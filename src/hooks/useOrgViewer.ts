'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OrgSnapshot } from '@/app/api/org-state/route';

export type ViewerStatus = 'loading' | 'live' | 'stale' | 'not_found';

const POLL_MS = 3000;
const LIVE_THRESHOLD_MS = 8000; // consider live if snapshot is <8s old

export function useOrgViewer(orgId: string | null) {
  const [snapshot, setSnapshot] = useState<OrgSnapshot | null>(null);
  const [ts, setTs] = useState<number | null>(null);
  const [status, setStatus] = useState<ViewerStatus>('loading');

  const poll = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/org-state?orgId=${encodeURIComponent(orgId)}`);
      if (res.status === 404) {
        setStatus('not_found');
        return;
      }
      const data = await res.json();
      if (!data.found) {
        setStatus('not_found');
        return;
      }
      setSnapshot(data.snapshot as OrgSnapshot);
      setTs(data.ts as number);
      setStatus(Date.now() - (data.ts as number) < LIVE_THRESHOLD_MS ? 'live' : 'stale');
    } catch {
      setStatus((prev) => (prev === 'loading' ? 'not_found' : 'stale'));
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [orgId, poll]);

  return { snapshot, ts, status };
}
