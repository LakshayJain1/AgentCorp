import { configLoader } from '@/config/ConfigLoader';
import { useGameStore } from '@/store/gameStore';

export interface IntentResult {
  type: 'internal' | 'needs_credentials' | 'chat';
  requiredKeys: { key: string; label: string; reason: string }[];
  confidence: number;
  chatReply?: string;
  ticketTitle?: string;
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

async function aiClassify(
  text: string,
  history?: { role: 'user' | 'agent'; text: string }[],
): Promise<{ isTask: boolean; reply?: string; ticketTitle?: string }> {
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

    const prompt = `You are Alex, CEO of AgentCorp, an AI-powered virtual company.${companyBlock} A user is chatting with you.
${historyBlock}
Your job:
1. Decide if the LATEST message is a TASK INSTRUCTION your engineering/product team should execute, or a CONVERSATIONAL MESSAGE you should respond to personally as CEO.
2. If it IS a task, generate a concise ticket title (3–7 words, Title Case).

Latest message: "${text}"

TASK — only if the user is explicitly asking the team to BUILD, CREATE, WRITE, CODE, DEPLOY, or PRODUCE something concrete. Examples:
  ✅ "Build a Stripe checkout page"
  ✅ "Write a Python script to parse logs"
  ✅ "Create a landing page for the product"

CHAT — everything else, including:
  ✅ Greetings and small talk ("hi", "how are you")
  ✅ Questions about the team, company, agents, or status
  ✅ Observations, concerns, or feedback ("morale has dropped", "the team seems stressed")
  ✅ Asking for opinions, plans, or advice ("what should we do?", "what's your plan?")
  ✅ Follow-ups referencing prior conversation ("tell me more", "what about that?")
  ✅ Emotional or managerial discussions ("employees seem burnt out", "the sprint went badly")
  ✅ Anything that does NOT require the team to produce a software or document deliverable

Important: observations like "X has dropped" or "X is low" are CHAT — the user is sharing information, not assigning work. Respond as CEO with empathy, context, and a conversational reply.

Respond with valid JSON only:
{"isTask": true, "ticketTitle": "Short Ticket Title"} if it truly is a build/create/deploy request
{"isTask": false, "reply": "your short, warm CEO response — reference conversation history where relevant"} for everything else

Return ONLY the JSON, no markdown, no explanation.`;

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

    const parsed = JSON.parse(jsonMatch[0]) as { isTask?: boolean; reply?: string; ticketTitle?: string };
    return { isTask: parsed.isTask === true, reply: parsed.reply, ticketTitle: parsed.ticketTitle };
  } catch {
    // Fallback heuristic when AI is unavailable.
    // A message is only a TASK if it contains an explicit build/create/deploy verb
    // AND no conversational signal. Observations, concerns, and questions are CHAT.
    const actionVerbs = /\b(build|create|write|make|design|implement|fix|generate|draft|develop|audit|document|deploy|set up|set-up|configure|code|program|script|build out|spin up)\b/i;
    const chatSignals = /\b(how are|how is|what do you think|what should|tell me|i see|i notice|seems like|looks like|feeling|morale|stress|burnt out|dropped|falling|low|high|great|bad|good|struggling|doing well|going well|worried|concerned)\b/i;

    if (!actionVerbs.test(text) || chatSignals.test(text)) {
      return { isTask: false, reply: `Hey! 👋 I'm Alex, your CEO. Happy to chat — or drop me a task (something to build, research, or plan) and I'll get the team on it.` };
    }
    return { isTask: true, ticketTitle: formatTicketTitle(text) };
  }
}

export async function classifyIntent(
  text: string,
  history?: { role: 'user' | 'agent'; text: string }[],
): Promise<IntentResult> {
  console.log('[AgentCorp] classifyIntent called with:', text);

  // Step 1: AI-powered chat vs task classification + ticket title generation
  const { isTask, reply, ticketTitle } = await aiClassify(text, history);
  if (!isTask) {
    console.log('[AgentCorp] intent = chat');
    return {
      type: 'chat',
      requiredKeys: [],
      confidence: 0.95,
      chatReply: reply || `Got it! If you have a task for the team, just describe what you need built or done.`,
    };
  }

  const resolvedTitle = (ticketTitle && ticketTitle.length >= 3 && ticketTitle.length <= 80)
    ? ticketTitle.replace(/["""'']/g, '').trim()
    : formatTicketTitle(text);

  // Step 2: credential detection for confirmed tasks
  const matchedKeys: { key: string; label: string; reason: string }[] = [];
  const patterns = await getPatterns();

  for (const entry of patterns) {
    if (entry.pattern.test(text)) {
      console.log('[AgentCorp] matched pattern:', entry.pattern, '→ keys:', entry.keys.map(k => k.key));
      for (const k of entry.keys) {
        if (!matchedKeys.find((m) => m.key === k.key)) {
          matchedKeys.push(k);
        }
      }
    }
  }

  const hasExternalIndicators =
    /\b(connect|integrate|deploy|push|send\s*to|post\s*to|upload|publish|host)\b/i.test(text);

  if (matchedKeys.length > 0 || hasExternalIndicators) {
    console.log('[AgentCorp] intent = needs_credentials, title =', resolvedTitle);
    return {
      type: 'needs_credentials',
      requiredKeys: matchedKeys,
      confidence: matchedKeys.length > 0 ? 0.9 : 0.5,
      ticketTitle: resolvedTitle,
    };
  }

  console.log('[AgentCorp] intent = internal, title =', resolvedTitle);
  return {
    type: 'internal',
    requiredKeys: [],
    confidence: 0.95,
    ticketTitle: resolvedTitle,
  };
}
