import 'server-only';

import {
  ProviderError,
  envCredential,
  type AuthorizeParams,
  type ExchangeParams,
  type OAuthTokens,
  type ProviderAdapter,
} from './types';

const AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const REVOKE_URL = 'https://slack.com/api/auth.revoke';
const SCOPES = ['chat:write', 'channels:read'];

function clientId(): string {
  const id = envCredential('SLACK_CLIENT_ID');
  if (!id) throw new ProviderError('not_configured', 'SLACK_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const secret = envCredential('SLACK_CLIENT_SECRET');
  if (!secret) throw new ProviderError('not_configured', 'SLACK_CLIENT_SECRET is not set');
  return secret;
}

interface SlackTokenResponse {
  ok?: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  team?: { id?: string; name?: string };
}

async function postForm(url: string, body: Record<string, string>): Promise<SlackTokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as SlackTokenResponse | null;
  if (!res.ok || !json) {
    throw new ProviderError('exchange_failed', `Slack returned ${res.status}`);
  }
  return json;
}

export const slackProvider: ProviderAdapter = {
  id: 'slack',
  label: 'Slack',
  scopes: SCOPES,
  supportsPkce: false,

  authorizeUrl({ state, redirectUri }: AuthorizeParams): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  },

  async exchange(code: string, { redirectUri }: ExchangeParams): Promise<OAuthTokens> {
    const raw = await postForm(TOKEN_URL, {
      client_id: clientId(),
      client_secret: clientSecret(),
      code,
      redirect_uri: redirectUri,
    });
    if (!raw.ok || !raw.access_token) {
      throw new ProviderError('exchange_failed', `Slack rejected the token request (${raw.error ?? 'unknown'})`);
    }
    return {
      accessToken: raw.access_token,
      refreshToken: null,
      // Bot tokens do not expire; revocation is the only invalidation.
      expiresAt: null,
      scopes: raw.scope ? raw.scope.split(',').filter(Boolean) : SCOPES,
      accountId: raw.team?.name ?? raw.team?.id ?? raw.bot_user_id ?? null,
    };
  },

  async revoke(accessToken: string): Promise<void> {
    await postForm(REVOKE_URL, { token: accessToken }).catch(() => undefined);
  },
};
