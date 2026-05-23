import { ToolDefinition, ToolResult } from '@/agents/AgentTypes';

interface ToolHandler {
  definition: ToolDefinition;
  execute: (params: Record<string, string>) => Promise<ToolResult>;
}

class ToolRegistry {
  private tools: Map<string, ToolHandler> = new Map();

  constructor() {
    this.register({
      definition: {
        name: 'read_file',
        description: 'Read the contents of a file at the given path',
        parameters: { path: 'string' },
      },
      execute: async ({ path }) => {
        const start = performance.now();
        try {
          const res = await fetch('/api/tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'read_file', params: { path } }),
          });
          const data = await res.json();
          return { success: data.success, output: data.output, duration: performance.now() - start };
        } catch (e) {
          return { success: false, output: '', error: String(e), duration: performance.now() - start };
        }
      },
    });

    this.register({
      definition: {
        name: 'write_file',
        description: 'Write content to a file at the given path',
        parameters: { path: 'string', content: 'string' },
      },
      execute: async ({ path, content }) => {
        const start = performance.now();
        try {
          const res = await fetch('/api/tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'write_file', params: { path, content } }),
          });
          const data = await res.json();
          return { success: data.success, output: `Wrote ${content.length} bytes to ${path}`, duration: performance.now() - start };
        } catch (e) {
          return { success: false, output: '', error: String(e), duration: performance.now() - start };
        }
      },
    });

    this.register({
      definition: {
        name: 'search_files',
        description: 'Search for files matching a glob pattern',
        parameters: { pattern: 'string' },
      },
      execute: async ({ pattern }) => {
        const start = performance.now();
        try {
          const res = await fetch('/api/tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'search_files', params: { pattern } }),
          });
          const data = await res.json();
          return { success: data.success, output: data.output, duration: performance.now() - start };
        } catch (e) {
          return { success: false, output: '', error: String(e), duration: performance.now() - start };
        }
      },
    });

    this.register({
      definition: {
        name: 'read_directory',
        description: 'List files and directories in a directory',
        parameters: { path: 'string' },
      },
      execute: async ({ path }) => {
        const start = performance.now();
        try {
          const res = await fetch('/api/tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'read_directory', params: { path } }),
          });
          const data = await res.json();
          return { success: data.success, output: data.output, duration: performance.now() - start };
        } catch (e) {
          return { success: false, output: '', error: String(e), duration: performance.now() - start };
        }
      },
    });

    this.register({
      definition: {
        name: 'execute_command',
        description: 'Run a terminal command on the host system',
        parameters: { command: 'string', workdir: 'string' },
      },
      execute: async ({ command, workdir }) => {
        const start = performance.now();
        try {
          const res = await fetch('/api/tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'execute_command', params: { command, workdir: workdir || '' } }),
          });
          const data = await res.json();
          return { success: data.success, output: data.output, duration: performance.now() - start };
        } catch (e) {
          return { success: false, output: '', error: String(e), duration: performance.now() - start };
        }
      },
    });

    this.register({
      definition: {
        name: 'search_codebase',
        description: 'Search for text patterns in the codebase',
        parameters: { pattern: 'string', include: 'string' },
      },
      execute: async ({ pattern, include }) => {
        const start = performance.now();
        try {
          const res = await fetch('/api/tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'search_codebase', params: { pattern, include: include || '' } }),
          });
          const data = await res.json();
          return { success: data.success, output: data.output, duration: performance.now() - start };
        } catch (e) {
          return { success: false, output: '', error: String(e), duration: performance.now() - start };
        }
      },
    });

    this.register({
      definition: {
        name: 'ask_agent',
        description: 'Send a message to another agent and get their response',
        parameters: { agentRole: 'string', question: 'string' },
      },
      execute: async ({ agentRole, question }) => {
        const start = performance.now();
        try {
          const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: question, role: agentRole, action: 'chat' }),
          });
          const data = await res.json();
          return { success: true, output: data.content || 'No response', duration: performance.now() - start };
        } catch (e) {
          return { success: false, output: '', error: String(e), duration: performance.now() - start };
        }
      },
    });
  }

  private register(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  getTool(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async executeTool(
    name: string,
    params: Record<string, string>,
    onLog?: (log: { action: string; tool: string; input: string; output: string; status: 'running' | 'success' | 'error' }) => void,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${name}`, duration: 0 };
    }

    onLog?.({
      action: `Executing ${name}`,
      tool: name,
      input: JSON.stringify(params),
      output: '',
      status: 'running',
    });

    const result = await tool.execute(params);

    onLog?.({
      action: result.success ? `${name} completed` : `${name} failed`,
      tool: name,
      input: JSON.stringify(params),
      output: result.output || result.error || '',
      status: result.success ? 'success' : 'error',
    });

    return result;
  }
}

export const toolRegistry = new ToolRegistry();
