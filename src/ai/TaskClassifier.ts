import { AgentRole, DeliverableType } from '@/agents/AgentTypes';
import { useGameStore } from '@/store/gameStore';
import { aiFetch } from '@/ai/transport';

export interface TaskClassification {
  agentRole: AgentRole;
  deliverableType: DeliverableType;
  deliverableLang?: string;
}

const ROLE_DELIVERABLE_FALLBACK: Record<string, { agentRole: AgentRole; deliverableType: DeliverableType; deliverableLang?: string }> = {
  pitch:    { agentRole: 'sales',      deliverableType: 'pitch',    deliverableLang: 'markdown' },
  outreach: { agentRole: 'sales',      deliverableType: 'outreach', deliverableLang: 'markdown' },
  gtm:      { agentRole: 'sales',      deliverableType: 'gtm',      deliverableLang: 'markdown' },
  proposal: { agentRole: 'sales',      deliverableType: 'proposal', deliverableLang: 'markdown' },
  icp:      { agentRole: 'sales',      deliverableType: 'icp',      deliverableLang: 'markdown' },
  campaign: { agentRole: 'sales',      deliverableType: 'campaign', deliverableLang: 'markdown' },
  report:   { agentRole: 'researcher', deliverableType: 'report',   deliverableLang: 'markdown' },
  analysis: { agentRole: 'researcher', deliverableType: 'analysis', deliverableLang: 'markdown' },
  research: { agentRole: 'researcher', deliverableType: 'report',   deliverableLang: 'markdown' },
  spec:     { agentRole: 'engineer',   deliverableType: 'spec',     deliverableLang: 'markdown' },
  doc:      { agentRole: 'engineer',   deliverableType: 'doc',      deliverableLang: 'markdown' },
  config:   { agentRole: 'engineer',   deliverableType: 'config',   deliverableLang: 'yaml' },
  code:     { agentRole: 'engineer',   deliverableType: 'code',     deliverableLang: 'typescript' },
};

const VALID_ROLES: AgentRole[] = ['engineer', 'researcher', 'sales', 'finance', 'ops', 'qa', 'hr', 'ceo', 'pm'];
const VALID_TYPES: DeliverableType[] = [
  'code', 'doc', 'report', 'spec', 'config', 'analysis', 'design', 'research',
  'pitch', 'outreach', 'gtm', 'proposal', 'icp', 'campaign',
];

function getCompanyContext(): string {
  try {
    const { companyName, companyProduct } = useGameStore.getState();
    if (!companyName && !companyProduct) return '';
    return `Company: ${companyName} | Building: ${companyProduct}\n`;
  } catch {
    return '';
  }
}

// ── Rules first, model second ───────────────────────────────────────────────

interface Rule { id: string; re: RegExp; result: TaskClassification }

/**
 * Word-bounded signals that name one kind of work unambiguously. When exactly ONE group matches the
 * title the answer is known without a model call; zero or several matches (e.g. "Python script to
 * forecast revenue") go to the model. The looser keyword heuristic below stays the last resort only.
 */
const CONFIDENT_RULES: Rule[] = [
  { id: 'pitch',    re: /\b(pitch deck|investor deck|pitch)\b/i,                                 result: ROLE_DELIVERABLE_FALLBACK.pitch },
  { id: 'outreach', re: /\b(cold emails?|outreach|email sequence|lead gen(eration)?)\b/i,        result: ROLE_DELIVERABLE_FALLBACK.outreach },
  { id: 'gtm',      re: /\b(go[- ]to[- ]market|gtm)\b/i,                                         result: ROLE_DELIVERABLE_FALLBACK.gtm },
  { id: 'proposal', re: /\b(sales )?proposals?\b/i,                                              result: ROLE_DELIVERABLE_FALLBACK.proposal },
  { id: 'icp',      re: /\b(icp|ideal customer profile|buyer personas?)\b/i,                     result: ROLE_DELIVERABLE_FALLBACK.icp },
  { id: 'campaign', re: /\b(marketing campaign|campaign brief|ad copy|marketing plan)\b/i,       result: ROLE_DELIVERABLE_FALLBACK.campaign },
  { id: 'finance',  re: /\b(budget|forecast|p&l|runway|burn rate|cash flow|financial model)\b/i, result: { agentRole: 'finance', deliverableType: 'report', deliverableLang: 'markdown' } },
  { id: 'ops',      re: /\b(sop|runbook|playbook|okrs?)\b/i,                                     result: { agentRole: 'ops', deliverableType: 'doc', deliverableLang: 'markdown' } },
  { id: 'research', re: /\b(competitive analysis|market analysis|market research|benchmark)\b/i, result: ROLE_DELIVERABLE_FALLBACK.analysis },
  { id: 'landing',  re: /\b(landing page|html page|static site)\b/i,                             result: { agentRole: 'engineer', deliverableType: 'code', deliverableLang: 'html' } },
  { id: 'python',   re: /\b(python|django|flask|fastapi)\b/i,                                    result: { agentRole: 'engineer', deliverableType: 'code', deliverableLang: 'python' } },
  { id: 'nextjs',   re: /\b(next\.?js)\b/i,                                                      result: { agentRole: 'engineer', deliverableType: 'code', deliverableLang: 'nextjs' } },
  { id: 'react',    re: /\b(react)\b/i,                                                          result: { agentRole: 'engineer', deliverableType: 'code', deliverableLang: 'react' } },
  { id: 'docs',     re: /\b(readme|documentation)\b/i,                                           result: ROLE_DELIVERABLE_FALLBACK.doc },
];

