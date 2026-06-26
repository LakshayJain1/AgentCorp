import { useGameStore } from '@/store/gameStore';
import { SubTask, WorkerRole } from '@/agents/AgentTypes';
import { BaseWorkerAgent } from '@/agents/BaseWorkerAgent';

interface QueueItem {
  subtask: SubTask;
  priority: number;
  enqueuedAt: number;
  retryDetails?: string[];
}

export class TaskQueue {
  private queue: QueueItem[] = [];
  private inProgress = new Set<string>();

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
    this.queue.push({
      subtask,
      priority: 5,
      enqueuedAt: Date.now(),
      retryDetails,
    });
  }

  async dispatchReadyJobs(workers: BaseWorkerAgent[]): Promise<void> {
    const store = useGameStore.getState();

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];
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
    }
  }

  private areDependenciesMet(subtask: SubTask): boolean {
    if (!subtask.dependencies || subtask.dependencies.length === 0) return true;

    const store = useGameStore.getState();
    const parentTask = store.tasks.find((t) => t.id === subtask.parentTaskId);
    if (!parentTask) return false;

    for (const depIdx of subtask.dependencies) {
      const depSub = parentTask.subtasks[parseInt(depIdx.split('_').pop() || '')];
      if (!depSub || depSub.status !== 'completed') return false;
    }
    return true;
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

    if (preferredRole) {
      const preferred = workers.find((w) => w.getWorkerRole() === preferredRole && isAvailable(w));
      if (preferred) return preferred;
    }
    return workers.find(isAvailable) || null;
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
