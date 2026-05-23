import { BaseWorkerAgent, AgentStep } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { MemoryStore } from '@/memory/MemoryStore';

export class ResearchAgent extends BaseWorkerAgent {
  private memStore: MemoryStore;

  constructor(agentId: string, memStore: MemoryStore) {
    super(agentId);
    this.memStore = memStore;
  }

  getWorkerRole(): WorkerRole {
    return 'research_worker';
  }

  protected async getExecutionSteps(subtask: SubTask): Promise<AgentStep[]> {
    const relevantMemories = this.memStore.findRelevant(this.agentId, subtask.description, 3);
    const memoryContext = relevantMemories.length > 0
      ? `Relevant past knowledge:\n${relevantMemories.map((m) => `- ${m.content}`).join('\n')}`
      : '';

    return [
      {
        tool: 'search_codebase', required: false,
        params: { pattern: subtask.description.split(' ').slice(0, 3).join(' '), include: '' },
        description: 'Searching codebase for relevant code',
        storeAs: 'search_results',
      },
      {
        tool: 'read_directory', required: false,
        params: { path: 'src' },
        description: 'Exploring project structure',
        storeAs: 'project_structure',
      },
      {
        tool: 'ask_agent', required: true,
        params: {
          agentRole: 'researcher',
          question: `Research task: "${subtask.description}"

${memoryContext}

Project structure:
{project_structure}

Search results:
{search_results}

Provide a thorough research report with findings, analysis, and recommendations. Return structured markdown.`,
        },
        description: 'Conducting research analysis',
        storeAs: 'research_content',
      },
      {
        tool: 'write_file', required: true,
        params: { path: `deliverables/research_${Date.now()}.md`, content: '{research_content}' },
        description: 'Writing research report',
      },
    ];
  }
}
