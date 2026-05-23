import { useGameStore } from '@/store/gameStore';
import { Agent, AgentActivity, Task } from '@/agents/AgentTypes';
import { toolRegistry } from './ToolRegistry';
import { agentMemory } from './AgentMemory';
import { performanceTracker } from '@/hr/HRSystem';

export class ActivityBuilder {
  private activityFn: (agentId: string, activity: AgentActivity) => void;

  constructor(activityFn: (agentId: string, activity: AgentActivity) => void) {
    this.activityFn = activityFn;
  }

  push(agentId: string, type: AgentActivity['type'], message: string, details?: string): void {
    this.activityFn(agentId, {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      type,
      message,
      details,
      timestamp: Date.now(),
    });
  }
}

interface ActionStep {
  agentId: string;
  tool: string;
  params: Record<string, string>;
  description: string;
  /** If set, stores step output in context under this key for later steps to reference */
  storeAs?: string;
}

export class AgentRuntime {
  private tickCounter = 0;
  /** Accumulates step outputs across a single agent's execution flow */
  private stepOutputs: Record<string, string> = {};
  /** Agents currently being processed — prevents overlapping ticks */
  private busyAgents = new Set<string>();

  async processAgent(agent: Agent): Promise<void> {
    // Per-agent lock: skip if this agent is already being processed
    if (this.busyAgents.has(agent.id)) {
      return;
    }
    this.busyAgents.add(agent.id);
    try {
      await this._processAgent(agent);
    } finally {
      this.busyAgents.delete(agent.id);
    }
  }

  private async _processAgent(agent: Agent): Promise<void> {
    const store = useGameStore.getState();
    const builder = new ActivityBuilder((id, activity) => store.pushAgentActivity(id, activity));

    if (!agent.online) return;

    if (!agent.currentTaskId) {
      if (agent.workStatus !== 'idle') {
        store.updateWorkStatus(agent.id, 'idle');
      }
      if (agent.role === 'hr' && this.tickCounter % 30 === 0) {
        await performanceTracker.evaluateTeam(agent);
      }
      return;
    }

    console.log(`[AgentRuntime] Processing ${agent.name} (${agent.role}) — currentTaskId: ${agent.currentTaskId}`);

    const task = store.tasks.find((t) => t.id === agent.currentTaskId);
    if (!task) {
      console.log(`[AgentRuntime] ❌ Task ${agent.currentTaskId} not found in store for ${agent.name}`);
      return;
    }
    // Skip if task is already completed/failed by a prior tick
    if (task.status === 'completed' || task.status === 'failed') {
      console.log(`[AgentRuntime] Task "${task.title}" already ${task.status}, clearing agent`);
      store.updateAgent(agent.id, { currentTaskId: null });
      return;
    }
    console.log(`[AgentRuntime] Found task: "${task.title}" (status: ${task.status}, assignedTo: ${task.assignedTo})`);

    store.updateWorkStatus(agent.id, 'thinking');
    builder.push(agent.id, 'thinking', `Analyzing task: "${task.title}"`);

    const memories = agentMemory.findRelevant(agent.id, task.title, 2);
    if (memories.length > 0) {
      builder.push(agent.id, 'thinking', `Recalling ${memories.length} relevant memory entries`);
    }

    const steps = await this.planNextAction(agent, task, builder);
    console.log(`[AgentRuntime] Planned ${steps.length} steps for ${agent.name} on "${task.title}"`);
    this.stepOutputs = {};

    let didRealWork = false;
    let writeFailed = false;

    for (const step of steps) {
      const resolvedParams: Record<string, string> = {};
      for (const [key, val] of Object.entries(step.params)) {
        resolvedParams[key] = val.replace(/\{(\w+)\}/g, (_, name) => this.stepOutputs[name] ?? '');
      }

      const result = await this.executeStep(
        agent, task, { ...step, params: resolvedParams }, builder,
      );

      if (step.storeAs) {
        this.stepOutputs[step.storeAs] = result.output;
        didRealWork = true;
      }

      if (step.tool === 'write_file' && !result.success) {
        writeFailed = true;
      }
    }

    // After completing all steps, mark the task as done and clear the agent
    if (didRealWork && (agent.role === 'engineer' || agent.role === 'researcher')) {
      const s = useGameStore.getState();
      const verifyOutput = this.stepOutputs['verify_result'] || '';
      console.log(`[AgentRuntime] verify_result for "${task.title}":`, verifyOutput.slice(0, 300));
      const hasTscError = verifyOutput.toLowerCase().includes('error');

      // Check if the task is already completed by a concurrent tick
      const currentTask = useGameStore.getState().tasks.find((t) => t.id === task.id);
      if (currentTask && (currentTask.status === 'completed' || currentTask.status === 'failed')) {
        console.log(`[AgentRuntime] Task "${task.title}" already finalized as ${currentTask.status}, skipping`);
        return;
      }

      if (writeFailed) {
        console.log(`[AgentRuntime] ❌ FAILING task "${task.title}" because write_file failed`);
        s.pushAgentActivity(agent.id, {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: agent.id,
          type: 'blocked',
          message: `Task "${task.title}" failed — could not write file`,
          timestamp: Date.now(),
        });
        s.failTask(task.id);
        s.updateAgent(agent.id, { currentTaskId: null, mood: 'frustrated' });
      } else if (hasTscError) {
        console.log(`[AgentRuntime] ❌ FAILING task "${task.title}" due to tsc errors`);
        s.pushAgentActivity(agent.id, {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: agent.id,
          type: 'blocked',
          message: `Task "${task.title}" has TypeScript errors, marking as failed`,
          timestamp: Date.now(),
        });
        s.failTask(task.id);
        s.updateAgent(agent.id, { currentTaskId: null, mood: 'frustrated' });
      } else {
        const path = this.stepOutputs['file_path'] || 'unknown path';
        console.log(`[AgentRuntime] ✅ COMPLETING task "${task.title}" — wrote ${path}`);
        s.completeTask(task.id);
        s.pushAgentActivity(agent.id, {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: agent.id,
          type: 'tool_result',
          message: `Task "${task.title}" completed — wrote ${path}`,
          timestamp: Date.now(),
        });
        s.updateAgent(agent.id, {
          currentTaskId: null,
          mood: 'happy',
        });
      }
    } else {
      console.log(`[AgentRuntime] No real work done for ${agent.name} on "${task.title}" (didRealWork=${didRealWork}, role=${agent.role})`);
    }
  }

