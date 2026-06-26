import { ToolDefinition, ToolResult } from '@/agents/AgentTypes';

interface ToolHandler {
  definition: ToolDefinition;
  execute: (params: Record<string, string>) => Promise<ToolResult>;
}

class ToolRegistry {
  private tools: Map<string, ToolHandler> = new Map();

  constructor() {
    console.log('[AgentCorp] ToolRegistry constructed');
    this.register({
      definition: {
        name: 'ask_agent',
        description: 'Send a prompt to the AI and get a response. The primary tool for all agent work.',
        parameters: { agentRole: 'string', question: 'string' },
      },
      execute: async ({ agentRole, question }) => {
        const start = performance.now();
        console.log('[AgentCorp] ask_agent executing — role:', agentRole, 'question length:', question?.length);
        try {
          const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: question, role: agentRole, action: 'chat' }),
          });
          console.log('[AgentCorp] /api/ai response status:', res.status);
          if (!res.ok) {
            const errorText = await res.text().catch(() => 'unknown');
            console.error('[AgentCorp] /api/ai error:', res.status, errorText);
            return { success: false, output: '', error: `API returned ${res.status}: ${errorText}`, duration: performance.now() - start };
          }
          const data = await res.json();
          console.log('[AgentCorp] /api/ai response data keys:', Object.keys(data));
          return { success: true, output: data.content || 'No response', duration: performance.now() - start };
        } catch (e) {
          console.error('[AgentCorp] /api/ai fetch failed:', e);
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
    console.log('[AgentCorp] executeTool called:', name, Object.keys(params));
    const tool = this.tools.get(name);
    if (!tool) {
      console.error('[AgentCorp] unknown tool:', name);
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

    console.log('[AgentCorp] executeTool result:', name, 'success:', result.success, 'outputLength:', result.output?.length);
    return result;
  }
}

export const toolRegistry = new ToolRegistry();
