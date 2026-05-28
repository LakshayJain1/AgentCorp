import { BaseWorkerAgent, AgentStep } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';

export class DeveloperAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'developer';
  }

  protected async getExecutionSteps(subtask: SubTask): Promise<AgentStep[]> {
    if (subtask.type === 'documentation') {
      return this.getDocSteps(subtask);
    }
    if (subtask.type === 'analysis') {
      return this.getAnalysisSteps(subtask);
    }
    return this.getCodeSteps(subtask);
  }

  private async getCodeSteps(subtask: SubTask): Promise<AgentStep[]> {
    return [
      {
        tool: 'search_codebase', required: false,
        params: { pattern: subtask.description.split(' ').slice(0, 3).join(' '), include: '' },
        description: 'Searching relevant code for task',
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
          agentRole: 'engineer',
          question: `Task: "${subtask.description}"

Project structure:
{project_structure}

Search results:
{search_results}

${this.retryDetails.length > 0 ? `PREVIOUS ATTEMPT FEEDBACK:\n${this.retryDetails.join('\n')}\n\nAddress each issue above.` : ''}

What single file path should I create or modify? Return ONLY the file path.`,
        },
        description: 'Planning file path',
        storeAs: 'file_path',
      },
      {
        tool: 'read_file', required: false,
        params: { path: '{file_path}' },
        description: 'Reading target file',
        storeAs: 'existing_content',
      },
      {
        tool: 'ask_agent', required: true,
        params: {
          agentRole: 'engineer',
          question: `Generate the complete file content for:
FILE: {file_path}
TASK: "${subtask.description}"

Existing content:
{existing_content}

Use TypeScript, Tailwind CSS, lucide-react for icons. Return ONLY the raw file content, no markdown fences.`,
        },
        description: 'Generating file content',
        storeAs: 'file_content',
      },
      {
        tool: 'write_file', required: true,
        params: { path: '{file_path}', content: '{file_content}' },
        description: 'Writing file to project',
      },
      {
        tool: 'execute_command', required: false,
        params: { command: 'npx tsc --noEmit 2>&1 | head -20', workdir: '' },
        description: 'Verifying TypeScript compilation',
        storeAs: 'verify_result',
      },
    ];
  }

  private async getDocSteps(subtask: SubTask): Promise<AgentStep[]> {
    return [
      {
        tool: 'ask_agent', required: true,
        params: {
          agentRole: 'engineer',
          question: `Generate documentation for: "${subtask.description}"
Return ONLY the raw markdown content, no fences.`,
        },
        description: 'Generating documentation',
        storeAs: 'file_content',
      },
      {
        tool: 'write_file', required: true,
        params: { path: `deliverables/docs_${Date.now()}.md`, content: '{file_content}' },
        description: 'Writing documentation',
      },
    ];
  }

  private async getAnalysisSteps(subtask: SubTask): Promise<AgentStep[]> {
    return [
      {
        tool: 'search_codebase', required: false,
        params: { pattern: subtask.description.split(' ').slice(0, 3).join(' '), include: '' },
        description: 'Searching codebase for analysis',
        storeAs: 'search_results',
      },
      {
        tool: 'ask_agent', required: true,
        params: {
          agentRole: 'engineer',
          question: `Analyze the following for task "${subtask.description}":
{search_results}
Return a structured analysis with findings and recommendations.`,
        },
        description: 'Performing analysis',
        storeAs: 'file_content',
      },
      {
        tool: 'write_file', required: true,
        params: { path: `deliverables/analysis_${Date.now()}.md`, content: '{file_content}' },
        description: 'Writing analysis report',
      },
    ];
  }
}