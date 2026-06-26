import { BaseWorkerAgent } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

export class DeveloperAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'developer';
  }

  protected async generateDeliverable(subtask: SubTask): Promise<string> {
    const systemPrompt = `You are a senior developer at AgentCorp. Generate the deliverable for: "${subtask.description}".

${
  subtask.type === 'documentation'
    ? 'Write comprehensive documentation in markdown.'
    : subtask.type === 'analysis'
    ? 'Write a detailed analysis with findings and recommendations.'
    : 'Write complete, production-ready code. Use TypeScript. Return ONLY the raw content, no markdown fences, no explanations.'
}`;

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: 'engineer',
      question: systemPrompt,
    });

    return result.success ? result.output : '';
  }
}
