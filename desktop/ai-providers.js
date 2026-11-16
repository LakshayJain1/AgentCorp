'use strict';

/**
 * Direct AI provider calls for the desktop app (BYOK).
 *
 * This runs in the Electron MAIN process. The user's key is read from the OS-keystore
 * encrypted store, attached here, and sent straight to the provider: it never goes
 * through the hosted site or any AgentCorp server, and it is never returned to the page.
 *
 * Pure functions plus a thin fetch wrapper, so it can be unit tested against a local
 * mock server without Electron.
 */

const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    kind: 'openai',
    base: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    models: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct'],
    keyUrl: 'https://openrouter.ai/keys',
    needsKey: true,
  },
  openai: {
    label: 'OpenAI',
    kind: 'openai',
    base: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    keyUrl: 'https://platform.openai.com/api-keys',
    needsKey: true,
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    kind: 'anthropic',
    base: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-haiku-5-5',
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    needsKey: true,
  },
  gemini: {
    label: 'Google Gemini',
    kind: 'openai',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    keyUrl: 'https://aistudio.google.com/apikey',
    needsKey: true,
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    kind: 'openai',
    base: null, // chosen by the user: Ollama, LM Studio, Groq, Together, DeepSeek, a company gateway...
    defaultModel: '',
    models: [],
    keyUrl: null,
    needsKey: false,
  },
};

const MAX_KEY_LENGTH = 512;
const MAX_MODEL_LENGTH = 120;
const MAX_PROMPT_CHARS = 400000;
const MAX_SYSTEM_CHARS = 100000;
const MAX_OUTPUT_CHARS = 200000;
const COMPLETE_TIMEOUT_MS = 120000;
const STREAM_TIMEOUT_MS = 180000;

function publicProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    base: p.base,
    defaultModel: p.defaultModel,
    models: p.models,
    keyUrl: p.keyUrl,
    needsKey: p.needsKey,
  }));
}

/** Header values must never be able to inject a new header line. */
function cleanKey(key) {
  if (typeof key !== 'string') return null;
  const k = key.trim();
  if (k.length > MAX_KEY_LENGTH) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(k)) return null;
  return k;
}

function cleanModel(model) {
  if (typeof model !== 'string') return null;
  const m = model.trim();
  if (!m || m.length > MAX_MODEL_LENGTH || /[\u0000-\u001f\u007f]/.test(m)) return null;
  return m;
}

function cleanBaseUrl(raw) {
  if (typeof raw !== 'string') return null;
  let u;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.search || u.hash) return null;
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

/**
 * Validate what the user typed into settings. Returns {ok, cfg} or {ok:false, error}.
 * The endpoint is part of the saved config together with the key, so the page can never
 * point an already-stored key at a different host (changing the endpoint needs the key again).
 */
function validateConfig(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'invalid settings' };
  const provider = typeof input.provider === 'string' && Object.prototype.hasOwnProperty.call(PROVIDERS, input.provider) ? input.provider : null;
  if (!provider) return { ok: false, error: 'unknown provider' };
  const def = PROVIDERS[provider];

  const model = cleanModel(input.model || def.defaultModel);
  if (!model) return { ok: false, error: 'choose a model name' };

  let baseUrl = def.base;
  if (provider === 'custom') {
    baseUrl = cleanBaseUrl(input.baseUrl);
    if (!baseUrl) return { ok: false, error: 'enter a full http(s) address, for example http://localhost:11434/v1' };
  }

  const rawKey = typeof input.key === 'string' ? input.key : '';
  const key = cleanKey(rawKey);
  if (key === null) return { ok: false, error: 'the key contains spaces or invalid characters' };
  if (def.needsKey && key.length < 8) return { ok: false, error: `paste your ${def.label} API key` };

  return { ok: true, cfg: { provider, model, baseUrl, key } };
}

function keyHint(key) {
  return key && key.length >= 8 ? `…${key.slice(-4)}` : '';
}

const clamp = (n, lo, hi, d) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d);

/** Normalise a request from the page into safe values. */
function cleanRequest(req) {
  if (!req || typeof req !== 'object') return null;
  if (typeof req.prompt !== 'string' || !req.prompt) return null;
  if (req.prompt.length > MAX_PROMPT_CHARS) return null;
  const system = typeof req.system === 'string' ? req.system.slice(0, MAX_SYSTEM_CHARS) : '';
  return {
    system,
    prompt: req.prompt,
    temperature: clamp(req.temperature, 0, 2, 0.3),
    maxTokens: Math.floor(clamp(req.maxTokens, 1, 8192, 4096)),
  };
}

function buildRequest(cfg, req, stream) {
  const kind = PROVIDERS[cfg.provider].kind;
  if (kind === 'anthropic') {
    return {
      url: `${cfg.baseUrl}/messages`,
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
      body: {
        model: cfg.model,
        max_tokens: req.maxTokens,
        temperature: Math.min(1, req.temperature),
        ...(req.system ? { system: req.system } : {}),
        messages: [{ role: 'user', content: req.prompt }],
        ...(stream ? { stream: true } : {}),
      },
    };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  if (cfg.provider === 'openrouter') headers['X-Title'] = 'AgentCorp';
  return {
    url: `${cfg.baseUrl}/chat/completions`,
    headers,
    body: {
      model: cfg.model,
      messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), { role: 'user', content: req.prompt }],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      ...(stream ? { stream: true } : {}),
    },
  };
}

