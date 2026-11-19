/**
 * Groq adapter helpers (server side only; the key never leaves the server).
 *
 * Two model tiers keep token spend down: routing and chat (intent, task classification, acceptance
 * criteria, short replies) use the small model; real work (the agent loop, deliverables, QA judge,
 * planning, tool calls) uses the large one. Both names can be overridden per environment because
 * Groq retires models on short notice: GROQ_MODEL_SMALL / GROQ_MODEL_LARGE, each a comma-separated
 * list (the next model is tried when one is rate-limited, see openrouterFallback.postWithFallback).
 */

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export type ModelTier = 'small' | 'large';

export const DEFAULT_GROQ_SMALL = 'openai/gpt-oss-20b';
export const DEFAULT_GROQ_LARGE = 'openai/gpt-oss-120b';

/** Hard ceiling for one reply, including a retry after the first was cut off. Keeps requests inside the free tokens-per-minute limit. */
export const MAX_REPLY_TOKENS = 6000;
const FIRST_REPLY_TOKENS = 4096;

export function isTier(v: unknown): v is ModelTier {
  return v === 'small' || v === 'large';
}

function list(v: string | undefined): string[] {
  return (v ?? '').split(',').map((m) => m.trim()).filter(Boolean);
}

/**
 * Models to try for a tier, in order. Routing may borrow the large model if the small one is rate-limited
 * (each Groq model has its own limits); the large tier never falls back to the small one, because a weaker
 * model cannot be trusted with the agent loop's tool calls.
 */
export function groqModels(tier: ModelTier | undefined, env: Record<string, string | undefined> = process.env): string[] {
  const small = list(env.GROQ_MODEL_SMALL);
  const large = list(env.GROQ_MODEL_LARGE);
  const s = small.length ? small : [DEFAULT_GROQ_SMALL];
  const l = large.length ? large : [DEFAULT_GROQ_LARGE];
  return tier === 'small' ? [...s, ...l.filter((m) => !s.includes(m))] : l;
}

/** gpt-oss spends part of the output cap on hidden reasoning; "low" keeps that small. Other models ignore the field. */
export function groqExtras(models: string[]): Record<string, unknown> {
  return models.every((m) => m.startsWith('openai/gpt-oss')) ? { reasoning_effort: 'low' } : {};
}

/** Cap for the first attempt: the caller's cap, never above the default ceiling. */
export function firstCap(requested: number | undefined): number {
  return Math.max(16, Math.min(requested ?? FIRST_REPLY_TOKENS, FIRST_REPLY_TOKENS));
}

/** Cap for the single retry after a reply was cut off by the length limit. */
export function boostedCap(cap: number): number {
  return Math.min(Math.max(cap * 2, cap + 256), MAX_REPLY_TOKENS);
}

/** Seconds to wait before retrying a 429, only when it is short enough to be worth waiting for. */
export function retryDelayMs(headers: { get(name: string): string | null }, maxMs = 8000): number | null {
  const raw = headers.get('retry-after');
  if (!raw) return null;
  const s = Number(raw);
  if (!Number.isFinite(s) || s < 0) return null;
  const ms = Math.ceil(s * 1000);
  return ms <= maxMs ? ms : null;
}
