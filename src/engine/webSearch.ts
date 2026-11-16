import type { SearchResult } from '@/lib/search';

/**
 * Client-side entry point for web search (the agent tool and the research
 * deliverable path both use it). It only talks to our own /api/tools/web-search
 * route, so no search key ever exists in the browser or the desktop shell.
 */

export type WebSearchResponse =
  | { ok: true; results: SearchResult[] }
  | { ok: false; error: string; code?: string };

export async function searchWeb(query: string, opts: { maxResults?: number; signal?: AbortSignal } = {}): Promise<WebSearchResponse> {
  try {
    const res = await fetch('/api/tools/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxResults: opts.maxResults }),
      signal: opts.signal,
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean; results?: SearchResult[]; error?: string; code?: string } | null;
    if (!data) return { ok: false, error: `Web search failed (${res.status}).` };
    if (!data.success) return { ok: false, error: data.error ?? `Web search failed (${res.status}).`, code: data.code };
    return { ok: true, results: Array.isArray(data.results) ? data.results : [] };
  } catch (e) {
    if (opts.signal?.aborted) return { ok: false, error: 'cancelled' };
    return { ok: false, error: `Web search failed: ${String(e).slice(0, 120)}` };
  }
}
