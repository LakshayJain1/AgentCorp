import { AgentRole, AgentTrait, AIRequest, AIResponse } from '@/agents/AgentTypes';
import { buildSystemPrompt, getTaskPrompt } from './AgentPersonalities';

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

  async checkApiKey(): Promise<boolean> {
    if (this.apiKeyChecked) return this.hasApiKey;
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' }),
      });
      const data = await res.json();
      this.hasApiKey = data.available === true && data.configured === true;
    } catch {
      this.hasApiKey = false;
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
    const prompt = getTaskPrompt(role, name, taskTitle, taskStage);
    return this.askAgent(role, name, traits, prompt, context);
  }

  async generateDeliverable(
    taskTitle: string,
    deliverableType: string,
    deliverableLang?: string,
  ): Promise<string> {
    const langHint = deliverableLang ? ` in ${deliverableLang}` : '';

    if (!this.hasApiKey) {
      return this.getMockDeliverable(taskTitle, deliverableType, deliverableLang);
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

  private getMockDeliverable(
    taskTitle: string,
    deliverableType: string,
    deliverableLang?: string,
  ): string {
    const lang = deliverableLang || 'typescript';
    const domain = this.detectDomain(taskTitle);
    const templates: Record<string, string> = {
      code: this.mockCode(taskTitle, lang, domain),
      doc: this.mockDoc(taskTitle, domain),
      report: this.mockReport(taskTitle, domain),
      spec: this.mockSpec(taskTitle, domain),
      config: this.mockConfig(taskTitle, lang, domain),
      analysis: this.mockAnalysis(taskTitle, domain),
      design: this.mockDesign(taskTitle, domain),
    };
    return templates[deliverableType] || templates.code;
  }

  private mockCode(title: string, lang: string, domain: string): string {
    const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24);
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    if (lang === 'html') {
      if (domain === 'dashboard') {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0f0f1e; color: #ddd; }
    .layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    .sidebar { background: #1a1a2e; padding: 1.5rem; border-right: 1px solid #2a2a4e; }
    .sidebar h2 { color: #6c63ff; font-size: 1rem; margin-bottom: 1.5rem; }
    .sidebar a { display: block; color: #888; padding: 0.5rem; text-decoration: none; font-size: 0.9rem; }
    .sidebar a:hover { color: #fff; background: #2a2a4e; border-radius: 4px; }
    .main { padding: 2rem; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #1a1a2e; border: 1px solid #2a2a4e; border-radius: 8px; padding: 1.2rem; }
    .card h3 { color: #888; font-size: 0.8rem; text-transform: uppercase; }
    .card .value { font-size: 2rem; font-weight: bold; color: #6c63ff; margin-top: 0.25rem; }
    .card .change { font-size: 0.8rem; color: #4caf50; }
    .chart-container { background: #1a1a2e; border: 1px solid #2a2a4e; border-radius: 8px; padding: 1.5rem; }
    canvas { width: 100% !important; height: 300px !important; }
  </style>
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <h2>AgentCorp</h2>
      <a href="#">Overview</a>
      <a href="#">Analytics</a>
      <a href="#">Users</a>
      <a href="#">Settings</a>
    </nav>
    <div class="main">
      <h1>${title}</h1>
      <div class="stats">
        <div class="card"><h3>Users</h3><div class="value">12,847</div><div class="change">+12% this week</div></div>
        <div class="card"><h3>Revenue</h3><div class="value">$48,290</div><div class="change">+8% this week</div></div>
        <div class="card"><h3>Active</h3><div class="value">3,421</div><div class="change">+5% this week</div></div>
      </div>
      <div class="chart-container">
        <canvas id="chart"></canvas>
      </div>
      <script>
        const ctx = document.getElementById('chart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
            datasets: [{
              label: 'Users',
              data: [1200,1900,3000,2500,4200,3800,5200],
              borderColor: '#6c63ff',
              tension: 0.3
            }]
          }
        });
      </script>
    </div>
  </div>
</body>
</html>`;
      }
      if (domain === 'ui') {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0f0f1e; color: #ddd; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { text-align: center; padding: 3rem 0; }
    header h1 { font-size: 2.5rem; color: #fff; margin-bottom: 0.5rem; }
    header p { color: #888; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
    .card { background: #1a1a2e; border: 1px solid #2a2a4e; border-radius: 12px; padding: 1.5rem; transition: transform 0.2s; }
    .card:hover { transform: translateY(-4px); border-color: #6c63ff; }
    .card h3 { color: #6c63ff; margin-bottom: 0.5rem; }
    .card p { color: #888; font-size: 0.9rem; }
    .btn { display: inline-block; padding: 0.6rem 1.5rem; background: #6c63ff; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
    .btn:hover { background: #5b52e0; }
    .btn-outline { background: transparent; border: 1px solid #6c63ff; color: #6c63ff; }
    .flex { display: flex; gap: 0.75rem; justify-content: center; margin: 2rem 0; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${title}</h1>
      <p>A clean, responsive component built by AgentCorp Engineering</p>
    </header>
    <div class="grid">
      <div class="card"><h3>Primary Card</h3><p>With hover elevation and accent border.</p></div>
      <div class="card"><h3>Secondary Card</h3><p>Consistent spacing and typography.</p></div>
      <div class="card"><h3>Tertiary Card</h3><p>Responsive grid adapts to viewport.</p></div>
    </div>
    <div class="flex">
      <button class="btn">Primary Action</button>
      <button class="btn btn-outline">Secondary</button>
    </div>
  </div>
</body>
</html>`;
      }
      // Default HTML — fully styled page
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0f0f1e; color: #ddd; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 4rem 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #fff; }
    h2 { color: #6c63ff; margin: 2rem 0 0.5rem; }
    p { color: #888; margin-bottom: 1rem; }
    code { background: #1a1a2e; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9rem; color: #a29bfe; }
    pre { background: #1a1a2e; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>Built by AgentCorp Engineering Team</p>
    <h2>Overview</h2>
    <p>This page implements <strong>${title}</strong> with semantic HTML, system font stack, and accessible color contrast.</p>
    <h2>Usage</h2>
    <pre>&lt;script type="module"&gt;
import { ${cap(safeName)} } from './module.js';

const instance = new ${cap(safeName)}();
instance.mount('#app');
&lt;/script&gt;</pre>
  </div>
</body>
</html>`;
    }

    // --- Non-HTML code generation ---
    if (domain === 'api') {
      const route = safeName.replace(/_/g, '-');
      return `// ${title}
// Generated by AgentCorp Engineering — API Service

import express, { Request, Response, Router } from 'express';

const router: Router = express.Router();

interface ${cap(safeName)}Request {
  id?: string;
  action: string;
  payload: Record<string, unknown>;
}

interface ${cap(safeName)}Response {
  success: boolean;
  data: unknown;
  error?: string;
  timestamp: number;
}

router.post('/${route}', async (req: Request, res: Response): Promise<void> => {
  try {
    const body: ${cap(safeName)}Request = req.body;

    if (!body.action) {
      res.status(400).json({ success: false, error: 'Missing action field' });
      return;
    }

    const result = await handle${cap(safeName)}Request(body);
    res.json({ success: true, data: result, timestamp: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ success: false, error: message });
  }
});

async function handle${cap(safeName)}Request(req: ${cap(safeName)}Request): Promise<unknown> {
  // TODO: implement request handler
  return { received: true, action: req.action };
}

export default router;
`;
    }

    if (domain === 'database') {
      return `// ${title}
// Generated by AgentCorp Engineering — Database Schema

export interface ${cap(safeName)}Record {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface ${cap(safeName)}Query {
  limit?: number;
  offset?: number;
  sortBy?: keyof ${cap(safeName)}Record;
  sortOrder?: 'asc' | 'desc';
  filters?: Partial<${cap(safeName)}Record>;
}

const db = new Map<string, ${cap(safeName)}Record>();

export async function createRecord(
  data: Omit<${cap(safeName)}Record, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<${cap(safeName)}Record> {
  const record: ${cap(safeName)}Record = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  };
  db.set(record.id, record);
  return record;
}

export async function queryRecords(
  query: ${cap(safeName)}Query = {},
): Promise<${cap(safeName)}Record[]> {
  let results = Array.from(db.values());

  if (query.filters) {
    results = results.filter((r) =>
      Object.entries(query.filters!).every(
        ([key, val]) => r[key as keyof ${cap(safeName)}Record] === val,
      ),
    );
  }

  if (query.sortBy) {
    results.sort((a, b) => {
      const aVal = a[query.sortBy!];
      const bVal = b[query.sortBy!];
      const cmp = String(aVal).localeCompare(String(bVal));
      return query.sortOrder === 'desc' ? -cmp : cmp;
    });
  }

  return results.slice(query.offset || 0, (query.offset || 0) + (query.limit || 50));
}

export async function getRecordById(id: string): Promise<${cap(safeName)}Record | null> {
  return db.get(id) || null;
}

export async function deleteRecord(id: string): Promise<boolean> {
  return db.delete(id);
}
`;
    }

    if (domain === 'auth') {
      return `// ${title}
// Generated by AgentCorp Engineering — Authentication Module

import { createHash, randomBytes } from 'node:crypto';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
}

interface Session {
  token: string;
  userId: string;
  expiresAt: Date;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 3600_000; // 1 hour

function hashPassword(password: string, salt: string): string {
  return createHash('sha256')
    .update(password + salt)
    .digest('hex');
}

export function createSession(userId: string): Session {
  const token = randomBytes(32).toString('hex');
  const session: Session = {
    token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
  sessions.set(token, session);
  return session;
}

export function validateSession(token: string): User | null {
  const session = sessions.get(token);
  if (!session || session.expiresAt < new Date()) {
    sessions.delete(token);
    return null;
  }
  return getUserById(session.userId);
}

export function hasPermission(user: User, required: string): boolean {
  return user.permissions.includes(required) || user.role === 'admin';
}

function getUserById(id: string): User | null {
  // TODO: look up from database
  return null;
}
`;
    }

    if (domain === 'devops') {
      return `// ${title}
// Generated by AgentCorp Engineering — DevOps / Deployment Script

interface DeploymentConfig {
  service: string;
  version: string;
  replicas: number;
  strategy: 'rolling' | 'bluegreen' | 'canary';
  healthEndpoint: string;
  timeout: number;
}

const defaultConfig: DeploymentConfig = {
  service: '${safeName}',
  version: process.env.VERSION || '1.0.0',
  replicas: 3,
  strategy: 'rolling',
  healthEndpoint: '/health',
  timeout: 120_000,
};

async function waitForHealth(endpoint: string, timeout: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export async function deploy(config: Partial<DeploymentConfig> = {}): Promise<void> {
  const merged = { ...defaultConfig, ...config };
  console.log(\`[Deploy] Starting \${merged.strategy} deployment of \${merged.service}:\${merged.version}\`);

  const healthy = await waitForHealth(merged.healthEndpoint, merged.timeout);
  if (!healthy) throw new Error('Health check failed - aborting deployment');

  console.log(\`[Deploy] \${merged.service} deployed successfully (\${merged.replicas} replicas)\`);
}

export default { deploy, defaultConfig };
`;
    }

    // Default TypeScript — generic service module
    return `// ${title}
// Generated by AgentCorp Engineering (${lang})

const TAG = '${safeName}';

export interface ${cap(safeName)}Options {
  debug?: boolean;
  retryCount?: number;
  onComplete?: (result: unknown) => void;
}

export class ${cap(safeName)} {
  private options: Required<${cap(safeName)}Options>;

  constructor(opts: ${cap(safeName)}Options = {}) {
    this.options = {
      debug: opts.debug ?? false,
      retryCount: opts.retryCount ?? 3,
      onComplete: opts.onComplete ?? (() => {}),
    };
  }

  async execute(input?: unknown): Promise<{ success: boolean; output: unknown }> {
    if (this.options.debug) console.log(\`[\${TAG}] Starting with:\`, input);

    for (let attempt = 1; attempt <= this.options.retryCount; attempt++) {
      try {
        const output = await this.process(input);
        this.options.onComplete(output);
        return { success: true, output };
      } catch (err) {
        if (attempt === this.options.retryCount) throw err;
        if (this.options.debug) console.warn(\`[\${TAG}] Attempt \${attempt} failed, retrying...\`);
      }
    }

    return { success: false, output: null };
  }

  private async process(input: unknown): Promise<unknown> {
    // TODO: implement
    return { processed: true, input };
  }
}

export function create${cap(safeName)}(opts?: ${cap(safeName)}Options): ${cap(safeName)} {
  return new ${cap(safeName)}(opts);
}

export default ${cap(safeName)};
`;
  }

  private mockDoc(title: string, domain: string): string {
    const safe = title.toLowerCase().replace(/\s+/g, '-');

    if (domain === 'api') {
      return `# API Documentation: ${title}

## Base URL
\`https://api.agentcorp.io/v1\`

## Authentication
All requests require an \`Authorization: Bearer <token>\` header.

## Endpoints

### \`GET /${safe}\`
Fetch a list of resources.

**Query Parameters**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | number | No | Max results (default 20) |
| offset | number | No | Pagination offset |
| sort | string | No | Sort field |

**Response** \`200 OK\`
\`\`\`json
{
  "data": [],
  "total": 0,
  "limit": 20,
  "offset": 0
}
\`\`\`

### \`POST /${safe}\`
Create a new resource.

**Request Body**
\`\`\`json
{
  "name": "string",
  "config": {}
}
\`\`\`

**Response** \`201 Created\`

### \`DELETE /${safe}/:id\`
Delete a resource.

**Errors**
| Code | Description |
|------|-------------|
| 401 | Missing or invalid token |
| 404 | Resource not found |
| 429 | Rate limit exceeded |

## Rate Limiting
- 100 requests/minute per token
- 1000 requests/minute per IP
`;
    }

    if (domain === 'database') {
      return `# Database Documentation: ${title}

## Schema Overview
The \`${safe}\` schema manages core business data.

## Tables

### \`${safe}_records\`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Display name |
| status | ENUM('active','inactive') | DEFAULT 'active' | Current status |
| metadata | JSONB | DEFAULT '{}' | Flexible metadata |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

### Indexes
- \`idx_${safe}_status\` ON \`${safe}_records\` (status)
- \`idx_${safe}_created_at\` ON \`${safe}_records\` (created_at DESC)

## Migrations
\`\`\`sql
CREATE TABLE ${safe}_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_${safe}_status ON ${safe}_records(status);
\`\`\`
`;
    }

    return `# ${title}

## Overview
Documentation for ${title.toLowerCase()}, maintained by AgentCorp.

## Getting Started
\`\`\`bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development
npm run dev
\`\`\`

## Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| \`NODE_ENV\` | development | Environment mode |
| \`PORT\` | 3000 | HTTP server port |
| \`LOG_LEVEL\` | info | Logging verbosity |

## Architecture
The system follows a modular architecture with clear separation of concerns:

- **API Layer** — Handles HTTP requests and validation
- **Service Layer** — Business logic and orchestration
- **Data Layer** — Persistence and external integrations

## Deployment
Refer to the deployment guide for production setup instructions.

## Support
For issues, create a ticket in the AgentCorp support portal.
`;
  }

  private mockReport(title: string, domain: string): string {
    const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    if (domain === 'research') {
      return `# Market Research Report: ${title}

**Prepared by:** AgentCorp Research Division
**Date:** ${new Date().toISOString().split('T')[0]}
**Status:** Final

## Executive Summary
This report analyzes market trends, competitive positioning, and strategic opportunities related to ${title.toLowerCase()}.

## Methodology
- Primary research: 50 customer interviews conducted
- Secondary research: Industry reports, financial filings, market data
- Competitive analysis: SWOT framework applied to top 5 competitors

## Key Findings

### Market Size & Growth
The addressable market is estimated at $2.4B with a CAGR of 14.2% over the next 3 years.

### Competitive Landscape
| Competitor | Market Share | Strength | Weakness |
|------------|:-----------:|----------|----------|
| Competitor A | 32% | Brand recognition | Legacy tech stack |
| Competitor B | 24% | Innovation pace | High pricing |
| AgentCorp | 18% | Developer experience | Brand awareness |

### Customer Insights
- **Top requested feature**: Improved API documentation and SDK support
- **Primary pain point**: Integration complexity with existing systems
- **NPS Score**: 42 (industry average: 35)

## Recommendations
1. **Product**: Prioritize developer tooling and SDK improvements
2. **Marketing**: Increase brand awareness through technical content
3. **Sales**: Target enterprise accounts with compliance-focused messaging

## Appendix
Raw survey data and interview transcripts available upon request.
`;
    }

    if (domain === 'bugfix') {
      return `# Incident & Fix Report: ${title}

**Reported by:** AgentCorp Engineering
**Severity:** Medium
**Status:** Resolved

## Summary
${title} has been investigated, root cause identified, and a fix deployed.

## Root Cause Analysis
- **Primary cause**: Race condition in async handler within the ${safeName} module
- **Contributing factors**: Missing synchronization guard, insufficient test coverage
- **Impact window**: Approximately 45 minutes of degraded performance

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 09:15 | Alert triggered: error rate spike |
| 09:18 | Engineer triaged and began investigation |
| 09:32 | Root cause identified in ${safeName} module |
| 09:45 | Hotfix deployed to staging |
| 09:52 | Staging validation passed |
| 10:00 | Production rollout complete |
| 10:15 | Error rates returned to baseline |

## Changes Applied
1. Added mutex lock to ${safeName} async handler
2. Increased timeout from 5s to 15s for edge cases
3. Added integration tests covering the race condition scenario

## Prevention
- Add regression test for concurrent access patterns
- Increase monitoring granularity for error rate anomalies
- Schedule architecture review of remaining async handlers
`;
    }

    return `# Report: ${title}

**Prepared by:** AgentCorp Research Division
**Date:** ${new Date().toISOString().split('T')[0]}

## Executive Summary
This report presents findings and analysis regarding ${title.toLowerCase()}. Key metrics indicate stable performance with identified areas for improvement.

## Analysis
### Current State
The system handles an average of 50K requests/day with 99.2% uptime. Response times average 180ms p95.

### Areas Evaluated
1. **Performance** — Within expected parameters
2. **Reliability** — No critical incidents in the reporting period
3. **Scalability** — Current capacity supports 3x growth without reconfiguration

## Recommendations
1. Implement caching layer for high-traffic endpoints
2. Schedule load testing for the upcoming feature release
3. Review and update runbooks for incident response

## Conclusion
The system is in good health with minor optimizations recommended for continued growth.
`;
  }

  private mockSpec(title: string, domain: string): string {
    const safe = title.toLowerCase().replace(/\s+/g, '-');

    if (domain === 'api') {
      return `# Technical Specification: ${title}

## Overview
RESTful API specification for ${title.toLowerCase()}.

## Data Model
\`\`\`typescript
interface ${safe.replace(/-/g, '_')}Resource {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
\`\`\`

## Endpoints
### List Resources
\`GET /api/v1/${safe}\`
- Pagination: ?limit, ?offset, ?cursor
- Sorting: ?sort=field:asc|desc
- Filtering: ?filter[status]=active

### Create Resource
\`POST /api/v1/${safe}\`
- Body: JSON payload matching interface
- Returns: 201 with created resource

### Get Resource
\`GET /api/v1/${safe}/:id\`
- Returns: 200 with resource or 404

### Update Resource
\`PATCH /api/v1/${safe}/:id\`
- Body: Partial update fields
- Returns: 200 with updated resource

## Error Codes
| Code | Meaning |
|------|---------|
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Versioning
API versioning via \`Accept: application/vnd.agentcorp.v1+json\` header.
`;
    }

    if (domain === 'ui') {
      return `# Technical Specification: ${title}

## Component Library Spec

### Component: \`${safe.replace(/-/g, '_')}\`

#### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| variant | 'primary' \\| 'secondary' \\| 'ghost' | No | 'primary' | Visual style |
| size | 'sm' \\| 'md' \\| 'lg' | No | 'md' | Component size |
| disabled | boolean | No | false | Disabled state |
| onClick | () => void | No | — | Click handler |
| children | ReactNode | Yes | — | Child content |

#### States
- **Default**: Resting state with accent background
- **Hover**: Slight elevation and brightness shift
- **Active**: Inset shadow for pressed feel
- **Disabled**: 40% opacity, no interactions
- **Loading**: Spinner replaces content while processing

#### Accessibility
- Role: \`button\`
- Keyboard: Enter/Space to activate
- Focus: Visible 2px ring in accent color
- ARIA: \`aria-disabled\` when disabled

#### Usage
\`\`\`tsx
import { ${safe.replace(/-/g, '_')} } from '@agentcorp/ui';

function Page() {
  return (
    <${safe.replace(/-/g, '_')} variant="primary" size="lg" onClick={handleClick}>
      Get Started
    </${safe.replace(/-/g, '_')}>
  );
}
\`\`\`
`;
    }

    return `# Technical Specification: ${title}

## 1. Overview
Technical specification for implementation of ${title.toLowerCase()}.

## 2. Requirements
### Functional
- System processes requests with sub-200ms latency
- Supports concurrent usage with no data corruption
- Provides clear error messaging for all failure modes

### Non-Functional
- 99.9% uptime SLA
- < 100ms p95 response time
- Horizontal scalability to 10x current load

## 3. Architecture
\`\`\`
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│   API Layer  │────▶│  Service     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                          ┌──────▼───────┐
                                          │  Data Store   │
                                          └──────────────┘
\`\`\`

## 4. Implementation Plan
1. Core implementation with unit tests
2. Integration testing and validation
3. Performance benchmarking and optimization
4. Documentation and deployment

## 5. Acceptance Criteria
- [ ] All tests pass
- [ ] Performance benchmarks met
- [ ] Security review completed
`;
  }

  private mockConfig(title: string, lang: string, domain: string): string {
    const safe = title.toLowerCase().replace(/\s+/g, '-');

    if (domain === 'devops') {
      if (lang === 'yaml') {
        return `# ${title}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${safe}
  namespace: agentcorp
  labels:
    app: ${safe}
    managed-by: agentcorp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${safe}
  template:
    metadata:
      labels:
        app: ${safe}
    spec:
      containers:
      - name: ${safe}
        image: agentcorp/${safe}:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: ${safe}-svc
  namespace: agentcorp
spec:
  selector:
    app: ${safe}
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
`;
      }
      return `// ${title}
// Deployment configuration

export const deployment = {
  name: '${safe}',
  replicas: 3,
  image: 'agentcorp/${safe}:latest',

  container: {
    port: 3000,
    env: {
      NODE_ENV: 'production',
    },
    healthCheck: {
      path: '/health',
      initialDelayMs: 10_000,
      periodMs: 30_000,
    },
    resources: {
      requests: { memory: '256Mi', cpu: '200m' },
      limits: { memory: '512Mi', cpu: '500m' },
    },
  },

  autoscaling: {
    enabled: true,
    minReplicas: 3,
    maxReplicas: 10,
    targetCPUUtilization: 70,
  },
};
`;
    }

    if (lang === 'yaml') {
      return `# ${title}
apiVersion: v1
kind: Config
metadata:
  name: ${safe}
  namespace: agentcorp

data:
  app.name: "${title}"
  app.version: "1.0.0"
  server.port: "3000"
  server.host: "0.0.0.0"
  db.maxConnections: "20"
  cache.ttl: "3600"
  log.level: "info"
`;
    }

    return `// ${title}
export default {
  app: {
    name: '${title}',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    url: process.env.DATABASE_URL,
    maxConnections: 20,
    ssl: true,
  },
  cache: {
    ttl: 3600,
    maxSize: 100,
  },
};
`;
  }

  private mockAnalysis(title: string, domain: string): string {
    const safe = title.toLowerCase().replace(/\s+/g, '-');

    if (domain === 'bugfix') {
      return `# Root Cause Analysis: ${title}

## Incident Summary
${title} — investigation into system behavior and failure mode.

## Metrics During Incident
| Metric | Normal | During Incident |
|--------|--------|-----------------|
| Error Rate | 0.5% | 23% |
| P95 Latency | 180ms | 2400ms |
| Throughput | 1200 req/s | 400 req/s |
| CPU Usage | 45% | 92% |

## Root Cause
A race condition in the ${safe} module's async handler caused concurrent requests to corrupt shared state, leading to cascading failures across dependent services.

## Timeline
1. **09:15** — Error rate spike detected by monitoring
2. **09:18** — On-call engineer acknowledged alert
3. **09:32** — Race condition identified in handleRequest()
4. **09:45** — Fix deployed: added mutex lock
5. **10:00** — All metrics returned to baseline

## Action Items
- [ ] Add stress test with concurrent requests ≥100
- [ ] Add runtime assertion for shared state integrity
- [ ] Review all async handlers for similar patterns
- [ ] Reduce monitoring alert threshold to 2% error rate
`;
    }

    if (domain === 'dashboard' || domain === 'analytics') {
      return `# Analytics Report: ${title}

## Period
${new Date().toLocaleDateString()} — trailing 30 days

## Key Metrics
| Metric | Current | Previous Period | Change |
|--------|:-------:|:--------------:|:------:|
| Daily Active Users | 4,230 | 3,890 | +8.7% |
| Session Duration | 8.4 min | 7.2 min | +16.7% |
| Conversion Rate | 3.2% | 2.9% | +10.3% |
| Bounce Rate | 34% | 38% | -10.5% |
| Customer Lifetime Value | $1,240 | $1,100 | +12.7% |

## Insights
1. **User growth is accelerating** — DAU grew 8.7% MoM driven by the new onboarding flow
2. **Engagement is up** — Session duration increased 16.7%, suggesting content improvements are working
3. **Conversion funnel** — 3.2% conversion rate is above industry benchmark of 2.5%

## Recommendations
1. Double down on onboarding improvements — highest impact on retention
2. A/B test checkout flow to further improve conversion
3. Investigate bounce rate on mobile traffic (currently 52% vs 28% desktop)
`;
    }

    return `# Analysis: ${title}

## Context
Analysis of ${title.toLowerCase()} conducted by AgentCorp Research.

## Key Metrics
| Metric | Value | Trend |
|--------|:-----:|:-----:|
| Performance Score | 92% | ↑ Improving |
| Reliability | 99.4% | → Stable |
| Code Coverage | 81% | ↑ Improving |
| Response Time (p95) | 165ms | ↓ Needs attention |
| Error Rate | 0.3% | → Stable |

## Findings
1. **Performance**: Overall system performance is strong with consistent improvement over the last 30 days
2. **Reliability**: Uptime remains above the 99% target with no critical incidents this period
3. **Code Quality**: Test coverage increased 8% following the recent quality initiative
4. **Latency**: P95 response time shows slight degradation during peak hours (2-4 PM UTC)

## Recommendations
1. Profile and optimize the slowest 5% of requests
2. Add caching for frequently accessed endpoints
3. Continue coverage improvement with focus on edge cases
4. Set up latency alert at 200ms p95 threshold
`;
  }

  private mockDesign(title: string, domain: string): string {
    if (domain === 'dashboard') {
      return `# Design Document: ${title}

## Design Goals
- Provide at-a-glance status of key business metrics
- Support drill-down for detailed analysis
- Responsive layout for desktop and tablet use

## Dashboard Layout
\`\`\`
┌──────────────────────────────────────────────┐
│  Header: Logo  |  Breadcrumb  |  User Menu   │
├──────────┬───────────────────────────────────┤
│ Sidebar  │  Metrics Row (4 stat cards)        │
│          ├───────────────────────────────────┤
│ Overview │  Chart: Revenue over time          │
│ Analytics│────────────────────────────────────│
│ Users    │  Table: Recent activity feed        │
│ Settings │────────────────────────────────────│
│          │  Footer: Status indicators          │
└──────────┴───────────────────────────────────┘
\`\`\`

## Color Palette
- **Background**: #0f0f1e (dark navy)
- **Surface**: #1a1a2e (card backgrounds)
- **Border**: #2a2a4e (subtle dividers)
- **Primary**: #6c63ff (accent/interactive)
- **Success**: #4caf50 (positive metrics)
- **Warning**: #ff9800 (attention needed)
- **Error**: #f44336 (critical alerts)

## States
- **Loading**: Skeleton placeholders with shimmer animation
- **Empty**: Illustration + CTA to add first data source
- **Error**: Inline banner with retry button
- **Refreshing**: Subtle indicator at top, data stays visible

## Interaction Design
- Clicking a stat card navigates to detailed view
- Charts support hover tooltips and click-to-filter
- Activity feed is paginated with infinite scroll
- All actions have 200ms ease-in-out transitions
`;
    }

    if (domain === 'ui') {
      return `# Component Design System: ${title}

## Design Tokens

### Spacing
| Token | Value |
|-------|-------|
| space-xs | 4px |
| space-sm | 8px |
| space-md | 16px |
| space-lg | 24px |
| space-xl | 32px |

### Typography
| Token | Value | Usage |
|-------|-------|-------|
| font-body | 14px/1.5 system-ui | Body text |
| font-small | 12px/1.4 system-ui | Captions, labels |
| font-h1 | 28px/1.2 system-ui | Page titles |
| font-h2 | 20px/1.3 system-ui | Section headers |

### Colors
- Primary: #6c63ff
- Primary Hover: #5b52e0
- Text: #ddd
- Text Muted: #888
- Surface: #1a1a2e
- Background: #0f0f1e

## Example Component States
\`\`\`
┌─────────────────────────────────────┐
│  Default                             │
│  ┌────────────────────────────────┐  │
│  │ [Button Component]              │  │
│  └────────────────────────────────┘  │
│                                      │
│  Hover                               │
│  ┌────────────────────────────────┐  │
│  │ [Button Component] ← elevated  │  │
│  └────────────────────────────────┘  │
│                                      │
│  Disabled                            │
│  ┌────────────────────────────────┐  │
│  │ [Button Component] ← dimmed    │  │
│  └────────────────────────────────┘  │
└─────────────────────────────────────┘
\`\`\`
`;
    }

    return `# Design Document: ${title}

## Goals
- Deliver a polished implementation of ${title.toLowerCase()}
- Ensure consistency with AgentCorp design system
- Optimize for usability and accessibility

## User Flow
1. User navigates to the feature from the main interface
2. System presents relevant data with clear visual hierarchy
3. User interacts with controls to refine their view
4. Actions provide immediate feedback

## Visual Style
- **Theme**: Dark mode with indigo accent (#6c63ff)
- **Typography**: System font stack, 14px body, 20px headings
- **Surfaces**: Elevated cards on dark background with subtle borders
- **Motion**: 200ms ease-in-out for state transitions

## Responsive Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, stacked |
| Tablet | 768-1024px | 2-column grid |
| Desktop | > 1024px | Full layout with sidebar |

## Accessibility
- All interactive elements are keyboard-accessible
- Color contrast meets WCAG AA standards
- Screen reader announcements for dynamic content changes
- Focus indicators visible on all interactive elements
`;
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
        ? `Generate an AgentCorp product task title based on this idea: "${customPrompt}". The task must be an analysis, QA review, audit, or documentation of existing AgentCorp code — no code modification. Format: verb + component/system + purpose. Return ONLY the title.`
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
    const { agentRole, agentName, prompt } = request;
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
        'Slight change in requirements — let me update the scope.',
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
        'Found the issue — it was a race condition in the async handler. Pushing a fix.',
        'This is going to require a small refactor of the data layer. About 2 hours.',
        'Code is written, tests are passing. Sending for review.',
        'The architecture needs updating but I\'ve got a clean solution in mind.',
      ],
      qa: [
        'I\'ve run the test suite. Found 3 edge cases that need attention.',
        'The regression tests pass. I\'m doing an exploratory testing pass now.',
        'This one\'s tricky — works in isolation but fails under load. Flagging it.',
        'QA approved! All acceptance criteria met. No critical issues found.',
        'I\'m rejecting this build — there\'s a data integrity issue in the migration.',
      ],
    };
    const responses = mockByRole[agentRole] || ['Processing your request.'];
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

export const aiService = new AIService();
