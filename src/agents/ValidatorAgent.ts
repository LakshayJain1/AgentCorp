import { useGameStore } from '@/store/gameStore';
import { SubTask, ValidationResult } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';
import { agentMemory } from '@/runtime/AgentMemory';

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
        message: `Validating subtask: "${item.subtask.description.slice(0, 50)}..."`,
        agentId: null,
        taskId: item.subtask.parentTaskId,
      });

      const result = await this.runValidation(item.subtask, item.retryCount);

      this.completed.push({ subtask: item.subtask, result });

      if (result.passed) {
        agentMemory.addSharedMemory({
          type: 'knowledge',
          content: `Validation passed for: ${item.subtask.description}`,
          tags: ['validation', 'pass', item.subtask.type],
          importance: 3,
        });
      }
    } finally {
      this.processing = false;
    }
  }

  private async runValidation(subtask: SubTask, retryCount: number): Promise<ValidationResult> {
    const details: string[] = [];
    let typeCheckOutput = '';
    let testOutput = '';
    let lintOutput = '';

    if (subtask.type === 'code' || subtask.type === 'qa') {
      const tscResult = await toolRegistry.executeTool('execute_command', {
        command: 'npx tsc --noEmit 2>&1 | head -30',
        workdir: '',
      });
      typeCheckOutput = tscResult.output || '';
      if (tscResult.success && !typeCheckOutput.toLowerCase().includes('error')) {
        details.push('TypeScript compilation: PASSED');
      } else {
        details.push(`TypeScript compilation: FAILED\n${typeCheckOutput.slice(0, 200)}`);
      }

      const lintResult = await toolRegistry.executeTool('execute_command', {
        command: 'npx eslint src/ 2>&1 | head -20',
        workdir: '',
      });
      lintOutput = lintResult.output || '';
      if (lintResult.success || lintOutput.length === 0) {
        details.push('Lint check: PASSED');
      } else {
        details.push(`Lint check: ISSUES FOUND\n${lintOutput.slice(0, 200)}`);
      }
    }

    if (subtask.type === 'research' || subtask.type === 'analysis') {
      if (subtask.deliverable && subtask.deliverable.length > 100) {
        details.push('Content length check: PASSED');
      } else {
        details.push('Content length check: FAILED (too short)');
      }
    }

    const score = this.computeScore(details, typeCheckOutput);

    if (subtask.deliverable && subtask.deliverable.length > 0) {
      details.push(`Deliverable size: ${subtask.deliverable.length} bytes`);
    }

    return {
      passed: score >= 70,
      score,
      details,
      typeCheckOutput,
      lintOutput,
      testOutput,
      validatorAgentId: 'validator',
      validatedAt: Date.now(),
      retryCount,
    };
  }

  private computeScore(details: string[], tscOutput: string): number {
    let score = 50;

    const tscPassed = details.some((d) => d.startsWith('TypeScript compilation: PASSED'));
    if (tscPassed) score += 25;

    const lintPassed = details.some((d) => d.startsWith('Lint check: PASSED'));
    if (lintPassed) score += 15;

    const contentOk = details.some((d) => d.startsWith('Content length check: PASSED'));
    if (contentOk) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  getCompletedValidations(): Array<{ subtask: SubTask; result: ValidationResult }> {
    const done = [...this.completed];
    this.completed = [];
    return done;
  }
}