  private async planNextAction(
    agent: Agent,
    task: Task,
    builder: ActivityBuilder,
  ): Promise<ActionStep[]> {
    const store = useGameStore.getState();
    const steps: ActionStep[] = [];

    switch (agent.role) {
      case 'ceo': {
        if (task.status === 'pending') {
          const pm = store.agents.find((a) => a.role === 'pm');
          if (pm) {
            steps.push({
              agentId: agent.id, tool: 'ask_agent',
              params: { agentRole: 'pm', question: `Evaluate this task: "${task.title}" — assign it to the right team member.` },
              description: `Delegating to ${pm.name}`,
            });
          }
        }
        break;
      }

      case 'pm': {
        if (task.status === 'prioritized' && !task.assignedTo) {
          const workers = store.agents.filter(
            (a) => a.role !== 'ceo' && a.role !== 'pm' && a.role !== 'hr',
          );
          const candidate = workers.reduce((best, w) =>
            w.performance.tasksCompleted < (best?.performance.tasksCompleted ?? Infinity) ? w : best,
          );
          if (candidate) {
            steps.push({
              agentId: agent.id, tool: 'ask_agent',
              params: { agentRole: candidate.role, question: `You've been assigned: "${task.title}". Describe your approach.` },
              description: `Assigning to ${candidate.name}`,
            });
            steps.push({
              agentId: agent.id, tool: 'ask_agent',
              params: { agentRole: 'engineer', question: `Review requirements for "${task.title}". What tools and approach will you use?` },
              description: `Planning approach for ${task.title}`,
            });
          }
        }
        break;
      }

      case 'engineer':
      case 'researcher': {
        if (task.status !== 'assigned' && task.status !== 'in_progress') break;

        // Step 1: explore project structure
        steps.push({
          agentId: agent.id, tool: 'read_directory',
          params: { path: 'src' },
          description: 'Scanning project structure',
          storeAs: 'project_structure',
        });

        // Step 2: search for task-related files
        const keywords = task.title.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
        for (const kw of keywords) {
          steps.push({
            agentId: agent.id, tool: 'search_codebase',
            params: { pattern: kw, include: '.ts' },
            description: `Searching for "${kw}" in codebase`,
          });
        }

        // Step 3: read the context file if task has one
        if (task.aiContext?.contextFile) {
          steps.push({
            agentId: agent.id, tool: 'read_file',
            params: { path: task.aiContext.contextFile },
            description: `Reading context file: ${task.aiContext.contextFile}`,
            storeAs: 'context_file',
          });
        }

        // Step 4: check current type errors if relevant
        if (task.title.toLowerCase().includes('type error') || task.title.toLowerCase().includes('ts error')) {
          steps.push({
            agentId: agent.id, tool: 'execute_command',
            params: { command: 'npx tsc --noEmit 2>&1 | head -30', workdir: '' },
            description: 'Checking TypeScript errors',
            storeAs: 'ts_check',
          });
        }

        const lang = task.deliverableLang || 'typescript';
        const fileExt = lang === 'html' ? '.html' : lang === 'nextjs' || lang === 'tsx' ? '.tsx' : lang === 'python' ? '.py' : '.ts';

        // Step 5: ask AI what file path to create/modify
        const pathPlanPrompt = `You are an engineer on AgentCorp. Task: "${task.title}".

Project structure:
{project_structure}

${task.aiContext?.contextFile ? `Context file content:\n{context_file}` : ''}

Based on this task, what single file path should I create or modify?
- If creating a new component like a theme switcher or navbar element, use src/components/ComponentName.tsx
- If modifying an existing file, use the path from context or search results
- Reply with ONLY the file path relative to project root, nothing else.
Example: src/components/ThemeSwitcher.tsx`;

        steps.push({
          agentId: agent.id, tool: 'ask_agent',
          params: { agentRole: agent.role, question: pathPlanPrompt },
          description: `Planning file path for "${task.title}"`,
          storeAs: 'file_path',
        });

        // Step 6: try to read the target file (it might not exist yet — that's OK)
        steps.push({
          agentId: agent.id, tool: 'read_file',
          params: { path: '{file_path}' },
          description: 'Checking if target file exists',
          storeAs: 'existing_content',
        });

        // Step 7: ask AI to generate the file content
        const contentPrompt = `You are an engineer on AgentCorp. Generate the complete content for the file.

TASK: "${task.title}"
FILE PATH: {file_path}
LANGUAGE: ${lang}

Project structure:
{project_structure}

${task.aiContext?.contextFile ? `Context file:\n{context_file}` : ''}

${`Existing file content (empty if new file):\n{existing_content}`}

AVAILABLE PACKAGES (use ONLY these):
- next (Next.js framework)
- react, react-dom
- lucide-react (icons only)
- tailwindcss (utility classes)
- zustand (state management)
- phaser (game engine)

ABSOLUTELY DO NOT USE:
- @heroicons, @heroicons/react/* — NOT installed
- react-redux, redux — NOT installed
- any other icon library

REQUIREMENTS:
- Write COMPLETE, working code — every tag must be closed, every string terminated
- Use 'use client' directive at top for interactive components
- Use Tailwind CSS utility classes for styling
- Use lucide-react for icons if needed (import from 'lucide-react')
- Import from existing project files only (use '@/' path alias)
- If modifying an existing file, preserve existing functionality
- For reports or analysis, use a simple React component with text output
- TypeScript strict mode is on — define proper types for all props and state

OUTPUT: Return ONLY the complete file content. No explanations, no markdown fences. Just the raw file content.`;

        steps.push({
          agentId: agent.id, tool: 'ask_agent',
          params: { agentRole: agent.role, question: contentPrompt },
          description: `Generating content for {file_path}`,
          storeAs: 'file_content',
        });

        // Step 8: write the file to the real project path
        steps.push({
          agentId: agent.id, tool: 'write_file',
          params: { path: '{file_path}', content: '{file_content}' },
          description: 'Writing file to project',
        });

        // Step 9: verify TypeScript compilation
        steps.push({
          agentId: agent.id, tool: 'execute_command',
          params: { command: 'npx tsc --noEmit 2>&1 | head -20', workdir: '' },
          description: 'Verifying TypeScript compilation',
          storeAs: 'verify_result',
        });

        // Step 10: mark task completed
        steps.push({
          agentId: agent.id, tool: 'ask_agent',
          params: {
            agentRole: agent.role,
            question: `Summarize what you did for task "${task.title}". File: {file_path}. TS check: {verify_result}. Return a brief 1-2 sentence completion summary.`,
          },
          description: 'Summarizing completed work',
        });
        break;
      }

      case 'qa': {
        if (task.status === 'review') {
          steps.push({
            agentId: agent.id, tool: 'ask_agent',
            params: { agentRole: 'qa', question: `Final validation for "${task.title}". Has the deliverable been generated? What is the file path? Reply with VALIDATE or REJECT.` },
            description: `Validating "${task.title}"`,
          });
        }
        break;
      }
    }

    return steps;
  }

