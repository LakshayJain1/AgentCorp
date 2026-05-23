import { useGameStore } from '@/store/gameStore';
import { Agent, AgentFSMState, AGENT_FSM_TRANSITIONS, Task, SubTask, WorkerRole, StreamEvent, ExecutionStreamChunk } from '@/agents/AgentTypes';
import { PlannerAgent } from './PlannerAgent';
import { TaskQueue } from './TaskQueue';
import { BaseWorkerAgent } from '@/agents/BaseWorkerAgent';
import { ValidatorAgent } from '@/agents/ValidatorAgent';
import { performanceTracker } from '@/hr/HRSystem';
import { MemoryStore } from '@/memory/MemoryStore';
import { VectorMemory } from '@/memory/VectorMemory';
import { ExecutionLogStream } from '@/execution/ExecutionLogStream';
import { processTasks } from '@/systems/TaskSystem';
import { DeveloperAgent } from '@/agents/DeveloperAgent';
import { QAAgent } from '@/agents/QAAgent';
import { ResearchAgent } from '@/agents/ResearchAgent';

export class CentralOrchestrator {
  private planner: PlannerAgent;
  private taskQueue: TaskQueue;
  private validator: ValidatorAgent;
  private workers: BaseWorkerAgent[] = [];
  private memStore: MemoryStore;
  private vectorMem: VectorMemory;
  private logStream: ExecutionLogStream;
  private tickCounter = 0;
  private listeners: Set<(event: StreamEvent) => void> = new Set();

  constructor() {
    this.planner = new PlannerAgent();
    this.taskQueue = new TaskQueue();
    this.validator = new ValidatorAgent();
    this.memStore = new MemoryStore();
    this.vectorMem = new VectorMemory();
    this.logStream = new ExecutionLogStream();
  }

