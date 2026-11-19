import { useGameStore, setIntegrationResumeHandler } from '@/store/gameStore';
import { Agent, AgentActivity, AgentRole, DeliverableType, SubTask, StreamEvent, Task } from '@/agents/AgentTypes';
import { PlannerAgent } from './PlannerAgent';
import { splitTeamBrief, briefTopic, type TeamBrief } from './teamBrief';
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
import { classifyIntent, formatTicketTitle, invalidateConnectedProviders } from '@/ai/IntentClassifier';
import { routeCredentialKeys } from '@/ai/credentialRouting';
import { classifyTask } from '@/ai/TaskClassifier';
import { LoopOrchestrator } from './LoopOrchestrator';
import { MAX_VALIDATION_RETRIES } from './LoopTypes';
import { aiService, AIUnavailableError } from '@/ai/AIService';
import { AGENT_PERSONALITIES } from '@/ai/AgentPersonalities';
import { announceTaskHandoff } from '@/systems/ConversationSystem';
import { streamAI } from '@/ai/stream';
import { emitRun, publishFromChunk } from '@/engine/runBridge';
import { useRunStore, type CriterionResult } from '@/engine/runEvents';
import { runAgentLoop, type LoopResult, type LoopStatus } from '@/engine/AgentLoop';
import { resolveTools } from '@/engine/tools';
import { defaultBudget } from '@/engine/budget';
import { explainLoopBlocker } from '@/engine/desktopCaps';
import { modelAvailable } from '@/engine/model';
import { generateCriteria, verifyCriteria, verdictOf, failureFeedback, type Criterion, type VerifyDeps } from '@/engine/criteria';
import { registerRun, unregisterRun, setResumeHandler, discardInterruptedRun } from '@/engine/runControl';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, type LoopCheckpoint } from '@/engine/runPersistence';
import { detectExecutorEnv } from '@/execution/ToolExecutor';
import { aiFetch } from '@/ai/transport';
import { trimHistory } from '@/ai/history';
import { buildTeamContext } from '@/ai/teamContext';
import { searchWeb } from '@/engine/webSearch';
import { formatResultsForModel } from '@/lib/search';

/** How many times QA may send a finished loop back to the agent before flagging it for a human. */
const MAX_QA_RETRIES = 1;

/** Deliverable types that cite the market and so get a web search first, whoever writes them. */
const SOURCED_TYPES = new Set<string>(['research', 'analysis', 'gtm', 'campaign', 'icp']);

