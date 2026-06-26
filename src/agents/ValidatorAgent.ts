import { useGameStore } from '@/store/gameStore';
import { SubTask, ValidationResult } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

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

  private async runValidation(subtask: SubTask, retryCount: number): Promise<ValidationResult> {
    const details: string[] = [];

    if (subtask.deliverable && subtask.deliverable.length > 0) {
      details.push(`Deliverable size: ${subtask.deliverable.length} chars`);

      if (subtask.deliverable.length >= 50) {
        details.push('Content length check: PASSED');
      } else {
        details.push('Content length check: FAILED (too short)');
      }

      const aiResult = await toolRegistry.executeTool('ask_agent', {
        agentRole: 'qa',
        question: `Validate this deliverable for task "${subtask.description}":\n${subtask.deliverable.slice(0, 1500)}\n\nReturn VALID or INVALID with a brief reason.`,
      });

      if (aiResult.success && aiResult.output) {
        const isValid = /VALID/i.test(aiResult.output) && !/INVALID/i.test(aiResult.output);
        details.push(`AI review: ${isValid ? 'PASSED' : 'FAILED'}`);
        details.push(`Review: ${aiResult.output.slice(0, 200)}`);
      }
    } else {
      details.push('Content length check: FAILED (empty)');
    }

    const score = this.computeScore(details);

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
    if (details.some((d) => d.startsWith('Content length check: PASSED'))) score += 20;
    if (details.some((d) => d.startsWith('AI review: PASSED'))) score += 30;
    return Math.min(100, Math.max(0, score));
  }

  getCompletedValidations(): Array<{ subtask: SubTask; result: ValidationResult }> {
    const done = [...this.completed];
    this.completed = [];
    return done;
  }
}
