import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SnapshotEntry {
  snapshot: OrgSnapshot;
  ts: number;
}

export interface OrgSnapshot {
  companyName: string;
  companyProduct: string;
  agents: Array<{
    id: string; name: string; role: string; emoji: string;
    workStatus: string; mood: string; energy: number;
    currentTaskId: string | null; online: boolean;
  }>;
  tasks: Array<{
    id: string; title: string; status: string; priority: string;
    assignedTo: string | null; deliverableType?: string; createdAt: number;
  }>;
  events: Array<{
    id: string; type: string; message: string;
    timestamp: number; agentId: string | null;
  }>;
  simulation: {
    efficiency: number; tick: number; speed: number;
    paused: boolean; totalTasksCompleted: number;
  };
  deliverableProjects: Array<{ id: string; title: string; type: string; createdAt: number }>;
}

// Module-level store — persists for the lifetime of the Node.js process instance
const store = new Map<string, SnapshotEntry>();
const TTL_MS = 10 * 60 * 1000; // evict after 10 min of no updates

function evictStale() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.ts > TTL_MS) store.delete(k);
  }
}

export async function POST(req: NextRequest) {
  let body: { orgId?: string; snapshot?: OrgSnapshot };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const { orgId, snapshot } = body;
  if (!orgId || typeof orgId !== 'string' || !snapshot) {
    return Response.json({ error: 'orgId and snapshot required' }, { status: 400 });
  }

  evictStale();
  store.set(orgId, { snapshot, ts: Date.now() });
  return Response.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) return Response.json({ found: false }, { status: 400 });

  const entry = store.get(orgId);
  if (!entry) return Response.json({ found: false }, { status: 404 });

  return Response.json({ found: true, snapshot: entry.snapshot, ts: entry.ts });
}
