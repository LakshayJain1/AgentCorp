import { NextRequest, NextResponse } from 'next/server';
import { ensureBranch } from '@/connectors/GitHubClient';

// POST /api/github/branch { repo, branch, base? }
// Idempotent per-task branch on the USER's repo. Token stays server-side.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    repo?: string;
    branch?: string;
    base?: string;
  } | null;
  if (!body?.repo || !body?.branch) {
    return NextResponse.json({ success: false, error: 'repo and branch are required' }, { status: 400 });
  }
  const out = await ensureBranch(body.repo, body.branch, body.base ?? 'main');
  if ('error' in out) {
    return NextResponse.json({ success: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ success: true, branch: out.branch, created: out.created });
}
