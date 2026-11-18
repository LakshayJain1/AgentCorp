/**
 * Linear -> app, by polling (no webhooks, so it works in the desktop app and on localhost).
 *
 * For each task the mirror created an issue for, read the issue every few seconds-to-minutes and tell the
 * operator in chat when a HUMAN changed something in Linear: the status moved, or a comment (one that is not
 * an agent's "**Name (Role):**" comment) was added. It only reads, so it needs no approval, and it never
 * changes how the agents work: it reports, the operator decides.
 *
 * The first look at an issue is a baseline: whatever is already there is recorded, not announced.
 */
import { useGameStore } from '@/store/gameStore';
import { execViaApi, type Exec } from './LinearMirror';
import type { Task } from '@/agents/AgentTypes';

export interface ParsedIssue {
  identifier: string;
  status: string;
  /** Comment bodies, oldest first, as `linear_get_issue` returns them (truncated by the tool). */
  comments: string[];
}

/** Parse the text `linear_get_issue` returns: `AGE-8 "title" [Done] url`, then `comment: ...` lines. */
export function parseIssueOutput(out: string): ParsedIssue | null {
  const head = out.match(/^([A-Z][A-Z0-9]{1,9}-\d+) "(.*)" \[([^\]]+)\]/m);
  if (!head) return null;
  const comments: string[] = [];
  let current: string[] | null = null;
  for (const line of out.split('\n').slice(1)) {
    if (line.startsWith('comment: ')) {
      if (current) comments.push(current.join('\n'));
      current = [line.slice('comment: '.length)];
    } else if (line.startsWith('description: ')) {
      if (current) comments.push(current.join('\n'));
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  if (current) comments.push(current.join('\n'));
  return { identifier: head[1], status: head[3].trim(), comments: comments.map((c) => c.trim()).filter(Boolean) };
}

/** Agents post as "**Mike (Engineer):** ..."; anything else was written by a person. */
export const isAgentComment = (body: string): boolean => /^\*\*[^*]+\([^)]+\):\*\*/.test(body.trim());

/** A short stable fingerprint (comments have no id in the tool output). */
export function fingerprint(body: string): string {
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h << 5) + h + body.charCodeAt(i)) | 0;
  return `${body.length}:${(h >>> 0).toString(36)}`;
}

export interface PollResult {
  taskId: string;
  announced: string[];
}

const MAX_SEEN = 60;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface PollerOptions {
  exec?: Exec;
  intervalMs?: number;
  /** Tasks older than this are no longer polled. */
  maxAgeMs?: number;
  now?: () => number;
}

export interface PollerHandle {
  stop(): void;
  /** One pass over every eligible task (also what the timer calls). */
  pollOnce(): Promise<PollResult[]>;
}

export function startLinearPoller(opts: PollerOptions = {}): PollerHandle {
  const exec = opts.exec ?? execViaApi;
  const intervalMs = opts.intervalMs ?? 30_000;
  const maxAge = opts.maxAgeMs ?? 24 * 3600_000;
  const now = opts.now ?? Date.now;
  let running = false;

  const eligible = (t: Task): boolean => {
    const l = t.linear;
    return Boolean(l?.identifier && l.syncState !== 'skipped' && now() - t.createdAt < maxAge);
  };

  async function pollTask(task: Task): Promise<PollResult> {
    const announced: string[] = [];
    const id = task.linear!.identifier;
    const issue = parseIssueOutput(await exec('linear_get_issue', { issueId: id }));
    if (!issue) return { taskId: task.id, announced };

    const gs = useGameStore.getState();
    const fresh = gs.tasks.find((t) => t.id === task.id)?.linear ?? task.linear!;
    const commentsBaselined = fresh.remoteSeen !== undefined; // first look at the comments only records them
    const human = issue.comments.filter((c) => !isAgentComment(c));
    const seen = new Set(fresh.remoteSeen ?? []);
    const newComments = commentsBaselined ? human.filter((c) => !seen.has(fingerprint(c))) : [];

    const statusChanged =
      fresh.remoteStatus !== undefined && // no known status yet = first look, nothing to compare with
      issue.status.toLowerCase() !== fresh.remoteStatus.toLowerCase() &&
      issue.status.toLowerCase() !== (fresh.lastWrittenStatus ?? '').toLowerCase();

    const pm = gs.agents.find((a) => a.role === 'pm');
    const say = (text: string) => {
      announced.push(text);
      if (pm) useGameStore.getState().sendMessage(pm.id, pm.id, text);
    };
    if (statusChanged) say(`🔄 ${id} was moved to ${issue.status} in Linear ("${clip(task.title, 60)}").`);
    for (const c of newComments) say(`💬 New comment on ${id} in Linear: "${clip(c, 280)}"`);

    // Re-read: the mirror may have patched this task while we were waiting on the network.
    const latest = useGameStore.getState().tasks.find((t) => t.id === task.id)?.linear ?? fresh;
    useGameStore.getState().updateTask(task.id, {
      linear: {
        ...latest,
        remoteStatus: issue.status,
        remoteSeen: [...new Set([...(latest.remoteSeen ?? []), ...human.map(fingerprint)])].slice(-MAX_SEEN),
        remoteCheckedAt: now(),
      },
    });
    return { taskId: task.id, announced };
  }

  async function pollOnce(): Promise<PollResult[]> {
    if (running) return [];
    const gs = useGameStore.getState();
    if (!gs.connectors.linear?.connected) return [];
    running = true;
    const results: PollResult[] = [];
    try {
      for (const task of gs.tasks.filter(eligible).slice(0, 10)) {
        try {
          results.push(await pollTask(task));
        } catch (err) {
          // A failed read is not worth bothering the operator about; the next pass tries again.
          console.warn('[LinearPoller]', task.linear?.identifier, err instanceof Error ? err.message : err);
        }
      }
    } finally {
      running = false;
    }
    return results;
  }

  const timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void pollOnce();
  }, intervalMs);
  // Do not keep a Node process (tests) alive just for the timer.
  (timer as unknown as { unref?: () => void }).unref?.();

  return { stop: () => clearInterval(timer), pollOnce };
}
