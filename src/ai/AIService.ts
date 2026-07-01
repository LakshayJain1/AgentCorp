import { AgentRole, AgentTrait, AIRequest, AIResponse } from '@/agents/AgentTypes';
import { buildSystemPrompt, getTaskPrompt } from './AgentPersonalities';
import { configLoader } from '@/config/ConfigLoader';

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

    if (!this.hasApiKey) {
      return await this.getMockDeliverable(taskTitle, deliverableType, deliverableLang);
    }

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
      code: `${langSpecific} for: "${taskTitle}".
IMPORTANT: Read the task title carefully. If it mentions a specific framework or technology (like Next.js, React, Vue, Node, Python), use that. Otherwise, choose the most appropriate technology.
Return ONLY the raw code with NO explanation, NO markdown backticks.`,
      doc: `Write comprehensive documentation for: "${taskTitle}".
Include: overview, setup, usage, API reference, and examples. Format in markdown. Keep it professional.`,
      report: `Write a detailed professional report about: "${taskTitle}".
Include: executive summary, methodology, findings, recommendations. Format in markdown.`,
      spec: `Write a technical specification for: "${taskTitle}".
Include: overview, requirements, architecture, implementation details, acceptance criteria. Format in markdown.`,
      config: `Generate a complete configuration${langHint} for: "${taskTitle}".
Return ONLY the raw configuration content with NO explanation.`,
      analysis: `Write a detailed analysis for: "${taskTitle}".
Include: context, data examination, key insights, actionable recommendations. Format in markdown.`,
      design: `Write a design document for: "${taskTitle}".
Include: goals, user stories, wireframe description, component tree, data flow. Format in markdown.`,
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
    };
    const responses = mockByRole[agentRole] || ['Processing your request.'];
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

export const aiService = new AIService();
