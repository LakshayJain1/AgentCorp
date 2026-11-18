import { useGameStore } from '@/store/gameStore';
import { SubTask, Task, WorkerRole } from '@/agents/AgentTypes';
import { BaseWorkerAgent } from '@/agents/BaseWorkerAgent';
import { normalizeDependencies, resolveDependencyRef } from './dependencies';

interface QueueItem {
  subtask: SubTask;
  priority: number;
  enqueuedAt: number;
  retryDetails?: string[];
}

export class TaskQueue {
  private queue: QueueItem[] = [];
  private inProgress = new Set<string>();
  private warnedDeps = new Set<string>();
  private failedJobs = new Set<string>();

  enqueue(subtask: SubTask, priority: number = 0): void {
    if (this.queue.some((q) => q.subtask.id === subtask.id)) return;
    if (this.inProgress.has(subtask.id)) return;

    this.queue.push({ subtask, priority, enqueuedAt: Date.now() });
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  reEnqueue(subtask: SubTask, retryDetails: string[]): void {
    if (this.inProgress.has(subtask.id)) {
      this.inProgress.delete(subtask.id);
    }
    // P0: carry the retry count across the round-trip. Previously reEnqueue
    // ignored subtask.retryCount, so each re-queue looked like a first attempt
    // and the legacy retryCount<3 gate in processCompletedItems never fired.
    const nextRetry = (subtask.retryCount ?? 0) + 1;
    this.queue.push({
      subtask: { ...subtask, retryCount: nextRetry },
      priority: 5,
      enqueuedAt: Date.now(),
      retryDetails,
    });
  }

  async dispatchReadyJobs(workers: BaseWorkerAgent[]): Promise<void> {
    const store = useGameStore.getState();

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];
      // One bad job must not stop the others (or throw out of the orchestrator tick).
      try {
        if (this.inProgress.has(item.subtask.id)) {
          this.queue.splice(i, 1);
          continue;
        }

        if (!this.areDependenciesMet(item.subtask)) continue;

        const availableWorker = this.findWorker(workers, item.subtask.assignedRole);
        if (!availableWorker) continue;

        const agent = store.agents.find((a) => a.id === availableWorker.id);
        if (!agent || agent.currentSubTaskId) continue;

        this.inProgress.add(item.subtask.id);
        this.queue.splice(i, 1);

        store.updateSubtaskStatus(item.subtask.id, 'assigned');
        store.updateSubtaskAgent(item.subtask.id, agent.id);

        store.updateAgent(agent.id, {
          currentSubTaskId: item.subtask.id,
          fsmState: 'thinking',
        });

        store.addEvent({
          id: `assign_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          type: 'subtask',
          message: `Assigned "${item.subtask.description.slice(0, 50)}..." to ${agent.name}`,
          agentId: agent.id,
          taskId: item.subtask.parentTaskId,
        });

        availableWorker.assignSubtask(item.subtask);
      } catch (err) {
        const id = item.subtask.id;
        this.inProgress.delete(id);
        if (!this.failedJobs.has(id)) {
          this.failedJobs.add(id);
          console.error(`[AgentCorp] dispatch failed for subtask ${id}; skipping it this tick:`, err);
        }
      }
    }
  }

  private areDependenciesMet(subtask: SubTask): boolean {
    // Normalize at read time too: persisted or older subtasks may still hold
    // numbers/objects from the planner. Never throw from here.
    const deps = normalizeDependencies(subtask.dependencies);
    if (deps.length === 0) return true;

    const store = useGameStore.getState();
    const parentTask = store.tasks.find((t) => t.id === subtask.parentTaskId);
    if (!parentTask) return false;

    for (const depRef of deps) {
      const depSub = this.resolveDependency(parentTask, depRef);
      if (!depSub) {
        // A reference that points at nothing can never complete; blocking on it
        // would wedge the subtask forever. Ignore it and say so once.
        this.warnUnresolvable(subtask.id, depRef);
        continue;
      }
      if (depSub.status !== 'completed') return false;
    }
    return true;
  }

  /**
   * Resolve a dependency reference to a real subtask. The planner emits logical
   * indices like "sub_0", but subtask IDs are generated as
   * `sub_<taskId>_<idx>_<timestamp>`, so the naive `parseInt(split('_').pop())`
   * parsed the timestamp instead of the index and dependencies silently failed.
   */
  private resolveDependency(parentTask: Task, depRef: string): SubTask | undefined {
    return resolveDependencyRef(parentTask.subtasks, depRef);
  }

  private warnUnresolvable(subtaskId: string, depRef: string): void {
    const key = `${subtaskId}->${depRef}`;
    if (this.warnedDeps.has(key)) return;
    this.warnedDeps.add(key);
    console.warn(`[AgentCorp] subtask ${subtaskId} has an unresolvable dependency "${depRef}"; ignoring it.`);
  }

  private findWorker(
    workers: BaseWorkerAgent[],
    preferredRole: WorkerRole | null,
  ): BaseWorkerAgent | null {
    const store = useGameStore.getState();
    const isAvailable = (w: BaseWorkerAgent) => {
      const agent = store.agents.find((a) => a.id === w.id);
      if (!agent) return false;
      const inCooldown = agent.cooldownRemainingSeconds !== undefined && agent.cooldownRemainingSeconds > 0;
      return !w.isBusy() && agent.online && !inCooldown;
    };

    // P4: load-aware — least-loaded available worker wins (was first-match).
    const loadOf = (w: BaseWorkerAgent): number => {
      const agent = store.agents.find((a) => a.id === w.id);
      if (!agent) return 99;
      let n = agent.currentSubTaskId ? 1 : 0;
      for (const t of store.tasks) {
        for (const s of t.subtasks) {
          if (s.assignedAgentId === agent.id && (s.status === 'assigned' || s.status === 'in_progress')) n += 1;
        }
      }
      return n;
    };
    const available = workers.filter(isAvailable).sort((a, b) => loadOf(a) - loadOf(b));
    if (preferredRole) {
      const preferred = available.find((w) => w.getWorkerRole() === preferredRole);
      if (preferred) return preferred;
    }
    return available[0] || null;
  }

  markComplete(subtaskId: string): void {
    this.inProgress.delete(subtaskId);
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get activeJobs(): number {
    return this.inProgress.size;
  }
}
