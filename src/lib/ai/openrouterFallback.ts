/**
 * OpenRouter model fallback.
 *
 * `OPENROUTER_MODEL` may list several models, comma-separated ("a:free,b:free"). Free models are
 * rate-limited upstream (HTTP 429 `tpm_rate_limit_exceeded` is common under concurrent agent calls), so
 * when one is limited, out of credit (402) or erroring (5xx) the next one is tried before giving up.
 * Anything else (400 bad request, 401 bad key) is returned as-is: another model would not fix it.
 */

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

/** An explicit model from the caller wins; otherwise the env list; otherwise the paid default. */
export function resolveModels(explicit: string | undefined, envValue: string | undefined): string[] {
  if (explicit?.trim()) return [explicit.trim()];
  const list = (envValue ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length > 0 ? list : [DEFAULT_OPENROUTER_MODEL];
}

const FALL_THROUGH = new Set([402, 429, 500, 502, 503, 504]);

export interface FallbackResult {
  response: Response;
  /** The model that produced `response`. */
  model: string;
  /** Models that failed before it, with their status (for logs). */
  skipped: { model: string; status: number }[];
}

export async function postWithFallback(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
  models: string[],
): Promise<FallbackResult> {
  const skipped: { model: string; status: number }[] = [];
  let last: { response: Response; model: string } | null = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify({ ...payload, model }) });
    last = { response, model };
    if (response.ok || !FALL_THROUGH.has(response.status) || i === models.length - 1) break;
    skipped.push({ model, status: response.status });
    await response.text().catch(() => ''); // release the connection before trying the next model
  }
  return { ...last!, skipped };
}
