import 'server-only';

import {
  ProviderError,
  envCredential,
  type AuthorizeParams,
  type ExchangeParams,
  type OAuthTokens,
  type ProviderAdapter,
} from './types';

const AUTHORIZE_URL = 'https://vercel.com/oauth/authorize';
const TOKEN_URL = 'https://api.vercel.com/v2/oauth/access_token';
const REVOKE_URL = 'https://api.vercel.com/v2/oauth/revokes';
const USER_URL = 'https://api.vercel.com/v2/user';
const SCOPES = ['read', 'write', 'deploy', 'deploy:preview', 'delete'];

function clientId(): string {
  const id = envCredential('VERCEL_CLIENT_ID');
  if (!id) throw new ProviderError('not_configured', 'VERCEL_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const secret = envCredential('VERCEL_CLIENT_SECRET');
  if (!secret) throw new ProviderError('not_configured', 'VERCEL_CLIENT_SECRET is not set');
  return secret;
}

interface VercelTokenResponse {
  token_type?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postForm(url: string, body: Record<string, string>): Promise<VercelTokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as VercelTokenResponse | null;
  if (!res.ok || !json) {
    throw new ProviderError('exchange_failed', `Vercel returned ${res.status}`);
  }
  return json;
}

function parseTokens(raw: VercelTokenResponse): OAuthTokens {
  if (raw.error) {
    throw new ProviderError('exchange_failed', `Vercel rejected the token request (${raw.error_description ?? raw.error})`);
  }
  if (!raw.access_token) {
    throw new ProviderError('exchange_failed', 'Vercel returned no access token');
  }
  const scopes = (raw.scope ?? '').split(',').filter(Boolean);
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    expiresAt: raw.expires_in ? new Date(Date.now() + raw.expires_in * 1000) : null,
    scopes: scopes.length > 0 ? scopes : SCOPES,
    accountId: null,
  };
}

async function fetchUser(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { user?: { username?: string; email?: string } };
    return json.user?.username ?? json.user?.email ?? null;
  } catch {
    return null;
  }
}

export const vercelProvider: ProviderAdapter = {
  id: 'vercel',
  label: 'Vercel',
  scopes: SCOPES,
  supportsPkce: false,

  authorizeUrl({ state, redirectUri }: AuthorizeParams): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  },

  async exchange(code: string, { redirectUri }: ExchangeParams): Promise<OAuthTokens> {
    const raw = await postForm(TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId(),
      client_secret: clientSecret(),
    });
    const tokens = parseTokens(raw);
    tokens.accountId = await fetchUser(tokens.accessToken);
    return tokens;
  },

  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const raw = await postForm(TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
    });
    return parseTokens(raw);
  },

  async revoke(accessToken: string): Promise<void> {
    await postForm(REVOKE_URL, {
      token: accessToken,
      client_id: clientId(),
      client_secret: clientSecret(),
    }).catch(() => undefined);
  },
};