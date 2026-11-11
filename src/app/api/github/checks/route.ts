import { NextResponse, type NextRequest } from 'next/server';
import { getRepoChecks } from '@/connectors/GitHubChecks';
import { requireIntegration } from '@/lib/integrations/require';

export const runtime = 'nodejs';

// GET /api/github/checks?repo=owner/name&ref=branch-or-sha
// Deterministic CI verdict for a ref, using the caller's stored OAuth token.
export async function GET(req: NextRequest) {
  const ctx = await requireIntegration('github');
  if (!ctx.ok) return ctx.response;

  const q = req.nextUrl.searchParams;
  const repo = q.get('repo') ?? '';
  const ref = q.get('ref') ?? '';
  if (!repo || !ref) {
    return NextResponse.json({ success: false, error: 'repo and ref are required' }, { status: 400 });
  }

  const out = await getRepoChecks(ctx.token, repo, ref);
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, ...out });
}
