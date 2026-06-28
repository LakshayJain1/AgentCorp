import { configLoader } from '@/config/ConfigLoader';

export interface IntentResult {
  type: 'internal' | 'needs_credentials';
  requiredKeys: { key: string; label: string; reason: string }[];
  confidence: number;
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

export async function classifyIntent(text: string): Promise<IntentResult> {
  console.log('[AgentCorp] classifyIntent called with:', text);
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

  const clean = text.toLowerCase();
  const hasExternalIndicators =
    /\b(connect|integrate|deploy|push|send\s*to|post\s*to|upload|publish|host)\b/i.test(clean);

  if (matchedKeys.length > 0 || hasExternalIndicators) {
    const confidence = matchedKeys.length > 0 ? 0.9 : 0.5;
    console.log('[AgentCorp] intent = needs_credentials, matchedKeys:', matchedKeys.length, 'hasExternalIndicators:', hasExternalIndicators);
    return {
      type: 'needs_credentials',
      requiredKeys: matchedKeys,
      confidence,
    };
  }

  console.log('[AgentCorp] intent = internal');
  return {
    type: 'internal',
    requiredKeys: [],
    confidence: 0.95,
  };
}
