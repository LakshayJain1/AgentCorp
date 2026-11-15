import { useRunStore, type RunEvent, type RunMeta } from './runEvents';

/**
 * Local run persistence (D1): runs, their events and loop checkpoints live in
 * IndexedDB so a refresh, crash or app restart doesn't lose the story — and an
 * interrupted loop can resume from its last completed step.
 *
 * Everything is best-effort: if IndexedDB is unavailable (private window,
 * blocked storage) the app works exactly as before, in memory only.
 */

const DB_NAME = 'agentcorp-runs';
const DB_VERSION = 1;
const KEEP_RUNS = 40;

/** What a loop needs to continue where it stopped. Kept small on purpose. */
export interface LoopCheckpoint {
  taskId: string;
  workerId: string;
  step: number;
  tokensUsed: number;
  stepsUsed: number;
  filesChanged: string[];
  transcript: Array<{ role: 'assistant' | 'tool' | 'user'; text: string }>;
  qaRound: number;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'runId' });
        if (!db.objectStoreNames.contains('events')) {
          const ev = db.createObjectStore('events', { keyPath: 'id' });
          ev.createIndex('runId', 'runId', { unique: false });
        }
        if (!db.objectStoreNames.contains('checkpoints')) db.createObjectStore('checkpoints', { keyPath: 'taskId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(stores, mode);
      const r = fn(t);
      t.oncomplete = () => resolve(r ? (r.result as T) : undefined);
      t.onerror = () => resolve(undefined);
      t.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve) => {
    try {
      const r = db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result as T[]);
      r.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveCheckpoint(cp: LoopCheckpoint): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, ['checkpoints'], 'readwrite', (t) => { t.objectStore('checkpoints').put(cp); });
}

export async function loadCheckpoint(taskId: string): Promise<LoopCheckpoint | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction('checkpoints', 'readonly').objectStore('checkpoints').get(taskId);
      r.onsuccess = () => resolve((r.result as LoopCheckpoint | undefined) ?? null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearCheckpoint(taskId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, ['checkpoints'], 'readwrite', (t) => { t.objectStore('checkpoints').delete(taskId); });
}

export async function deleteStoredRun(runId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, ['runs', 'events', 'checkpoints'], 'readwrite', (t) => {
    t.objectStore('runs').delete(runId);
    t.objectStore('checkpoints').delete(runId);
    const idx = t.objectStore('events').index('runId');
    const cur = idx.openKeyCursor(IDBKeyRange.only(runId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { t.objectStore('events').delete(c.primaryKey); c.continue(); }
    };
  });
}

async function prune(db: IDBDatabase): Promise<void> {
  const runs = await getAll<RunMeta>(db, 'runs');
  if (runs.length <= KEEP_RUNS) return;
  const old = runs.sort((a, b) => a.startedAt - b.startedAt).slice(0, runs.length - KEEP_RUNS);
  for (const r of old) await deleteStoredRun(r.runId);
}

let started = false;

/**
 * Load stored runs into the run store, mark anything that was mid-flight as
 * interrupted (nothing from a previous session can still be running), then
 * start writing changes through. Safe to call more than once.
 */
export async function initRunPersistence(): Promise<void> {
  if (started) return;
  started = true;
  const db = await openDb();
  if (!db) return;

  const [runs, events] = await Promise.all([getAll<RunMeta>(db, 'runs'), getAll<RunEvent>(db, 'events')]);
  const interrupted = runs.map((r) => (
    r.status === 'running' || r.status === 'blocked'
      ? { ...r, status: 'interrupted' as const, summaryStreaming: false }
      : r
  ));
  useRunStore.getState().hydrate(interrupted, events);

  // Remember how much of each run is already on disk so we only append new events.
  const savedCount = new Map<string, number>();
  const savedMeta = new Map<string, RunMeta>();
  for (const r of interrupted) savedMeta.set(r.runId, runs.find((x) => x.runId === r.runId)!);
  for (const e of events) savedCount.set(e.runId, (savedCount.get(e.runId) ?? 0) + 1);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    timer = null;
    const state = useRunStore.getState();
    const metas: RunMeta[] = [];
    const newEvents: RunEvent[] = [];
    for (const runId of state.order) {
      const meta = state.runs[runId];
      if (!meta) continue;
      if (savedMeta.get(runId) !== meta) { metas.push(meta); savedMeta.set(runId, meta); }
      const evs = state.events[runId] ?? [];
      const done = savedCount.get(runId) ?? 0;
      if (evs.length > done) { newEvents.push(...evs.slice(done)); savedCount.set(runId, evs.length); }
    }
    if (metas.length === 0 && newEvents.length === 0) return;
    await tx(db, ['runs', 'events'], 'readwrite', (t) => {
      for (const m of metas) t.objectStore('runs').put(m);
      for (const e of newEvents) t.objectStore('events').put(e);
    });
  };
  const schedule = () => { if (!timer) timer = setTimeout(() => { void flush(); }, 400); };
  useRunStore.subscribe(schedule);
  // Persist the "interrupted" markers we just assigned.
  schedule();
  void prune(db);
}

/** Test/maintenance helper. */
export async function wipeRunStorage(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, ['runs', 'events', 'checkpoints'], 'readwrite', (t) => {
    t.objectStore('runs').clear();
    t.objectStore('events').clear();
    t.objectStore('checkpoints').clear();
  });
}
