/**
 * Headless stand-in for src/engine/model.ts: same callModel() contract, but it
 * talks to the provider directly instead of through the app's /api/ai route
 * (which needs a signed-in browser session). Same defaults as the route:
 * OpenRouter first (model openai/gpt-4o-mini unless overridden), Gemini fallback.
 */

export interface ModelConfig {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey: string;
}

export const stats = { calls: 0, failures: 0, promptTokens: 0, completionTokens: 0, errors: {} as Record<string, number> };
const noteError = (k: string) => { stats.errors[k] = (stats.errors[k] ?? 0) + 1; };
let config: ModelConfig | null = null;

export function configureModel(c: ModelConfig): void { config = c; }
export function resetStats(): void { stats.calls = 0; stats.failures = 0; stats.promptTokens = 0; stats.completionTokens = 0; stats.errors = {}; }
export async function modelAvailable(): Promise<boolean> { return !!config?.apiKey; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openrouter(c: ModelConfig, o: { system?: string; prompt: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<string | null> {
  const messages = [...(o.system ? [{ role: 'system', content: o.system }] : []), { role: 'user', content: o.prompt }];
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}` },
    body: JSON.stringify({ model: c.model, messages, temperature: o.temperature ?? 0.2, max_tokens: o.maxTokens ?? 2500 }),
    signal: o.signal,
  });
  if (res.status === 429 || res.status >= 500) { noteError(`http ${res.status}`); throw Object.assign(new Error(`retryable ${res.status}`), { retry: true }); }
  if (!res.ok) { noteError(`http ${res.status}`); return null; }
  const j = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  stats.promptTokens += j?.usage?.prompt_tokens ?? 0;
  stats.completionTokens += j?.usage?.completion_tokens ?? 0;
  return j?.choices?.[0]?.message?.content ?? null;
}

async function gemini(c: ModelConfig, o: { system?: string; prompt: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent?key=${c.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: o.system ? { parts: [{ text: o.system }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: o.prompt }] }],
      generationConfig: { temperature: o.temperature ?? 0.2, maxOutputTokens: o.maxTokens ?? 2500 },
    }),
    signal: o.signal,
  });
  if (res.status === 429 || res.status >= 500) { noteError(`http ${res.status}`); throw Object.assign(new Error(`retryable ${res.status}`), { retry: true }); }
  if (!res.ok) { noteError(`http ${res.status}`); return null; }
  const j = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } } | null;
  stats.promptTokens += j?.usageMetadata?.promptTokenCount ?? 0;
  stats.completionTokens += j?.usageMetadata?.candidatesTokenCount ?? 0;
  return j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? null;
}

export async function callModel(opts: {
  label: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string | null> {
  if (!config) throw new Error('benchmark model is not configured');
  stats.calls++;
  const delays = [2000, 6000, 15000, 30000];
  for (let attempt = 0; ; attempt++) {
    try {
      const out = config.provider === 'gemini' ? await gemini(config, opts) : await openrouter(config, opts);
      if (out === null) stats.failures++;
      return out;
    } catch (e) {
      if (opts.signal?.aborted) return null;
      const retry = (e as { retry?: boolean }).retry === true || e instanceof TypeError; // TypeError = fetch failed (network blip)
      if ((e as { retry?: boolean }).retry !== true) noteError(`network: ${String((e as Error)?.cause ?? e).slice(0, 60)}`);
      if (!retry || attempt >= delays.length) { stats.failures++; return null; }
      await sleep(delays[attempt]);
    }
  }
}
