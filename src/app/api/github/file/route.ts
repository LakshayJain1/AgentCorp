import { NextResponse, type NextRequest } from 'next/server';
import { readRepoFile } from '@/connectors/GitHubClient';
import { requireIntegration } from '@/lib/integrations/require';

export const runtime = 'nodejs';

// GET /api/github/file?repo=owner/name&path=README.md&ref=main
// Uses the caller's stored OAuth token. The token never reaches the browser.
export async function GET(req: NextRequest) {
  const ctx = await requireIntegration('github');
  if (!ctx.ok) return ctx.response;

  const q = req.nextUrl.searchParams;
  const repo = q.get('repo') ?? '';
  const path = q.get('path') ?? '';
  const ref = q.get('ref') ?? undefined;
  if (!repo || !path) {
    return NextResponse.json({ success: false, error: 'repo and path are required' }, { status: 400 });
  }

  const out = await readRepoFile(ctx.token, repo, path, ref ?? undefined);
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, content: out.content, sha: out.sha });
}
