'use client';

import { useState, useEffect } from 'react';
import type { OrgSnapshot } from '@/lib/orgStore';

export type ViewerStatus = 'loading' | 'live' | 'stale' | 'not_found';

const POLL_MS = 3000;
const LIVE_THRESHOLD_MS = 8000; // consider live if snapshot is <8s old

export function useOrgViewer(orgId: string | null) {
  const [snapshot, setSnapshot] = useState<OrgSnapshot | null>(null);
  const [ts, setTs] = useState<number | null>(null);
  const [status, setStatus] = useState<ViewerStatus>('loading');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/org-state?orgId=${encodeURIComponent(orgId)}`);
        if (cancelled) return;
        if (res.status === 404 || res.status === 401) {
          setStatus('not_found');
          return;
        }
        // Rate limited / storage hiccup: keep what we have and mark it stale.
        if (!res.ok) {
          setStatus((prev) => (prev === 'loading' ? 'loading' : 'stale'));
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data.found) {
          setStatus('not_found');
          return;
        }
        setSnapshot(data.snapshot as OrgSnapshot);
        setTs(data.ts as number);
        setStatus(Date.now() - (data.ts as number) < LIVE_THRESHOLD_MS ? 'live' : 'stale');
      } catch {
        if (!cancelled) setStatus((prev) => (prev === 'loading' ? 'not_found' : 'stale'));
      }
    };

    // First poll is deferred a tick so no state is set synchronously in the effect.
    const first = setTimeout(poll, 0);
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [orgId]);

  return { snapshot, ts, status };
}
