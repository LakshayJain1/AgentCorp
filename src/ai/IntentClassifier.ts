import { configLoader } from '@/config/ConfigLoader';
import { useGameStore } from '@/store/gameStore';

export interface IntentResult {
  type: 'internal' | 'needs_credentials' | 'chat' | 'action';
  requiredKeys: { key: string; label: string; reason: string }[];
  confidence: number;
  chatReply?: string;
  ticketTitle?: string;
}

/** Tools available per connected provider, shown to the LLM classifier. */
const PROVIDER_TOOLS: Record<string, string[]> = {
  linear: ['create_issue', 'list_teams'],
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

async function aiClassifyIntent(
  text: string,
  connectedProviders: string[],
  history?: { role: 'user' | 'agent'; text: string }[],
): Promise<LLMClassifyResult> {
  try {
    const historyBlock = history && history.length > 0
      ? `\nConversation so far (oldest first):\n${history.map((m) => `${m.role === 'user' ? 'User' : 'CEO'}: ${m.text}`).join('\n')}\n`
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

    const prompt = `You are Alex, CEO of AgentCorp, an AI-powered virtual company.${companyBlock}
A user is chatting with you.${integrationsBlock}${historyBlock}
Classify the LATEST user message into exactly one of these types:

"action"  — The user wants to immediately EXECUTE an operation using a connected integration right now.
            Examples: "create a Linear ticket", "post a message to Slack", "list my Vercel deployments".
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

Latest message: "${text}"

Respond with valid JSON only — no markdown, no explanation:
{"type": "action", "ticketTitle": "Short Title"}
{"type": "task", "ticketTitle": "Short Title (3–7 words, Title Case)"}
{"type": "chat", "chatReply": "your short warm CEO reply"}
{"type": "needs_credentials", "ticketTitle": "Short Title"}`;

    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, temperature: 0.2 }),
    });

    if (!res.ok) throw new Error('AI classify failed');
    const data = await res.json() as { content?: string };
    if (!data.content) throw new Error('empty response');

    const jsonMatch = data.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as { type?: string; ticketTitle?: string; chatReply?: string };
    const validTypes: LLMIntentType[] = ['action', 'task', 'chat', 'needs_credentials'];
    const type = validTypes.includes(parsed.type as LLMIntentType) ? (parsed.type as LLMIntentType) : 'chat';
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

  const connectedProviders = getConnectedProviders();
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
    console.log('[AgentCorp] intent = action (LLM decision)');
    const resolvedTitle = resolveTitle(ticketTitle, text);
    return { type: 'action', requiredKeys: [], confidence: 0.95, ticketTitle: resolvedTitle };
  }

  const resolvedTitle = resolveTitle(ticketTitle, text);

  if (llmType === 'needs_credentials') {
    // Still run credential detection to populate requiredKeys for the UI prompt.
    const matchedKeys = await detectRequiredKeys(text);
    console.log('[AgentCorp] intent = needs_credentials, title =', resolvedTitle);
    return {
      type: 'needs_credentials',
      requiredKeys: matchedKeys,
      confidence: matchedKeys.length > 0 ? 0.9 : 0.7,
      ticketTitle: resolvedTitle,
    };
  }

  // llmType === 'task' — check if it references unconnected services needing creds.
  const matchedKeys = await detectRequiredKeys(text);
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
