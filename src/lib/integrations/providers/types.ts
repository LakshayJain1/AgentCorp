export type ProviderId = 'github' | 'slack' | 'linear';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  /** Absolute expiry. Null means the provider token does not expire. */
  expiresAt?: Date | null;
  scopes: string[];
  /** Human-readable account identity, e.g. GitHub login. */
  accountId?: string | null;
}

export interface AuthorizeParams {
  state: string;
  redirectUri: string;
  codeChallenge?: string;
}

export interface ExchangeParams {
  redirectUri: string;
  codeVerifier?: string;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Read a credential from the environment, trimming surrounding whitespace.
 *
 * Vercel (and any env file) can carry a trailing newline on a value, and a
 * client id with a trailing CRLF is rejected by GitHub/Linear as unknown.
 * Stripping here is a cheap, universal defence that also makes local `.env`
 * edits forgiving.
 */
export function envCredential(name: string): string {
  const raw = process.env[name];
  if (raw === undefined) return '';
  return raw.trim();
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly label: string;
  readonly scopes: string[];
  readonly supportsPkce: boolean;
  authorizeUrl(params: AuthorizeParams): string;
  exchange(code: string, params: ExchangeParams): Promise<OAuthTokens>;
  refresh?(refreshToken: string): Promise<OAuthTokens>;
  revoke?(accessToken: string): Promise<void>;
}
