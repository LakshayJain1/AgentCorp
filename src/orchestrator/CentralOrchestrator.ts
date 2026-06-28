import { useGameStore } from '@/store/gameStore';
import { Agent, SubTask, WorkerRole, StreamEvent } from '@/agents/AgentTypes';
import { PlannerAgent } from './PlannerAgent';
import { TaskQueue } from './TaskQueue';
import { BaseWorkerAgent } from '@/agents/BaseWorkerAgent';
import { ValidatorAgent } from '@/agents/ValidatorAgent';
import { performanceTracker } from '@/hr/HRSystem';
import { MemoryStore } from '@/memory/MemoryStore';
import { ExecutionLogStream } from '@/execution/ExecutionLogStream';
import { processTasks } from '@/systems/TaskSystem';
import { DeveloperAgent } from '@/agents/DeveloperAgent';
import { QAAgent } from '@/agents/QAAgent';
import { ResearchAgent } from '@/agents/ResearchAgent';
import { classifyIntent } from '@/ai/IntentClassifier';
import { agentRuntime } from '@/runtime/AgentRuntime';

export class CentralOrchestrator {
  private planner: PlannerAgent;
  private taskQueue: TaskQueue;
  private validator: ValidatorAgent;
  private workers: BaseWorkerAgent[] = [];
  private memStore: MemoryStore;
  private logStream: ExecutionLogStream;
  private tickCounter = 0;
  private listeners: Set<(event: StreamEvent) => void> = new Set();

  constructor() {
    this.planner = new PlannerAgent();
    this.taskQueue = new TaskQueue();
    this.validator = new ValidatorAgent();
    this.memStore = new MemoryStore();
    this.logStream = new ExecutionLogStream();
    console.log('[AgentCorp] CentralOrchestrator constructed');
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
    console.log('[AgentCorp] initWorkers: agents count =', store.agents.length);
    for (const agent of store.agents) {
      if (agent.workerRole === 'developer') {
        this.workers.push(new DeveloperAgent(agent.id));
      } else if (agent.workerRole === 'qa_worker') {
        this.workers.push(new QAAgent(agent.id));
      } else if (agent.workerRole === 'research_worker') {
        this.workers.push(new ResearchAgent(agent.id));
      }
    }
    console.log('[AgentCorp] initWorkers: registered', this.workers.length, 'workers');
  }

  async handleUserRequest(request: string): Promise<void> {
    const store = useGameStore.getState();
    console.log('[AgentCorp] handleUserRequest received:', request);

    this.emit({
      type: 'log',
      data: { message: `User request received: "${request}"` },
      timestamp: Date.now(),
      streamId: `user_${Date.now()}`,
    });

    const intent = await classifyIntent(request);
    console.log('[AgentCorp] classified intent:', intent.type, intent.requiredKeys);

    if (intent.type === 'needs_credentials') {
      for (const key of intent.requiredKeys) {
        store.requestCredential(
          `intent_${Date.now()}`,
          key.reason,
          key.key,
          key.label,
        );
      }
      this.emit({
        type: 'log',
        data: { message: `Request requires credentials: ${intent.requiredKeys.map((k) => k.label).join(', ')}. Awaiting user input.` },
        timestamp: Date.now(),
        streamId: `intent_${Date.now()}`,
      });
    } else {
      console.log('[AgentCorp] adding task with title:', request);
      store.addTaskWithTitle(request);
      this.emit({
        type: 'log',
        data: { message: `Request classified as internal. Agents will work on it.` },
        timestamp: Date.now(),
        streamId: `intent_${Date.now()}`,
      });
    }
  }

  async tick(): Promise<void> {
    this.tickCounter++;
    const store = useGameStore.getState();

    if (store.tasks.length === 0) return;

    console.log('[AgentCorp] tick #' + this.tickCounter + ' — tasks:', store.tasks.map(t => ({ id: t.id, title: t.title.slice(0, 30), status: t.status, assignedTo: t.assignedTo })));

    // Run TaskSystem CEO/PM actions (pending → prioritized → assigned)
    await processTasks();

    // After TaskSystem actions, pick up tasks that are now "assigned" and process them
    const currentState = useGameStore.getState();
    for (const task of currentState.tasks) {
      if (task.status === 'assigned' && task.assignedTo && !task.deliverable) {
        console.log('[AgentCorp] detected assigned task without deliverable — starting agentRuntime.processTask:', task.id, task.title);
        // Don't await — let it run in background so tick loop continues
        agentRuntime.processTask(task).catch(err => {
          console.error('[AgentCorp] agentRuntime.processTask failed:', err);
        });
      }
    }

    await this.planner.processPendingTasks();

    await this.taskQueue.dispatchReadyJobs(this.workers);

    for (const worker of this.workers) {
      await worker.tick();
    }

    await this.validator.processQueuedValidations();

    if (this.tickCounter % 10 === 0) {
      await this.processCompletedItems();
    }

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

  async onSubtaskComplete(subtask: SubTask, agent: Agent): Promise<void> {
    const store = useGameStore.getState();
    console.log('[AgentCorp] onSubtaskComplete:', subtask.id, agent.id);

    store.updateAgent(agent.id, {
      currentSubTaskId: null,
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
        store.updateAgent(agent.id, {});
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

    console.log('[AgentCorp] processCompletedItems:', validated.length, 'validations');

    for (const validation of validated) {
      const subtask = validation.subtask;
      const passed = validation.result.passed;

      store.updateSubtaskStatus(subtask.id, passed ? 'completed' : 'failed');
      store.updateSubtaskValidation(subtask.id, validation.result);

      if (!passed) {
        const storeNow = useGameStore.getState();
        const agent = storeNow.agents.find((a) => a.id === subtask.assignedAgentId);
        if (agent && validation.result.retryCount < 3) {
          store.updateAgent(agent.id, {
            currentSubTaskId: subtask.id,
          });
          this.taskQueue.reEnqueue(subtask, validation.result.details);
          this.emit({
            type: 'log',
            data: { message: `Subtask "${subtask.description.slice(0, 40)}..." re-queued for retry #${validation.result.retryCount}` },
            timestamp: Date.now(),
            streamId: `retry_${subtask.id}`,
          });
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
}

export const centralOrchestrator = new CentralOrchestrator();
