import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getUserId } from '@/lib/session';
import { DbNotConfiguredError, getDb } from '@/lib/db/client';
import { oauthStates } from '@/lib/db/schema';
import { CryptoNotConfiguredError } from '@/lib/integrations/crypto';
import { getProvider } from '@/lib/integrations/registry';
import { absoluteUrl } from '@/lib/integrations/require';
import { saveToken } from '@/lib/integrations/token-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function stateCookieName(provider: string): string {
  return `ac_oauth_state_${provider}`;
}

function finish(req: NextRequest, provider: string, outcome: 'connected' | 'error', reason?: string): NextResponse {
  const url = absoluteUrl(req, '/workspace');
  url.searchParams.set('integration', outcome);
  url.searchParams.set('provider', provider);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

// GET /api/oauth/[provider]/callback — validates state, exchanges the code,
// encrypts and stores the token, then returns the user to the workspace.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = getProvider(provider);
  if (!adapter) {
    return NextResponse.json({ success: false, error: 'unknown provider' }, { status: 404 });
  }

  const q = req.nextUrl.searchParams;
  const providerError = q.get('error');
  if (providerError) {
    return finish(req, provider, 'error', providerError === 'access_denied' ? 'access_denied' : 'provider_error');
  }

  const code = q.get('code');
  const state = q.get('state');
  if (!code || !state) return finish(req, provider, 'error', 'missing_code');

  const userId = await getUserId();
  if (!userId) {
    // Re-login cannot replay the one-time code, so surface a clean error.
    return finish(req, provider, 'error', 'session_expired');
  }

  // Cookie is defence in depth; the DB row is authoritative.
  const cookieState = req.cookies.get(stateCookieName(provider))?.value;
  if (!cookieState || cookieState !== state) {
    return finish(req, provider, 'error', 'state_mismatch');
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(oauthStates)
      .where(and(eq(oauthStates.state, state), eq(oauthStates.provider, provider)))
      .limit(1);
    const row = rows[0];

    // Single use: delete before exchanging so a replay cannot succeed.
    if (row) {
      await db.delete(oauthStates).where(eq(oauthStates.state, state));
    }

    if (!row || row.expiresAt.getTime() < Date.now()) {
      return finish(req, provider, 'error', 'state_expired');
    }
    if (row.userId !== userId) {
      return finish(req, provider, 'error', 'state_mismatch');
    }

    const redirectUri = absoluteUrl(req, `/api/oauth/${provider}/callback`).toString();
    const tokens = await adapter.exchange(code, {
      redirectUri,
      codeVerifier: row.codeVerifier ?? undefined,
    });

    await saveToken(userId, row.workspaceId, provider, tokens);

    const res = finish(req, provider, 'connected');
    res.cookies.delete(stateCookieName(provider));
    return res;
  } catch (err) {
    const reason =
      err instanceof DbNotConfiguredError || err instanceof CryptoNotConfiguredError
        ? 'server_not_configured'
        : 'exchange_failed';
    // Log the failure class only — never the code, tokens, or request body.
    console.error(`[oauth] ${provider} callback failed (${reason})`);
    const res = finish(req, provider, 'error', reason);
    res.cookies.delete(stateCookieName(provider));
    return res;
  }
}
