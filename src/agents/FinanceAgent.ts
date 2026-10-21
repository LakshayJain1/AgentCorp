import { BaseWorkerAgent } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

export class FinanceAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'finance_worker';
  }

  protected async generateDeliverable(subtask: SubTask): Promise<string> {
    const isProjection = /projection|forecast|model|revenue|burn|runway|p&l|profit|loss/i.test(subtask.description);
    const isBudget = /budget|spend|cost|expense|allocation|headcount/i.test(subtask.description);
    const isReport = /report|statement|balance|cash flow|financ/i.test(subtask.description);

    let prompt: string;

    if (isProjection) {
      prompt = `You are a CFO-level finance analyst at AgentCorp. Create a financial projection document for: "${subtask.description}"

Include:
## Financial Projections

### Revenue Model
- Pricing assumptions (monthly/annual)
- Customer acquisition projections (Month 1–12)
- MRR/ARR growth table

### Cost Structure
- Fixed costs (salaries, infrastructure, tools)
- Variable costs (per customer)
- One-time costs (setup, legal, marketing)

### P&L Summary (12-month)
| Month | Revenue | COGS | Gross Profit | OpEx | Net Income |
(fill with realistic placeholder numbers)

### Key Metrics
- CAC, LTV, LTV:CAC ratio
- Gross margin %
- Burn rate and runway (months)
- Break-even month

### Assumptions & Risks
Return ONLY the markdown content.`;
    } else if (isBudget) {
      prompt = `You are a finance analyst at AgentCorp. Create a detailed budget plan for: "${subtask.description}"

Include department-level budget allocation, quarterly breakdown, and variance tracking framework.
Format as a structured markdown document with tables. Return ONLY the content.`;
    } else if (isReport) {
      prompt = `You are a finance analyst at AgentCorp. Produce a financial report for: "${subtask.description}"

Include executive summary, key financial metrics, trend analysis, and strategic recommendations.
Format in professional markdown with tables and clear sections. Return ONLY the content.`;
    } else {
      prompt = `You are a finance analyst at AgentCorp. Create a financial analysis document for: "${subtask.description}"

Include: key financial metrics, data-driven analysis, risks and opportunities, and actionable recommendations.
Return ONLY the markdown content.`;
    }

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: 'finance',
      question: prompt,
    });

    return result.success ? result.output : '';
  }
}
