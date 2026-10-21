import { BaseWorkerAgent } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

export class OpsAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'ops_worker';
  }

  protected async generateDeliverable(subtask: SubTask): Promise<string> {
    const isSOP = /sop|process|procedure|workflow|runbook|playbook|checklist/i.test(subtask.description);
    const isOnboarding = /onboard|hiring|recruit|interview|orient/i.test(subtask.description);
    const isOKR = /okr|goal|kpi|metric|objective|milestone|roadmap/i.test(subtask.description);

    let prompt: string;

    if (isSOP) {
      prompt = `You are a senior operations manager at AgentCorp. Create a Standard Operating Procedure (SOP) for: "${subtask.description}"

Include:
## SOP: [Title]

**Version:** 1.0 | **Owner:** Operations | **Last Updated:** [date]

### Purpose
Why this process exists and what it achieves.

### Scope
Who this applies to and when.

### Prerequisites
Tools, permissions, or knowledge required before starting.

### Step-by-Step Procedure
1. Step one (with sub-steps if needed)
2. ...

### Quality Checks
How to verify each step was completed correctly.

### Escalation Path
Who to contact if something goes wrong.

### Revision History
Return ONLY the markdown content.`;
    } else if (isOnboarding) {
      prompt = `You are an operations manager at AgentCorp. Create a detailed onboarding plan for: "${subtask.description}"

Include: pre-day-one checklist, week 1 agenda, 30/60/90 day milestones, tools setup guide, and success criteria.
Format in clear markdown. Return ONLY the content.`;
    } else if (isOKR) {
      prompt = `You are an operations manager at AgentCorp. Create an OKR framework document for: "${subtask.description}"

Include: 3 Objectives, 3 Key Results per objective, measurement method, owner, and quarterly cadence.
Format as a structured markdown document. Return ONLY the content.`;
    } else {
      prompt = `You are an operations manager at AgentCorp. Create a detailed operational document for: "${subtask.description}"

Include: overview, process steps, responsible parties, tools required, success metrics, and review schedule.
Format in professional markdown. Return ONLY the content.`;
    }

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: 'ops',
      question: prompt,
    });

    return result.success ? result.output : '';
  }
}
