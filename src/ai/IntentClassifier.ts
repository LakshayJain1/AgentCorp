import { configLoader } from '@/config/ConfigLoader';
import { useGameStore } from '@/store/gameStore';
import { aiFetch } from '@/ai/transport';
import { guardAction, providersMentioned, PROVIDER_LABELS } from '@/ai/actionGuard';
import { trimHistory } from '@/ai/history';
import { normalizeClassification, rememberClassification } from '@/ai/TaskClassifier';

export interface IntentResult {
  type: 'internal' | 'needs_credentials' | 'chat' | 'action';
  requiredKeys: { key: string; label: string; reason: string }[];
  confidence: number;
  chatReply?: string;
  ticketTitle?: string;
  /** Integrations the server reports connected at classification time (used to route credential requests). */
  connectedProviders?: string[];
}

/** Forget the cached connection list (call right after the user connects an integration). */
export function invalidateConnectedProviders(): void {
  serverConnected = null;
}

/** Tools available per connected provider, shown to the LLM classifier. */
const PROVIDER_TOOLS: Record<string, string[]> = {
  linear: ['create_issue', 'get_issue', 'comment_on_issue', 'update_issue_status', 'add_label', 'assign_issue', 'list_teams', 'list_workflow_states'],
  slack: ['post_message'],
  vercel: ['list_deployments', 'get_user'],
  github: ['read_file', 'propose_file', 'list_checks', 'ensure_branch'],
  notion: ['search_pages', 'create_page', 'append_block'],
};

/**
 * Returns all provider names that are currently connected in the game store.
 */
function getConnectedProviders(): string[] {
  try {
    const state = useGameStore.getState();
    const connectors = (state as any).connectors;
    if (!connectors) return [];
    return Object.entries(connectors)
      .filter(([, v]) => (v as any)?.connected === true)
      .map(([k]) => k);
  } catch {
    return [];
  }
}

let serverConnected: { at: number; list: string[] } | null = null;
const CONNECTED_TTL_MS = 10_000;
const CONNECTED_TIMEOUT_MS = 4_000;

/**
 * The server's integration store is the source of truth. The persisted `connectors`
 * flags in the game store go stale (onboarding left GitHub/Vercel "connected" with no
 * OAuth behind them) and only re-sync when the Integrations tab is opened, so ask the
 * server directly, repair the store with the answer, and fall back to the last server
 * answer (then the local flags) if it cannot be reached. Cached briefly and time-boxed
 * so the lookup never holds up a chat message for long.
 */
async function resolveConnectedProviders(): Promise<string[]> {
  if (serverConnected && Date.now() - serverConnected.at < CONNECTED_TTL_MS) return serverConnected.list;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONNECTED_TIMEOUT_MS);
  try {
    const res = await fetch('/api/integrations', { cache: 'no-store', signal: ctrl.signal });
    if (res.ok) {
      const data = (await res.json()) as { connections?: Array<{ provider: string; accountId?: string | null }> };
      if (Array.isArray(data.connections)) {
        try { useGameStore.getState().syncOAuthConnections(data.connections); } catch { /* headless */ }
        serverConnected = { at: Date.now(), list: data.connections.map((c) => c.provider) };
        return serverConnected.list;
      }
    }
  } catch {
    // offline, timed out, or headless: fall through
  } finally {
    clearTimeout(timer);
  }
  return serverConnected?.list ?? getConnectedProviders();
}

/**
 * Put the integrations the message names (and that are not connected) first in the
 * credential request, so the user is told "Linear connection" rather than a generic
 * "API Credentials" that matched an unrelated word like "login".
 */
function withProviderKeys(
  keys: { key: string; label: string; reason: string }[],
  text: string,
  connected: string[],
): { key: string; label: string; reason: string }[] {
  const out = [...keys];
  for (const p of providersMentioned(text).filter((m) => !connected.includes(m))) {
    if (out.some((k) => k.key.startsWith(`${p}_`))) continue;
    const label = PROVIDER_LABELS[p] ?? p;
    out.unshift({
      key: `${p}_connection`,
      label: `${label} connection`,
      reason: `${label} is not connected. Connect it in the Integrations tab so the team can act on it.`,
    });
  }
  return out;
}

