import { BaseWorkerAgent } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

export class ResearchAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'research_worker';
  }

  protected async generateDeliverable(subtask: SubTask): Promise<string> {
    const prompt = `You are a researcher at AgentCorp. Produce a thorough research report for: "${subtask.description}"

Include: executive summary, methodology, key findings, analysis, and recommendations. Format in markdown. Return ONLY the content, no explanations.`;

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: 'researcher',
      question: prompt,
    });

    return result.success ? result.output : '';
  }
}
