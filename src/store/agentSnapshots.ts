/**
 * Persisted agent snapshots can contain duplicates: an earlier version of
 * initializePersonalizedOffice() created sales/finance/ops twice (initAgents()
 * already makes them) and those duplicates were saved. Every role is a single
 * seat except engineers, which legitimately repeat (one per developer).
 *
 * Keeps the first snapshot of each single-seat role.
 */
export function dedupeSnapshotsByRole<T extends { role?: string }>(snaps: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of snaps) {
    const role = s.role ?? 'engineer';
    if (role !== 'engineer') {
      if (seen.has(role)) continue;
      seen.add(role);
    }
    out.push(s);
  }
  return out;
}
