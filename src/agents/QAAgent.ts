import { BaseWorkerAgent } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

export class QAAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'qa_worker';
  }

  protected async generateDeliverable(subtask: SubTask): Promise<string> {
    const deliverablePreview = subtask.deliverable
      ? `Deliverable to review:\n${subtask.deliverable.slice(0, 1000)}`
      : 'No deliverable provided for review.';

    const prompt = `You are a QA engineer at AgentCorp. Review the following deliverable for QA task: "${subtask.description}"

${deliverablePreview}

Evaluate: correctness, completeness, code quality, potential issues. Return QA_PASS or QA_FAIL with detailed reasoning. Format in markdown.`;

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: 'qa',
      question: prompt,
    });

    return result.success ? result.output : '';
  }
}
