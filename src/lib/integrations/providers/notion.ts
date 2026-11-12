import 'server-only';

import {
  ProviderError,
  envCredential,
  type AuthorizeParams,
  type ExchangeParams,
  type OAuthTokens,
  type ProviderAdapter,
} from './types';

const AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize';
const TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

function clientId(): string {
  const id = envCredential('NOTION_CLIENT_ID');
  if (!id) throw new ProviderError('not_configured', 'NOTION_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const secret = envCredential('NOTION_CLIENT_SECRET');
  if (!secret) throw new ProviderError('not_configured', 'NOTION_CLIENT_SECRET is not set');
  return secret;
}

interface NotionTokenResponse {
  access_token?: string;
  token_type?: string;
  bot_id?: string;
  workspace_name?: string;
  workspace_id?: string;
  workspace_icon?: string;
  owner?: unknown;
  error?: string;
  error_description?: string;
}

export const notionProvider: ProviderAdapter = {
  id: 'notion',
  label: 'Notion',
  scopes: [],
  supportsPkce: false,

  authorizeUrl({ state, redirectUri }: AuthorizeParams): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('owner', 'user');
    return url.toString();
  },

  async exchange(code: string, { redirectUri }: ExchangeParams): Promise<OAuthTokens> {
    // Notion requires HTTP Basic Auth for token exchange (not form params).
    const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    });

    const json = (await res.json().catch(() => null)) as NotionTokenResponse | null;
    if (!res.ok || !json) {
      throw new ProviderError('exchange_failed', `Notion returned ${res.status}`);
    }
    if (json.error) {
      throw new ProviderError('exchange_failed', `Notion rejected the token request (${json.error})`);
    }
    if (!json.access_token) {
      throw new ProviderError('exchange_failed', 'Notion returned no access token');
    }

    return {
      accessToken: json.access_token,
      refreshToken: null,
      expiresAt: null,
      scopes: [],
      accountId: json.workspace_name ?? json.workspace_id ?? null,
    };
  },
  // Notion tokens don't expire — no refresh needed.
  // Notion has no revoke endpoint — disconnect is handled by removing from our DB.
};
