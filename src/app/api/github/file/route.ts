import { NextRequest, NextResponse } from 'next/server';
import { readRepoFile } from '@/connectors/GitHubClient';

// GET /api/github/file?repo=owner/name&path=README.md&ref=main
// Server-only token use. Scope required: repo must be provided per call.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const repo = q.get('repo') ?? '';
  const path = q.get('path') ?? '';
  const ref = q.get('ref') ?? undefined;
  if (!repo || !path) {
    return NextResponse.json({ success: false, error: 'repo and path are required' }, { status: 400 });
  }
  const out = await readRepoFile(repo, path, ref ?? undefined);
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, content: out.content, sha: out.sha });
}
