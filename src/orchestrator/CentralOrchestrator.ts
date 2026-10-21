import { useGameStore } from '@/store/gameStore';
import { Agent, SubTask, StreamEvent, Task } from '@/agents/AgentTypes';
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
import { SalesAgent } from '@/agents/SalesAgent';
import { FinanceAgent } from '@/agents/FinanceAgent';
import { OpsAgent } from '@/agents/OpsAgent';
import { classifyIntent } from '@/ai/IntentClassifier';
import { LoopOrchestrator } from './LoopOrchestrator';
import { aiService } from '@/ai/AIService';
import { AGENT_PERSONALITIES } from '@/ai/AgentPersonalities';
import { announceTaskHandoff } from '@/systems/ConversationSystem';

export class CentralOrchestrator {
  private planner: PlannerAgent;
  private taskQueue: TaskQueue;
  private validator: ValidatorAgent;
  private workers: BaseWorkerAgent[] = [];
  private memStore: MemoryStore;
  private logStream: ExecutionLogStream;
  private loopOrchestrator: LoopOrchestrator;
  private tickCounter = 0;
  private listeners: Set<(event: StreamEvent) => void> = new Set();

  constructor(storeAccessor?: () => { tasks: ReturnType<typeof useGameStore.getState>['tasks']; agents: ReturnType<typeof useGameStore.getState>['agents'] }) {
    this.planner = new PlannerAgent();
    this.taskQueue = new TaskQueue();
    this.validator = new ValidatorAgent();
    this.memStore = new MemoryStore();
    this.loopOrchestrator = new LoopOrchestrator({
      goal: 'Autonomous task completion via phased loop',
      successCriteria: 'All tasks completed, tsc+build pass',
      memStore: this.memStore,
      // Headless seam: phases read via injected accessor; defaults to Zustand snapshot.
      storeAccessor: storeAccessor ?? (() => {
        const s = useGameStore.getState();
        return { tasks: s.tasks, agents: s.agents };
      }),
    });
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
      } else if (agent.workerRole === 'sales_worker') {
        this.workers.push(new SalesAgent(agent.id));
      } else if (agent.workerRole === 'finance_worker') {
        this.workers.push(new FinanceAgent(agent.id));
      } else if (agent.workerRole === 'ops_worker') {
        this.workers.push(new OpsAgent(agent.id));
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

    if (intent.type === 'chat') {
      // Conversational message — CEO replies directly in the chat panel, no task spawned
      const ceo = store.agents.find((a) => a.role === 'ceo');
      const pm = store.agents.find((a) => a.role === 'pm');
      if (ceo) {
        const replyTarget = pm?.id ?? ceo.id;
        store.sendMessage(ceo.id, replyTarget, intent.chatReply || `Hey! I'm Alex, your CEO. Tell me what you need built and I'll get the team on it.`);
        store.pushAgentActivity(ceo.id, {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: ceo.id,
          type: 'communicating',
          message: intent.chatReply || 'Chatting with user',
          timestamp: Date.now(),
        });
      }
      this.emit({
        type: 'log',
        data: { message: `Conversational message — CEO responded directly.` },
        timestamp: Date.now(),
        streamId: `chat_${Date.now()}`,
      });
      return;
    }

    if (intent.type === 'needs_credentials') {
      // Add the task first so it exists in the store before requesting credentials
      console.log('[AgentCorp] adding task first:', request);
      store.addTaskWithTitle(request);
      const newTask = useGameStore.getState().tasks[useGameStore.getState().tasks.length - 1];
      const taskId = newTask?.id;

      for (const key of intent.requiredKeys) {
        store.requestCredential(
          taskId || `intent_${Date.now()}`,
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
      // Process internal tasks directly (bypass CEO/PM/Planner for simple requests)
      const newTask = useGameStore.getState().tasks[useGameStore.getState().tasks.length - 1];
      if (newTask) {
        this.executeDirectTask(newTask).catch(err => {
          console.error('[AgentCorp] direct task execution failed:', err);
        });
      }
    }
  }

  async tick(): Promise<void> {
    this.tickCounter++;
    const store = useGameStore.getState();

    if (store.tasks.length === 0) return;

    console.log('[AgentCorp] tick #' + this.tickCounter + ' — tasks:', store.tasks.map(t => ({ id: t.id, title: t.title.slice(0, 30), status: t.status, assignedTo: t.assignedTo })));

    // Run TaskSystem CEO/PM actions (pending → prioritized → assigned)
    await processTasks();

    await this.planner.processPendingTasks();

    // Enqueue any store subtasks that are still pending (planner creates them
    // in the store; the queue is the dispatch mechanism — without this step
    // workers never receive work).
    {
      const s = useGameStore.getState();
      for (const t of s.tasks) {
        for (const sub of t.subtasks) {
          if (sub.status === 'pending') {
            this.taskQueue.enqueue(sub, sub.estimatedEffort ?? 0);
          }
        }
      }
    }

    await this.taskQueue.dispatchReadyJobs(this.workers);

    for (const worker of this.workers) {
      await worker.tick();
    }

    // Reconcile finished workers: BaseWorkerAgent marks the subtask
    // completed/failed in the store but never frees itself, so without this
    // each worker wedges after exactly one subtask and validation never runs.
    for (const worker of this.workers) {
      const cur = worker.getCurrentSubtask();
      if (!cur) continue;
      const fresh = useGameStore.getState().tasks
        .flatMap((t) => t.subtasks)
        .find((st) => st.id === cur.id);
      if (!fresh || (fresh.status !== 'completed' && fresh.status !== 'failed')) continue;
      worker.cancelCurrentTask();
      this.taskQueue.markComplete(fresh.id);
      const st2 = useGameStore.getState();
      const agent = st2.agents.find((a) => a.id === worker.id);
      if (!agent) continue;
      if (fresh.status === 'completed') {
        await this.onSubtaskComplete(fresh, agent);
      } else {
        st2.updateAgent(agent.id, { currentSubTaskId: null });
      }
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
      // Task-grounded handoff: worker → PM about this subtask (never random chatter)
      const pm = store.agents.find((a) => a.role === 'pm');
      if (pm && pm.id !== agent.id) {
        announceTaskHandoff(agent.id, pm.id, parentTask.title, 'subtask_complete');
      }
      const allDone = parentTask.subtasks.every((s) => s.status === 'completed' || s.status === 'failed');
      if (allDone) {
        const hasFailures = parentTask.subtasks.some((s) => s.status === 'failed');
        performanceTracker.recordTaskComplete(agent.id, Date.now() - subtask.createdAt);
        store.updateAgent(agent.id, {});
        // Deliverable-ready handoff to the user-facing channel via PM
        if (pm && pm.id !== agent.id) {
          announceTaskHandoff(agent.id, pm.id, parentTask.title, 'deliverable_ready');
        }
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
        // Outer loop budget governs the inner QA-reject retry: escalate after 2 build-verify cycles
        // even if the legacy retryCount (<3) would allow another attempt.
        const verdict = this.loopOrchestrator.recordBuildVerifyCycle();
        if (verdict === 'escalate') {
          this.emit({
            type: 'log',
            data: { message: `Subtask "${subtask.description.slice(0, 40)}..." escalated: build-verify budget exhausted` },
            timestamp: Date.now(),
            streamId: `escalate_${subtask.id}`,
          });
          continue;
        }
        if (agent && validation.result.retryCount < 3) {
          store.updateAgent(agent.id, {
            currentSubTaskId: subtask.id,
          });
          this.taskQueue.reEnqueue(subtask, validation.result.details);
          const parent = storeNow.tasks.find((t) => t.id === subtask.parentTaskId);
          const pm = storeNow.agents.find((a) => a.role === 'pm');
          if (parent && pm && pm.id !== agent.id) {
            announceTaskHandoff(agent.id, pm.id, parent.title, 'validation_retry');
          }
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

  getLoopSnapshot(): { phase: string; cycles: number; blocked: string | null } {
    return this.loopOrchestrator.snapshot();
  }

  getLogStream(): ExecutionLogStream {
    return this.logStream;
  }

  getMemoryStore(): MemoryStore {
    return this.memStore;
  }

  /**
   * Execute a task directly using AI, bypassing the full CEO/PM/Planner pipeline.
   * Used for user-created tasks that should be handled immediately.
   */
  private async executeDirectTask(task: Task): Promise<void> {
    console.log('[AgentCorp] executeDirectTask called for:', task.id, task.title);
    const store = useGameStore.getState();

    // Find the best available worker agent for this task
    const workerAgent = store.agents.find((a) =>
      a.online &&
      (a.workerRole === 'developer' || a.workerRole === 'research_worker' || a.workerRole === 'qa_worker'
        || a.workerRole === 'sales_worker' || a.workerRole === 'finance_worker' || a.workerRole === 'ops_worker')
    );

    if (!workerAgent) {
      console.warn('[AgentCorp] No available worker agent for direct task');
      this.emit({
        type: 'log',
        data: { message: `No available worker for task "${task.title}"` },
        timestamp: Date.now(),
        streamId: `direct_${task.id}`,
      });
      store.failTask(task.id);
      return;
    }

    this.emit({
      type: 'log',
      data: { message: `Direct execution: ${workerAgent.name} (${workerAgent.role}) working on "${task.title}"` },
      timestamp: Date.now(),
      streamId: `direct_${task.id}`,
    });

    // Update agent status
    store.updateAgent(workerAgent.id, {
      currentTaskId: task.id,
      workStatus: 'thinking',
      mood: 'focused',
    });
    store.updateTask(task.id, { status: 'in_progress', assignedTo: workerAgent.id });

    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startTs = Date.now();

    store.addTaskExecutionLog(task.id, {
      id: logId,
      taskId: task.id,
      agentId: workerAgent.id,
      action: `Started "${task.title}"`,
      tool: 'generateDeliverable',
      input: task.title,
      output: '',
      duration: 0,
      timestamp: startTs,
      status: 'running',
    });

    try {
      // Use AIService to generate deliverable directly
      const personalities = AGENT_PERSONALITIES();
      const personality = personalities[workerAgent.role];
      const deliverableType = task.deliverableType || 'code';
      const deliverableLang = task.deliverableLang || 'typescript';

      const content = await aiService.generateDeliverable(task.title, deliverableType, deliverableLang);

      if (content && content.length > 50) {
        // Success - store deliverable and complete task
        store.updateTask(task.id, { deliverable: content });
        store.addDeliverableProject({
          id: `project_${Date.now()}`,
          taskId: task.id,
          title: task.title,
          type: deliverableType,
          lang: deliverableLang,
          content,
          createdAt: Date.now(),
          completedBy: workerAgent.id,
        });
        store.completeTask(task.id);
        store.updateAgent(workerAgent.id, { currentTaskId: null, workStatus: 'idle', mood: 'happy' });

        store.addTaskExecutionLog(task.id, {
          id: `${logId}_done`,
          taskId: task.id,
          agentId: workerAgent.id,
          action: `Completed "${task.title}"`,
          tool: 'generateDeliverable',
          input: task.title,
          output: `${content.length} chars — ${deliverableType}${deliverableLang ? ` (${deliverableLang})` : ''}`,
          duration: Date.now() - startTs,
          timestamp: Date.now(),
          status: 'success',
        });

        this.emit({
          type: 'log',
          data: { message: `Task "${task.title}" completed by ${workerAgent.name}` },
          timestamp: Date.now(),
          streamId: `direct_${task.id}`,
        });

        this.logStream.push({
          taskId: task.id,
          subtaskId: `direct_${task.id}`,
          agentId: workerAgent.id,
          type: 'complete',
          message: `Direct task completed (${content.length} chars)`,
          timestamp: Date.now(),
        });
      } else {
        throw new Error('Empty or too short deliverable');
      }
    } catch (err) {
      console.error('[AgentCorp] executeDirectTask failed:', err);
      store.failTask(task.id);
      store.updateAgent(workerAgent.id, { currentTaskId: null, workStatus: 'idle', mood: 'frustrated' });

      store.addTaskExecutionLog(task.id, {
        id: `${logId}_err`,
        taskId: task.id,
        agentId: workerAgent.id,
        action: `Failed "${task.title}"`,
        tool: 'generateDeliverable',
        input: task.title,
        output: String(err),
        duration: Date.now() - startTs,
        timestamp: Date.now(),
        status: 'error',
      });

      this.emit({
        type: 'log',
        data: { message: `Task "${task.title}" failed: ${err}` },
        timestamp: Date.now(),
        streamId: `direct_${task.id}`,
      });
    }
  }
}

export const centralOrchestrator = new CentralOrchestrator();
