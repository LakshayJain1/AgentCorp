import { useGameStore } from '@/store/gameStore';
import { toolRegistry } from '@/runtime/ToolRegistry';
import {
  Agent, AgentFSMState, AGENT_FSM_TRANSITIONS,
  SubTask, WorkerRole, ToolResult, StreamEvent,
  ExecutionStreamChunk,
} from './AgentTypes';

export abstract class BaseWorkerAgent {
  protected agentId: string;
  protected currentSubtask: SubTask | null = null;
  protected stepOutputs: Record<string, string> = {};
  protected retryDetails: string[] = [];
  protected listeners: Set<(event: StreamEvent) => void> = new Set();

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  abstract getWorkerRole(): WorkerRole;
  protected abstract getExecutionSteps(subtask: SubTask): Promise<AgentStep[]>;

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

  assignSubtask(subtask: SubTask, retryDetails?: string[]): void {
    this.currentSubtask = subtask;
    this.stepOutputs = {};
    this.retryDetails = retryDetails || [];
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

      const steps = await this.getExecutionSteps(subtask);
      this.stepOutputs = {};

      let failed = false;

      for (const step of steps) {
        const resolvedParams: Record<string, string> = {};
        for (const [key, val] of Object.entries(step.params)) {
          resolvedParams[key] = val.replace(/\{(\w+)\}/g, (_, name) => this.stepOutputs[name] ?? '');
        }

        if (step.tool === 'ask_agent') {
          store.updateAgent(this.agentId, { fsmState: 'thinking' as AgentFSMState });
        } else {
          store.updateAgent(this.agentId, { fsmState: (step.tool === 'write_file' ? 'coding' : 'debugging') as AgentFSMState });
        }

        this.pushStreamChunk(subtask, 'tool_call', `Running ${step.tool}: ${step.description}`, JSON.stringify(step.params));

        const result = await this.executeStep(subtask, step, resolvedParams);

        this.pushStreamChunk(subtask, 'tool_result', `${step.tool} completed`, result.output.slice(0, 200));

        if (step.storeAs) {
          this.stepOutputs[step.storeAs] = result.output;
        }

        if (!result.success && step.required) {
          failed = true;
          store.updateAgent(this.agentId, { fsmState: 'blocked' as AgentFSMState });
          this.pushStreamChunk(subtask, 'error', `Step failed: ${step.description}`, result.error);
          break;
        }
      }

      if (failed) {
        store.updateAgent(this.agentId, { fsmState: 'blocked' as AgentFSMState });
        store.updateSubtaskStatus(subtask.id, 'failed');
      } else {
        store.updateAgent(this.agentId, { fsmState: 'reviewing' as AgentFSMState });
        store.updateSubtaskStatus(subtask.id, 'completed');

        if (steps.some((s) => s.tool === 'write_file')) {
          const path = this.stepOutputs['file_path'] || '';
          const content = this.stepOutputs['file_content'] || '';
          store.updateSubtaskDeliverable(subtask.id, content, path);
        }
      }
    } catch (err) {
      store.updateAgent(this.agentId, { fsmState: 'blocked' as AgentFSMState });
      store.updateSubtaskStatus(subtask.id, 'failed');
      this.pushStreamChunk(subtask, 'error', `Execution error: ${err}`, '');
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

  private async executeStep(
    subtask: SubTask,
    step: AgentStep,
    params: Record<string, string>,
  ): Promise<ToolResult> {
    const store = useGameStore.getState();

    store.addTaskExecutionLog(subtask.parentTaskId, {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      taskId: subtask.parentTaskId,
      agentId: this.agentId,
      action: step.description,
      tool: step.tool,
      input: JSON.stringify(params),
      output: '',
      duration: 0,
      timestamp: Date.now(),
      status: 'running',
    });

    const result = await toolRegistry.executeTool(step.tool, params);

    const outputText = (result.output || result.error || '').trim();
    store.addTaskExecutionLog(subtask.parentTaskId, {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskId: subtask.parentTaskId,
      agentId: this.agentId,
      action: result.success ? `${step.tool} completed` : `${step.tool} failed`,
      tool: step.tool,
      input: JSON.stringify(params),
      output: outputText,
      duration: result.duration,
      timestamp: Date.now(),
      status: result.success ? 'success' : 'error',
    });

    return result;
  }

  get id(): string {
    return this.agentId;
  }

  cancelCurrentTask(): void {
    this.currentSubtask = null;
    this.stepOutputs = {};
  }
}

export interface AgentStep {
  tool: string;
  params: Record<string, string>;
  description: string;
  storeAs?: string;
  required?: boolean;
}
