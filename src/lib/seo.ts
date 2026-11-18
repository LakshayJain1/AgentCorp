// Single source of truth for SEO / AEO / GEO surfaces (metadata, robots,
// sitemap, llms.txt, JSON-LD). Keep copy here so they never drift apart.

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://agent-corp.vercel.app').replace(/\/$/, '');
export const SITE_NAME = 'AgentCorp';
export const SITE_TITLE = 'AgentCorp - AI Office Simulation';
export const SITE_DESCRIPTION =
  'AgentCorp is an AI-powered autonomous agent workspace: define a company, hire a team of AI agents (engineering, product, marketing, research), and watch them plan, build, test and ship work in a simulated office.';

export const FAQS = [
  { q: 'How does AgentCorp write code locally?', a: 'AgentCorp runs inside a secure local sandbox workspace. It reads files, decomposes architectural needs, compiles via tsc, and automatically fixes syntax errors, committing directly to your local workspace once validation passes.' },
  { q: 'What keeps agents from writing buggy code?', a: 'Our integrated Quality Assurance (QA) loop runs automated tests and lints (eslint) on every iteration. If an error is detected, the stack trace is fed back to the developer agent to debug.' },
  { q: 'Can I customise the agent roles?', a: 'Yes! During onboarding, you define the company name, goals, and role structures. You can adjust agent energy conservation settings, morale triggers, and local connector access settings.' },
  { q: 'Do I need online accounts to use AgentCorp?', a: 'No. You can run AgentCorp entirely locally. To use advanced AI features, configure your Gemini API Key or OpenRouter fallback token in your local .env.local file.' },
];

// Public, indexable routes. Everything else (workspace, api, onboarding) is private.
export const PUBLIC_ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/download', priority: 0.8, changeFrequency: 'monthly' as const },
];

// AI crawlers / answer engines we explicitly welcome on public pages.
export const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'CCBot',
  'Bytespider', 'Amazonbot', 'cohere-ai', 'MistralAI-User', 'DuckAssistBot',
];

export const PRIVATE_PATHS = ['/workspace', '/api/', '/onboard', '/sign-in', '/sign-up'];

export function llmsTxt(): string {
  return `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

AgentCorp simulates a small company staffed by AI agents. You set the company name, goals and roles during onboarding; an orchestrator plans work, specialist agents (developer, QA, product, marketing, research) execute it, and a QA loop validates results before anything is committed.

## Pages

- [Home](${SITE_URL}/): product overview, agent teams, lifecycle and FAQ
- [Download](${SITE_URL}/download): desktop app with local filesystem and command execution
- [Full context for LLMs](${SITE_URL}/llms-full.txt): expanded product description and FAQ

## Optional

- The signed-in workspace (${SITE_URL}/workspace) and API routes are private and not intended for crawling.
`;
}

export function llmsFullTxt(): string {
  const faq = FAQS.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n');
  return `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

## What it is

AgentCorp is an autonomous multi-agent workspace presented as an office simulation. A central orchestrator takes a goal, a planner breaks it into tasks, and specialist AI agents carry them out and report status in real time.

## How it works

1. Onboarding: define the company name, goals and role structure.
2. Planning: the orchestrator and planner decompose a request into tasks and assign agents.
3. Execution: agents write code, research, draft content and collaborate via agent-to-agent chat.
4. Validation: a QA loop runs tests and lint on every iteration and feeds failures back to the developer agent.
5. Delivery: validated work is committed to the local workspace.

## Agent teams

Engineering, Product, Marketing and Research.

## Where it runs

- Web app: ${SITE_URL}/ (shared AI key with usage limits and plans).
- Desktop app: ${SITE_URL}/download (real filesystem and command execution; bring your own AI key).

## FAQ

${faq}
`;
}
