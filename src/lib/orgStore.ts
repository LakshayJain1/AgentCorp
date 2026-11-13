import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { getDb, isDbConfigured } from '@/lib/db/client';
import { orgSnapshots } from '@/lib/db/schema';

/** Org ids are minted by the client with 128 bits of entropy: org_<32 hex>. */
export const ORG_ID_RE = /^org_[a-f0-9]{32}$/;

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

export const MAX_SNAPSHOT_BYTES = 200 * 1024;

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const arr = (v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

/** Rebuild the snapshot from known fields only, with caps — never store client JSON verbatim. */
export function sanitizeSnapshot(input: unknown): OrgSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const s = input as Record<string, unknown>;
  const sim = (s.simulation && typeof s.simulation === 'object' ? s.simulation : {}) as Record<string, unknown>;
  return {
    companyName: str(s.companyName, 120),
    companyProduct: str(s.companyProduct, 300),
    agents: arr(s.agents, 60).map((a) => ({
      id: str(a.id, 80), name: str(a.name, 60), role: str(a.role, 40), emoji: str(a.emoji, 8),
      workStatus: str(a.workStatus, 40), mood: str(a.mood, 40), energy: num(a.energy),
      currentTaskId: typeof a.currentTaskId === 'string' ? a.currentTaskId.slice(0, 80) : null,
      online: a.online === true,
    })),
    tasks: arr(s.tasks, 200).map((t) => ({
      id: str(t.id, 80), title: str(t.title, 300), status: str(t.status, 40), priority: str(t.priority, 20),
      assignedTo: typeof t.assignedTo === 'string' ? t.assignedTo.slice(0, 80) : null,
      deliverableType: typeof t.deliverableType === 'string' ? t.deliverableType.slice(0, 40) : undefined,
      createdAt: num(t.createdAt),
    })),
    events: arr(s.events, 60).map((e) => ({
      id: str(e.id, 80), type: str(e.type, 40), message: str(e.message, 500),
      timestamp: num(e.timestamp), agentId: typeof e.agentId === 'string' ? e.agentId.slice(0, 80) : null,
    })),
    simulation: {
      efficiency: num(sim.efficiency), tick: num(sim.tick), speed: num(sim.speed),
      paused: sim.paused === true, totalTasksCompleted: num(sim.totalTasksCompleted),
    },
    deliverableProjects: arr(s.deliverableProjects, 40).map((p) => ({
      id: str(p.id, 80), title: str(p.title, 200), type: str(p.type, 40), createdAt: num(p.createdAt),
    })),
  };
}

// ── In-memory fallback (used only when DATABASE_URL is not configured) ──
interface MemEntry { ownerSub: string; snapshot: OrgSnapshot; auth0OrgId: string | null; ts: number }
const mem = new Map<string, MemEntry>();
const TTL_MS = 10 * 60 * 1000;
function evictStale() {
  const now = Date.now();
  for (const [k, v] of mem) if (now - v.ts > TTL_MS) mem.delete(k);
}

// Create the table on first use so no manual migration step is needed.
let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const db = getDb();
      await db.execute(sql`CREATE TABLE IF NOT EXISTS org_snapshots (
        org_id text PRIMARY KEY,
        owner_sub text NOT NULL,
        snapshot jsonb NOT NULL,
        auth0_org_id text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS org_snapshots_auth0_org_idx ON org_snapshots (auth0_org_id)`);
    })().catch((e) => { ensured = null; throw e; });
  }
  return ensured;
}

async function dbReady(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try { await ensureTable(); return true; } catch (e) {
    console.error('[orgStore] database unavailable, using memory fallback:', (e as Error).message);
    return false;
  }
}

/** Create or update an org snapshot. Returns false if the org belongs to someone else. */
export async function saveSnapshot(orgId: string, ownerSub: string, snapshot: OrgSnapshot): Promise<boolean> {
  if (await dbReady()) {
    const rows = await getDb()
      .insert(orgSnapshots)
      .values({ orgId, ownerSub, snapshot })
      .onConflictDoUpdate({
        target: orgSnapshots.orgId,
        set: { snapshot, updatedAt: sql`now()` },
        setWhere: eq(orgSnapshots.ownerSub, ownerSub),
      })
      .returning({ orgId: orgSnapshots.orgId });
    return rows.length > 0;
  }
  evictStale();
  const existing = mem.get(orgId);
  if (existing && existing.ownerSub !== ownerSub) return false;
  mem.set(orgId, { ownerSub, snapshot, auth0OrgId: existing?.auth0OrgId ?? null, ts: Date.now() });
  return true;
}

export async function getSnapshot(orgId: string): Promise<{ snapshot: OrgSnapshot; ts: number; ownerSub: string } | null> {
  if (await dbReady()) {
    const rows = await getDb().select().from(orgSnapshots).where(eq(orgSnapshots.orgId, orgId)).limit(1);
    const r = rows[0];
    return r ? { snapshot: r.snapshot as OrgSnapshot, ts: r.updatedAt.getTime(), ownerSub: r.ownerSub } : null;
  }
  evictStale();
  const e = mem.get(orgId);
  return e ? { snapshot: e.snapshot, ts: e.ts, ownerSub: e.ownerSub } : null;
}

/** Remember which Auth0 Organization belongs to this org (owner only). */
export async function linkAuth0Org(orgId: string, ownerSub: string, auth0OrgId: string): Promise<boolean> {
  if (await dbReady()) {
    const rows = await getDb()
      .update(orgSnapshots)
      .set({ auth0OrgId })
      .where(sql`${orgSnapshots.orgId} = ${orgId} AND ${orgSnapshots.ownerSub} = ${ownerSub}`)
      .returning({ orgId: orgSnapshots.orgId });
    return rows.length > 0;
  }
  const e = mem.get(orgId);
  if (!e || e.ownerSub !== ownerSub) return false;
  e.auth0OrgId = auth0OrgId;
  return true;
}

export async function findOrgByAuth0Org(auth0OrgId: string): Promise<string | null> {
  if (await dbReady()) {
    const rows = await getDb()
      .select({ orgId: orgSnapshots.orgId })
      .from(orgSnapshots)
      .where(eq(orgSnapshots.auth0OrgId, auth0OrgId))
      .limit(1);
    return rows[0]?.orgId ?? null;
  }
  for (const [k, v] of mem) if (v.auth0OrgId === auth0OrgId) return k;
  return null;
}
