import { BaseWorkerAgent } from './BaseWorkerAgent';
import { SubTask, WorkerRole } from './AgentTypes';
import { toolRegistry } from '@/runtime/ToolRegistry';

export class SalesAgent extends BaseWorkerAgent {
  getWorkerRole(): WorkerRole {
    return 'sales_worker';
  }

  protected async generateDeliverable(subtask: SubTask): Promise<string> {
    // deliverableType is set by AI classification at task creation — use it directly
    const type = subtask.deliverableType || 'gtm';

    const PROMPTS: Record<string, string> = {
      pitch: `You are a senior sales strategist. Create a complete investor/customer pitch deck in markdown for: "${subtask.description}"
Structure: Cover → Problem → Solution → Market Opportunity → Product → Business Model → Traction → Go-to-Market → Team → Ask.
For each slide: full content, speaker notes, key talking points. Return ONLY markdown, no fences.`,

      outreach: `You are a sales strategist. Create a complete multi-touch outreach sequence in markdown for: "${subtask.description}"
Include: cold email (pain-first, ≤120 words), 3-day follow-up, 10-day final bump, LinkedIn connection request (≤300 chars), LinkedIn DM, 30-second voicemail script.
For each: full copy, best send time, psychological hook. Return ONLY markdown.`,

      gtm: `You are a sales strategist. Write a comprehensive go-to-market strategy document in markdown for: "${subtask.description}"
Include: executive summary, ICP (3 segments), value prop per segment, channel strategy, 90-day launch timeline, competitive positioning, KPIs with targets, budget allocation. Use tables and bullets for scannability. Return ONLY markdown.`,

      proposal: `You are a sales strategist. Write a professional sales proposal in markdown for: "${subtask.description}"
Structure: executive summary, understanding their situation, proposed solution + timeline, pricing options table (3 tiers), ROI analysis with payback period, why us (3 proof points), next steps with dates. Return ONLY markdown.`,

      icp: `You are a sales strategist. Define a detailed Ideal Customer Profile document in markdown for: "${subtask.description}"
Include: company-level firmographics, contact-level personas (champion + buyer), pain point deep-dive (5 problems with cost of inaction), buying triggers, qualification criteria (BANT/MEDDIC), objection map (top 5), 5 sample accounts. Return ONLY markdown.`,

      campaign: `You are a marketing strategist. Write a complete marketing campaign brief in markdown for: "${subtask.description}"
Include: objective + success metrics, audience segments, messaging framework table, channel mix with budget %, 30-day content calendar, ad copy for 3 channels (full copy), A/B test plan (3 hypotheses), KPIs and reporting cadence. Return ONLY markdown.`,
    };

    const prompt = PROMPTS[type]
      ?? `You are a sales strategist. Create a comprehensive sales document in markdown for: "${subtask.description}"
Include: executive summary, ICP, value proposition, objection handling guide, and next steps. Return ONLY markdown.`;

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: 'sales',
      question: prompt,
    });

    return result.success ? result.output : '';
  }
}
