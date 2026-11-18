/**
 * Subtask dependency references, normalized.
 *
 * The planner LLM is told to list dependencies as 0-based indices, so it returns
 * numbers (`[0]`), numeric strings (`["0"]`), `"sub_0"`, real subtask ids, or
 * even objects. Anything non-string used to crash the orchestrator tick
 * (`depRef.match is not a function`). Canonical form is a string: either a real
 * subtask id, or a logical index written `sub_<n>`.
 */

type SubtaskLike = { id: string };

const LOGICAL_INDEX = /^sub_(\d+)$/;

/** One raw reference -> canonical string, or null when it cannot be understood. */
export function normalizeDependencyRef(raw: unknown): string | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 ? `sub_${raw}` : null;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return `sub_${parseInt(s, 10)}`;
    return s;
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return normalizeDependencyRef(o.id ?? o.index ?? o.ref ?? null);
  }
  return null;
}

/** Whatever the LLM (or persisted state) gave us -> a clean, de-duplicated string[]. */
export function normalizeDependencies(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const ref = normalizeDependencyRef(item);
    if (ref && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/** Resolve one canonical ref against a parent's subtasks (by id first, then `sub_<n>` index). */
export function resolveDependencyRef<T extends SubtaskLike>(subtasks: T[], ref: string): T | undefined {
  const byId = subtasks.find((s) => s.id === ref);
  if (byId) return byId;
  const m = LOGICAL_INDEX.exec(ref);
  if (m) return subtasks[parseInt(m[1], 10)];
  return undefined;
}

/**
 * Planner-time cleanup: normalize, then drop references that can never be met
 * (a subtask depending on itself, or on an index that does not exist), because
 * those would block the subtask forever.
 */
export function sanitizePlannedDependencies(raw: unknown, ownIndex: number, count: number): string[] {
  return normalizeDependencies(raw).filter((ref) => {
    const m = LOGICAL_INDEX.exec(ref);
    if (!m) return true; // a real id: the queue resolves it later
    const idx = parseInt(m[1], 10);
    return idx !== ownIndex && idx < count;
  });
}
