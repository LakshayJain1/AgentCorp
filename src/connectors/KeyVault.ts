// Per-user key vault interface (server-side).
// Design: secrets are stored encrypted per user and referenced by handle.
// This P1 scaffolding provides a dev fallback (process.env) and a clearly-marked
// persistent backend seam. It NEVER logs or returns raw secret values.

export interface KeyReference {
  /** Opaque handle, e.g. "vault://<userId>/openrouter". Safe to log/store client-side. */
  ref: string;
  provider: 'openrouter' | 'gemini' | 'github' | 'vercel';
}

const DEV_ENV_MAP: Record<KeyReference['provider'], string | undefined> = {
  openrouter: process.env.OPENROUTER_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  // User OAuth tokens are never in env — they arrive per-request after OAuth.
  github: undefined,
  vercel: undefined,
};

export function hasDevKey(provider: KeyReference['provider']): boolean {
  return !!DEV_ENV_MAP[provider];
}

// TODO(P1-full): replace with encrypted per-user store (e.g. Postgres + KMS envelope).
// Current behavior: dev fallback only; production without vault returns unavailable.
export async function resolveKey(
  userId: string,
  provider: KeyReference['provider'],
): Promise<{ ok: true; ref: KeyReference } | { ok: false; needed: string }> {
  if (!userId) {
    return { ok: false, needed: 'Sign in (Clerk) so keys resolve per user, not globally.' };
  }
  if (hasDevKey(provider)) {
    return { ok: true, ref: { ref: `env://${provider}`, provider } };
  }
  const neededByProvider: Record<KeyReference['provider'], string> = {
    openrouter: 'OPENROUTER_API_KEY (dev) or per-user BYOK vault entry for OpenRouter',
    gemini: 'GEMINI_API_KEY (dev) or per-user BYOK vault entry for Gemini',
    github: 'GitHub App (APP_ID + private key + OAuth client) so users can connect their own repos',
    vercel: 'Vercel integration credentials so users can link their own projects',
  };
  return { ok: false, needed: neededByProvider[provider] };
}
