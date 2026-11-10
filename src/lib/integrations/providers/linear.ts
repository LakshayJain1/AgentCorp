import 'server-only';

import {
  ProviderError,
  envCredential,
  type AuthorizeParams,
  type ExchangeParams,
  type OAuthTokens,
  type ProviderAdapter,
} from './types';

const AUTHORIZE_URL = 'https://linear.app/oauth/authorize';
const TOKEN_URL = 'https://api.linear.app/oauth/token';
const REVOKE_URL = 'https://api.linear.app/oauth/revoke';
const GRAPHQL_URL = 'https://api.linear.app/graphql';
const SCOPES = ['read', 'write'];

function clientId(): string {
  const id = envCredential('LINEAR_CLIENT_ID');
  if (!id) throw new ProviderError('not_configured', 'LINEAR_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const secret = envCredential('LINEAR_CLIENT_SECRET');
  if (!secret) throw new ProviderError('not_configured', 'LINEAR_CLIENT_SECRET is not set');
  return secret;
}

interface LinearTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string | string[];
  token_type?: string;
  error?: string;
  error_description?: string;
}

async function postForm(url: string, body: Record<string, string>): Promise<LinearTokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as LinearTokenResponse | null;
  if (!res.ok || !json) {
    throw new ProviderError('exchange_failed', `Linear returned ${res.status}`);
  }
  return json;
}

function parseTokens(raw: LinearTokenResponse): OAuthTokens {
  if (raw.error) {
    throw new ProviderError('exchange_failed', `Linear rejected the token request (${raw.error})`);
  }
  if (!raw.access_token) {
    throw new ProviderError('exchange_failed', 'Linear returned no access token');
  }
  const scopes = Array.isArray(raw.scope)
    ? raw.scope
    : (raw.scope ?? '').split(',').filter(Boolean);
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    expiresAt: raw.expires_in ? new Date(Date.now() + raw.expires_in * 1000) : null,
    scopes: scopes.length > 0 ? scopes : SCOPES,
    accountId: null,
  };
}

async function fetchViewer(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'query { viewer { id name } }' }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { viewer?: { id?: string; name?: string } } };
    return json.data?.viewer?.name ?? json.data?.viewer?.id ?? null;
  } catch {
    return null;
  }
}

export const linearProvider: ProviderAdapter = {
  id: 'linear',
  label: 'Linear',
  scopes: SCOPES,
  supportsPkce: false,

  authorizeUrl({ state, redirectUri }: AuthorizeParams): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('state', state);
    // App-actor tokens act as the installed app, not a specific member.
    url.searchParams.set('actor', 'app');
    url.searchParams.set('prompt', 'consent');
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
    tokens.accountId = await fetchViewer(tokens.accessToken);
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
