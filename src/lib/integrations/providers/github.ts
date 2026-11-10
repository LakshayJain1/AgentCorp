import 'server-only';

import {
  ProviderError,
  envCredential,
  type AuthorizeParams,
  type ExchangeParams,
  type OAuthTokens,
  type ProviderAdapter,
} from './types';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API = 'https://api.github.com';
const SCOPES = ['repo', 'read:user'];

function clientId(): string {
  const id = envCredential('GITHUB_CLIENT_ID');
  if (!id) throw new ProviderError('not_configured', 'GITHUB_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const secret = envCredential('GITHUB_CLIENT_SECRET');
  if (!secret) throw new ProviderError('not_configured', 'GITHUB_CLIENT_SECRET is not set');
  return secret;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

function parseTokenResponse(raw: TokenResponse): OAuthTokens {
  if (raw.error) {
    throw new ProviderError(
      'exchange_failed',
      `GitHub rejected the token request (${raw.error})`,
    );
  }
  if (!raw.access_token) {
    throw new ProviderError('exchange_failed', 'GitHub returned no access token');
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    expiresAt: raw.expires_in ? new Date(Date.now() + raw.expires_in * 1000) : null,
    scopes: raw.scope ? raw.scope.split(/[,\s]+/).filter(Boolean) : [],
    accountId: null,
  };
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as TokenResponse | null;
  if (!res.ok || !json) {
    throw new ProviderError('exchange_failed', `GitHub token endpoint returned ${res.status}`);
  }
  return json;
}

async function fetchLogin(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { login?: string };
    return json.login ?? null;
  } catch {
    return null;
  }
}

export const githubProvider: ProviderAdapter = {
  id: 'github',
  label: 'GitHub',
  scopes: SCOPES,
  supportsPkce: true,

  authorizeUrl({ state, redirectUri, codeChallenge }: AuthorizeParams): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('redirect_uri', redirectUri);
    // GitHub accepts comma- or space-separated scopes.
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('state', state);
    url.searchParams.set('allow_signup', 'false');
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url.toString();
  },

  async exchange(code: string, { redirectUri, codeVerifier }: ExchangeParams): Promise<OAuthTokens> {
    const raw = await postToken({
      client_id: clientId(),
      client_secret: clientSecret(),
      code,
      redirect_uri: redirectUri,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    const tokens = parseTokenResponse(raw);
    tokens.accountId = await fetchLogin(tokens.accessToken);
    return tokens;
  },

  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const raw = await postToken({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return parseTokenResponse(raw);
  },

  async revoke(accessToken: string): Promise<void> {
    const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
    await fetch(`${API}/applications/${encodeURIComponent(clientId())}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: accessToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  },
};