interface KeywordEntry {
  pattern: RegExp;
  keys: { key: string; label: string; reason: string }[];
}

const DEFAULT_PATTERNS: KeywordEntry[] = [
  { pattern: /\b(github|git|repo|repository|push|commit|clone)\b/i, keys: [{ key: 'github_token', label: 'GitHub Personal Access Token', reason: 'Needed to create repositories, push code, or interact with GitHub on your behalf.' }] },
  { pattern: /\b(vercel|deploy|deployment)\b/i, keys: [{ key: 'vercel_token', label: 'Vercel API Token', reason: 'Required to deploy the project to Vercel.' }] },
  { pattern: /\b(slack|webhook|notification)\b/i, keys: [{ key: 'slack_webhook', label: 'Slack Webhook URL', reason: 'Needed to send notifications or messages to a Slack channel.' }] },
  { pattern: /\b(openai|gpt|chatgpt|llm|ai\s*key|gemini|claude)\b/i, keys: [{ key: 'ai_api_key', label: 'AI Provider API Key', reason: 'External AI service required to fulfill this request.' }] },
  { pattern: /\b(database|postgres|mysql|mongodb|redis|supabase|firebase)\b/i, keys: [{ key: 'database_url', label: 'Database Connection String', reason: 'A database connection is needed to store or retrieve data for this task.' }] },
  { pattern: /\b(api\s*key|token|secret|credential|auth|oauth|login|password)\b/i, keys: [{ key: 'api_credentials', label: 'API Credentials (Key/Token)', reason: 'This task requires external API access that needs authentication.' }] },
  { pattern: /\b(aws|s3|ec2|lambda|cloud|azure|gcp|google\s*cloud)\b/i, keys: [{ key: 'cloud_credentials', label: 'Cloud Provider Credentials', reason: 'Cloud infrastructure access is required for this task.' }] },
  { pattern: /\b(docker|kubernetes|k8s|container|registry)\b/i, keys: [{ key: 'container_registry', label: 'Container Registry Credentials', reason: 'Container registry access needed to build and push images.' }] },
  { pattern: /\b(stripe|payment|invoice|billing|checkout)\b/i, keys: [{ key: 'stripe_api_key', label: 'Stripe API Key', reason: 'Payment processing requires Stripe API access.' }] },
  { pattern: /\b(twitter|x\.com|linkedin|facebook|instagram|social|discord)\b/i, keys: [{ key: 'social_api_key', label: 'Social Media API Credentials', reason: 'Social media platform API access is required.' }] },
  { pattern: /\b(mcp|external\s*plugin|plugin|integration)\b/i, keys: [{ key: 'mcp_credentials', label: 'External Plugin/MCP Credentials', reason: 'This task requires an external plugin or MCP integration that needs credentials.' }] },
];

let cachedPatterns: KeywordEntry[] | null = null;

export async function loadIntentPatterns(): Promise<void> {
  if (cachedPatterns) return;
  await getPatterns();
}

async function getPatterns(): Promise<KeywordEntry[]> {
  if (cachedPatterns) return cachedPatterns;

  try {
    const md = await configLoader.fetchText('/config/intent-patterns.md');
    const section = configLoader.getSection(md, 'External Keyword Patterns');
    const rows = configLoader.parseTable(section);

    cachedPatterns = rows.map(r => ({
      pattern: new RegExp(r.KeywordPattern || '', 'i'),
      keys: [{
        key: r.CredentialKey || '',
        label: r.CredentialLabel || '',
        reason: r.CredentialReason || '',
      }],
    }));
  } catch {
    cachedPatterns = DEFAULT_PATTERNS;
  }
  return cachedPatterns;
}

