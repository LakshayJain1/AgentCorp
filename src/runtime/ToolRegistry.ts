import { ToolDefinition, ToolResult } from '@/agents/AgentTypes';
import { WorkspaceScope } from '@/connectors/ConnectorTypes';
import { ToolCapability } from '@/execution/ToolExecutor';

const FILE_EXEC_CAPABILITIES: ToolCapability[] = [
  'read_file',
  'write_file',
  'patch_file',
  'search_code',
  'run_command',
  'run_tests',
];

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

  // P2-dev: repo-backed capabilities via server API routes (token stays server-side).
  private async executeRepoCapability(
    capability: ToolCapability,
    params: Record<string, string>,
    scope: WorkspaceScope,
  ): Promise<ToolResult> {
    const start = performance.now();
    const done = (r: Omit<ToolResult, 'duration'>): ToolResult => ({ ...r, duration: performance.now() - start });
    try {
      if (capability === 'read_file') {
        if (!params.path) return done({ success: false, output: '', error: 'read_file needs path' });
        const url = `/api/github/file?repo=${encodeURIComponent(scope.repo)}&path=${encodeURIComponent(params.path)}${params.ref ? `&ref=${encodeURIComponent(params.ref)}` : ''}`;
        const res = await fetch(url);
        const data = (await res.json().catch(() => null)) as { success?: boolean; content?: string; error?: string } | null;
        if (!res.ok || !data?.success) return done({ success: false, output: '', error: data?.error ?? `read failed (${res.status})` });
        return done({ success: true, output: data.content ?? '' });
      }
      if (capability === 'write_file' || capability === 'patch_file') {
        if (!params.path || params.content === undefined) {
          return done({ success: false, output: '', error: `${capability} needs path + content` });
        }
        const res = await fetch('/api/github/propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo: scope.repo,
            path: params.path,
            content: params.content,
            message: params.message || `AgentCorp: ${capability} ${params.path}`,
            base: params.base || 'main',
          }),
        });
        const data = (await res.json().catch(() => null)) as { success?: boolean; branch?: string; prUrl?: string | null; error?: string } | null;
        if (!res.ok || !data?.success) return done({ success: false, output: '', error: data?.error ?? `propose failed (${res.status})` });
        return done({ success: true, output: `branch=${data.branch} pr=${data.prUrl ?? 'pending'}` });
      }
      return done({
        success: false,
        output: '',
        error: `disabled: '${capability}' needs a job runner (P3) — reads/writes go via GitHub API; exec/tests run on desktop or CI.`,
      });
    } catch (e) {
      return done({ success: false, output: '', error: String(e) });
    }
  }

  async executeTool(
    name: string,
    params: Record<string, string>,
    onLog?: (log: { action: string; tool: string; input: string; output: string; status: 'running' | 'success' | 'error' }) => void,
    scope?: WorkspaceScope,
  ): Promise<ToolResult> {
    console.log('[AgentCorp] executeTool called:', name, Object.keys(params));
    // File/exec capabilities route through server APIs scoped to the USER's repo —
    // never direct fs, token never leaves the server. Without a connected repo
    // scope they are denied by construction (per-user isolation).
    if ((FILE_EXEC_CAPABILITIES as string[]).includes(name)) {
      const capability = name as ToolCapability;
      if (!scope || !scope.repo) {
        return {
          success: false,
          output: '',
          error: `denied: no-connected-repo — '${capability}' requires the user to connect their own repo first (scope userId/workspaceId/repo).`,
          duration: 0,
        };
      }
      return this.executeRepoCapability(capability, params, scope);
    }
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