/** A classification decided by rules alone, or null when it needs the model. Exported for tests. */
export function confidentClassification(title: string): TaskClassification | null {
  const hits = CONFIDENT_RULES.filter((r) => r.re.test(title));
  return hits.length === 1 ? { ...hits[0].result } : null;
}

// ── One call instead of two ─────────────────────────────────────────────────
// The intent classifier already read the message with a model; when it also names the role and deliverable
// (a few extra output tokens) the follow-up classifyTask() call for that same title is skipped.

const REMEMBER_TTL_MS = 10 * 60_000;
const REMEMBER_MAX = 30;
const remembered = new Map<string, { at: number; value: TaskClassification }>();
const memoKey = (title: string) => title.toLowerCase().replace(/\s+/g, ' ').trim();

/** Validates a model-produced {agentRole, deliverableType, deliverableLang}; null when unusable. */
export function normalizeClassification(raw: { agentRole?: unknown; deliverableType?: unknown; deliverableLang?: unknown }): TaskClassification | null {
  const agentRole = VALID_ROLES.includes(raw.agentRole as AgentRole) ? (raw.agentRole as AgentRole) : null;
  const deliverableType = VALID_TYPES.includes(raw.deliverableType as DeliverableType) ? (raw.deliverableType as DeliverableType) : null;
  if (!agentRole || !deliverableType) return null;
  return { agentRole, deliverableType, deliverableLang: typeof raw.deliverableLang === 'string' ? raw.deliverableLang : undefined };
}

export function rememberClassification(title: string, value: TaskClassification): void {
  if (!title.trim()) return;
  if (remembered.size >= REMEMBER_MAX) remembered.delete(remembered.keys().next().value as string);
  remembered.set(memoKey(title), { at: Date.now(), value });
}

function recalled(title: string): TaskClassification | null {
  const hit = remembered.get(memoKey(title));
  if (!hit) return null;
  if (Date.now() - hit.at > REMEMBER_TTL_MS) { remembered.delete(memoKey(title)); return null; }
  return { ...hit.value };
}

/** Test hook. */
export function clearRememberedClassifications(): void { remembered.clear(); }

// The routing instructions never change, so they go first as a stable prefix the provider can cache;
// only the task text and company line vary and come last.
const CLASSIFY_SYSTEM = `You are a project manager routing a work task to the right specialist.

Choose the best agent role AND deliverable type for the task.

Agent roles:
- engineer   → software builds: code, APIs, components, configs, docs, specs, tests
- researcher → analysis, market research, competitive intel, reports, investigations
- sales      → pitch decks, outreach sequences, GTM strategy, proposals, ICP docs, campaigns
- finance    → financial models, P&L, budgets, revenue forecasts, runway analysis
- ops        → SOPs, runbooks, OKRs, onboarding guides, process documentation
- qa         → test plans, quality audits, validation, regression analysis

Deliverable types (pick the most specific one):
code | doc | report | spec | config | analysis | design | pitch | outreach | gtm | proposal | icp | campaign

For code deliverables also pick a lang: typescript | react | nextjs | node | python | html | yaml

Respond with ONLY valid JSON, no markdown, no explanation:
{"agentRole": "sales", "deliverableType": "pitch", "deliverableLang": "markdown"}`;