  onEvent(cb: (event: StreamEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(event: StreamEvent): void {
    for (const cb of this.listeners) cb(event);
  }

  registerWorker(worker: BaseWorkerAgent): void {
    this.workers.push(worker);
  }

  initWorkers(): void {
    this.workers = [];
    const store = useGameStore.getState();
    for (const agent of store.agents) {
      if (agent.workerRole === 'developer') {
        this.workers.push(new DeveloperAgent(agent.id));
      } else if (agent.workerRole === 'qa_worker') {
        this.workers.push(new QAAgent(agent.id));
      } else if (agent.workerRole === 'research_worker') {
        this.workers.push(new ResearchAgent(agent.id, this.memStore));
      }
    }
    console.log(`[ORCHESTRATOR] Registered ${this.workers.length} workers`);
  }

  async tick(): Promise<void> {
    this.tickCounter++;
    const store = useGameStore.getState();

    // Phase 1: Process pending tasks through CEO/PM lifecycle (pending → prioritized → assigned)
    await processTasks();

    // Phase 2: Plan assigned tasks into subtasks
    await this.planner.processPendingTasks();

    // Phase 3: Dispatch subtasks to available workers
    await this.taskQueue.dispatchReadyJobs(this.workers);

    // Phase 4: Run worker ticks
    for (const worker of this.workers) {
      await worker.tick();
    }

    // Phase 5: Run validator on completed subtasks
    await this.validator.processQueuedValidations();

    // Phase 6: Process completed validations
    if (this.tickCounter % 10 === 0) {
      await this.processCompletedItems();
    }

    // Random HR evaluation (~once every 200 ticks on average)
    if (Math.random() < 0.005) {
      const hrAgent = store.agents.find((a) => a.role === 'hr' && a.online);
      if (hrAgent) {
        await performanceTracker.evaluateTeam(hrAgent);
      }
    }

    if (this.tickCounter % 60 === 0) {
      await this.memStore.persist();
    }
  }

  async handleUserRequest(request: string): Promise<void> {
    const store = useGameStore.getState();
    store.addTaskWithTitle(request);
    this.emit({
      type: 'log',
      data: { message: `User request queued: "${request}"` },
      timestamp: Date.now(),
      streamId: `user_${Date.now()}`,
    });
  }

  async onSubtaskComplete(subtask: SubTask, agent: Agent): Promise<void> {
    const store = useGameStore.getState();

    store.updateAgent(agent.id, {
      currentSubTaskId: null,
      fsmState: 'reviewing' as AgentFSMState,
    });

    this.emit({
      type: 'subtask',
      data: { subtaskId: subtask.id, status: 'completed', agentId: agent.id },
      timestamp: Date.now(),
      streamId: `sub_${subtask.id}`,
    });

    this.logStream.push({
      taskId: subtask.parentTaskId,
      subtaskId: subtask.id,
      agentId: agent.id,
      type: 'complete',
      message: `Subtask "${subtask.description.slice(0, 60)}" completed`,
      timestamp: Date.now(),
    });

    if (subtask.type === 'code' || subtask.type === 'qa') {
      this.validator.enqueueValidation(subtask);
    }

    const parentTask = store.tasks.find((t) => t.id === subtask.parentTaskId);
    if (parentTask) {
      const allDone = parentTask.subtasks.every((s) => s.status === 'completed' || s.status === 'failed');
      if (allDone) {
        const hasFailures = parentTask.subtasks.some((s) => s.status === 'failed');
        performanceTracker.recordTaskComplete(agent.id, Date.now() - subtask.createdAt);
        store.updateAgent(agent.id, {
          fsmState: 'completed' as AgentFSMState,
        });
        this.emit({
          type: 'status',
          data: { taskId: parentTask.id, status: hasFailures ? 'partial' : 'completed' },
          timestamp: Date.now(),
          streamId: `task_${parentTask.id}`,
        });
      }
    }
  }

  private async processCompletedItems(): Promise<void> {
    const store = useGameStore.getState();
    const validated = this.validator.getCompletedValidations();

    for (const validation of validated) {
      const subtask = validation.subtask;
      const passed = validation.result.passed;

      store.updateSubtaskStatus(subtask.id, passed ? 'completed' : 'failed');
      store.updateSubtaskValidation(subtask.id, validation.result);

      if (passed) {
        await this.vectorMem.store({
          id: `mem_${Date.now()}`,
          vector: [],
          metadata: { type: 'validation_pass', taskId: subtask.parentTaskId },
          content: `Subtask passed validation: ${subtask.description}`,
          timestamp: Date.now(),
        });
      } else {
        const storeNow = useGameStore.getState();
        const agent = storeNow.agents.find((a) => a.id === subtask.assignedAgentId);
        if (agent && validation.result.retryCount < 3) {
          store.updateAgent(agent.id, {
            fsmState: 'debugging' as AgentFSMState,
            currentSubTaskId: subtask.id,
          });
          this.taskQueue.reEnqueue(subtask, validation.result.details);
          this.emit({
            type: 'log',
            data: { message: `Subtask "${subtask.description.slice(0, 40)}..." re-queued for retry #${validation.result.retryCount}` },
            timestamp: Date.now(),
            streamId: `retry_${subtask.id}`,
          });
          // Trigger HR evaluation on failure
          const hrAgent = storeNow.agents.find((a) => a.role === 'hr' && a.online);
          if (hrAgent && Math.random() < 0.3) {
            await performanceTracker.evaluateTeam(hrAgent);
          }
        } else if (agent) {
          // All retries exhausted — trigger HR evaluation
          performanceTracker.recordTaskFailure(agent.id);
          const hrAgent = storeNow.agents.find((a) => a.role === 'hr' && a.online);
          if (hrAgent) {
            await performanceTracker.evaluateTeam(hrAgent);
          }
        }
      }
    }
  }

  getLogStream(): ExecutionLogStream {
    return this.logStream;
  }

  getMemoryStore(): MemoryStore {
    return this.memStore;
  }

  getVectorMemory(): VectorMemory {
    return this.vectorMem;
  }

  getTaskQueue(): TaskQueue {
    return this.taskQueue;
  }

  getPlanner(): PlannerAgent {
    return this.planner;
  }

  getValidator(): ValidatorAgent {
    return this.validator;
  }
}

export const centralOrchestrator = new CentralOrchestrator();
