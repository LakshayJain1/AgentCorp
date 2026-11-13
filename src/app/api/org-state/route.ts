import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { rateLimit } from '@/lib/rateLimit';
import {
  MAX_SNAPSHOT_BYTES,
  ORG_ID_RE,
  getSnapshot,
  sanitizeSnapshot,
  saveSnapshot,
} from '@/lib/orgStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type { OrgSnapshot } from '@/lib/orgStore';

// POST — the owner publishes a snapshot of their org. The first writer owns the
// org id; everyone else gets 403. Bodies are size-capped and re-built from
// known fields only.
export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  const sub = session?.user?.sub as string | undefined;
  if (!sub) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // 1 publish / 3s per tab ≈ 20/min; allow headroom for a couple of tabs.
  if (!rateLimit(`org-state:${sub}`, 90, 60_000)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_SNAPSHOT_BYTES * 1.5) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }
  const text = await req.text();
  if (text.length > MAX_SNAPSHOT_BYTES * 1.5) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: { orgId?: unknown; snapshot?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  if (typeof body.orgId !== 'string' || !ORG_ID_RE.test(body.orgId)) {
    return Response.json({ error: 'invalid orgId' }, { status: 400 });
  }
  const snapshot = sanitizeSnapshot(body.snapshot);
  if (!snapshot) return Response.json({ error: 'snapshot required' }, { status: 400 });
  if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_BYTES) {
    return Response.json({ error: 'Snapshot too large' }, { status: 413 });
  }

  try {
    const ok = await saveSnapshot(body.orgId, sub, snapshot);
    if (!ok) return Response.json({ error: 'Forbidden' }, { status: 403 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[org-state] save failed:', (e as Error).message);
    return Response.json({ error: 'Storage unavailable' }, { status: 503 });
  }
}

// GET — viewers must be signed in. The org id is a 128-bit capability carried by
// the invite link; unknown and malformed ids look identical (404).
export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  const sub = session?.user?.sub as string | undefined;
  if (!sub) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!rateLimit(`org-state-get:${sub}`, 120, 60_000)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const orgId = req.nextUrl.searchParams.get('orgId') ?? '';
  if (!ORG_ID_RE.test(orgId)) return Response.json({ found: false }, { status: 404 });

  try {
    const entry = await getSnapshot(orgId);
    if (!entry) return Response.json({ found: false }, { status: 404 });
    return Response.json({ found: true, snapshot: entry.snapshot, ts: entry.ts });
  } catch (e) {
    console.error('[org-state] read failed:', (e as Error).message);
    return Response.json({ found: false }, { status: 503 });
  }
}
