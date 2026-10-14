import { detectExecutorEnv } from '@/execution/ToolExecutor';

export interface DiscoveredTask {
  title: string;
  source: string;
  contextFile?: string;
}

export class TaskDiscovery {
  async scanProject(): Promise<DiscoveredTask[]> {
    if (detectExecutorEnv() !== 'desktop') return [];
    const api = typeof window !== 'undefined'
      ? (window as unknown as { electronAPI?: { exec: { run: (cmd: string, args: string[], cwd?: string) => Promise<{ ok: boolean; output?: string; error?: string }> } } }).electronAPI
      : undefined;
    if (!api) return [];

    const tasks: DiscoveredTask[] = [];

    // TypeScript error count
    try {
      const tsc = await api.exec.run('npx', ['tsc', '--noEmit', '--pretty', 'false']);
      const output = tsc.output || '';
      // Count "error TS" occurrences
      const errorCount = (output.match(/error TS/g) || []).length;
      if (errorCount > 0) {
        tasks.push({
          title: `Fix ${errorCount} TypeScript error${errorCount > 1 ? 's' : ''} in the codebase`,
          source: 'tsc',
          contextFile: 'tsconfig.json',
        });
      }
    } catch {
      // tsc not available — skip
    }

    // ESLint error count
    try {
      const lint = await api.exec.run('npx', ['eslint', '--ext', '.ts,.tsx', 'src', '--format', 'compact']);
      const output = lint.output || '';
      const errorLines = output.split('\n').filter((l) => l.includes(': error ')).length;
      if (errorLines > 0) {
        tasks.push({
          title: `Resolve ${errorLines} ESLint error${errorLines > 1 ? 's' : ''} across src/`,
          source: 'eslint',
        });
      }
    } catch {
      // eslint not available — skip
    }

    return tasks;
  }
}

export const taskDiscovery = new TaskDiscovery();
