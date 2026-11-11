import { NextResponse, type NextRequest } from 'next/server';
import { ensureBranch } from '@/connectors/GitHubClient';
import { requireIntegration } from '@/lib/integrations/require';

export const runtime = 'nodejs';

// POST /api/github/branch { repo, branch, base? }
// Idempotent per-task branch on the caller's repo with their stored token.
export async function POST(req: NextRequest) {
  const ctx = await requireIntegration('github');
  if (!ctx.ok) return ctx.response;

  const body = (await req.json().catch(() => null)) as {
    repo?: string;
    branch?: string;
    base?: string;
  } | null;
  if (!body?.repo || !body?.branch) {
    return NextResponse.json({ success: false, error: 'repo and branch are required' }, { status: 400 });
  }

  const out = await ensureBranch(ctx.token, body.repo, body.branch, body.base ?? 'main');
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, branch: out.branch, created: out.created });
}
