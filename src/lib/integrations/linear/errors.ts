/**
 * Typed Linear failures. The kind decides what happens next:
 * only `rate_limited`, `server` and `network` are retried; everything else
 * is a real answer from Linear and repeating it would not change it.
 */

export type LinearErrorKind =
  | 'auth' // 401 / "authentication error": token revoked or invalid
  | 'rate_limited' // 429 / RATELIMITED
  | 'not_found' // entity does not exist
  | 'validation' // bad input, permissions, duplicate id: never retry
  | 'server' // 5xx
  | 'network'; // connection dropped / timed out: outcome unknown

const RETRYABLE: ReadonlySet<LinearErrorKind> = new Set(['rate_limited', 'server', 'network']);

export class LinearError extends Error {
  readonly kind: LinearErrorKind;
  readonly status?: number;
  /** How long Linear asked us to wait, when it said. */
  readonly retryAfterMs?: number;

  constructor(kind: LinearErrorKind, message: string, opts?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = 'LinearError';
    this.kind = kind;
    this.status = opts?.status;
    this.retryAfterMs = opts?.retryAfterMs;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }
}

export function kindForStatus(status: number): LinearErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limited';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server';
  return 'validation';
}

interface GraphQLErrorLike {
  message?: string;
  extensions?: { type?: string; code?: string; userPresentableMessage?: string };
}

/** Linear reports most failures as HTTP 200/400 + `errors[]`; classify them by their declared type. */
export function kindForGraphQLErrors(errors: GraphQLErrorLike[]): LinearErrorKind {
  const text = errors
    .map((e) => `${e.extensions?.type ?? ''} ${e.extensions?.code ?? ''} ${e.message ?? ''}`)
    .join(' ')
    .toLowerCase();
  if (/ratelimit|rate limit|too many requests/.test(text)) return 'rate_limited';
  if (/authentication|unauthenticated|unauthorized|invalid token|token.*(expired|revoked)/.test(text)) return 'auth';
  if (/not found|entity not found/.test(text)) return 'not_found';
  if (/internal server|internal_error|service unavailable|temporarily unavailable/.test(text)) return 'server';
  return 'validation';
}

/** `Retry-After` (seconds) or Linear's `X-RateLimit-Requests-Reset` (epoch ms) -> milliseconds to wait. */
export function retryAfterMsFrom(headers: { get(name: string): string | null } | undefined, now = Date.now()): number | undefined {
  if (!headers) return undefined;
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  }
  const reset = headers.get('x-ratelimit-requests-reset');
  if (reset) {
    const at = Number(reset);
    if (Number.isFinite(at) && at > now) return at - now;
  }
  return undefined;
}

/** Messages shown to the user / agents. They never contain token material. */
export function describeLinearError(err: LinearError): string {
  switch (err.kind) {
    case 'auth':
      return 'Linear rejected the access token. Reconnect Linear in the Integrations tab.';
    case 'rate_limited':
      return 'Linear is rate limiting requests. Try again in a moment.';
    case 'not_found':
      return `Linear could not find that item (${err.message}).`;
    case 'server':
      return 'Linear had a temporary problem. Try again shortly.';
    case 'network':
      return 'Could not reach Linear. Check the connection and try again.';
    default:
      return `Linear rejected the request (${err.message}).`;
  }
}
