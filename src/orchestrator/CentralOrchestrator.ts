import { useGameStore } from '@/store/gameStore';
import { Agent, AgentActivity, SubTask, StreamEvent, Task } from '@/agents/AgentTypes';
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
import { classifyIntent, formatTicketTitle } from '@/ai/IntentClassifier';
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

  async handleUserRequest(request: string, history?: { role: 'user' | 'agent'; text: string }[]): Promise<void> {
    const store = useGameStore.getState();
    console.log('[AgentCorp] handleUserRequest received:', request);

    this.emit({
      type: 'log',
      data: { message: `User request received: "${request}"` },
      timestamp: Date.now(),
      streamId: `user_${Date.now()}`,
    });

    // ── @mention routing ────────────────────────────────────────────────────
    const mentionMatch = request.match(/@([a-zA-Z]+)/);
    if (mentionMatch) {
      const mentionedName = mentionMatch[1].toLowerCase();
      const mentionedAgent = store.agents.find(
        (a) => a.name.toLowerCase() === mentionedName || a.name.toLowerCase().startsWith(mentionedName),
      );
      if (mentionedAgent) {
        const messageText = request.replace(/@[a-zA-Z]+\s*/g, '').trim() || `Hey ${mentionedAgent.name}, how are you?`;
        const personalities = AGENT_PERSONALITIES();
        const traits = personalities[mentionedAgent.role] || personalities.engineer;
        const historyBlock = history && history.length > 0
          ? `\nRecent conversation:\n${history.map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`).join('\n')}\n`
          : '';

        // Classify the stripped message to decide chat vs task
        const mentionIntent = await classifyIntent(messageText, history);
        const canExecute = mentionedAgent.workerRole !== null; // ceo/pm/hr cannot execute

        if (mentionIntent.type !== 'chat' && mentionIntent.type !== 'needs_credentials') {
          // ── TASK intent ───────────────────────────────────────────────────
          if (canExecute) {
            // Agent can do this work — create task and force it to them
            const ticketTitle = mentionIntent.ticketTitle || formatTicketTitle(messageText);
            store.addTaskWithTitle(ticketTitle, undefined, messageText);
            const newTask = [...useGameStore.getState().tasks].reverse().find((t) => t.title === ticketTitle);

            // Acknowledge in chat
            const ackPrompt = `${historyBlock}The user asked you directly: "${messageText}". You accepted the task. Respond briefly in character as ${mentionedAgent.name} (${mentionedAgent.role}), confirming you're on it. One sentence.`;
            const ackReply = await aiService.askAgent(mentionedAgent.role, mentionedAgent.name, traits, ackPrompt);
            store.sendMessage(mentionedAgent.id, mentionedAgent.id, ackReply.content || `On it! I'll get "${ticketTitle}" done right away.`);
            store.pushAgentActivity(mentionedAgent.id, {
              id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              agentId: mentionedAgent.id, type: 'thinking',
              message: `Working on: ${ticketTitle}`, timestamp: Date.now(),
            });

            if (newTask) this.executeDirectTask(newTask, mentionedAgent.id);
          } else {
            // Agent cannot execute — delegate to the right worker
            const ROLE_DELEGATES: Record<string, string> = {
              ceo: 'engineer', pm: 'engineer', hr: 'engineer',
            };
            const delegateRole = ROLE_DELEGATES[mentionedAgent.role] || 'engineer';
            const delegateAgent = store.agents.find((a) => a.role === delegateRole && a.online)
              ?? store.agents.find((a) => a.workerRole !== null && a.online);

            const ticketTitle = mentionIntent.ticketTitle || formatTicketTitle(messageText);
            store.addTaskWithTitle(ticketTitle, undefined, messageText);
            const newTask = [...useGameStore.getState().tasks].reverse().find((t) => t.title === ticketTitle);

            // Mentioned agent acknowledges + delegates
            const delegateName = delegateAgent?.name ?? 'the team';
            const delegatePrompt = `${historyBlock}The user asked you: "${messageText}". That's outside your area (you are ${mentionedAgent.role}). Briefly acknowledge their request, explain you're delegating it to ${delegateName} who is better suited, and that it's been added to the task queue. Stay in character as ${mentionedAgent.name}. One to two sentences.`;
            const delegateReply = await aiService.askAgent(mentionedAgent.role, mentionedAgent.name, traits, delegatePrompt);
            store.sendMessage(mentionedAgent.id, mentionedAgent.id, delegateReply.content || `That's a bit outside my lane — routing "${ticketTitle}" to ${delegateName} who'll handle it!`);
            store.pushAgentActivity(mentionedAgent.id, {
              id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              agentId: mentionedAgent.id, type: 'communicating',
              message: `Delegated: ${ticketTitle}`, timestamp: Date.now(),
            });

            if (newTask && delegateAgent) this.executeDirectTask(newTask, delegateAgent.id);
            else if (newTask) this.executeDirectTask(newTask);
          }
          this.emit({
            type: 'log',
            data: { message: `@mention task: "${mentionedAgent.name}" ${canExecute ? 'executing' : 'delegating'}.` },
            timestamp: Date.now(), streamId: `mention_${Date.now()}`,
          });
        } else {
          // ── CHAT intent — agent replies conversationally ──────────────────
          const prompt = `${historyBlock}The user is talking directly to you. Respond in character as ${mentionedAgent.name} (${mentionedAgent.role}). Keep it conversational and concise.\n\nUser: ${messageText}`;
          const aiReply = await aiService.askAgent(mentionedAgent.role, mentionedAgent.name, traits, prompt);
          const reply = aiReply.content || `Hey! I'm ${mentionedAgent.name}. How can I help?`;
          store.sendMessage(mentionedAgent.id, mentionedAgent.id, reply);
          store.pushAgentActivity(mentionedAgent.id, {
            id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            agentId: mentionedAgent.id, type: 'communicating',
            message: reply, timestamp: Date.now(),
          });
          this.emit({
            type: 'log',
            data: { message: `@mention chat: ${mentionedAgent.name} responded.` },
            timestamp: Date.now(), streamId: `mention_${Date.now()}`,
          });
        }
        return;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const intent = await classifyIntent(request, history);
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

    const ticketTitle = intent.ticketTitle || formatTicketTitle(request);
    const pm = store.agents.find((a) => a.role === 'pm');
    const ceo = store.agents.find((a) => a.role === 'ceo');

    if (pm) {
      store.pushAgentActivity(pm.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: pm.id,
        type: 'thinking',
        message: `Triaging ticket: "${ticketTitle}" (${intent.type})`,
        timestamp: Date.now(),
      });
    }

    if (intent.type === 'needs_credentials') {
      // Add the task with clean ticket title and detailed user request in description
      console.log('[AgentCorp] PM creating task with title:', ticketTitle);
      store.addTaskWithTitle(ticketTitle, undefined, request);
      const newTask = useGameStore.getState().tasks[useGameStore.getState().tasks.length - 1];
      const taskId = newTask?.id;

      if (pm && ceo) {
        store.sendMessage(pm.id, ceo.id, `Ticket "${ticketTitle}" requires external credentials (${intent.requiredKeys.map((k) => k.label).join(', ')}). Awaiting credentials.`);
      }

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
        data: { message: `Ticket "${ticketTitle}" requires credentials: ${intent.requiredKeys.map((k) => k.label).join(', ')}. Awaiting user input.` },
        timestamp: Date.now(),
        streamId: `intent_${Date.now()}`,
      });
    } else {
      console.log('[AgentCorp] PM creating task with title:', ticketTitle);
      store.addTaskWithTitle(ticketTitle, undefined, request);

      if (pm && ceo) {
        store.sendMessage(pm.id, ceo.id, `Created ticket "${ticketTitle}". Assigning to development.`);
      }

      this.emit({
        type: 'log',
        data: { message: `PM triaged ticket: "${ticketTitle}". Classified as internal.` },
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
   * Post a visible agent-to-agent message in the chat feed and push an activity.
   */
  private agentSay(fromId: string, toId: string, message: string, activityType: AgentActivity['type'] = 'communicating'): void {
    const store = useGameStore.getState();
    store.sendMessage(fromId, toId, message);
    store.pushAgentActivity(fromId, {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId: fromId,
      type: activityType,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Occasionally has PM push back on a task before execution (agent disagreement).
   */
  private async maybePushback(pm: Agent | undefined, worker: Agent, taskShort: string): Promise<void> {
    if (!pm || Math.random() > 0.25) return;
    const lines = [
      `Heads up ${worker.name} — "${taskShort}" looks complex. Flag me if scope creeps.`,
      `Quick note: "${taskShort}" is ambitious. Start lean and we'll iterate.`,
      `${worker.name}, just checking — is "${taskShort}" scoped tightly enough? Ping me if you need to break it down.`,
    ];
    this.agentSay(pm.id, worker.id, lines[Math.floor(Math.random() * lines.length)], 'communicating');
    await new Promise((r) => setTimeout(r, 300));
  }

  /**
   * PM-driven sprint planning: generates and kicks off 4 tasks based on company context.
   */
  async runSprintPlanning(): Promise<void> {
    const store = useGameStore.getState();
    const pm = store.agents.find((a) => a.role === 'pm');
    const ceo = store.agents.find((a) => a.role === 'ceo');
    if (!pm || !ceo) return;

    const { companyName, companyProduct } = store;
    this.agentSay(pm.id, ceo.id, `Starting sprint planning for ${companyName || 'the team'}! Generating this week's priorities… 📋`, 'thinking');

    let sprintTasks: string[] = [];

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a Product Manager running sprint planning for ${companyName || 'a startup'}, building "${companyProduct || 'a product'}".
Generate exactly 4 concrete sprint tasks that are specific, actionable, and realistic for one week.
Return ONLY a JSON array of task title strings — no explanation, no markdown.
Example: ["Build user dashboard UI", "Write API endpoint tests", "Document onboarding flow", "Fix login edge case"]`,
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content?: string };
        if (data.content) {
          const match = data.content.match(/\[[\s\S]*?\]/);
          if (match) {
            const parsed = JSON.parse(match[0]) as unknown[];
            sprintTasks = parsed.filter((t): t is string => typeof t === 'string' && t.length > 5).slice(0, 5);
          }
        }
      }
    } catch { /* fall through to defaults */ }

    if (sprintTasks.length === 0) {
      const base = companyProduct || 'the product';
      sprintTasks = [
        `Analyze ${base} performance bottlenecks`,
        `Document ${base} API endpoints`,
        `Write ${base} user onboarding guide`,
        `Review ${base} security and error handling`,
      ];
    }

    for (const title of sprintTasks) {
      store.addTaskWithTitle(title);
    }

    // Stagger execution so agents don't all race at once
    const freshTasks = useGameStore.getState().tasks.slice(-sprintTasks.length);
    for (let i = 0; i < freshTasks.length; i++) {
      const t = freshTasks[i];
      setTimeout(() => {
        this.executeDirectTask(t).catch((err) => console.error('[AgentCorp] sprint task failed:', err));
      }, i * 3000);
    }

    this.agentSay(
      pm.id, ceo.id,
      `Sprint kicked off! ${sprintTasks.length} tasks queued: ${sprintTasks.map((t) => `"${t.slice(0, 28)}"`).join(', ')}. Team is on it 🚀`,
      'communicating',
    );
  }

  /**
   * Execute a task directly using AI, bypassing the full CEO/PM/Planner pipeline.
   * Used for user-created tasks that should be handled immediately.
   */
  private async executeDirectTask(task: Task, forcedWorkerId?: string): Promise<void> {
    console.log('[AgentCorp] executeDirectTask called for:', task.id, task.title);
    const store = useGameStore.getState();

    // Use the forced agent if provided, otherwise find best available worker
    const workerAgent = forcedWorkerId
      ? store.agents.find((a) => a.id === forcedWorkerId)
      : store.agents.find((a) =>
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

    const pm = store.agents.find((a) => a.role === 'pm');
    const ceo = store.agents.find((a) => a.role === 'ceo');
    const short = task.title.length > 55 ? `${task.title.slice(0, 55)}…` : task.title;

    this.emit({
      type: 'log',
      data: { message: `Direct execution: ${workerAgent.name} (${workerAgent.role}) working on "${task.title}"` },
      timestamp: Date.now(),
      streamId: `direct_${task.id}`,
    });

    // ── Stage 1: Assign — PM hands task to worker, worker acknowledges ──────
    store.updateAgent(workerAgent.id, { currentTaskId: task.id, workStatus: 'thinking', mood: 'focused' });
    store.updateTask(task.id, { status: 'in_progress', assignedTo: workerAgent.id });

    if (pm) {
      this.agentSay(pm.id, workerAgent.id, `Hey ${workerAgent.name}, you're up! Working on: "${short}".`, 'communicating');
    }
    this.agentSay(workerAgent.id, pm?.id ?? workerAgent.id, `On it! Starting "${short}" now — I'll keep you posted.`, 'thinking');

    await this.maybePushback(pm, workerAgent, short);

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
      const deliverableType = task.deliverableType || 'code';
      const deliverableLang = task.deliverableLang;
      const prompt = (task.description && task.description.length > task.title.length)
        ? task.description
        : task.title;

      // ── Stage 2: Working ─────────────────────────────────────────────────
      store.updateAgent(workerAgent.id, { workStatus: 'coding' });
      this.agentSay(workerAgent.id, pm?.id ?? workerAgent.id, `Working through "${short}"… making solid progress.`, 'coding');

      const content = await aiService.generateDeliverable(prompt, deliverableType, deliverableLang);

      if (content && content.length > 50) {
        // ── Stage 3: Review — brief pause before marking complete ────────────
        store.updateTask(task.id, { status: 'review' });
        store.updateAgent(workerAgent.id, { workStatus: 'reviewing' });
        this.agentSay(workerAgent.id, pm?.id ?? workerAgent.id, `Done with "${short}"! Giving it a final review before I hand it off.`, 'reviewing');

        await new Promise((resolve) => setTimeout(resolve, 800));

        // ── Stage 4: Complete ────────────────────────────────────────────────
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

        if (pm) {
          this.agentSay(pm.id, ceo?.id ?? pm.id, `${workerAgent.name} just wrapped up "${short}". Deliverable is live in the projects folder! ✅`, 'communicating');
        }

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

      if (pm) {
        this.agentSay(pm.id, ceo?.id ?? pm.id, `Heads up — ${workerAgent.name} hit a blocker on "${short}". Task failed.`, 'communicating');
      }

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
