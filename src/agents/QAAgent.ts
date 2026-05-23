import { BaseWorkerAgent, AgentStep } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';

export class QAAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'qa_worker';
  }

  protected async getExecutionSteps(subtask: SubTask): Promise<AgentStep[]> {
    return [
      {
        tool: 'execute_command', required: false,
        params: { command: 'npx tsc --noEmit 2>&1 | head -30', workdir: '' },
        description: 'Running TypeScript type check',
        storeAs: 'tsc_output',
      },
      {
        tool: 'execute_command', required: false,
        params: { command: 'npm run lint 2>&1 | head -20', workdir: '' },
        description: 'Running linter',
        storeAs: 'lint_output',
      },
      {
        tool: 'ask_agent', required: true,
        params: {
          agentRole: 'qa',
          question: `QA Review for task: "${subtask.description}"

TypeScript check:
{tsc_output}

Lint output:
{lint_output}

${subtask.deliverable ? `Deliverable preview:\n${subtask.deliverable.slice(0, 500)}` : ''}

Evaluate quality. Return QA_PASS or QA_FAIL with reason.`,
        },
        description: 'Performing QA review',
        storeAs: 'qa_result',
      },
    ];
  }
}