/**
 * Decides which agent role should handle a task and what deliverable it produces.
 * Order: result already worked out by the intent step, then unambiguous keyword rules (no model call),
 * then the small model, then the loose keyword heuristic if the model fails.
 */
export async function classifyTask(
  title: string,
  description?: string,
): Promise<TaskClassification> {
  const known = recalled(title);
  if (known) return known;
  const sure = confidentClassification(title);
  if (sure) return sure;

  const companyCtx = getCompanyContext();
  const taskText = description && description.length > title.length + 10
    ? `Title: "${title}"\nDescription: "${description.slice(0, 300)}"`
    : `Task: "${title}"`;

  const prompt = `${companyCtx}${taskText}`;

  try {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The answer is one small JSON object; don't reserve the default output cap (a low balance 402s on that).
      body: JSON.stringify({ systemPrompt: CLASSIFY_SYSTEM, prompt, temperature: 0.1, maxTokens: 150, tier: 'small' }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { content?: string };
    if (!data.content) throw new Error('empty response');

    const match = data.content.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('no JSON in response');

    const normalized = normalizeClassification(JSON.parse(match[0]) as Record<string, unknown>);
    if (normalized) return normalized;
  } catch (err) {
    console.warn('[TaskClassifier] AI classification failed, using heuristic fallback:', err);
  }

  return heuristicFallback(title);
}

/** Minimal keyword heuristic — only used when the AI call fails. */
function heuristicFallback(title: string): TaskClassification {
  const t = title.toLowerCase();
  if (/pitch|deck|investor/.test(t))                                      return ROLE_DELIVERABLE_FALLBACK.pitch;
  if (/outreach|cold\s*email|prospect|lead\s*gen/.test(t))               return ROLE_DELIVERABLE_FALLBACK.outreach;
  if (/go.to.market|gtm|launch\s*strat|market\s*strat/.test(t))          return ROLE_DELIVERABLE_FALLBACK.gtm;
  if (/\bproposal\b/.test(t))                                             return ROLE_DELIVERABLE_FALLBACK.proposal;
  if (/icp|ideal\s*customer|buyer\s*persona/.test(t))                    return ROLE_DELIVERABLE_FALLBACK.icp;
  if (/campaign|marketing\s*plan|marketing\s*brief|ad\s*copy/.test(t))   return ROLE_DELIVERABLE_FALLBACK.campaign;
  if (/budget|forecast|financ|p&l|burn|runway|cash\s*flow/.test(t))      return { agentRole: 'finance',    deliverableType: 'report',   deliverableLang: 'markdown' };
  if (/\bsop\b|runbook|playbook|okr|workflow|process\s*doc/.test(t))     return { agentRole: 'ops',        deliverableType: 'doc',      deliverableLang: 'markdown' };
  if (/research|analys|investigat|benchmark|competitive/.test(t))        return ROLE_DELIVERABLE_FALLBACK.analysis;
  if (/test|coverage|regression|qa\s|quality\s*assur/.test(t))           return { agentRole: 'qa',         deliverableType: 'report',   deliverableLang: 'markdown' };
  if (/\bspec\b|architecture|design\s*doc|roadmap/.test(t))              return ROLE_DELIVERABLE_FALLBACK.spec;
  if (/\bdoc\b|readme|guide|manual|documentation/.test(t))               return ROLE_DELIVERABLE_FALLBACK.doc;
  if (/react|component|nextjs|next\.js/.test(t))                         return { agentRole: 'engineer',   deliverableType: 'code',     deliverableLang: 'react' };
  if (/node|express|api\s*server|graphql/.test(t))                       return { agentRole: 'engineer',   deliverableType: 'code',     deliverableLang: 'node' };
  if (/python|django|flask|fastapi/.test(t))                             return { agentRole: 'engineer',   deliverableType: 'code',     deliverableLang: 'python' };
  if (/landing\s*page|website|html|frontend/.test(t))                    return { agentRole: 'engineer',   deliverableType: 'code',     deliverableLang: 'html' };
  return { agentRole: 'engineer', deliverableType: 'code', deliverableLang: 'typescript' };
}