  private async executeStep(
    agent: Agent,
    task: Task,
    step: ActionStep,
    builder: ActivityBuilder,
  ): Promise<{ output: string; success: boolean }> {
    const store = useGameStore.getState();

    builder.push(agent.id, 'tool_call', step.description);
    store.updateWorkStatus(agent.id, step.tool === 'ask_agent' ? 'thinking' : 'coding');

    const startTime = Date.now();

    store.addTaskExecutionLog(task.id, {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      taskId: task.id,
      agentId: agent.id,
      action: step.description,
      tool: step.tool,
      input: JSON.stringify(step.params),
      output: '',
      duration: 0,
      timestamp: startTime,
      status: 'running',
    });

    const toolResult = await toolRegistry.executeTool(step.tool, step.params, (log) => {
      store.addTaskExecutionLog(task.id, {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        taskId: task.id,
        agentId: agent.id,
        action: log.action,
        tool: log.tool,
        input: log.input,
        output: log.output,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        status: log.status,
      });
    });

    const elapsed = Date.now() - startTime;
    const outputText = (toolResult.output || toolResult.error || '').trim();

    if (toolResult.success) {
      const preview = outputText.length > 120 ? outputText.slice(0, 120) + '...' : outputText;
      console.log(`[EXECUTE] ${agent.name}.${step.tool}() — OK (${elapsed}ms) — ${preview}`);
      builder.push(agent.id, 'tool_result', `${step.tool} completed`, outputText.slice(0, 200));

      if (step.tool === 'write_file') {
        console.log(`[EXECUTE] ✅ File written: ${step.params.path} (${outputText.length} chars)`);
        agentMemory.addAgentMemory(agent.id, {
          type: 'code',
          content: `Wrote to ${step.params.path}`,
          tags: ['file', step.params.path.split('/').pop() || ''],
          importance: 4,
        });
      }

      if (step.tool === 'ask_agent') {
        console.log(`[EXECUTE] 🤖 AI response (${agent.name}): ${preview}`);
      }

      agentMemory.addAgentMemory(agent.id, {
        type: 'task',
        content: `Executed ${step.tool} for "${task.title}" in ${elapsed}ms`,
        tags: ['execution', step.tool, task.status],
        importance: 3,
      });

      performanceTracker.recordToolUse(agent.id);
    } else {
      console.log(`[EXECUTE] ❌ ${agent.name}.${step.tool}() — FAILED (${elapsed}ms): ${toolResult.error}`);
      builder.push(agent.id, 'blocked', `${step.tool} failed: ${toolResult.error}`, toolResult.error);
    }

    store.addTaskExecutionLog(task.id, {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskId: task.id,
      agentId: agent.id,
      action: toolResult.success ? `${step.tool} completed` : `${step.tool} failed`,
      tool: step.tool,
      input: JSON.stringify(step.params),
      output: outputText,
      duration: elapsed,
      timestamp: Date.now(),
      status: toolResult.success ? 'success' : 'error',
    });

    store.updateAgentPerformance(agent.id, {
      toolUsageCount: agent.performance.toolUsageCount + 1,
    });

    return { output: outputText, success: toolResult.success };
  }

  async tick(): Promise<void> {
    const store = useGameStore.getState();
    this.tickCounter++;

    const activeAgents = store.agents.filter((a) => a.online && a.currentTaskId && !a.currentSubTaskId);
    if (this.tickCounter % 10 === 0) {
      const allAgents = store.agents.map(a => `${a.name}(${a.role}): taskId=${a.currentTaskId || 'none'}`);
      console.log(`[AgentRuntime] Tick #${this.tickCounter} — active: ${activeAgents.length}, agents: [${allAgents.join(', ')}]`);
    }
    for (const agent of activeAgents) {
      await this.processAgent(agent);
    }
  }
}

export const agentRuntime = new AgentRuntime();
