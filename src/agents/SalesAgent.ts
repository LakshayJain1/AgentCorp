import { BaseWorkerAgent } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

export class SalesAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'sales_worker';
  }

  protected async generateDeliverable(subtask: SubTask): Promise<string> {
    const isSalesPitch = /pitch|deck|proposal|outreach|email|prospect|lead|crm|pipeline/i.test(subtask.description);
    const isPricingDoc = /pric|tier|plan|packaging|monetiz/i.test(subtask.description);

    let prompt: string;

    if (isSalesPitch) {
      prompt = `You are a senior sales strategist at AgentCorp. Create a professional sales document for: "${subtask.description}"

Produce a complete pitch deck outline in markdown with the following slides:
1. **Cover** — Company name, tagline, presenter
2. **Problem** — The pain point being solved (3 bullet points)
3. **Solution** — What we offer and how it works
4. **Market Opportunity** — TAM/SAM/SOM with numbers
5. **Product Demo** — Key features and screenshots description
6. **Business Model** — How we make money
7. **Traction** — Key metrics, customers, growth
8. **Go-to-Market** — Channels, ICP, launch strategy
9. **Team** — Key hires and backgrounds
10. **Ask** — Funding amount, use of funds, timeline

For each slide include: speaker notes, key talking points, and data to gather.
Return ONLY the markdown content, no fences.`;
    } else if (isPricingDoc) {
      prompt = `You are a sales strategist at AgentCorp. Create a detailed pricing strategy document for: "${subtask.description}"

Include:
- Pricing philosophy and model (subscription/usage/hybrid)
- 3 pricing tiers with feature matrices
- Competitive pricing analysis framework
- Discount and negotiation guidelines
- Revenue projections per tier

Return ONLY the markdown content.`;
    } else {
      prompt = `You are a sales strategist at AgentCorp. Create a comprehensive sales document for: "${subtask.description}"

Include: executive summary, target customer profile (ICP), value proposition, objection handling guide, and recommended next steps.
Format in professional markdown. Return ONLY the content.`;
    }

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: 'sales',
      question: prompt,
    });

    return result.success ? result.output : '';
  }
}
