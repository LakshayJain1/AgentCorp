import { useGameStore } from '@/store/gameStore';
import { Task, Agent } from '@/agents/AgentTypes';
import { toolRegistry } from './ToolRegistry';

type RuntimeLog = {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'error' | 'complete';
  message: string;
  details?: string;
  timestamp: number;
};

type RuntimeCallback = (log: RuntimeLog) => void;

const SYSTEM_PROMPT = `You are a senior frontend engineer at AgentCorp. You write production React/Next.js code.

You will receive a project structure and a task. Respond with ONLY the code files needed, each inside a fenced code block.

The FIRST line of each code block MUST be a comment with the file path, like:
// src/components/ThemeToggle.tsx
or
// src/app/page.tsx

Rules:
- Use 'use client' for interactive components
- Use Tailwind CSS for styling
- Use lucide-react for icons: import { Moon, Sun, Menu, X } from 'lucide-react'
- Import local files with '@/' alias
- Include ALL imports, ALL closing tags, ALL semicolons
- Files must be COMPLETE and stand-alone
- New components go in src/components/
- When modifying an existing file, include the entire file content with your changes`;

export class SimpleRuntime {
  private listeners = new Map<string, RuntimeCallback[]>();

  on(agentId: string, cb: RuntimeCallback): () => void {
    if (!this.listeners.has(agentId)) this.listeners.set(agentId, []);
    this.listeners.get(agentId)!.push(cb);
    return () => {
      const cbs = this.listeners.get(agentId);
      if (cbs) {
        const idx = cbs.indexOf(cb);
        if (idx >= 0) cbs.splice(idx, 1);
      }
    };
  }

  private emit(agentId: string, log: RuntimeLog): void {
    const cbs = this.listeners.get(agentId);
    if (cbs) for (const cb of cbs) cb(log);
  }

  async executeTask(task: Task): Promise<void> {
    const store = useGameStore.getState();
    const agent = store.agents.find((a) => a.role === 'engineer');
    if (!agent) {
      this.logError(task, 'No engineer agent found');
      return;
    }

    store.updateTask(task.id, { status: 'in_progress', assignedTo: agent.id });
    store.updateAgent(agent.id, { currentTaskId: task.id, workStatus: 'thinking' });

    this.emit(agent.id, {
      type: 'thinking',
      message: `Starting: "${task.title}"`,
      timestamp: Date.now(),
    });

    try {
      await this.run(task, agent);
    } catch (err) {
      this.logError(task, `Runtime error: ${err}`);
      store.updateTask(task.id, { status: 'failed' });
      store.updateAgent(agent.id, { currentTaskId: null, workStatus: 'blocked' });
    }
  }