function parseCompletion(cfg, json) {
  if (!json || typeof json !== 'object') return null;
  if (PROVIDERS[cfg.provider].kind === 'anthropic') {
    const parts = Array.isArray(json.content) ? json.content : [];
    const text = parts.filter((p) => p && p.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('');
    return text || null;
  }
  const msg = json.choices && json.choices[0] && json.choices[0].message;
  return msg && typeof msg.content === 'string' && msg.content ? msg.content : null;
}

/** One SSE line -> {delta} | {done} | {error} | null. */
function parseStreamLine(cfg, line) {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload) return null;
  if (payload === '[DONE]') return { done: true };
  let j;
  try { j = JSON.parse(payload); } catch { return null; }
  if (PROVIDERS[cfg.provider].kind === 'anthropic') {
    if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta' && typeof j.delta.text === 'string') return { delta: j.delta.text };
    if (j.type === 'message_stop') return { done: true };
    if (j.type === 'error') return { error: (j.error && j.error.message) || 'provider error' };
    return null;
  }
  if (j.error) return { error: typeof j.error === 'string' ? j.error : j.error.message || 'provider error' };
  const d = j.choices && j.choices[0] && j.choices[0].delta;
  return d && typeof d.content === 'string' && d.content ? { delta: d.content } : null;
}

/** A message a person can act on, never containing the key. */
function describeFailure(status, bodyText, label) {
  let detail = '';
  try {
    const j = JSON.parse(bodyText);
    detail = (j && j.error && (j.error.message || (typeof j.error === 'string' ? j.error : ''))) || '';
  } catch { /* not json */ }
  detail = String(detail).replace(/\s+/g, ' ').slice(0, 200);
  if (status === 401 || status === 403) return `${label} rejected your API key. Check that it is correct and still active.`;
  if (status === 402) return `${label} says this account is out of credit. Add credit, or use another key.${detail ? ` (${detail})` : ''}`;
  if (status === 404) return `${label} does not know that model name. Check the model.${detail ? ` (${detail})` : ''}`;
  if (status === 429) return `${label} is rate limiting this key. Wait a moment, or check your plan limits.`;
  if (status >= 500) return `${label} had a server problem (${status}). Try again shortly.`;
  return `${label} returned an error (${status}).${detail ? ` ${detail}` : ''}`;
}

function describeNetworkError(err, cfg) {
  if (err && err.name === 'AbortError') return 'cancelled';
  if (err && err.name === 'TimeoutError') return 'The AI provider took too long to answer.';
  const where = cfg.provider === 'custom' ? cfg.baseUrl : PROVIDERS[cfg.provider].label;
  return `Could not reach ${where}. Check your internet connection${cfg.provider === 'custom' ? ' and that the server is running' : ''}.`;
}

function withTimeout(signal, ms) {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

/** Non-streaming completion. Resolves {ok, content?, error?, status?}; never throws. */
async function complete(cfg, rawReq, opts = {}) {
  const req = cleanRequest(rawReq);
  if (!req) return { ok: false, error: 'invalid request' };
  const label = PROVIDERS[cfg.provider].label;
  const b = buildRequest(cfg, req, false);
  try {
    const res = await (opts.fetchImpl || fetch)(b.url, {
      method: 'POST',
      headers: b.headers,
      body: JSON.stringify(b.body),
      redirect: 'error', // never forward the key to another host
      signal: withTimeout(opts.signal, COMPLETE_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: describeFailure(res.status, text, label) };
    let json = null;
    try { json = JSON.parse(text); } catch { /* handled below */ }
    const content = parseCompletion(cfg, json);
    if (!content) return { ok: false, status: res.status, error: `${label} returned an empty answer.` };
    return { ok: true, content: content.slice(0, MAX_OUTPUT_CHARS) };
  } catch (err) {
    return { ok: false, error: describeNetworkError(err, cfg) };
  }
}

/** Streaming completion; calls onDelta(text) per chunk. Resolves {ok, content?, error?}; never throws. */
async function stream(cfg, rawReq, onDelta, opts = {}) {
  const req = cleanRequest(rawReq);
  if (!req) return { ok: false, error: 'invalid request' };
  const label = PROVIDERS[cfg.provider].label;
  const b = buildRequest(cfg, req, true);
  let full = '';
  try {
    const res = await (opts.fetchImpl || fetch)(b.url, {
      method: 'POST',
      headers: b.headers,
      body: JSON.stringify(b.body),
      redirect: 'error',
      signal: withTimeout(opts.signal, STREAM_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, error: describeFailure(res.status, await res.text(), label) };
    if (!res.body) return { ok: false, error: `${label} sent no data.` };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let failure = null;
    outer: for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        const evt = parseStreamLine(cfg, line);
        if (!evt) continue;
        if (evt.delta) {
          if (full.length + evt.delta.length > MAX_OUTPUT_CHARS) break outer;
          full += evt.delta;
          onDelta(evt.delta);
        } else if (evt.error) {
          failure = evt.error;
          break outer;
        } else if (evt.done) {
          break outer;
        }
      }
    }
    if (failure && !full) return { ok: false, error: `${label}: ${String(failure).slice(0, 200)}` };
    if (!full) return { ok: false, error: `${label} returned an empty answer.` };
    return { ok: true, content: full };
  } catch (err) {
    return { ok: false, error: describeNetworkError(err, cfg), content: full };
  }
}

module.exports = {
  PROVIDERS,
  publicProviders,
  validateConfig,
  keyHint,
  cleanRequest,
  cleanModel,
  buildRequest,
  parseCompletion,
  parseStreamLine,
  describeFailure,
  complete,
  stream,
};
