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