/** How each kind of teammate's part of a team brief is written. */
const PART_CLASSIFICATION: Record<string, { agentRole: AgentRole; deliverableType: DeliverableType; deliverableLang: string }> = {
  researcher: { agentRole: 'researcher', deliverableType: 'research', deliverableLang: 'markdown' },
  sales:      { agentRole: 'sales',      deliverableType: 'gtm',      deliverableLang: 'markdown' },
  finance:    { agentRole: 'finance',    deliverableType: 'report',   deliverableLang: 'markdown' },
  ops:        { agentRole: 'ops',        deliverableType: 'doc',      deliverableLang: 'markdown' },
  engineer:   { agentRole: 'engineer',   deliverableType: 'spec',     deliverableLang: 'markdown' },
  ceo:        { agentRole: 'ceo',        deliverableType: 'report',   deliverableLang: 'markdown' },
  pm:         { agentRole: 'pm',         deliverableType: 'doc',      deliverableLang: 'markdown' },
  hr:         { agentRole: 'hr',         deliverableType: 'doc',      deliverableLang: 'markdown' },
};

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
    // Pipeline (planner/queue) progress feeds the same run-event stream the chat reads.
    this.logStream.onChunk(publishFromChunk);
    setResumeHandler((taskId) => this.resumeRun(taskId));
    // A task that was waiting for an integration is unblocked: re-submit its original request so it is
    // classified again with the integration connected (an `action` can now actually run).
    setIntegrationResumeHandler((task) => {
      invalidateConnectedProviders(); // the 10s cache may still say "not connected"
      this.handleUserRequest(task.description || task.title).catch((err) =>
        console.error('[AgentCorp] resuming after integration connect failed:', err),
      );
    });
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
        const recentTurns = trimHistory(history, { maxMessages: 4, maxChars: 400 });
        const historyBlock = recentTurns.length > 0
          ? `\nRecent conversation:\n${recentTurns.map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`).join('\n')}\n`
          : '';

        // Classify the stripped message to decide chat vs task
        const mentionIntent = await classifyIntent(messageText, history);
        const canExecute = mentionedAgent.workerRole !== null; // ceo/pm/hr cannot execute

        if (mentionIntent.type === 'action') {
          // ── ACTION intent — invoke tool directly, no deliverable pipeline ──
          const ackPrompt = `The user asked you directly: "${messageText}". You are about to execute this action using your integration tools. Respond briefly in character as ${mentionedAgent.name} confirming you're on it. One sentence.`;
          const ackReply = await aiService.askAgent(mentionedAgent.role, mentionedAgent.name, traits, ackPrompt);
          store.sendMessage(mentionedAgent.id, mentionedAgent.id, ackReply.content || `On it!`);
          this.executeActionDirect(messageText, mentionedAgent.id).catch((err) =>
            console.error('[AgentCorp] executeActionDirect (@mention) failed:', err),
          );
          this.emit({
            type: 'log',
            data: { message: `@mention action: "${mentionedAgent.name}" executing via tool gateway.` },
            timestamp: Date.now(),
            streamId: `mention_${Date.now()}`,
          });
        } else if (mentionIntent.type !== 'chat' && mentionIntent.type !== 'needs_credentials') {
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
          const aiReply = await aiService.askAgent(mentionedAgent.role, mentionedAgent.name, traits, prompt, buildTeamContext(useGameStore.getState()));
          const reply = aiReply.content || `Hey! I'm ${mentionedAgent.name}. How can I help?`;
          this.reportToolCalls(mentionedAgent.id, aiReply.toolCalls ?? []);
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
        const personalities = AGENT_PERSONALITIES();
        const traits = personalities['ceo'] || personalities['engineer'];
        const recentTurns = trimHistory(history, { maxMessages: 4, maxChars: 400 });
        const historyBlock = recentTurns.length > 0
          ? `\nRecent conversation:\n${recentTurns.map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`).join('\n')}\n`
          : '';
        const chatPrompt = `${historyBlock}The user just said: "${request}"\n\nRespond in character as ${ceo.name}, CEO. You have full context of the conversation above including any agent results. Be concise and conversational. If the user is referencing something an agent just found or did, engage with that content directly.`;
        const aiReply = await aiService.askAgent('ceo', ceo.name, traits, chatPrompt, buildTeamContext(useGameStore.getState()));
        const replyText = aiReply.content || intent.chatReply || `Hey! I'm Alex, your CEO. Tell me what you need built and I'll get the team on it.`;
        store.sendMessage(ceo.id, replyTarget, replyText);
        store.pushAgentActivity(ceo.id, {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: ceo.id,
          type: 'communicating',
          message: replyText.slice(0, 80),
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

    if (intent.type === 'action') {
      const opsAgent = store.agents.find((a) => a.role === 'ops' && a.online)
        ?? store.agents.find((a) => a.workerRole !== null && a.online);
      if (opsAgent) {
        store.sendMessage(opsAgent.id, opsAgent.id, `On it — executing your request now.`);
      }
      this.emit({
        type: 'log',
        data: { message: `Action request detected — executing directly via tool gateway.` },
        timestamp: Date.now(),
        streamId: `action_${Date.now()}`,
      });
      this.executeActionDirect(request, opsAgent?.id).catch((err) =>
        console.error('[AgentCorp] executeActionDirect failed:', err),
      );
      return;
    }

    if (intent.type === 'needs_credentials') {
      // Add the task with clean ticket title and detailed user request in description
      console.log('[AgentCorp] PM creating task with title:', ticketTitle);
      const credClassification = await classifyTask(ticketTitle, request);
      store.addTaskWithTitle(ticketTitle, undefined, request, credClassification);
      const newTask = useGameStore.getState().tasks[useGameStore.getState().tasks.length - 1];
      const taskId = newTask?.id;

      // Integrations that live in the Integrations tab are connected there (OAuth), never pasted.
      // Only real secrets (cloud, database, Stripe...) get the paste prompt.
      const { integrations, secrets } = routeCredentialKeys(intent.requiredKeys, intent.connectedProviders ?? []);
      if (integrations.length > 0 && taskId) {
        store.requestIntegrations(taskId, integrations, secrets);
      } else if (secrets.length > 0) {
        if (pm && ceo) {
          store.sendMessage(pm.id, ceo.id, `Ticket "${ticketTitle}" requires external credentials (${secrets.map((k) => k.label).join(', ')}). Awaiting credentials.`);
        }
        // Ask one at a time: a single prompt slot, so the rest wait on the task.
        if (taskId) store.updateTask(taskId, { pendingSecrets: secrets.slice(1) });
        store.requestCredential(taskId || `intent_${Date.now()}`, secrets[0].reason, secrets[0].key, secrets[0].label);
      } else if (newTask) {
        // Everything the request named is already connected: nothing is missing, just do the work.
        this.executeDirectTask(newTask).catch((err) => {
          console.error('[AgentCorp] direct task execution failed:', err);
        });
      }
      this.emit({
        type: 'log',
        data: { message: `Ticket "${ticketTitle}" requires credentials: ${intent.requiredKeys.map((k) => k.label).join(', ')}. Awaiting user input.` },
        timestamp: Date.now(),
        streamId: `intent_${Date.now()}`,
      });
    } else {
      // A brief that hands work to several named teammates becomes one task per teammate, not one task for one agent.
      const team = splitTeamBrief(request, store.agents.map((a) => a.name));
      if (team) {
        this.emit({
          type: 'log',
          data: { message: `Team brief: splitting "${ticketTitle}" into ${team.parts.length} tasks (${team.parts.map((p) => p.agentName).join(', ')}).` },
          timestamp: Date.now(),
          streamId: `intent_${Date.now()}`,
        });
        void this.runTeamBrief(team, ticketTitle).catch((err) => console.error('[AgentCorp] team brief failed:', err));
        return;
      }

      console.log('[AgentCorp] PM creating task with title:', ticketTitle);
      const classification = await classifyTask(ticketTitle, request);
      store.addTaskWithTitle(ticketTitle, undefined, request, classification);

      if (pm && ceo) {
        store.sendMessage(pm.id, ceo.id, `Created ticket "${ticketTitle}". Routing to ${classification.agentRole} (${classification.deliverableType}).`);
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

  /**
   * Run a team brief: one task per named teammate, in order, each owned by that teammate. Parts run one after
   * another (not in parallel) to stay inside the provider's per-minute limits, and the synthesis part (the
   * go/no-go) goes last and is handed what the others wrote.
   */
  private async runTeamBrief(team: TeamBrief, projectTitle: string): Promise<void> {
    const store = useGameStore.getState();
    const pm = store.agents.find((a) => a.role === 'pm');
    const ceo = store.agents.find((a) => a.role === 'ceo');
    const topic = briefTopic(team.context);
    const owners = team.parts.map((p) => p.agentName).join(', ');
    if (pm && ceo) {
      store.sendMessage(pm.id, ceo.id, `Split "${projectTitle}" into ${team.parts.length} tasks, one per owner: ${owners}.`);
    }

    const finished: { name: string; text: string }[] = [];
    for (const part of team.parts) {
      const agent = useGameStore.getState().agents.find((a) => a.name === part.agentName);
      if (!agent) continue;
      const cls = PART_CLASSIFICATION[agent.role] ?? PART_CLASSIFICATION.ops;
      const others = team.parts.filter((p) => p.agentName !== part.agentName).map((p) => `${p.agentName}: ${p.text}`).join('\n');
      const earlier = part.synthesis
        ? `\n\nWhat your teammates produced (use it, do not repeat it):\n${finished.map((f) => `--- ${f.name} ---\n${f.text.slice(0, 3500)}`).join('\n\n')}`
        : '';
      const description =
        `Business brief: ${team.context}\n\n` +
        `Your part (${agent.name}, ${agent.role}): ${part.text}\n\n` +
        `Your teammates cover:\n${others}\n\n` +
        `Write only your part, thoroughly, as a standalone document with a clear heading. Be specific to this idea.${earlier}`;
      const title = `${projectTitle} - ${agent.name}: ${part.text}`.slice(0, 90);

      store.addTaskWithTitle(title, undefined, description, { agentRole: cls.agentRole, deliverableType: cls.deliverableType, deliverableLang: cls.deliverableLang });
      const task = [...useGameStore.getState().tasks].reverse().find((t) => t.title === title);
      if (!task) continue;
      useGameStore.getState().updateTask(task.id, { searchQuery: `${part.text} ${topic}` });

      try {
        await this.executeDirectTask(task, agent.id);
      } catch (err) {
        console.error('[AgentCorp] team brief part failed:', agent.name, err);
      }
      const done = useGameStore.getState().tasks.find((t) => t.id === task.id);
      if (done?.deliverable) finished.push({ name: agent.name, text: done.deliverable });
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
        // P0: actually mark the parent task complete. Previously this branch only
        // emitted a status event, so tasks with subtasks never left 'in_progress'
        // and the UI showed them running forever.
        if (parentTask.status !== 'completed' && parentTask.status !== 'failed') {
          if (hasFailures) {
            store.updateTask(parentTask.id, { status: 'failed' });
            store.failTask(parentTask.id);
          } else {
            store.completeTask(parentTask.id);
          }
        }
        emitRun(parentTask.id, {
          kind: hasFailures ? 'run.failed' : 'run.finished',
          agentId: agent.id,
          status: hasFailures ? 'error' : 'success',
          message: hasFailures ? 'Finished with failed subtasks' : 'All subtasks finished',
          data: hasFailures ? undefined : { verdict: 'passed' },
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

    console.log('[AgentCorp] processCompletedItems:', validated.length, 'validations');

    for (const validation of validated) {
      const subtask = validation.subtask;
      const passed = validation.result.passed;

      store.updateSubtaskStatus(subtask.id, passed ? 'completed' : 'failed');
      store.updateSubtaskValidation(subtask.id, validation.result);
      emitRun(subtask.parentTaskId, {
        kind: 'validation.result',
        subtaskId: subtask.id,
        agentId: subtask.assignedAgentId ?? undefined,
        status: passed ? 'success' : 'error',
        message: `Validation ${passed ? 'passed' : 'failed'} (score ${validation.result.score})`,
        detail: validation.result.details.join('\n'),
        data: { stepId: `val_${subtask.id}_${validation.result.validatedAt}` },
      });

      if (!passed) {
        const storeNow = useGameStore.getState();
        const agent = storeNow.agents.find((a) => a.id === subtask.assignedAgentId);
        // P0: retryCount is authoritative from the subtask (carried by TaskQueue),
        // not the per-queue-item counter that reset to 0 on every re-enqueue.
        const currentRetries = subtask.retryCount ?? 0;
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
        if (agent && currentRetries < MAX_VALIDATION_RETRIES) {
          store.updateAgent(agent.id, {
            currentSubTaskId: subtask.id,
          });
          this.taskQueue.reEnqueue(subtask, validation.result.details);
          emitRun(subtask.parentTaskId, {
            kind: 'retry',
            subtaskId: subtask.id,
            agentId: agent.id,
            status: 'running',
            message: `Retry #${currentRetries + 1}: "${subtask.description.slice(0, 50)}"`,
            detail: validation.result.details.join('\n'),
          });
          const parent = storeNow.tasks.find((t) => t.id === subtask.parentTaskId);
          const pm = storeNow.agents.find((a) => a.role === 'pm');
          if (parent && pm && pm.id !== agent.id) {
            announceTaskHandoff(agent.id, pm.id, parent.title, 'validation_retry');
          }
          this.emit({
            type: 'log',
            data: { message: `Subtask "${subtask.description.slice(0, 40)}..." re-queued for retry #${currentRetries}` },
            timestamp: Date.now(),
            streamId: `retry_${subtask.id}`,
          });
        }
      } else {
        // P0: a passing validation clears any build-verify block, otherwise
        // the loop wedges after one bad slice and never processes the next task.
        this.loopOrchestrator.clearBlock();
      }
    }
  }

  /**
   * Surface tool calls the model chose (via the OpenRouter function-calling
   * loop in /api/ai) as agent activity + execution logs so they show up in the
   * UI. The actual tool execution happens server-side with the caller's
   * decrypted token — this only reports the outcome.
   */
  private reportToolCalls(agentId: string, toolCalls: Array<{ name: string; args: Record<string, string>; result: string }>, taskId?: string | null): void {
    if (!toolCalls || toolCalls.length === 0) return;
    const store = useGameStore.getState();
    for (const tc of toolCalls) {
      store.pushAgentActivity(agentId, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId,
        type: 'tool_call',
        message: `${tc.name} → ${tc.result.slice(0, 120)}`,
        timestamp: Date.now(),
        details: JSON.stringify({ args: tc.args, result: tc.result }),
      });
      if (taskId) {
        store.addTaskExecutionLog(taskId, {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          taskId,
          agentId,
          action: `tool ${tc.name}`,
          tool: tc.name,
          input: JSON.stringify(tc.args),
          output: tc.result,
          duration: 0,
          timestamp: Date.now(),
          status: 'success',
        });
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
      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a Product Manager running sprint planning for ${companyName || 'a startup'}, building "${companyProduct || 'a product'}".
Generate exactly 4 concrete sprint tasks that are specific, actionable, and realistic for one week.
Return ONLY a JSON array of task title strings — no explanation, no markdown.
Example: ["Build user dashboard UI", "Write API endpoint tests", "Document onboarding flow", "Fix login edge case"]`,
          temperature: 0.7,
          maxTokens: 300,
          tier: 'small',
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

    const classifications = await Promise.all(sprintTasks.map((t) => classifyTask(t)));
    sprintTasks.forEach((title, i) => {
      store.addTaskWithTitle(title, undefined, undefined, classifications[i]);
    });

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
   * Execute a direct integration action (create ticket, post message, etc.)
   * using the agent's tool-calling capability — bypasses the deliverable pipeline.
   */
  private async executeActionDirect(description: string, agentId?: string): Promise<void> {
    const store = useGameStore.getState();
    const agent = agentId
      ? store.agents.find((a) => a.id === agentId)
      : store.agents.find((a) => a.role === 'ops' && a.online)
        ?? store.agents.find((a) => a.workerRole !== null && a.online)
        ?? store.agents.find((a) => a.workerRole !== null);
    if (!agent) return;

    store.updateAgent(agent.id, { fsmState: 'thinking' });
    store.pushAgentActivity(agent.id, {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId: agent.id,
      type: 'thinking',
      message: `Executing: ${description.slice(0, 80)}`,
      timestamp: Date.now(),
    });

    try {
      const systemPrompt = `You are ${agent.name}, an AI agent at AgentCorp with access to integration tools.\nThe user has asked you to perform an action. Use your tools to do it immediately.\nAfter completing it, reply with a brief confirmation including specific details (ticket URL, message timestamp, etc.).\nDo not describe what you plan to do — just do it.`;
      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A tool call plus a one-line confirmation never needs the default 4096-token reservation (which fails on a low balance).
        body: JSON.stringify({ systemPrompt, prompt: description, maxTokens: 1024 }),
        needsServerTools: true, // Slack/Linear actions run on the server's connector tools
      });
      const data = (await res.json().catch(() => null)) as {
        content?: string | null;
        toolCalls?: { name: string; args: Record<string, string>; result: string }[];
        error?: string;
      } | null;

      const toolCalls = data?.toolCalls ?? [];
      // If the AI itself failed (no credit, provider down) say that, not "check your integrations".
      const aiFailed = !data || Boolean(data.error);
      const reply = data?.content
        || (toolCalls.length > 0
          ? `Done. ${toolCalls.map((t) => t.result).join(' ')}`
          : aiFailed
            ? '⚠️ The AI service is unavailable right now, so I couldn\'t run that. Please try again in a moment.'
            : 'I didn\'t run any tool for that. Tell me which integration to use, or check it is connected.');

      store.sendMessage(agent.id, agent.id, reply);
      this.reportToolCalls(agent.id, toolCalls);
      store.updateAgent(agent.id, { fsmState: 'completed' });
      store.pushAgentActivity(agent.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: agent.id,
        type: 'communicating',
        message: reply.slice(0, 120),
        timestamp: Date.now(),
      });
    } catch (err) {
      store.updateAgent(agent.id, { fsmState: 'blocked' });
      store.pushAgentActivity(agent.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: agent.id,
        type: 'blocked',
        message: `Action failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Re-run an interrupted task. A tool loop continues from its last saved step;
   * a single-shot task simply runs again.
   */
  async resumeRun(taskId: string): Promise<void> {
    const store = useGameStore.getState();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) {
      await discardInterruptedRun(taskId);
      return;
    }
    const cp = await loadCheckpoint(taskId);
    const run = useRunStore.getState().runs[taskId];
    useRunStore.getState().patchRun(taskId, { status: 'running', finishedAt: undefined, summary: '', summaryStreaming: false, verdict: undefined });
    emitRun(taskId, {
      kind: 'step.progress',
      agentId: cp?.workerId ?? run?.agentId,
      status: 'running',
      message: cp ? `Resuming from step ${cp.step}` : 'Restarting the task',
    });
    await this.executeDirectTask(task, cp?.workerId ?? run?.agentId, { resume: cp ?? null, isResume: true });
  }

  /** Extra, mechanically checkable criteria grounded in what the workspace actually contains. */
  private async detectMechanicalCriteria(task: Task): Promise<string[]> {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    const out: string[] = [];
    if (!api) return out;
    try {
      if ((await api.fs.read('tsconfig.json')).ok) out.push('TypeScript typecheck passes');
    } catch { /* no tsconfig */ }
    try {
      const pkg = await api.fs.read('package.json');
      if (pkg.ok && /vitest/.test(pkg.content ?? '') && /\btests?\b/i.test(`${task.title} ${task.description}`)) out.push('All tests pass');
    } catch { /* no package.json */ }
    return out;
  }

  /** Summary + the changed files' contents, so the QA judge has real evidence to read. */
  private async composeLoopDeliverable(result: LoopResult): Promise<string> {
    const parts = [result.summary];
    if (result.filesChanged.length > 0) {
      parts.push(`Files changed:\n${result.filesChanged.map((f) => `- ${f}`).join('\n')}`);
      const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
      for (const f of result.filesChanged.slice(0, 4)) {
        try {
          const r = await api?.fs.read(f);
          if (r?.ok) parts.push(`--- ${f} ---\n${(r.content ?? '').slice(0, 3000)}`);
        } catch { /* unreadable now; the path is still listed */ }
      }
    }
    return parts.join('\n\n');
  }

  private async runLoopTask(a: {
    task: Task;
    worker: Agent;
    criteria: Criterion[];
    signal: AbortSignal;
    resume: LoopCheckpoint | null;
  }): Promise<{ content: string; results: CriterionResult[]; filesChanged: string[]; incomplete: boolean; status: LoopStatus; stopNote: string }> {
    const { task, worker, criteria, signal } = a;
    const env = detectExecutorEnv();
    const tools = await resolveTools();
    const budget = defaultBudget(env);
    const goal = `${task.title}${task.description && task.description !== task.title ? `\n\n${task.description}` : ''}`;
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    const deps: VerifyDeps = {
      signal,
      runCheck: api?.runChecks
        ? async (c) => {
            const r = await api.runChecks!('workspace', c);
            return { ok: r.success, output: r.output ?? r.error ?? '' };
          }
        : undefined,
      fileExists: api?.fs ? async (p) => (await api.fs.read(p)).ok : undefined,
    };

    let checkpoint = a.resume;
    let feedback: string | undefined;
    let result!: LoopResult;
    let results: CriterionResult[] = [];
    let content = '';

    for (let round = checkpoint?.qaRound ?? 0; ; round++) {
      result = await runAgentLoop({
        taskId: task.id,
        agentId: worker.id,
        agentName: worker.name,
        persona: 'a senior software engineer at AgentCorp',
        goal,
        criteria: criteria.map((c) => c.text),
        tools,
        budget,
        env,
        signal,
        resume: checkpoint,
        feedback,
        onCheckpoint: (cp) => { void saveCheckpoint({ ...cp, qaRound: round }); },
      });
      content = await this.composeLoopDeliverable(result);
      if (result.status === 'cancelled' || result.status === 'failed') break;

      // Independent verification: checks are actually run, not asked about.
      results = await verifyCriteria(criteria, content, task.title, deps);
      const verdict = verdictOf(results);
      const unmet = results.filter((r) => r.passed === false);
      emitRun(task.id, {
        kind: 'validation.result',
        agentId: worker.id,
        status: verdict === 'passed' ? 'success' : 'error',
        message: verdict === 'passed' ? 'QA: all acceptance criteria met' : `QA: ${unmet.length} of ${results.length} criteria not met`,
        detail: results.map((r) => `${r.passed === true ? 'PASS' : r.passed === false ? 'FAIL' : 'N/A '}  ${r.text}${r.evidence ? `\n      ${r.evidence}` : ''}`).join('\n'),
        data: { stepId: `${task.id}_qa${round}`, criteria: results, budget: result.budget },
      });

      if (verdict === 'passed' || result.status !== 'finished' || round >= MAX_QA_RETRIES) break;
      feedback = `QA checked your work and found problems:\n${failureFeedback(results)}\n\nFix these, re-run the relevant checks, then call finish again.`;
      checkpoint = { ...result.checkpoint, qaRound: round + 1 };
      emitRun(task.id, {
        kind: 'retry',
        agentId: worker.id,
        status: 'running',
        message: `Sending the work back to ${worker.name} (attempt ${round + 2})`,
        detail: failureFeedback(results),
      });
    }

    const incomplete = result.status !== 'finished';
    return {
      content,
      results,
      filesChanged: result.filesChanged,
      incomplete,
      status: result.status,
      stopNote: result.stopReason ?? (result.status === 'failed' ? result.summary : ''),
    };
  }

  /**
   * Look the topic up on the web first and hand the model real sources. Shows up in the run's steps like any
   * other tool call. If search is unavailable the work still proceeds, with an explicit "do not invent sources" rule.
   */
  private async groundResearchPrompt(a: { task: Task; worker: Agent; prompt: string; signal: AbortSignal }): Promise<string> {
    const { task, worker, prompt, signal } = a;
    const query = (task.searchQuery || task.title).replace(/\s+/g, ' ').trim().slice(0, 200);
    const stepId = `${task.id}_search`;
    const noSources =
      '\n\nNo live web sources were available for this task. Do not invent URLs, quotes, statistics or citations. ' +
      'Write from general knowledge and say plainly which points you could not verify.';

    emitRun(task.id, { kind: 'tool.call', agentId: worker.id, status: 'running', message: `web_search ${query}`, data: { stepId, tool: 'web_search' } });
    const r = await searchWeb(query, { maxResults: 6, signal });
    if (signal.aborted) return prompt;
    if (!r.ok || r.results.length === 0) {
      emitRun(task.id, {
        kind: 'tool.result', agentId: worker.id, status: 'error',
        message: r.ok ? 'web_search: no results' : `web_search: ${r.error}`,
        data: { stepId, tool: 'web_search' },
      });
      return prompt + noSources;
    }
    emitRun(task.id, {
      kind: 'tool.result', agentId: worker.id, status: 'success', message: `web_search ${query}`,
      detail: formatResultsForModel(query, r.results).slice(0, 4000), data: { stepId, tool: 'web_search' },
    });
    return (
      prompt +
      '\n\n' + formatResultsForModel(query, r.results) +
      '\n\nUse these sources where they help. Cite the URL for every claim you take from them. Snippets are short and may be incomplete: ' +
      'if they do not cover something, say so plainly instead of guessing. Never invent a link or a quote.'
    );
  }

  private async runSingleShot(a: {
    task: Task;
    worker: Agent;
    prompt: string;
    deliverableType: string;
    deliverableLang?: string;
    criteria: Criterion[];
    signal: AbortSignal;
    modelOk: boolean;
  }): Promise<{ content: string; results: CriterionResult[] }> {
    const { task, worker, deliverableType, deliverableLang, criteria, signal, modelOk } = a;
    // Research work is written from real search results (and told never to invent links), not from memory alone.
    // Research, and business work that quotes the market (pricing, go-to-market, campaigns), is written from real
    // search results rather than memory.
    const needsSources = worker.workerRole === 'research_worker' || SOURCED_TYPES.has(deliverableType);
    let prompt = needsSources && modelOk ? await this.groundResearchPrompt({ task, worker, prompt: a.prompt, signal }) : a.prompt;
    if (deliverableType !== 'code' && deliverableType !== 'config') {
      prompt +=
        '\n\nHonesty rule: any competitor, price, statistic or finding that does not come from the sources above must be labelled an ' +
        'estimate or assumption. Never invent interviews, surveys, studies, dates of research or citations.';
    }
    const qa = async (text: string, stepId: string): Promise<CriterionResult[]> => {
      if (!modelOk) {
        // No AI reviewer (mock mode): report "not evaluated" rather than inventing a verdict.
        return criteria.map((c) => ({ id: c.id, text: c.text, kind: c.kind, passed: null, evidence: 'not evaluated (no AI reviewer available)' }));
      }
      const results = await verifyCriteria(criteria, text, task.title, { signal });
      const verdict = verdictOf(results);
      emitRun(task.id, {
        kind: 'validation.result',
        agentId: worker.id,
        status: verdict === 'passed' ? 'success' : 'error',
        message: verdict === 'passed' ? 'QA: all acceptance criteria met' : `QA: ${results.filter((r) => r.passed === false).length} of ${results.length} criteria not met`,
        detail: results.map((r) => `${r.passed === true ? 'PASS' : r.passed === false ? 'FAIL' : 'N/A '}  ${r.text}${r.evidence ? `\n      ${r.evidence}` : ''}`).join('\n'),
        data: { stepId, criteria: results },
      });
      return results;
    };

    const criteriaTexts = criteria.map((c) => c.text);
    let content = await aiService.generateDeliverable(prompt, deliverableType, deliverableLang, { signal, criteria: criteriaTexts });
    if (signal.aborted) throw new Error('cancelled');
    let results = await qa(content, `${task.id}_qa0`);

    if (verdictOf(results) === 'needs_attention' && content && modelOk && !signal.aborted) {
      emitRun(task.id, {
        kind: 'retry',
        agentId: worker.id,
        status: 'running',
        message: `Sending the work back to ${worker.name} (attempt 2)`,
        detail: failureFeedback(results),
      });
      let second = '';
      try {
        second = await aiService.generateDeliverable(
          `${prompt}\n\nA reviewer found problems with a previous attempt:\n${failureFeedback(results)}\n\nPrevious attempt:\n${content.slice(0, 12000)}\n\nWrite an improved, complete version that fixes every problem.`,
          deliverableType,
          deliverableLang,
          { signal, criteria: criteriaTexts },
        );
      } catch (err) {
        // The provider dropped during the retry: keep the first attempt (and its QA verdict) rather than failing the whole run.
        if (!(err instanceof AIUnavailableError)) throw err;
      }
      if (signal.aborted) throw new Error('cancelled');
      if (second && second.length > 50) {
        content = second;
        results = await qa(content, `${task.id}_qa1`);
      }
    }
    return { content, results };
  }

  /** Stream the closing note into the chat; falls back to a plain sentence if streaming is unavailable. */
  private async streamRunSummary(a: {
    task: Task;
    worker: Agent;
    content: string;
    results: CriterionResult[];
    attention: boolean;
    filesChanged: string[];
    stopNote: string;
    signal: AbortSignal;
  }): Promise<void> {
    const { task, worker, content, results, attention, filesChanged, stopNote, signal } = a;
    const unmet = results.filter((r) => r.passed === false);
    const where = filesChanged.length > 0 ? 'in the workspace folder' : 'in the Projects folder';
    const prompt =
      'Write a short status note (2-4 sentences, plain language, no headings or bullet lists) to the user about a task you just worked on.\n' +
      `Task: ${task.title}\n` +
      `Outcome: ${attention ? 'needs the user\'s attention' : 'completed'}\n` +
      (stopNote ? `Stopped early because: ${stopNote}\n` : '') +
      (filesChanged.length ? `Files changed: ${filesChanged.join(', ')}\n` : '') +
      (unmet.length ? `Unmet acceptance criteria: ${unmet.map((u) => u.text).join('; ')}\n` : '') +
      `Start of the deliverable:\n${content.slice(0, 1200)}\n\n` +
      `Say what was done, where to find it (${where}), and what needs the user's attention, if anything. Only state things supported by the facts above. ` +
      'If the task asked for something that is unsolved, unknowable or cannot honestly be guaranteed (for example a proof of an open problem), say plainly what could and could not be delivered; never describe an unsolved problem as solved.';

    let emitted = false;
    const push = (text: string) => {
      emitRun(task.id, { kind: 'summary.delta', agentId: worker.id, message: text, data: emitted ? undefined : { replace: true } });
      emitted = true;
    };
    const res = await streamAI({
      prompt,
      systemPrompt: `You are ${worker.name}, a ${worker.role} at AgentCorp, reporting back to the user.`,
      temperature: 0.4,
      maxTokens: 220,
      signal,
      onDelta: push,
    });
    if (!res.ok && !emitted) {
      push(
        attention
          ? `I worked on "${task.title}" but it needs your review${stopNote ? ` (${stopNote})` : ''}${unmet.length ? `: ${unmet.map((u) => u.text).join('; ')}` : '.'} The work is ${where}.`
          : `I finished "${task.title}". The result is ${where}.`,
      );
    }
  }

  /**
   * Execute a task directly, bypassing the full CEO/PM/Planner pipeline.
   *
   * Developer tasks on the desktop app (with a workspace folder and an AI key)
   * run as a tool loop: the agent reads and edits files and runs checks, and QA
   * verifies the result against the ticket's acceptance criteria by actually
   * running them. Everything else is a single-shot deliverable, which is also
   * checked against the criteria.
   */
  private async executeDirectTask(
    task: Task,
    forcedWorkerId?: string,
    opts: { resume?: LoopCheckpoint | null; isResume?: boolean } = {},
  ): Promise<void> {
    console.log('[AgentCorp] executeDirectTask called for:', task.id, task.title);
    const store = useGameStore.getState();

    // Map agent role (stored by classifyTask at task creation) → workerRole field on Agent
    const ROLE_TO_WORKER: Record<string, string> = {
      engineer:   'developer',
      researcher: 'research_worker',
      qa:         'qa_worker',
      sales:      'sales_worker',
      finance:    'finance_worker',
      ops:        'ops_worker',
    };
    const preferredWorkerRole = task.preferredAgentRole
      ? ROLE_TO_WORKER[task.preferredAgentRole] ?? null
      : null;
    const allWorkerRoles = Object.values(ROLE_TO_WORKER);

    // Use the forced agent if provided, otherwise route to domain-matched worker
    const workerAgent = forcedWorkerId
      ? store.agents.find((a) => a.id === forcedWorkerId)
      : preferredWorkerRole
        ? (store.agents.find((a) => a.workerRole === preferredWorkerRole && a.online)
            ?? store.agents.find((a) => allWorkerRoles.includes(a.workerRole ?? '') && a.online))
        : store.agents.find((a) => allWorkerRoles.includes(a.workerRole ?? '') && a.online);

    if (!workerAgent) {
      console.warn('[AgentCorp] No available worker agent for direct task');
      this.emit({
        type: 'log',
        data: { message: `No available worker for task "${task.title}"` },
        timestamp: Date.now(),
        streamId: `direct_${task.id}`,
      });
      emitRun(task.id, { kind: 'run.failed', status: 'error', message: 'No available worker for this task', data: { title: task.title } });
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

    // Claim the task for this worker before any await: otherwise the tick pipeline sees it still pending and
    // re-assigns it to whichever worker is least busy, overwriting the owner chosen here.
    store.updateTask(task.id, { status: 'in_progress', assignedTo: workerAgent.id });

    const ctrl = registerRun(task.id);
    const signal = ctrl.signal;
    const isDevTask = workerAgent.workerRole === 'developer' && (task.deliverableType ?? 'code') === 'code';
    const [blocker, modelOk] = await Promise.all([explainLoopBlocker(), modelAvailable()]);
    const useLoop = isDevTask && blocker === null && modelOk;

    // ── Stage 1: Assign — PM hands task to worker, worker acknowledges ──────
    store.updateAgent(workerAgent.id, { currentTaskId: task.id, workStatus: 'thinking', mood: 'focused' });
    store.updateTask(task.id, { status: 'in_progress', assignedTo: workerAgent.id });

    if (!opts.isResume) {
      if (pm) {
        this.agentSay(pm.id, workerAgent.id, `Hey ${workerAgent.name}, you're up! Working on: "${short}".`, 'communicating');
      }
      this.agentSay(workerAgent.id, pm?.id ?? workerAgent.id, `On it! Starting "${short}" now — I'll keep you posted.`, 'thinking');
      await this.maybePushback(pm, workerAgent, short);
      store.updateAgent(workerAgent.id, { workStatus: 'coding' });
      this.agentSay(workerAgent.id, pm?.id ?? workerAgent.id, `Working through "${short}"… making solid progress.`, 'coding');
    }

    // The run block is created AFTER the hand-off chatter, so it (and its streamed
    // summary) lands at the bottom of the conversation, not above later messages.
    if (opts.isResume) {
      useRunStore.getState().patchRun(task.id, { mode: useLoop ? 'loop' : 'direct' });
    } else {
      emitRun(task.id, {
        kind: 'run.started',
        agentId: workerAgent.id,
        status: 'running',
        message: 'Run started',
        data: { title: task.title, mode: useLoop ? 'loop' : 'direct' },
      });
    }
    if (isDevTask && !useLoop) {
      emitRun(task.id, {
        kind: 'step.progress',
        agentId: workerAgent.id,
        status: 'success',
        message: `Single-shot mode: ${!modelOk ? 'no AI key available' : blocker ?? 'tool loop unavailable'}`,
      });
    }

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

      // ── Acceptance criteria (written once per ticket, editable later) ────
      let criteria: Criterion[] = (task.acceptanceCriteria ?? []) as Criterion[];
      if (criteria.length === 0) {
        const stepId = `${task.id}_criteria`;
        emitRun(task.id, { kind: 'step.started', agentId: workerAgent.id, status: 'running', message: 'Defining acceptance criteria', data: { stepId } });
        const mechanical = useLoop ? await this.detectMechanicalCriteria(task) : [];
        criteria = await generateCriteria({ title: task.title, description: task.description, deliverableType, mechanical, signal });
        store.updateTask(task.id, { acceptanceCriteria: criteria });
        emitRun(task.id, {
          kind: 'step.finished',
          agentId: workerAgent.id,
          status: 'success',
          message: `Acceptance criteria set (${criteria.length})`,
          data: { stepId, criteria: criteria.map((c) => ({ id: c.id, text: c.text, kind: c.kind, passed: null })) },
        });
      }
      if (signal.aborted) throw new Error('cancelled');

      // ── Stage 2: Working ─────────────────────────────────────────────────
      store.updateAgent(workerAgent.id, { workStatus: 'coding' });

      let content = '';
      let results: CriterionResult[] = [];
      let filesChanged: string[] = [];
      let incomplete = false;
      let stopNote = '';

      if (useLoop) {
        const out = await this.runLoopTask({ task, worker: workerAgent, criteria, signal, resume: opts.resume ?? null });
        if (out.status === 'cancelled') throw new Error('cancelled');
        if (out.status === 'failed') throw new Error(out.stopNote || 'the agent loop failed');
        ({ content, results, filesChanged, incomplete, stopNote } = out);
      } else {
        const out = await this.runSingleShot({ task, worker: workerAgent, prompt, deliverableType, deliverableLang, criteria, signal, modelOk });
        ({ content, results } = out);
      }
      if (signal.aborted) throw new Error('cancelled');

      if (content && content.length > 50) {
        const verdict = verdictOf(results);
        const attention = verdict === 'needs_attention' || incomplete;

        // ── Stage 3: Review — brief pause before marking complete ────────────
        store.updateTask(task.id, { status: 'review' });
        store.updateAgent(workerAgent.id, { workStatus: 'reviewing' });
        this.agentSay(workerAgent.id, pm?.id ?? workerAgent.id, `Done with "${short}"! Giving it a final review before I hand it off.`, 'reviewing');

        await new Promise((resolve) => setTimeout(resolve, 800));

        // ── Stage 4: Complete (or flag for attention) ────────────────────────
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
        // A task whose checks failed, or whose run hit a limit, is not "completed":
        // it stays in review so a person looks at it.
        if (!attention) store.completeTask(task.id);
        store.updateAgent(workerAgent.id, { currentTaskId: null, workStatus: 'idle', mood: attention ? 'frustrated' : 'happy' });

        if (pm) {
          this.agentSay(
            pm.id,
            ceo?.id ?? pm.id,
            attention
              ? `${workerAgent.name} delivered "${short}", but it needs a human look before it's done. ⚠️`
              : `${workerAgent.name} just wrapped up "${short}". Deliverable is live in the projects folder! ✅`,
            'communicating',
          );
        }

        store.addTaskExecutionLog(task.id, {
          id: `${logId}_done`,
          taskId: task.id,
          agentId: workerAgent.id,
          action: `${attention ? 'Delivered (needs attention)' : 'Completed'} "${task.title}"`,
          tool: 'generateDeliverable',
          input: task.title,
          output: `${content.length} chars — ${deliverableType}${deliverableLang ? ` (${deliverableLang})` : ''}`,
          duration: Date.now() - startTs,
          timestamp: Date.now(),
          status: 'success',
        });

        this.emit({
          type: 'log',
          data: { message: `Task "${task.title}" ${attention ? 'delivered, needs attention' : 'completed'} by ${workerAgent.name}` },
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

        await this.streamRunSummary({ task, worker: workerAgent, content, results, attention, filesChanged, stopNote, signal });
        emitRun(task.id, {
          kind: 'run.finished',
          agentId: workerAgent.id,
          status: 'success',
          message: attention ? 'Finished, needs attention' : 'Finished',
          data: { verdict: attention ? 'needs_attention' : 'passed' },
        });
        void clearCheckpoint(task.id);
      } else {
        throw new Error('Empty or too short deliverable');
      }
    } catch (err) {
      const cancelled = signal.aborted || String(err).includes('cancelled');
      if (cancelled) console.info('[AgentCorp] run stopped by the user:', task.title);
      else console.error('[AgentCorp] executeDirectTask failed:', err);
      store.failTask(task.id);
      store.updateAgent(workerAgent.id, { currentTaskId: null, workStatus: 'idle', mood: 'frustrated' });

      if (pm) {
        this.agentSay(
          pm.id,
          ceo?.id ?? pm.id,
          cancelled ? `Stopped "${short}" as requested.` : `Heads up — ${workerAgent.name} hit a blocker on "${short}". Task failed.`,
          'communicating',
        );
      }

      store.addTaskExecutionLog(task.id, {
        id: `${logId}_err`,
        taskId: task.id,
        agentId: workerAgent.id,
        action: `${cancelled ? 'Stopped' : 'Failed'} "${task.title}"`,
        tool: 'generateDeliverable',
        input: task.title,
        output: String(err),
        duration: Date.now() - startTs,
        timestamp: Date.now(),
        status: 'error',
      });
      emitRun(task.id, {
        kind: 'run.failed',
        agentId: workerAgent.id,
        status: 'error',
        message: cancelled ? 'Stopped by you' : `Failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200),
        detail: String(err),
        data: cancelled ? { stopped: true } : undefined,
      });
      void clearCheckpoint(task.id);

      this.emit({
        type: 'log',
        data: { message: `Task "${task.title}" failed: ${err}` },
        timestamp: Date.now(),
        streamId: `direct_${task.id}`,
      });
    } finally {
      unregisterRun(task.id, ctrl);
    }
  }
}

export const centralOrchestrator = new CentralOrchestrator();
