import { AgentRole, DeliverableType } from '@/agents/AgentTypes';
import { useGameStore } from '@/store/gameStore';

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

/**
 * Asks Claude to classify a task: which agent role should handle it and
 * what deliverable format should it produce.  Falls back to a simple
 * keyword heuristic if the AI call fails or times out.
 */
export async function classifyTask(
  title: string,
  description?: string,
): Promise<TaskClassification> {
  const companyCtx = getCompanyContext();
  const taskText = description && description.length > title.length + 10
    ? `Title: "${title}"\nDescription: "${description.slice(0, 300)}"`
    : `Task: "${title}"`;

  const prompt = `You are a project manager routing a work task to the right specialist.

${companyCtx}${taskText}

Choose the best agent role AND deliverable type for this task.

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

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, temperature: 0.1 }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { content?: string };
    if (!data.content) throw new Error('empty response');

    const match = data.content.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('no JSON in response');

    const parsed = JSON.parse(match[0]) as Partial<TaskClassification>;

    const agentRole = VALID_ROLES.includes(parsed.agentRole as AgentRole)
      ? (parsed.agentRole as AgentRole)
      : null;
    const deliverableType = VALID_TYPES.includes(parsed.deliverableType as DeliverableType)
      ? (parsed.deliverableType as DeliverableType)
      : null;

    if (agentRole && deliverableType) {
      return { agentRole, deliverableType, deliverableLang: parsed.deliverableLang };
    }
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
