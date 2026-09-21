import { NextRequest, NextResponse } from 'next/server';
import { getRepoChecks } from '@/connectors/GitHubChecks';

// GET /api/github/checks?repo=owner/name&ref=branch-or-sha
// Returns deterministic CI verdict for a ref. Token stays server-side.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const repo = q.get('repo') ?? '';
  const ref = q.get('ref') ?? '';
  if (!repo || !ref) {
    return NextResponse.json({ success: false, error: 'repo and ref are required' }, { status: 400 });
  }
  const out = await getRepoChecks(repo, ref);
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, ...out });
}
