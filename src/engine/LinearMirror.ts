/**
 * Mirrors each task's lifecycle to a Linear issue.
 *
 * Internal tickets stay the source of truth; Linear is a synced copy. The mirror only LISTENS to the
 * run-event stream (it never changes how work is done) and writes through the server tool endpoint, so
 * the user's token never reaches the browser and no LLM is involved: every write is deterministic.
 *
 * Safety:
 *  - off by default (`linearMirror.enabled`), and only tasks created AFTER it was switched on are mirrored;
 *  - unless autopilot is on, the first write for a task needs the operator's approval (allow once / always /
 *    deny). Denying skips that task's mirror; the agents' work is never affected;
 *  - one issue per task (`<taskId>:created` is its idempotency key), ops are written in order per task;
 *  - every write has an idempotency key, so retries, reloads and second tabs cannot duplicate anything;
 *  - transient failures are retried a bounded number of times; a failed write is recorded on the task
 *    (`task.linear.syncState = 'failed'`) and never blocks the agents' actual work.
 */
import { useGameStore } from '@/store/gameStore';
import { useRunStore, type RunEvent } from './runEvents';
import { requestApproval, useApprovalStore } from './approvals';
import { planForEvent, issueDraft, parseCreated, type MirrorOp } from './linearMirrorPlan';
import type { Task, LinearSync } from '@/agents/AgentTypes';

export type Exec = (tool: string, params: Record<string, string>) => Promise<string>;

export class MirrorHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'MirrorHttpError';
  }
}

/** Default transport: the app's own authenticated tool endpoint (token stays on the server). */
export const execViaApi: Exec = async (tool, params) => {
  const res = await fetch('/api/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, params }),
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; output?: string; error?: string } | null;
  if (!res.ok || !body?.success) throw new MirrorHttpError(body?.error ?? `HTTP ${res.status}`, res.status);
  return String(body.output ?? '');
};

const ROLE_LABEL: Record<string, string> = {
  ceo: 'CEO', pm: 'PM', engineer: 'Engineer', qa: 'QA', researcher: 'Researcher',
  hr: 'HR', sales: 'Sales', finance: 'Finance', ops: 'Ops',
};

const MAX_PENDING_OPS = 60;
const MAX_DONE_KEYS = 120;

export interface MirrorOptions {
  exec?: Exec;
  sleep?: (ms: number) => Promise<void>;
  /** Waits between retries of a transient failure (so 2 entries = up to 3 attempts). */
  retryDelaysMs?: number[];
}

export interface MirrorHandle {
  stop(): void;
  /** Resolves when everything queued so far has been written (or has failed). For tests and shutdown. */
  idle(): Promise<void>;
}

function isTransient(err: unknown): boolean {
  if (err instanceof MirrorHttpError) return err.status >= 500 || err.status === 429;
  return err instanceof TypeError; // fetch() itself failed: offline, dev server restarting
}

