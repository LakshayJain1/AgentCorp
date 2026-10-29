import { AgentRole, AgentTrait, AIRequest, AIResponse } from '@/agents/AgentTypes';
import { buildSystemPrompt, getTaskPrompt } from './AgentPersonalities';
import { configLoader } from '@/config/ConfigLoader';
import { useGameStore } from '@/store/gameStore';

function getCompanyContext(): string {
  try {
    const { companyName, companyProduct } = useGameStore.getState();
    if (!companyName && !companyProduct) return '';
    return `\nCompany context: ${companyName} is building "${companyProduct}". Tailor all output to this product and domain.\n`;
  } catch {
    return '';
  }
}

let cachedTemplateSections: Map<string, string> | null = null;

async function ensureTemplatesLoaded(): Promise<Map<string, string>> {
  if (cachedTemplateSections) return cachedTemplateSections;
  const md = await configLoader.fetchText('/config/deliverable-templates.md');
  cachedTemplateSections = configLoader.extractAllCodeBlocks(md);
  return cachedTemplateSections;
}

interface QueueItem {
  request: AIRequest;
  resolve: (value: AIResponse) => void;
}

class AIService {
  private queue: QueueItem[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private minInterval = 1000;
  private apiKeyChecked = false;
  private hasApiKey = false;
  private initPromise: Promise<boolean> | null = null;

  async checkApiKey(): Promise<boolean> {
    if (this.apiKeyChecked) return this.hasApiKey;
    this.initPromise = this.initPromise || this._checkApiKey();
    return this.initPromise;
  }

  private async _checkApiKey(): Promise<boolean> {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' }),
      });
      const data = await res.json();
      this.hasApiKey = data.available === true && data.configured === true;
      console.log(`[AIService] API key ${this.hasApiKey ? 'available' : 'NOT available'}, using ${this.hasApiKey ? 'OpenRouter AI' : 'mock responses'}`);
    } catch {
      this.hasApiKey = false;
      console.log('[AIService] API key check failed, using mock responses');
    }
    this.apiKeyChecked = true;
    return this.hasApiKey;
  }

  async askAgent(
    role: AgentRole,
    name: string,
    traits: AgentTrait,
    prompt: string,
    context?: Record<string, string>,
  ): Promise<AIResponse> {
    return new Promise((resolve) => {
      this.queue.push({
        request: { agentRole: role, agentName: name, agentTraits: traits, prompt, context },
        resolve,
      });
      this.processQueue();
    });
  }

  async askTaskAgent(
    role: AgentRole,
    name: string,
    traits: AgentTrait,
    taskTitle: string,
    taskStage: string,
    context?: Record<string, string>,
  ): Promise<AIResponse> {
    const prompt = await getTaskPrompt(role, name, taskTitle, taskStage);
    return this.askAgent(role, name, traits, prompt, context);
  }

  async generateDeliverable(
    taskTitle: string,
    deliverableType: string,
    deliverableLang?: string,
  ): Promise<string> {
    const langHint = deliverableLang ? ` in ${deliverableLang}` : '';

    await this.checkApiKey();
    if (!this.hasApiKey) {
      return await this.getMockDeliverable(taskTitle, deliverableType, deliverableLang);
    }

    const companyCtx = getCompanyContext();
    const langSpecific = deliverableLang === 'html'
      ? 'Generate a complete, self-contained HTML page with embedded CSS and JavaScript.'
      : deliverableLang === 'nextjs'
        ? 'Generate a complete Next.js application. Include the page component, any necessary imports, and proper export syntax. Use TypeScript. Return the FULL page file content including imports, component definition, and export.'
        : deliverableLang === 'react'
          ? 'Generate a complete React component. Use TypeScript (TSX). Include all imports, the component function, and default export.'
          : deliverableLang === 'node'
            ? 'Generate a complete Node.js module or server file. Use TypeScript. Include imports, main logic, and exports.'
            : deliverableLang === 'python'
              ? 'Generate complete Python code with proper imports, classes/functions, and main block.'
              : `Generate complete, production-ready ${deliverableLang || 'code'}`;

    const promptMap: Record<string, string> = {
      code: `${companyCtx}${langSpecific} for: "${taskTitle}".
IMPORTANT: Read the task title carefully. If it mentions a specific framework or technology (like Next.js, React, Vue, Node, Python), use that. Otherwise, choose the most appropriate technology.
Return ONLY the raw code with NO explanation, NO markdown backticks.`,
      doc: `${companyCtx}Write comprehensive documentation for: "${taskTitle}".
Include: overview, setup, usage, API reference, and examples. Format in markdown. Keep it professional.`,
      report: `${companyCtx}Write a detailed professional report about: "${taskTitle}".
Include: executive summary, methodology, findings, recommendations. Format in markdown.`,
      spec: `${companyCtx}Write a technical specification for: "${taskTitle}".
Include: overview, requirements, architecture, implementation details, acceptance criteria. Format in markdown.`,
      config: `${companyCtx}Generate a complete configuration${langHint} for: "${taskTitle}".
Return ONLY the raw configuration content with NO explanation.`,
      analysis: `${companyCtx}Write a detailed analysis for: "${taskTitle}".
Include: context, data examination, key insights, actionable recommendations. Format in markdown.`,
      design: `${companyCtx}Write a design document for: "${taskTitle}".
Include: goals, user stories, wireframe description, component tree, data flow. Format in markdown.`,
      pitch: `${companyCtx}Create a complete investor/customer pitch deck outline in markdown for: "${taskTitle}".
Structure it as 10 slides with full content for each:
1. **Cover** — company name, tagline, one-line problem statement
2. **Problem** — 3 specific pain points with data or quotes, cost of the problem
3. **Solution** — what you offer, how it works, key differentiator in one sentence
4. **Market Opportunity** — TAM / SAM / SOM with realistic estimates and sources
5. **Product** — 3–4 core features, screenshots description, unique value per feature
6. **Business Model** — pricing tiers, revenue streams, unit economics (CAC / LTV)
7. **Traction** — users/revenue metrics, growth rate, key logos, notable milestones
8. **Go-to-Market** — ICP definition, acquisition channels, launch playbook
9. **Team** — founders and key hires, relevant backgrounds, advisors
10. **Ask** — funding amount, use of funds breakdown (%), milestones it buys
For each slide: write the full content, include speaker notes, and flag any data to validate. Make all numbers and claims specific and believable.`,
      outreach: `${companyCtx}Create a complete multi-touch outreach sequence in markdown for: "${taskTitle}".
Include all copy, ready to send:

**Email 1 — Cold intro (Day 1)**
Subject line (A/B test two variants):
Body (≤120 words, pain-first, no feature dump, one CTA):
Psychological hook: [explain]

**Email 2 — Follow-up (Day 4, value-add)**
Subject: [reply thread subject]
Body (≤80 words, add one concrete insight or resource):

**Email 3 — Final bump (Day 10)**
Subject:
Body (≤60 words, soft close, leave door open):

**LinkedIn Connection Request (≤300 chars):**

**LinkedIn Follow-up DM (1 week after connect, ≤200 chars):**

**Cold call opener script (30-second voicemail):**

For each touch: write the full copy, note the best send time, and explain the specific trigger event that would make this prospect respond.`,
      gtm: `${companyCtx}Write a comprehensive go-to-market strategy document in markdown for: "${taskTitle}".
Include:
## Executive Summary
One-paragraph summary of the GTM approach and expected outcomes.

## Ideal Customer Profile
3 target segments with: company attributes (size, industry, stage), contact attributes (role, seniority), pain points, and trigger events.

## Value Proposition by Segment
Tailored one-liner and 3 supporting proof points per segment.

## Channel Strategy
Owned, paid, earned, and partnership channels. For each: why it fits, expected CAC, and first 90-day tactics.

## Launch Timeline
30 / 60 / 90-day milestones with owners and success criteria.

## Competitive Positioning
2x2 positioning map description, key differentiators, and how to win each head-to-head scenario.

## KPIs and Success Metrics
5–7 leading and lagging indicators with specific targets for 3 and 6 months.

## Budget Allocation
% breakdown across channels with rationale.

Use tables and bullet points throughout for scannability.`,
      proposal: `${companyCtx}Write a professional sales proposal in markdown for: "${taskTitle}".
Structure:
## Executive Summary
The problem we solve, why now, and the expected ROI in 2–3 sentences.

## Understanding Your Situation
Show you understand their specific context, current pain, and the cost of inaction.

## Proposed Solution
What we deliver, the implementation timeline, and what success looks like at 30/60/90 days.

## Pricing Options
| Tier | What's included | Investment | ROI projection |
Present 3 options (good / better / best) with clear upgrade rationale.

## ROI Analysis
Specific dollar savings or revenue uplift with methodology. Include a simple payback period calculation.

## Why Us
3 differentiators backed by proof (case study excerpt, metric, or testimonial).

## Next Steps
Specific action items with dates: proposal review call, contract signature, kickoff.

Write persuasively but back every claim with a number or proof point.`,
      icp: `${companyCtx}Define a detailed Ideal Customer Profile (ICP) document in markdown for: "${taskTitle}".
## Company-Level Attributes
Firmographic filters: industry, sub-vertical, employee count, revenue range, geography, funding stage, tech stack signals.

## Contact-Level Attributes
Champion persona and economic buyer persona — for each: title/seniority, goals, KPIs they own, day-to-day frustrations, how they buy.

## Pain Point Deep-Dive
5 specific problems, current workarounds (what they use today), quantified cost of each problem, and emotional drivers.

## Buying Triggers
Events that signal readiness: funding round, new hire, product launch, competitive pressure, regulatory change. How to detect each.

## Qualification Criteria
Must-haves (deal-breakers if missing), nice-to-haves, and automatic disqualifiers. BANT / MEDDIC framework applied.

## Objection Map
Top 5 objections with: root cause, ideal response, and proof point.

## Sample Accounts
5 hypothetical ideal accounts with company name (fictional), why they qualify, and the first conversation hook.`,
      campaign: `${companyCtx}Write a complete marketing campaign brief in markdown for: "${taskTitle}".
## Campaign Overview
Objective (awareness / consideration / conversion), target audience, core message, and budget range.

## Audience Segments
Primary and secondary segments with persona sketch and where they spend attention.

## Messaging Framework
| Audience | Pain point | Value prop | Proof point | CTA |
Fill in the table for each segment.

## Channel Mix
For each channel (paid search, paid social, email, content, influencer, events):
- Rationale for inclusion
- Budget allocation (%)
- Specific tactics and formats
- Expected reach / impressions / clicks

## Content Calendar (30 days)
Week-by-week plan: asset type, channel, copy angle, and owner.

## Ad Copy
For 3 channels — headline, body copy, and CTA (write the full copy, not a description).

## A/B Test Plan
3 hypotheses with: variable being tested, control vs. variant, success metric, and sample size needed.

## KPIs and Reporting
Leading indicators (CTR, open rate, CPC), lagging indicators (MQL, SQL, revenue), reporting cadence, and dashboard link placeholder.`,
    };

    const prompt = promptMap[deliverableType] || promptMap.code;

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, temperature: 0.7 }),
      });
      const data = await res.json();
      if (data.content && data.content.length > 20) {
        return data.content.trim();
      }
    } catch {
      // fall through
    }

    return this.getMockDeliverable(taskTitle, deliverableType, deliverableLang);
  }

  private detectDomain(title: string): string {
    const t = title.toLowerCase();
    if (/\b(api|endpoint|rest|service|graphql|webhook)\b/.test(t)) return 'api';
    if (/\b(database|db|query|schema|sql|migration|index)\b/.test(t)) return 'database';
    if (/\b(auth|login|oauth|permission|role|access)\b/.test(t)) return 'auth';
    if (/\b(dashboard|monitoring|analytics|metrics|insight)\b/.test(t)) return 'dashboard';
    if (/\b(landing|portfolio|homepage|page|website|ui|component|button|form|modal)\b/.test(t)) return 'ui';
    if (/\b(deploy|ci|cd|pipeline|docker|kubernetes|infra|backup)\b/.test(t)) return 'devops';
    if (/\b(test|coverage|qa|lint|quality|audit)\b/.test(t)) return 'testing';
    if (/\b(market|competitor|pricing|research|customer|feedback)\b/.test(t)) return 'research';
    if (/\b(doc|readme|guide|tutorial|manual)\b/.test(t)) return 'docs';
    if (/\b(report|analysis|finding|review)\b/.test(t)) return 'report';
    if (/\b(fix|bug|error|crash|memory|leak|slow|performance)\b/.test(t)) return 'bugfix';
    return 'general';
  }

  private async getMockDeliverable(
    taskTitle: string,
    deliverableType: string,
    deliverableLang?: string,
  ): Promise<string> {
    const lang = deliverableLang || 'typescript';
    const domain = this.detectDomain(taskTitle);

    try {
      const templates = await ensureTemplatesLoaded();
      const key = `${deliverableType}_${lang}_${domain}`;
      const fallbackKey = `${deliverableType}_${lang}_default`;
      const generalKey = `${deliverableType}_typescript_general`;

      const template = templates.get(key) || templates.get(fallbackKey) || templates.get(generalKey);
      if (template) {
        return template.replace(/\{\{title\}\}/g, taskTitle)
          .replace(/\{\{domain\}\}/g, domain)
          .replace(/\{\{lang\}\}/g, lang);
      }
    } catch {
      // fall through to inline defaults below
    }

    return `Mock ${deliverableType} deliverable for: ${taskTitle} (${lang}, ${domain})`;
  }

  async generateTaskIdea(customPrompt?: string): Promise<string> {
    await this.checkApiKey();
    if (!this.hasApiKey && !customPrompt) {
      const ideas = [
        // AgentCorp product tasks — limited scope, agents can do these
        'Run QA review on the EventLog component for rendering issues',
        'Analyze the Zustand game store for missing error handling',
        'Review the ConversationPanel for accessibility improvements',
        'Audit the API routes for proper error responses',
        'Document the current agent TypeScript interfaces and types',
        'Review the tool route security for path traversal vulnerabilities',
        'Analyze the execution log viewer for performance bottlenecks',
        'Check for unused imports and dead code across the components',
        'Review the AgentRuntime state machine for edge cases',
        'Analyze the Phaser game scene for memory leak potential',
        'Document the task lifecycle from creation to completion',
        'Review the deliverable write permissions for security gaps',
        'Audit the WebSocket SSE implementation for connection handling',
        'Analyze the task discovery system for unnecessary API calls',
        'Review the HR evaluation system for fairness in scoring',
        'Document the game loop timing architecture',
        'Check the ToolRegistry for missing tool validations',
        'Analyze the agent memory system for localStorage limits',
        'Review the planner subtask generation for dependency correctness',
        'Document the complete API surface across all routes',
      ];
      return ideas[Math.floor(Math.random() * ideas.length)];
    }

    try {
      const prompt = customPrompt
        ? `Generate an AgentCorp product task title based on this idea: "${customPrompt}". The task must be an analysis, QA review, audit, or documentation of existing AgentCorp code with no code modification. Format: verb + component/system + purpose. Return ONLY the title.`
        : 'Generate an AgentCorp product task title. It must be an analysis, QA review, audit, or documentation of an existing AgentCorp component (EventLog, GameStore, API routes, ConversationPanel, AgentRuntime, ToolRegistry, TaskSystem, HR system, Phaser scene, memory system, task queue, validator, etc.). No code modification. Examples: "Analyze the Zustand store for missing error handling" or "Review the API route security" or "Document the agent state machine". Return ONLY the title.';

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          temperature: 0.8,
        }),
      });
      const data = await res.json();
      if (data.content) {
        const clean = data.content.replace(/["""''\n]/g, '').trim();
        if (clean.length > 5) return clean;
      }
    } catch {
      // fall through to mock
    }

    // Fallback — AgentCorp product tasks
    const ideas = [
      'Run QA review on the EventLog component',
      'Analyze the Zustand store for edge cases',
      'Review API route error handling',
      'Document the TypeScript type definitions',
      'Audit the tool execution pipeline for security',
    ];
    return ideas[Math.floor(Math.random() * ideas.length)];
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    await this.checkApiKey();

    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.minInterval) {
        await new Promise((r) => setTimeout(r, this.minInterval - elapsed));
      }

      const item = this.queue.shift()!;

      if (!this.hasApiKey) {
        item.resolve({ content: this.getMockResponse(item.request) });
      } else {
        try {
          const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemPrompt: buildSystemPrompt(item.request.agentRole, item.request.agentName),
              prompt: item.request.prompt,
              context: item.request.context,
            }),
          });
          const data = await res.json();
          item.resolve({ content: data.content || this.getMockResponse(item.request), error: data.error });
        } catch {
          item.resolve({ content: this.getMockResponse(item.request), error: 'API call failed' });
        }
      }

      this.lastRequestTime = Date.now();
    }

    this.processing = false;
  }

  getMockResponse(request: AIRequest): string {
    const { agentRole } = request;
    const mockByRole: Record<string, string[]> = {
      ceo: [
        'I\'ve analyzed this and it aligns with our Q2 objectives. Let\'s prioritize it.',
        'Good initiative. I\'m assigning this strategic importance.',
        'This needs immediate attention. Clear my schedule.',
        'I trust the team\'s judgment on this. Move forward.',
        'Let\'s be ambitious here. I want to see this done by end of week.',
      ],
      pm: [
        'I\'ll break this down into actionable tickets and assign them.',
        'Let me check the team\'s capacity and get back to you.',
        'Great, I\'ve updated the sprint board. Engineer lead is assigned.',
        'I\'ve communicated this to stakeholders. They\'re aligned.',
        'Slight change in requirements. Let me update the scope.',
      ],
      researcher: [
        'I\'ve analyzed the data and found some interesting correlations.',
        'Let me run some additional queries to validate this hypothesis.',
        'The numbers suggest we should focus on the user engagement metrics.',
        'I\'ve compiled my findings into a report. Key insight: performance gap in the API layer.',
        'Cross-referencing with industry benchmarks shows we\'re above average.',
      ],
      engineer: [
        'I\'ve started working on this. The main challenge is the legacy integration.',
        'Found the issue: it was a race condition in the async handler. Pushing a fix.',
        'This is going to require a small refactor of the data layer. About 2 hours.',
        'Code is written, tests are passing. Sending for review.',
        'The architecture needs updating but I\'ve got a clean solution in mind.',
      ],
      qa: [
        'I\'ve run the test suite. Found 3 edge cases that need attention.',
        'The regression tests pass. I\'m doing an exploratory testing pass now.',
        'This one is tricky. Works in isolation but fails under load. Flagging it.',
        'QA approved! All acceptance criteria met. No critical issues found.',
        'I\'m rejecting this build. There\'s a data integrity issue in the migration.',
      ],
      sales: [
        'Pitch deck drafted — 10 slides covering problem, solution, market, and ask.',
        'ICP defined: mid-market SaaS, 50–500 employees, growth stage. Outreach templates ready.',
        'Pricing strategy complete: Starter / Growth / Enterprise tiers with feature matrix.',
        'Sales proposal ready. Value prop leads with ROI, objection handling appended.',
        'Pipeline framework built. Qualification criteria mapped to deal stages.',
      ],
      finance: [
        'Financial model complete. 12-month P&L shows break-even at month 8 with current burn.',
        'Budget plan drafted. Engineering at 45%, marketing 25%, ops 20%, reserve 10%.',
        'Revenue projection: $0 → $180K ARR by month 12 assuming 15% MoM growth.',
        'Cash flow analysis done. Runway is 14 months at current spend rate.',
        'CAC: $420, LTV: $3,200, LTV:CAC ratio 7.6x — healthy for Series A raise.',
      ],
      ops: [
        'SOP drafted with 7 steps, quality checks, and escalation path defined.',
        'Onboarding plan complete: pre-day-one checklist, week 1 agenda, 30/60/90 milestones.',
        'OKR framework ready: 3 objectives, 9 key results, owners and measurement cadence set.',
        'Runbook documented. All steps have explicit owners and rollback procedures.',
        'Workflow optimized — removed 3 manual handoff steps, estimated 40% time saving.',
      ],
    };
    const responses = mockByRole[agentRole] || ['Processing your request.'];
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

export const aiService = new AIService();
