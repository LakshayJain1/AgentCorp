import { ToolResult } from '@/agents/AgentTypes';

// P0 seam: capability names agents may request. Backends decide what actually runs.
// - Vercel serverless: direct fs/exec CANNOT work (read-only fs except ephemeral /tmp,
//   no child_process/shell/docker, 10-60s timeouts). All file/exec capabilities report disabled.
// - Electron desktop: full Node (fs, child_process, git, docker) — implemented in P1 as DesktopExecutor.
export type ToolCapability =
  | 'read_file'
  | 'write_file'
  | 'patch_file'
  | 'search_code'
  | 'run_command'
  | 'run_tests';

export type ExecutorEnv = 'vercel' | 'desktop';

export interface ToolExecutor {
  readonly env: ExecutorEnv;
  capabilities(): ToolCapability[];
  execute(
    capability: ToolCapability,
    params: Record<string, string>,
  ): Promise<ToolResult>;
}

export const ALL_TOOL_CAPABILITIES: ToolCapability[] = [
  'read_file',
  'write_file',
  'patch_file',
  'search_code',
  'run_command',
  'run_tests',
];

// Vercel-safe backend: advertises no file/exec capabilities and explains why.
export class VercelExecutor implements ToolExecutor {
  readonly env: ExecutorEnv = 'vercel';

  capabilities(): ToolCapability[] {
    return [];
  }

  async execute(
    capability: ToolCapability,
    params: Record<string, string>,
  ): Promise<ToolResult> {
    const start = performance.now();
    return {
      success: false,
      output: '',
      error:
        `disabled: vercel-readonly — '${capability}' cannot run on Vercel serverless ` +
        `(read-only filesystem, no shell/docker). Use the desktop app for full execution. ` +
        `Params received: ${Object.keys(params).join(',') || 'none'}.`,
      duration: performance.now() - start,
    };
  }
}

declare global {
  interface Window {
    agentcorpDesktop?: { available?: boolean };
    electronAPI?: {
      fs: {
        read: (relPath: string) => Promise<{ ok: boolean; content?: string; error?: string }>;
        write: (relPath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
        search: (pattern: string, relDir?: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
      };
      exec: {
        run: (cmd: string, args: string[], relCwd?: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
      };
    };
  }
}

// Detection hook: returns 'desktop' only when the Electron preload bridge exists.
export function detectExecutorEnv(): ExecutorEnv {
  try {
    if (typeof window !== 'undefined' && window.agentcorpDesktop?.available) return 'desktop';
  } catch {
    // SSR — default to vercel-safe
  }
  return 'vercel';
}

// Capability matrix for UI/consumers: which capabilities run in the current env.
export function getCapabilityMatrix(env: ExecutorEnv): Record<ToolCapability, 'ready' | 'disabled: vercel-readonly'> {
  const ready = env === 'desktop';
  return {
    read_file: ready ? 'ready' : 'disabled: vercel-readonly',
    write_file: ready ? 'ready' : 'disabled: vercel-readonly',
    patch_file: ready ? 'ready' : 'disabled: vercel-readonly',
    search_code: ready ? 'ready' : 'disabled: vercel-readonly',
    run_command: ready ? 'ready' : 'disabled: vercel-readonly',
    run_tests: ready ? 'ready' : 'disabled: vercel-readonly',
  };
}

// Desktop executor: routes tool calls through the Electron IPC bridge.
// Sandboxed to the user's chosen workspace root on the main process side.
export class DesktopExecutor implements ToolExecutor {
  readonly env: ExecutorEnv = 'desktop';

  capabilities(): ToolCapability[] {
    return [...ALL_TOOL_CAPABILITIES];
  }

  async execute(capability: ToolCapability, params: Record<string, string>): Promise<ToolResult> {
    const start = performance.now();
    const done = (r: Omit<ToolResult, 'duration'>): ToolResult => ({ ...r, duration: performance.now() - start });
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!api) return done({ success: false, output: '', error: 'DesktopExecutor: electronAPI not available' });

    try {
      if (capability === 'read_file') {
        if (!params.path) return done({ success: false, output: '', error: 'read_file: missing path' });
        const r = await api.fs.read(params.path);
        return r.ok ? done({ success: true, output: r.content ?? '' }) : done({ success: false, output: '', error: r.error });
      }
      if (capability === 'write_file' || capability === 'patch_file') {
        if (!params.path || params.content === undefined) return done({ success: false, output: '', error: `${capability}: missing path or content` });
        const r = await api.fs.write(params.path, params.content);
        return r.ok ? done({ success: true, output: `wrote ${params.path}` }) : done({ success: false, output: '', error: r.error });
      }
      if (capability === 'search_code') {
        if (!params.pattern) return done({ success: false, output: '', error: 'search_code: missing pattern' });
        const r = await api.fs.search(params.pattern, params.dir);
        return r.ok ? done({ success: true, output: r.output ?? '' }) : done({ success: false, output: '', error: r.error });
      }
      if (capability === 'run_command' || capability === 'run_tests') {
        const cmd = params.cmd || (capability === 'run_tests' ? 'npx' : '');
        const args = params.args ? params.args.split(' ') : (capability === 'run_tests' ? ['vitest', 'run'] : []);
        if (!cmd) return done({ success: false, output: '', error: `${capability}: missing cmd` });
        const r = await api.exec.run(cmd, args, params.cwd);
        return r.ok ? done({ success: true, output: r.output ?? '' }) : done({ success: false, output: r.output ?? '', error: r.error });
      }
      return done({ success: false, output: '', error: `unknown capability: ${capability}` });
    } catch (e) {
      return done({ success: false, output: '', error: String(e) });
    }
  }
}

export function getToolExecutor(): ToolExecutor {
  if (detectExecutorEnv() === 'desktop') return new DesktopExecutor();
  return new VercelExecutor();
}
