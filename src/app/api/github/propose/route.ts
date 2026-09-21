import { NextRequest, NextResponse } from 'next/server';
import { proposeRepoFile } from '@/connectors/GitHubClient';

// POST /api/github/propose { repo, path, content, message, base? }
// Creates branch + commit + PR on the USER's repo. Token stays server-side.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    repo?: string;
    path?: string;
    content?: string;
    message?: string;
    base?: string;
  } | null;
  if (!body?.repo || !body?.path || body?.content === undefined || !body?.message) {
    return NextResponse.json(
      { success: false, error: 'repo, path, content, message are required' },
      { status: 400 },
    );
  }
  if (body.content.length > 500_000) {
    return NextResponse.json({ success: false, error: 'content too large (500kb max)' }, { status: 413 });
  }
  const out = await proposeRepoFile(body.repo, body.path, body.content, body.message, body.base ?? 'main');
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, branch: out.branch, prUrl: out.prUrl });
}
