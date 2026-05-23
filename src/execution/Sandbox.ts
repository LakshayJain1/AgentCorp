import { SandboxConfig } from '@/agents/AgentTypes';

export class Sandbox {
  private config: SandboxConfig;
  private activeProcesses: Map<string, { startTime: number }> = new Map();

  constructor(config?: Partial<SandboxConfig>) {
    this.config = {
      enabled: false,
      timeout: 30000,
      allowedPaths: ['src', 'deliverables'],
      allowedCommands: ['ls', 'cat', 'node', 'npm', 'npx', 'tsc', 'pwd', 'echo', 'grep', 'find'],
      ...config,
    };
  }

  async validatePath(requestedPath: string): Promise<{ allowed: boolean; resolvedPath: string; error?: string }> {
    const normalized = requestedPath.replace(/^\/+/, '');
    const isAllowed = this.config.allowedPaths.some((p) => normalized.startsWith(p));

    if (!isAllowed) {
      return {
        allowed: false,
        resolvedPath: normalized,
        error: `Path "${normalized}" not in allowed paths: ${this.config.allowedPaths.join(', ')}`,
      };
    }

    if (normalized.includes('..')) {
      return {
        allowed: false,
        resolvedPath: normalized,
        error: 'Path traversal detected',
      };
    }

    return { allowed: true, resolvedPath: normalized };
  }

  async validateCommand(command: string): Promise<{ allowed: boolean; error?: string }> {
    const cmdName = command.split(/\s+/)[0];
    const isAllowed = this.config.allowedCommands.some((c) => cmdName === c);

    if (!isAllowed) {
      return {
        allowed: false,
        error: `Command "${cmdName}" not in allowed list`,
      };
    }

    return { allowed: true };
  }

  startProcess(id: string): void {
    this.activeProcesses.set(id, { startTime: Date.now() });
  }

  stopProcess(id: string): void {
    this.activeProcesses.delete(id);
  }

  isTimedOut(id: string): boolean {
    const proc = this.activeProcesses.get(id);
    if (!proc) return false;
    return Date.now() - proc.startTime > this.config.timeout;
  }

  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const globalSandbox = new Sandbox();
