'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { OrgSnapshot } from '@/lib/orgStore';

const INTERVAL_MS = 3000;
const LOCK_NAME = 'agentcorp-org-broadcast';

function buildSnapshot(): OrgSnapshot {
  const s = useGameStore.getState();
  return {
    companyName: s.companyName,
    companyProduct: s.companyProduct,
    agents: s.agents.map((a) => ({
      id: a.id, name: a.name, role: a.role, emoji: a.emoji,
      workStatus: a.workStatus, mood: a.mood, energy: a.energy,
      currentTaskId: a.currentTaskId, online: a.online,
    })),
    tasks: s.tasks.slice(0, 200).map((t) => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority,
      assignedTo: t.assignedTo, deliverableType: t.deliverableType, createdAt: t.createdAt,
    })),
    events: s.events.slice(-30),
    simulation: {
      efficiency: s.simulation.efficiency,
      tick: s.simulation.tick,
      speed: s.simulation.speed,
      paused: s.simulation.paused,
      totalTasksCompleted: s.simulation.totalTasksCompleted,
    },
    deliverableProjects: s.deliverableProjects.slice(-15).map((p) => ({
      id: p.id, title: p.title, type: p.type, createdAt: p.createdAt,
    })),
  };
}

/**
 * Publishes this browser's org to the viewer endpoint every few seconds.
 * Only ONE tab per browser publishes (Web Locks), so several open tabs can't
 * overwrite each other and make viewers flicker.
 */
export function useOrgBroadcast() {
  const isInitialized = useGameStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) return;

    // Upgrade legacy guessable org ids to unguessable ones before publishing.
    useGameStore.getState().ensureStrongOrgId();

    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let releaseLock: (() => void) | null = null;

    const publish = async () => {
      if (stopped) return;
      const orgId = useGameStore.getState().ensureStrongOrgId();
      try {
        const res = await fetch('/api/org-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, snapshot: buildSnapshot() }),
        });
        // 403 = this id is owned by another account (e.g. copied localStorage).
        if (res.status === 403) {
          useGameStore.setState({ orgId: '', clerkOrgId: '', invitesSent: false });
          useGameStore.getState().ensureStrongOrgId();
        }
      } catch {
        // viewer keeps showing the last snapshot until the next tick
      }
    };

    const startPublishing = () => {
      void publish();
      intervalId = setInterval(publish, INTERVAL_MS);
    };

    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    if (locks?.request) {
      // Held until this effect is cleaned up (tab closed / unmounted).
      void locks.request(LOCK_NAME, () => new Promise<void>((resolve) => {
        if (stopped) { resolve(); return; }
        releaseLock = resolve;
        startPublishing();
      }));
    } else {
      startPublishing();
    }

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
      if (releaseLock) releaseLock();
    };
  }, [isInitialized]);
}
