import { NextResponse, type NextRequest } from 'next/server';
import { getUserId } from '@/lib/session';
import { DbNotConfiguredError } from '@/lib/db/client';
import { CryptoNotConfiguredError } from '@/lib/integrations/crypto';
import { getToken } from '@/lib/integrations/token-service';
import { resolveWorkspace } from '@/lib/workspace';

export type IntegrationContext =
  | { ok: true; userId: string; workspaceId: string; token: string }
  | { ok: false; response: NextResponse };

function notConnected(provider: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code: 'not_connected',
      error: `${provider} is not connected. Connect it in Settings → Integrations.`,
    },
    { status: 409 },
  );
}

/**
 * Shared guard for provider-backed routes: authenticated session, server-side
 * workspace, and a decrypted access token. The token never reaches the client.
 */
export async function requireIntegration(provider: string): Promise<IntegrationContext> {
  const userId = await getUserId();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  try {
    const workspaceId = await resolveWorkspace(userId);
    const token = await getToken(userId, workspaceId, provider);
    if (!token) return { ok: false, response: notConnected(provider) };
    return { ok: true, userId, workspaceId, token };
  } catch (err) {
    if (err instanceof DbNotConfiguredError || err instanceof CryptoNotConfiguredError) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, code: 'server_not_configured', error: 'Integration storage is not configured.' },
          { status: 503 },
        ),
      };
    }
    throw err;
  }
}

/** Absolute URL for redirects, preferring the configured public origin. */
export function absoluteUrl(req: NextRequest, path: string): URL {
  const configured = process.env.APP_BASE_URL?.replace(/\/+$/, '');
  return new URL(path, configured || req.nextUrl.origin);
}