  private async run(task: Task, agent: Agent): Promise<void> {
    const store = useGameStore.getState();

    // Phase 1: Gather context — read src structure + key existing files
    this.emit(agent.id, {
      type: 'thinking',
      message: 'Exploring project structure...',
      timestamp: Date.now(),
    });
    store.updateAgent(agent.id, { workStatus: 'thinking' });

    const dirResult = await toolRegistry.executeTool('read_directory', { path: 'src' });
    const structure = dirResult.success ? dirResult.output : '';

    // Read the main files the AI will need to modify
    const existingFiles: Record<string, string> = {};
    const filesToRead = ['src/components/TopBar.tsx', 'src/app/page.tsx', 'src/app/globals.css'];
    for (const fp of filesToRead) {
      const r = await toolRegistry.executeTool('read_file', { path: fp });
      if (r.success) existingFiles[fp] = r.output;
    }

    const contextParts: string[] = [
      `Project src/ structure:\n${structure}`,
    ];
    for (const [fp, content] of Object.entries(existingFiles)) {
      contextParts.push(`\n--- ${fp} ---\n${content}`);
    }
    contextParts.push(`\nTask: ${task.title}\n\nRespond with code blocks only.`);

    // Phase 2: Ask AI once
    this.emit(agent.id, {
      type: 'thinking',
      message: 'Asking AI to generate code...',
      timestamp: Date.now(),
    });

    const aiResponse = await this.askAI(contextParts.join('\n'));
    if (!aiResponse) {
      this.logError(task, 'AI returned no response');
      store.updateTask(task.id, { status: 'failed' });
      store.updateAgent(agent.id, { currentTaskId: null, workStatus: 'blocked' });
      return;
    }

    // Phase 3: Extract code blocks and write files
    this.emit(agent.id, {
      type: 'thinking',
      message: 'Extracting code and writing files...',
      timestamp: Date.now(),
    });
    store.updateAgent(agent.id, { workStatus: 'coding' });

    const codeFiles = this.extractCodeBlocks(aiResponse);
    if (codeFiles.length === 0) {
      // No code blocks — return AI response as deliverable
      store.updateTask(task.id, {
        status: 'completed',
        completedAt: Date.now(),
        deliverable: aiResponse,
      });
      store.updateAgent(agent.id, { currentTaskId: null, workStatus: 'completed' });
      store.addEvent({
        id: `done_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'complete',
        message: `"${task.title}" completed (no code generated)`,
        agentId: agent.id,
        taskId: task.id,
      });
      this.emit(agent.id, {
        type: 'complete',
        message: aiResponse.slice(0, 500),
        timestamp: Date.now(),
      });
      return;
    }

    let allOk = true;
    const writeLog: string[] = [];
    for (const cf of codeFiles) {
      this.emit(agent.id, {
        type: 'tool_call',
        message: `write_file(${cf.params.path})`,
        timestamp: Date.now(),
      });

      const result = await toolRegistry.executeTool('write_file', cf.params);
      if (result.success) {
        writeLog.push(`✓ ${cf.params.path}`);
      } else {
        writeLog.push(`✗ ${cf.params.path}: ${result.error}`);
        allOk = false;
      }

      this.emit(agent.id, {
        type: 'tool_result',
        message: result.success ? `Wrote ${cf.params.path}` : `Failed: ${result.error}`,
        timestamp: Date.now(),
      });
    }

    // Phase 4: Verify with tsc
    this.emit(agent.id, {
      type: 'thinking',
      message: 'Running tsc to verify...',
      timestamp: Date.now(),
    });

    const tscResult = await toolRegistry.executeTool('execute_command', {
      command: 'npx tsc --noEmit',
    });

    const tscOk = tscResult.success;
    const summary = [
      tscOk ? '✅ TypeScript check passed' : `❌ TypeScript errors:\n${(tscResult.error || tscResult.output || '').slice(0, 1000)}`,
      '',
      'Files written:',
      ...writeLog,
    ].join('\n');

    if (tscOk) {
      store.updateTask(task.id, {
        status: 'completed',
        completedAt: Date.now(),
        deliverable: summary,
      });
      store.updateAgent(agent.id, { currentTaskId: null, workStatus: 'completed' });
      store.addEvent({
        id: `done_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'complete',
        message: `✅ "${task.title}" completed`,
        agentId: agent.id,
        taskId: task.id,
      });
      this.emit(agent.id, {
        type: 'complete',
        message: summary,
        timestamp: Date.now(),
      });
      store.updateSimulation({
        totalTasksCompleted: store.simulation.totalTasksCompleted + 1,
      });
    } else {
      // tsc failed — store result, mark failed
      store.updateTask(task.id, {
        status: 'failed',
        deliverable: summary,
      });
      store.updateAgent(agent.id, { currentTaskId: null, workStatus: 'blocked' });
      store.addEvent({
        id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'error',
        message: `"${task.title}" failed tsc check`,
        agentId: agent.id,
        taskId: task.id,
      });
      this.emit(agent.id, {
        type: 'error',
        message: summary,
        timestamp: Date.now(),
      });
    }
  }

  private async askAI(prompt: string): Promise<string | null> {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: SYSTEM_PROMPT, prompt, temperature: 0.3 }),
      });
      const data = await res.json();
      return data.content || null;
    } catch (err) {
      console.error('[Runtime] AI call failed:', err);
      return null;
    }
  }

  private extractCodeBlocks(text: string): { tool: string; params: Record<string, string> }[] {
    const calls: { tool: string; params: Record<string, string> }[] = [];
    const blockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(text)) !== null) {
      const code = match[2].trim();
      if (!code) continue;

      const lines = code.split('\n');
      const firstLine = lines[0].trim();
      let filePath = '';

      const pathMatch = firstLine.match(/^\/\/\s*(.+)$/) || firstLine.match(/^#\s*(.+)$/);
      if (pathMatch) {
        filePath = pathMatch[1].trim();
      }

      if (!filePath && match[1].includes(':')) {
        filePath = match[1].split(':').slice(1).join(':').trim();
      }

      if (filePath) {
        const content = lines.slice(pathMatch ? 1 : 0).join('\n').trim();
        calls.push({ tool: 'write_file', params: { path: filePath, content } });
      }
    }
    return calls;
  }

  private logError(task: Task, message: string): void {
    const store = useGameStore.getState();
    store.addEvent({
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'error',
      message,
      agentId: null,
      taskId: task.id,
    });
  }
}

export const simpleRuntime = new SimpleRuntime();