export function startLinearMirror(opts: MirrorOptions = {}): MirrorHandle {
  const exec = opts.exec ?? execViaApi;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delays = opts.retryDelaysMs ?? [800, 2500];

  const seen = new Map<string, Set<string>>();
  const lastList = new Map<string, RunEvent[]>();
  const chains = new Map<string, Promise<void>>();
  const pending = new Map<string, MirrorOp[]>(); // ops waiting for the issue to exist
  const approved = new Set<string>(); // tasks the operator allowed (or autopilot covered) in this session
  let primed = false;

  const getTask = (taskId: string): Task | undefined => useGameStore.getState().tasks.find((t) => t.id === taskId);

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (!isTransient(err) || attempt >= delays.length) throw err;
        await sleep(delays[attempt]);
      }
    }
  }

  function patchLinear(taskId: string, patch: Partial<LinearSync>): void {
    const t = getTask(taskId);
    const base: LinearSync = t?.linear ?? { identifier: '', url: '', syncState: 'pending', doneKeys: [] };
    useGameStore.getState().updateTask(taskId, { linear: { ...base, ...patch } });
  }

  function markDone(taskId: string, key: string): void {
    const keys = getTask(taskId)?.linear?.doneKeys ?? [];
    if (keys.includes(key)) return;
    patchLinear(taskId, { doneKeys: [...keys, key].slice(-MAX_DONE_KEYS) });
  }

  function shouldMirror(task: Task | undefined): task is Task {
    const gs = useGameStore.getState();
    return Boolean(
      task &&
        gs.linearMirror.enabled &&
        gs.connectors.linear?.connected &&
        task.createdAt >= gs.linearMirror.enabledAt &&
        task.linear?.syncState !== 'skipped',
    );
  }

  /** True when this task may be written to Linear: already tracked, autopilot, or the operator says yes. */
  async function approve(task: Task): Promise<boolean> {
    if (task.linear?.identifier || approved.has(task.id)) return true;
    const gs = useGameStore.getState();
    if (gs.linearMirror.autopilot) {
      approved.add(task.id);
      return true;
    }
    const pm = gs.agents.find((a) => a.role === 'pm');
    const key = `linear_mirror:${task.id}`;
    const decision = await requestApproval({
      taskId: task.id,
      agentId: pm?.id,
      key,
      risk: 'external',
      title: `${pm ? `${pm.name} (PM)` : 'PM'} wants to track "${task.title}" in Linear`,
      detail:
        `Create a Linear issue for this task, then post assignment, progress, QA and the result as comments and ` +
        `move its status (Backlog → In Progress → Done).

"Always allow" turns Autopilot on for the Linear mirror.`,
    });
    if (decision === 'deny') {
      patchLinear(task.id, { syncState: 'skipped', lastError: undefined });
      pending.delete(task.id);
      if (pm) gs.sendMessage(pm.id, pm.id, `Not tracking "${task.title}" in Linear (you declined). The task carries on as normal.`);
      return false;
    }
    if (decision === 'allow_always') {
      useGameStore.getState().setLinearAutopilot(true);
      useApprovalStore.getState().revokeAlways(key); // autopilot is the one switch; keep nothing per task
    }
    approved.add(task.id);
    return true;
  }

  async function ensureIssue(task: Task): Promise<string | null> {
    if (task.linear?.identifier) return task.linear.identifier;
    const draft = issueDraft(task);
    try {
      const out = await withRetry(() =>
        exec('linear_create_issue', {
          title: draft.title,
          description: draft.description,
          labels: 'agentcorp',
          idempotencyKey: `${task.id}:created`,
        }),
      );
      const parsed = parseCreated(out);
      if (!parsed) throw new Error(`could not read the issue id from: ${out.slice(0, 120)}`);
      patchLinear(task.id, { identifier: parsed.identifier, url: parsed.url, syncState: 'synced', lastError: undefined, doneKeys: [`${task.id}:created`] });
      const gs = useGameStore.getState();
      const pm = gs.agents.find((a) => a.role === 'pm');
      if (pm) gs.sendMessage(pm.id, pm.id, `🔗 Tracking "${task.title}" in Linear as ${parsed.identifier}${parsed.url ? ` ${parsed.url}` : ''}`);
      return parsed.identifier;
    } catch (err) {
      patchLinear(task.id, { syncState: 'failed', lastError: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  async function runOp(identifier: string, taskId: string, op: MirrorOp): Promise<boolean> {
    if (getTask(taskId)?.linear?.doneKeys.includes(op.key)) return true;
    // Remember our own move first, so the Linear -> app poll never reports it back as a human change.
    if (op.type === 'status') patchLinear(taskId, { lastWrittenStatus: op.status, remoteStatus: op.status });
    try {
      if (op.type === 'comment') {
        await withRetry(() => exec('linear_comment_on_issue', { issueId: identifier, body: op.body, author: op.author, idempotencyKey: op.key }));
      } else if (op.type === 'status') {
        await withRetry(() => exec('linear_update_issue_status', { issueId: identifier, status: op.status }));
      } else {
        await withRetry(() => exec('linear_add_label', { issueId: identifier, label: op.label }));
      }
      markDone(taskId, op.key);
      return true;
    } catch (err) {
      // A label that does not exist (and cannot be created by the app) is expected and harmless.
      if (op.type === 'label') {
        markDone(taskId, op.key);
        return true;
      }
      patchLinear(taskId, { syncState: 'failed', lastError: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  function contextFor(taskId: string, ev: RunEvent) {
    const gs = useGameStore.getState();
    const nameOf = (a: { name: string; role: string }) => `${a.name} (${ROLE_LABEL[a.role] ?? a.role})`;
    const roleAgent = (role: string) => gs.agents.find((a) => a.role === role);
    const list = useRunStore.getState().events[taskId] ?? [];
    const seq = list.filter((e) => e.kind === ev.kind).findIndex((e) => e.id === ev.id);
    const run = useRunStore.getState().runs[taskId];
    return {
      taskId,
      authorOf: (agentId?: string) => {
        const a = agentId ? gs.agents.find((x) => x.id === agentId) : undefined;
        return a ? nameOf(a) : null;
      },
      qaAuthor: roleAgent('qa') ? nameOf(roleAgent('qa')!) : 'QA',
      pmAuthor: roleAgent('pm') ? nameOf(roleAgent('pm')!) : 'PM',
      ceoAuthor: roleAgent('ceo') ? nameOf(roleAgent('ceo')!) : 'CEO',
      roleOfName: (name: string) => gs.agents.find((a) => a.name.toLowerCase() === name.toLowerCase())?.role ?? null,
      seq: Math.max(0, seq),
      run: run ? { verdict: run.verdict, summary: run.summary } : undefined,
    };
  }

  async function handle(taskId: string, ev: RunEvent): Promise<void> {
    const task = getTask(taskId);
    if (!shouldMirror(task)) return;
    if (!(await approve(task))) return;

    const queued = [...(pending.get(taskId) ?? []), ...planForEvent(ev, contextFor(taskId, ev))];
    const hadIssue = Boolean(task.linear?.identifier);
    const identifier = await ensureIssue(task);
    if (!identifier) {
      // Keep the writes for when the issue can be created (the next event tries again).
      pending.set(taskId, queued.slice(-MAX_PENDING_OPS));
      return;
    }
    pending.delete(taskId);

    let allOk = true;
    for (const op of queued) {
      if (!(await runOp(identifier, taskId, op))) allOk = false;
    }
    if (allOk) {
      // A write dropped earlier is still missing from Linear and is not retried, so the task stays 'failed'
      // (visible to the operator) instead of looking healthy again. A failed CREATE is different: once the
      // issue exists and the queued writes went out, nothing is missing.
      const current = getTask(taskId)?.linear;
      if (!(hadIssue && current?.syncState === 'failed')) patchLinear(taskId, { syncState: 'synced', lastError: undefined });
    }
  }

  function enqueue(taskId: string, ev: RunEvent): void {
    const prev = chains.get(taskId) ?? Promise.resolve();
    chains.set(
      taskId,
      prev.then(() => handle(taskId, ev)).catch((err) => console.error('[LinearMirror] unexpected failure:', err)),
    );
  }

  const unsubscribe = useRunStore.subscribe((state) => {
    for (const [taskId, list] of Object.entries(state.events)) {
      if (lastList.get(taskId) === list) continue; // this task's events did not change
      lastList.set(taskId, list);
      let ids = seen.get(taskId);
      if (!ids) seen.set(taskId, (ids = new Set()));
      for (const ev of list) {
        if (ids.has(ev.id)) continue;
        ids.add(ev.id);
        if (primed) enqueue(taskId, ev);
      }
    }
  });

  // History that exists when we start is not replayed; only new events are mirrored.
  for (const [taskId, list] of Object.entries(useRunStore.getState().events)) {
    lastList.set(taskId, list);
    seen.set(taskId, new Set(list.map((e) => e.id)));
  }
  primed = true;

  return {
    stop: () => unsubscribe(),
    idle: async () => {
      // Writes can enqueue more writes, so wait until the set of chains stops changing.
      let before: Promise<void>[];
      do {
        before = [...chains.values()];
        await Promise.all(before);
      } while ([...chains.values()].some((p, i) => p !== before[i]) || chains.size !== before.length);
    },
  };
}
