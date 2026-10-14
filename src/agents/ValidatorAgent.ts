import { useGameStore } from '@/store/gameStore';
import { SubTask, ValidationResult } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';
import { detectExecutorEnv } from '@/execution/ToolExecutor';

interface QueuedValidation {
  subtask: SubTask;
  queuedAt: number;
  retryCount: number;
}

export class ValidatorAgent {
  private queue: QueuedValidation[] = [];
  private completed: Array<{ subtask: SubTask; result: ValidationResult }> = [];
  private processing = false;

  enqueueValidation(subtask: SubTask): void {
    if (this.queue.some((q) => q.subtask.id === subtask.id)) return;
    this.queue.push({ subtask, queuedAt: Date.now(), retryCount: 0 });
  }

  async processQueuedValidations(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    try {
      const item = this.queue.shift()!;
      const store = useGameStore.getState();

      store.addEvent({
        id: `val_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: 'validation',
        message: `Validating deliverable: "${item.subtask.description.slice(0, 50)}..."`,
        agentId: null,
        taskId: item.subtask.parentTaskId,
      });

      const result = await this.runValidation(item.subtask, item.retryCount);
      this.completed.push({ subtask: item.subtask, result });
    } finally {
      this.processing = false;
    }
  }

  private async runDesktopChecks(subtask: SubTask, details: string[]): Promise<boolean> {
    // Only run on desktop and only when the subtask specifies a verify command
    if (detectExecutorEnv() !== 'desktop') return false;
    if (!subtask.verifyCommand) return false;

    const api = typeof window !== 'undefined'
      ? (window as unknown as { electronAPI?: { exec: { run: (cmd: string, args: string[], cwd?: string) => Promise<{ ok: boolean; output?: string; error?: string }> } } }).electronAPI
      : undefined;
    if (!api) return false;

    let anyCheckRan = false;

    if (subtask.verifyCommand.includes('typecheck')) {
      const r = await api.exec.run('npx', ['tsc', '--noEmit']);
      anyCheckRan = true;
      if (r.ok) {
        details.push('TypeScript check: PASSED');
      } else {
        const errCount = (r.output?.match(/error TS/g) || []).length;
        details.push(`TypeScript check: FAILED (${errCount} errors)`);
      }
    }

    if (subtask.verifyCommand.includes('lint')) {
      const r = await api.exec.run('npx', ['eslint', '--ext', '.ts,.tsx', 'src', '--format', 'compact']);
      anyCheckRan = true;
      const errLines = (r.output?.split('\n').filter((l) => l.includes(': error ')).length) ?? 0;
      if (r.ok || errLines === 0) {
        details.push('ESLint check: PASSED');
      } else {
        details.push(`ESLint check: FAILED (${errLines} errors)`);
      }
    }

    if (subtask.verifyCommand.includes('test')) {
      const r = await api.exec.run('npx', ['vitest', 'run']);
      anyCheckRan = true;
      if (r.ok) {
        details.push('Tests: PASSED');
      } else {
        details.push(`Tests: FAILED — ${(r.output || '').slice(0, 200)}`);
      }
    }

    return anyCheckRan;
  }

  private async runValidation(subtask: SubTask, retryCount: number): Promise<ValidationResult> {
    const details: string[] = [];

    if (subtask.deliverable && subtask.deliverable.length > 0) {
      details.push(`Deliverable size: ${subtask.deliverable.length} chars`);

      if (subtask.deliverable.length >= 50) {
        details.push('Content length check: PASSED');
      } else {
        details.push('Content length check: FAILED (too short)');
      }

      // Run real local checks on desktop when the subtask has a verify command
      const ranChecks = await this.runDesktopChecks(subtask, details);

      // Only call AI review if no real checks ran (avoid redundant cost)
      if (!ranChecks) {
        const aiResult = await toolRegistry.executeTool('ask_agent', {
          agentRole: 'qa',
          question: `Validate this deliverable for task "${subtask.description}":\n${subtask.deliverable.slice(0, 1500)}\n\nReturn VALID or INVALID with a brief reason.`,
        });

        if (aiResult.success && aiResult.output) {
          const isValid = /VALID/i.test(aiResult.output) && !/INVALID/i.test(aiResult.output);
          details.push(`AI review: ${isValid ? 'PASSED' : 'FAILED'}`);
          details.push(`Review: ${aiResult.output.slice(0, 200)}`);
        }
      }
    } else {
      details.push('Content length check: FAILED (empty)');
    }

    // P3a: real CI verdict when the subtask links a repo ref. Fail-closed on
    // CI failure; pending CI never passes on its own (falls back to base score).
    let ciFailed = false;
    if (subtask.repoRef?.repo && subtask.repoRef?.ref) {
      try {
        const url = `/api/github/checks?repo=${encodeURIComponent(subtask.repoRef.repo)}&ref=${encodeURIComponent(subtask.repoRef.ref)}`;
        const res = await fetch(url);
        const data = (await res.json().catch(() => null)) as {
          success?: boolean;
          verdict?: string;
          details?: string[];
          error?: string;
        } | null;
        if (res.ok && data?.success) {
          details.push(`CI checks (${subtask.repoRef.ref}): ${data.verdict?.toUpperCase()}`);
          for (const d of (data.details ?? []).slice(0, 10)) details.push(d);
          ciFailed = data.verdict === 'fail';
        } else {
          details.push(`CI checks: UNAVAILABLE (${(data?.error ?? `http ${res.status}`).slice(0, 120)})`);
        }
      } catch (e) {
        details.push(`CI checks: UNAVAILABLE (${String(e).slice(0, 120)})`);
      }
    }

    const score = this.computeScore(details);
    if (ciFailed) {
      return {
        passed: false,
        score: Math.min(score, 40),
        details,
        typeCheckOutput: '',
        lintOutput: '',
        testOutput: '',
        validatorAgentId: 'validator',
        validatedAt: Date.now(),
        retryCount,
      };
    }

    return {
      passed: score >= 60,
      score,
      details,
      typeCheckOutput: '',
      lintOutput: '',
      testOutput: '',
      validatorAgentId: 'validator',
      validatedAt: Date.now(),
      retryCount,
    };
  }

  private computeScore(details: string[]): number {
    let score = 50;
    if (details.some((d) => d.startsWith('Content length check: PASSED'))) score += 10;
    if (details.some((d) => d.startsWith('AI review: PASSED'))) score += 20;
    // Real check results (desktop) carry more weight than AI review
    if (details.some((d) => d.startsWith('TypeScript check: PASSED'))) score += 15;
    if (details.some((d) => d.startsWith('ESLint check: PASSED'))) score += 10;
    if (details.some((d) => d.startsWith('Tests: PASSED'))) score += 15;
    // Penalise real failures
    if (details.some((d) => d.startsWith('TypeScript check: FAILED'))) score -= 30;
    if (details.some((d) => d.startsWith('ESLint check: FAILED'))) score -= 15;
    if (details.some((d) => d.startsWith('Tests: FAILED'))) score -= 20;
    return Math.min(100, Math.max(0, score));
  }

  getCompletedValidations(): Array<{ subtask: SubTask; result: ValidationResult }> {
    const done = [...this.completed];
    this.completed = [];
    return done;
  }
}
