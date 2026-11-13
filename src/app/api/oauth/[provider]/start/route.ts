import { createHash, randomBytes } from 'node:crypto';
import { lt } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { getUserId } from '@/lib/session';
import { getDb, DbNotConfiguredError } from '@/lib/db/client';
import { oauthStates } from '@/lib/db/schema';
import { getProvider } from '@/lib/integrations/registry';
import { absoluteUrl } from '@/lib/integrations/require';
import { CryptoNotConfiguredError } from '@/lib/integrations/crypto';
import { resolveWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MS = 10 * 60 * 1000;

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function stateCookieName(provider: string): string {
  return `ac_oauth_state_${provider}`;
}

function failure(req: NextRequest, provider: string, reason: string): NextResponse {
  const url = absoluteUrl(req, '/workspace');
  url.searchParams.set('integration', 'error');
  url.searchParams.set('provider', provider);
  url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

// GET /api/oauth/[provider]/start — begins the authorization-code flow.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = getProvider(provider);
  if (!adapter) {
    return NextResponse.json({ success: false, error: 'unknown provider' }, { status: 404 });
  }

  const userId = await getUserId();
  if (!userId) {
    // Signed out: send them to onboarding (email-code sign-in) rather than a provider-hosted login.
    return NextResponse.redirect(absoluteUrl(req, '/onboard'));
  }

  try {
    const workspaceId = await resolveWorkspace(userId);
    const db = getDb();

    const state = base64url(randomBytes(32));
    const codeVerifier = adapter.supportsPkce ? base64url(randomBytes(32)) : null;
    const codeChallenge = codeVerifier
      ? base64url(createHash('sha256').update(codeVerifier).digest())
      : undefined;

    const now = Date.now();
    // Opportunistic cleanup keeps the table small without a cron job.
    await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date(now)));

    await db.insert(oauthStates).values({
      state,
      userId,
      workspaceId,
      provider,
      codeVerifier,
      redirectTo: '/workspace',
      expiresAt: new Date(now + STATE_TTL_MS),
    });

    const redirectUri = absoluteUrl(req, `/api/oauth/${provider}/callback`).toString();
    const authorize = adapter.authorizeUrl({ state, redirectUri, codeChallenge });

    const res = NextResponse.redirect(authorize);
    res.cookies.set({
      name: stateCookieName(provider),
      value: state,
      httpOnly: true,
      // Match the actual origin: `next start` over http:// must not set Secure.
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/api/oauth',
      maxAge: STATE_TTL_MS / 1000,
    });
    return res;
  } catch (err) {
    if (err instanceof DbNotConfiguredError || err instanceof CryptoNotConfiguredError) {
      return failure(req, provider, 'server_not_configured');
    }
    return failure(req, provider, 'start_failed');
  }
}
