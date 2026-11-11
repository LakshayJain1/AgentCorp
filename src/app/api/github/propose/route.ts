import { NextResponse, type NextRequest } from 'next/server';
import { proposeRepoFile } from '@/connectors/GitHubClient';
import { requireIntegration } from '@/lib/integrations/require';

export const runtime = 'nodejs';

// POST /api/github/propose { repo, path, content, message, base? }
// Creates branch + commit + PR on the caller's repo with their stored token.
export async function POST(req: NextRequest) {
  const ctx = await requireIntegration('github');
  if (!ctx.ok) return ctx.response;

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

  const out = await proposeRepoFile(
    ctx.token,
    body.repo,
    body.path,
    body.content,
    body.message,
    body.base ?? 'main',
  );
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, branch: out.branch, prUrl: out.prUrl });
}
