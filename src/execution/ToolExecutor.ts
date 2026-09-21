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
    agentcorpDesktop?: { execute?: unknown };
  }
}

// Detection hook for P1: returns 'desktop' only when the Electron preload bridge exists.
export function detectExecutorEnv(): ExecutorEnv {
  try {
    if (typeof window !== 'undefined' && window.agentcorpDesktop) return 'desktop';
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

export function getToolExecutor(): ToolExecutor {
  // P0: always Vercel-safe. P1 adds DesktopExecutor when detectExecutorEnv() === 'desktop'.
  return new VercelExecutor();
}
