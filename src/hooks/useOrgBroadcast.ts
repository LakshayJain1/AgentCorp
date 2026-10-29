'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { OrgSnapshot } from '@/app/api/org-state/route';

const INTERVAL_MS = 3000;

export function useOrgBroadcast() {
  const orgId = useGameStore((s) => s.orgId);
  const isInitialized = useGameStore((s) => s.isInitialized);

  useEffect(() => {
    if (!orgId || !isInitialized) return;

    const publish = async () => {
      const s = useGameStore.getState();
      const snapshot: OrgSnapshot = {
        companyName: s.companyName,
        companyProduct: s.companyProduct,
        agents: s.agents.map((a) => ({
          id: a.id, name: a.name, role: a.role, emoji: a.emoji,
          workStatus: a.workStatus, mood: a.mood, energy: a.energy,
          currentTaskId: a.currentTaskId, online: a.online,
        })),
        tasks: s.tasks.map((t) => ({
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

      try {
        await fetch('/api/org-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, snapshot }),
        });
      } catch {
        // silently ignore — viewer gets stale data until next tick
      }
    };

    publish();
    const id = setInterval(publish, INTERVAL_MS);
    return () => clearInterval(id);
  }, [orgId, isInitialized]);
}