export function formatTicketTitle(text: string): string {
  // Strip code blocks and attached file annotations if present
  let clean = text.replace(/\[Attached file:[\s\S]*?\]/gi, '').trim();
  // Strip conversational leading filler
  clean = clean.replace(/^(can\s+you\s+(please\s+)?|could\s+you\s+(please\s+)?|please\s+|i\s+want\s+(you\s+)?to\s+|i\s+need\s+(you\s+)?to\s+|help\s+me\s+(to\s+)?|build\s+me\s+|create\s+me\s+|make\s+me\s+|write\s+me\s+|hey\s+(there\s*)?,?\s*|let's\s+|lets\s+)/i, '').trim();
  // Strip trailing punctuation
  clean = clean.replace(/[.?!;:]+$/, '').trim();

  // If first line has words, take first sentence or line
  const firstLine = clean.split('\n')[0].trim();
  const words = firstLine.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'Untitled Project Task';

  // Take at most 8 words
  const maxWords = words.slice(0, 8).join(' ');

  // Convert to Title Case
  return maxWords.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

type LLMIntentType = 'action' | 'task' | 'chat' | 'needs_credentials';

interface LLMClassifyResult {
  type: LLMIntentType;
  ticketTitle?: string;
  chatReply?: string;
}

const GREETING_RE = /^\s*(hi|hello|hey|yo|sup|hiya|howdy|good (morning|afternoon|evening)|thanks|thank you|thx|ty|ok|okay|cool|nice|great|got it|sounds good)\b[\s!.,]*(alex|there|team|all)?[\s!.,]*$/i;
const BUILD_VERB_RE = /^\s*(please\s+)?(build|create|write|make|design|implement|generate|draft|develop|code|add)\b/i;

/**
 * Decides obvious messages without a model call. Deliberately narrow: bare greetings/thanks become chat,
 * and short imperative build requests that name no integration become tasks. Everything else (questions,
 * anything touching an integration, anything ambiguous) still goes to the model. Exported for tests.
 */
export function ruleIntent(text: string): LLMClassifyResult | null {
  const t = text.trim();
  if (!t) return null;
  if (GREETING_RE.test(t)) {
    return { type: 'chat', chatReply: "Hey! I'm Alex. Tell me what you'd like the team to build, research or plan and I'll get it moving." };
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (
    t.length <= 120 && words.length >= 3 && BUILD_VERB_RE.test(t) &&
    !t.endsWith('?') && !t.includes('\n') && providersMentioned(t).length === 0
  ) {
    return { type: 'task', ticketTitle: formatTicketTitle(t) };
  }
  return null;
}

async function aiClassifyIntent(
  text: string,
  connectedProviders: string[],
  history?: { role: 'user' | 'agent'; text: string }[],
): Promise<LLMClassifyResult> {
  const ruled = ruleIntent(text);
  if (ruled) return ruled;
  try {
    const recent = trimHistory(history, { maxMessages: 4, maxChars: 200 });
    const historyBlock = recent.length > 0
      ? `\nConversation so far (oldest first):\n${recent.map((m) => `${m.role === 'user' ? 'User' : 'CEO'}: ${m.text}`).join('\n')}\n`
      : '';

    let companyBlock = '';
    try {
      const { companyName, companyProduct } = useGameStore.getState();
      if (companyName || companyProduct) {
        companyBlock = `\nCompany: ${companyName} | Building: ${companyProduct}\n`;
      }
    } catch { /* outside React context */ }

    const integrationsBlock = connectedProviders.length > 0
      ? `\nConnected integrations (OAuth tokens on file — can execute immediately):\n${connectedProviders.map((p) => {
          const tools = PROVIDER_TOOLS[p] ?? [];
          return `  - ${p}${tools.length > 0 ? `: ${tools.join(', ')}` : ''}`;
        }).join('\n')}\n`
      : '\nNo integrations currently connected.\n';

    // Volatile context last, static instructions in the system prompt (stable prefix the provider can cache).
    const prompt = `${companyBlock}${integrationsBlock}${historyBlock}
Latest message: "${text}"`;

    const systemPrompt = `You are Alex, CEO of AgentCorp, an AI-powered virtual company.
A user is chatting with you.
Classify the LATEST user message into exactly one of these types:

"action"  — The user wants to immediately EXECUTE an operation using a connected integration right now.
            Examples: "create a Linear ticket", "post a message to Slack", "list my Vercel deployments",
            "search my Notion pages", "find a Notion page about X", "create a Notion page".
            Only valid if the relevant integration is listed as connected above.

"task"    — The user wants the team to BUILD, CREATE, CODE, WRITE, or PRODUCE a software or document deliverable.
            Examples: "build a Stripe checkout page", "write a Python script", "design a landing page".

"chat"    — Everything else: greetings, questions, status checks, opinions, observations, concerns, follow-ups.
            Examples: "hi", "how's the team?", "morale seems low", "what should we do next?".

"needs_credentials" — The user wants to use an external service or integration that is NOT currently connected.
            Only use this if the message clearly references an unconnected external service.

Rules:
- If the user says "create a [provider] ticket/issue/message/deploy" and that provider IS connected → "action".
- If the user says "build me an app that uses Linear" or "integrate with Slack" → "task" (they want software built).
- Observations like "X has dropped" are always "chat".
- When in doubt between "action" and "task": if it's a one-shot operation (not building software) and a connected tool covers it → "action".
- "search/find/look up [provider] pages/issues/messages" when that provider IS connected → always "action".

For "task" also name who should do it, so no second routing call is needed:
agentRole: engineer | researcher | sales | finance | ops | qa
deliverableType: code | doc | report | spec | config | analysis | design | pitch | outreach | gtm | proposal | icp | campaign
deliverableLang (code only): typescript | react | nextjs | node | python | html | yaml
Keep chatReply to one or two short sentences.

Respond with valid JSON only — no markdown, no explanation:
{"type": "action", "ticketTitle": "Short Title"}
{"type": "task", "ticketTitle": "Short Title (3–7 words, Title Case)", "agentRole": "engineer", "deliverableType": "code", "deliverableLang": "react"}
{"type": "chat", "chatReply": "your short warm CEO reply"}
{"type": "needs_credentials", "ticketTitle": "Short Title"}`;

    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // One small JSON object (+ a short chatReply); don't reserve the default output cap.
      body: JSON.stringify({ systemPrompt, prompt, temperature: 0.2, maxTokens: 300, tier: 'small' }),
    });

    if (!res.ok) throw new Error('AI classify failed');
    const data = await res.json() as { content?: string };
    if (!data.content) throw new Error('empty response');

    const jsonMatch = data.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as { type?: string; ticketTitle?: string; chatReply?: string; agentRole?: string; deliverableType?: string; deliverableLang?: string };
    const validTypes: LLMIntentType[] = ['action', 'task', 'chat', 'needs_credentials'];
    const type = validTypes.includes(parsed.type as LLMIntentType) ? (parsed.type as LLMIntentType) : 'chat';
    if (type === 'task') {
      // Reuse the routing the model already did so classifyTask() does not spend a second call on this title.
      const cls = normalizeClassification(parsed);
      const title = resolveTitle(parsed.ticketTitle, text);
      if (cls) rememberClassification(title, cls);
    }
    return { type, ticketTitle: parsed.ticketTitle, chatReply: parsed.chatReply };
  } catch {
    // Fallback heuristics when AI is unavailable.
    const actionVerbs = /\b(build|create|write|make|design|implement|fix|generate|draft|develop|audit|document|deploy|set up|set-up|configure|code|program|script|spin up)\b/i;
    const chatSignals = /\b(how are|how is|what do you think|what should|tell me|i see|i notice|seems like|looks like|feeling|morale|stress|burnt out|dropped|falling|low|high|great|bad|good|struggling|doing well|going well|worried|concerned)\b/i;

    if (!actionVerbs.test(text) || chatSignals.test(text)) {
      return { type: 'chat', chatReply: `Hey! I'm Alex, your CEO. Happy to chat — or drop me a task (something to build, research, or plan) and I'll get the team on it.` };
    }
    return { type: 'task', ticketTitle: formatTicketTitle(text) };
  }
}

export async function classifyIntent(
  text: string,
  history?: { role: 'user' | 'agent'; text: string }[],
): Promise<IntentResult> {
  console.log('[AgentCorp] classifyIntent called with:', text);

  const connectedProviders = await resolveConnectedProviders();
  console.log('[AgentCorp] connected providers:', connectedProviders);

  // Single LLM call: model sees integration context and decides intent type.
  const { type: llmType, ticketTitle, chatReply } = await aiClassifyIntent(text, connectedProviders, history);

  if (llmType === 'chat') {
    console.log('[AgentCorp] intent = chat');
    return {
      type: 'chat',
      requiredKeys: [],
      confidence: 0.95,
      chatReply: chatReply || `Got it! If you have a task for the team, just describe what you need built or done.`,
    };
  }

  if (llmType === 'action') {
    // The LLM does not reliably honour "only valid if connected": verify it.
    const guard = guardAction(text, connectedProviders);
    if (!guard.downgrade) {
      console.log('[AgentCorp] intent = action (LLM decision)');
      const resolvedTitle = resolveTitle(ticketTitle, text);
      return { type: 'action', requiredKeys: [], confidence: 0.95, ticketTitle: resolvedTitle };
    }

    const resolvedTitle = resolveTitle(ticketTitle, text);
    const keys = withProviderKeys(await detectRequiredKeys(text), text, connectedProviders);
    if (keys.length === 0) {
      keys.push({
        key: 'integration_connection',
        label: 'An integration connection',
        reason: 'This needs a connected integration (Linear, Slack, Vercel, GitHub or Notion). Connect one in the Integrations tab.',
      });
    }
    console.log('[AgentCorp] intent = needs_credentials (action downgraded: integration not connected), title =', resolvedTitle);
    return { type: 'needs_credentials', requiredKeys: keys, confidence: 0.9, ticketTitle: resolvedTitle, connectedProviders };
  }

  const resolvedTitle = resolveTitle(ticketTitle, text);

  if (llmType === 'needs_credentials') {
    // Still run credential detection to populate requiredKeys for the UI prompt.
    const matchedKeys = withProviderKeys(await detectRequiredKeys(text), text, connectedProviders);
    console.log('[AgentCorp] intent = needs_credentials, title =', resolvedTitle);
    return {
      type: 'needs_credentials',
      requiredKeys: matchedKeys,
      confidence: matchedKeys.length > 0 ? 0.9 : 0.7,
      ticketTitle: resolvedTitle,
      connectedProviders,
    };
  }

  // llmType === 'task' — check if it references unconnected services needing creds.
  const matchedKeys = withProviderKeys(await detectRequiredKeys(text), text, connectedProviders);
  const hasExternalIndicators =
    /\b(connect|integrate|push|send\s*to|post\s*to|upload|publish|host)\b/i.test(text);

  // Only escalate to needs_credentials when the referenced service is not already connected.
  if (matchedKeys.length > 0 || hasExternalIndicators) {
    const keyProviders = matchedKeys.map((k) => k.key.split('_')[0]);
    const allConnected = keyProviders.every((p) => connectedProviders.includes(p));
    if (!allConnected) {
      console.log('[AgentCorp] intent = needs_credentials (task with unconnected service), title =', resolvedTitle);
      return {
        type: 'needs_credentials',
        requiredKeys: matchedKeys,
        confidence: matchedKeys.length > 0 ? 0.9 : 0.5,
        ticketTitle: resolvedTitle,
        connectedProviders,
      };
    }
  }

  console.log('[AgentCorp] intent = internal, title =', resolvedTitle);
  return { type: 'internal', requiredKeys: [], confidence: 0.95, ticketTitle: resolvedTitle };
}

function resolveTitle(ticketTitle: string | undefined, text: string): string {
  return (ticketTitle && ticketTitle.length >= 3 && ticketTitle.length <= 80)
    ? ticketTitle.replace(/["""'']/g, '').trim()
    : formatTicketTitle(text);
}

async function detectRequiredKeys(text: string): Promise<{ key: string; label: string; reason: string }[]> {
  const matchedKeys: { key: string; label: string; reason: string }[] = [];
  const patterns = await getPatterns();
  for (const entry of patterns) {
    if (entry.pattern.test(text)) {
      for (const k of entry.keys) {
        if (!matchedKeys.find((m) => m.key === k.key)) matchedKeys.push(k);
      }
    }
  }
  return matchedKeys;
}
