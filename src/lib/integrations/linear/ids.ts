import { createHash } from 'node:crypto';

/**
 * Deterministic UUID v4 from (namespace, key).
 *
 * Linear accepts a client-supplied `id` on create (IssueCreateInput.id: "The identifier in UUID v4
 * format. If none is provided, the backend will generate one"). Deriving that id from an idempotency
 * key makes every retry or replay of the same event target the SAME Linear object, even across
 * reloads or devices, so nothing has to be persisted before the call to stay safe.
 *
 * The namespace (workspace id) keeps two workspaces that happen to use the same key apart.
 */
export function deterministicUuid(namespace: string, key: string): string {
  const bytes = createHash('sha256').update(`agentcorp:linear\u0000${namespace}\u0000${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Buffer.from(bytes).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Idempotency key for a task event, e.g. `task_12:status:in_progress`. */
export function eventKey(taskId: string, event: string, sequence: number | string = 0): string {
  return `${taskId}:${event}:${sequence}`;
}
