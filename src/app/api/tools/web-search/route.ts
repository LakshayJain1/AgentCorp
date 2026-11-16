import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';
import { getSearchConfig, validateQuery, webSearch, MAX_RESULTS } from '@/lib/search';

/**
 * Web search for the agents (POST { query, maxResults? }).
 *
 * Uses the server's search key (SEARCH_API_KEY), so it is signed-in only and
 * rate limited per user: the free Tavily plan is 1,000 searches a month in total,
 * shared by everyone on the hosted site. The limits are in-memory (per server
 * instance), a best-effort brake rather than a hard guarantee.
 *
 * The key never leaves this file's server process and is never part of a response.
 */

export const runtime = 'nodejs';

const PER_MINUTE = 10;
const PER_DAY = 150;

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: { query?: unknown; maxResults?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const q = validateQuery(body.query);
  if ('error' in q) return NextResponse.json({ success: false, code: 'bad_query', error: q.error }, { status: 400 });

  const config = getSearchConfig();
  if (!config) {
    return NextResponse.json({ success: false, code: 'not_configured', error: 'Web search is not set up on this server.' }, { status: 503 });
  }

  if (!rateLimit(`search:min:${userId}`, PER_MINUTE, 60_000) || !rateLimit(`search:day:${userId}`, PER_DAY, 86_400_000)) {
    return NextResponse.json({ success: false, code: 'quota', error: 'Too many searches. Try again in a little while.' }, { status: 429 });
  }

  const maxResults = typeof body.maxResults === 'number' ? Math.min(MAX_RESULTS, Math.max(1, Math.floor(body.maxResults))) : 5;
  const out = await webSearch(q.query, { maxResults, config });
  if (!out.ok) {
    const status = out.code === 'quota' ? 429 : out.code === 'bad_query' ? 400 : 502;
    return NextResponse.json({ success: false, code: out.code, error: out.error }, { status });
  }
  return NextResponse.json({ success: true, provider: out.provider, query: q.query, results: out.results });
}
