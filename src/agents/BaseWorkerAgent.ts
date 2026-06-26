import { useGameStore } from '@/store/gameStore';
import {
  Agent, AgentFSMState,
  SubTask, WorkerRole, ToolResult, StreamEvent,
  ExecutionStreamChunk,
} from './AgentTypes';

export abstract class BaseWorkerAgent {
  protected agentId: string;
  protected currentSubtask: SubTask | null = null;
  protected listeners: Set<(event: StreamEvent) => void> = new Set();

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  abstract getWorkerRole(): WorkerRole;
  protected abstract generateDeliverable(subtask: SubTask): Promise<string>;

  onEvent(cb: (event: StreamEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  protected emit(event: StreamEvent): void {
    for (const cb of this.listeners) cb(event);
  }

  isBusy(): boolean {
    return this.currentSubtask !== null;
  }

  assignSubtask(subtask: SubTask): void {
    this.currentSubtask = subtask;
  }

  async tick(): Promise<void> {
    if (!this.currentSubtask) return;

    const store = useGameStore.getState();
    const agent = store.agents.find((a) => a.id === this.agentId);
    if (!agent) return;

    const subtask = this.currentSubtask;

    try {
      store.updateAgent(this.agentId, { fsmState: 'thinking' as AgentFSMState });
      store.updateSubtaskStatus(subtask.id, 'in_progress');

      this.pushStreamChunk(subtask, 'start', `Starting work on: "${subtask.description}"`);

      const content = await this.generateDeliverable(subtask);

      if (content && content.length > 10) {
        store.updateSubtaskStatus(subtask.id, 'completed');
        store.updateSubtaskDeliverable(subtask.id, content);
        store.updateAgent(this.agentId, { fsmState: 'completed' as AgentFSMState });

        this.pushStreamChunk(subtask, 'complete', `Deliverable generated (${content.length} chars)`);
      } else {
        store.updateSubtaskStatus(subtask.id, 'failed');
        store.updateAgent(this.agentId, { fsmState: 'blocked' as AgentFSMState });
        this.pushStreamChunk(subtask, 'error', 'Failed to generate deliverable');
      }
    } catch (err) {
      store.updateAgent(this.agentId, { fsmState: 'blocked' as AgentFSMState });
      store.updateSubtaskStatus(subtask.id, 'failed');
      this.pushStreamChunk(subtask, 'error', `Execution error: ${err}`);
    }
  }

  protected pushStreamChunk(
    subtask: SubTask,
    type: ExecutionStreamChunk['type'],
    message: string,
    details?: string,
  ): void {
    this.emit({
      type: 'log',
      data: {
        taskId: subtask.parentTaskId,
        subtaskId: subtask.id,
        agentId: this.agentId,
        type,
        message,
        details,
        timestamp: Date.now(),
      } as ExecutionStreamChunk,
      timestamp: Date.now(),
      streamId: `exec_${subtask.id}`,
    });
  }

  get id(): string {
    return this.agentId;
  }

  cancelCurrentTask(): void {
    this.currentSubtask = null;
  }
}
