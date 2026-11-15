import { useGameStore } from '@/store/gameStore';
import type { ExecutionStreamChunk, TaskExecutionLog } from '@/agents/AgentTypes';
import { publishRunEvent, useRunStore, type RunEvent, type RunEventStatus } from './runEvents';

/**
 * Helpers that let existing code paths (direct tasks, the planner/queue
 * pipeline, tool execution logs) feed the unified run-event stream without
 * being rewritten.
 */

type Partial_ = Omit<RunEvent, 'id' | 'timestamp' | 'runId' | 'taskId'> & { id?: string; timestamp?: number };

/** Publish for a task, creating the run (with the task's title) on first sight. */
export function emitRun(taskId: string, e: Partial_): RunEvent {
  const state = useRunStore.getState();
  if (!state.runs[taskId] && e.kind !== 'run.started') {
    const task = useGameStore.getState().tasks.find((t) => t.id === taskId);
    publishRunEvent({
      taskId,
      kind: 'run.started',
      agentId: e.agentId,
      message: 'Run started',
      status: 'running',
      data: { title: task?.title ?? 'Task', mode: 'direct' },
    });
  }
  return publishRunEvent({ ...e, taskId });
}

/** task.executionLogs entries (written by gameStore.addTaskExecutionLog). */
export function publishFromExecutionLog(taskId: string, log: TaskExecutionLog): void {
  const isDeliverableStep = log.tool === 'generateDeliverable';
  const stepId = log.id.replace(/_(done|err)$/, '');
  const status: RunEventStatus = log.status;
  emitRun(taskId, {
    kind: isDeliverableStep
      ? (log.status === 'running' ? 'step.started' : 'step.finished')
      : 'tool.result',
    agentId: log.agentId,
    message: log.action,
    detail: log.output || undefined,
    status,
    data: { stepId, tool: log.tool, durationMs: log.duration, input: log.input?.slice(0, 500) },
    timestamp: log.timestamp,
  });
}

/** ExecutionStreamChunk (planner/queue pipeline) → run events. */
export function publishFromChunk(chunk: ExecutionStreamChunk): void {
  const kindMap: Record<ExecutionStreamChunk['type'], RunEvent['kind']> = {
    start: 'step.started',
    progress: 'step.progress',
    tool_call: 'tool.call',
    tool_result: 'tool.result',
    error: 'step.finished',
    complete: 'step.finished',
  };
  emitRun(chunk.taskId, {
    kind: kindMap[chunk.type],
    subtaskId: chunk.subtaskId,
    agentId: chunk.agentId,
    message: chunk.message,
    detail: chunk.details,
    status: chunk.type === 'error' ? 'error' : chunk.type === 'complete' ? 'success' : 'running',
    data: { stepId: chunk.subtaskId },
    timestamp: chunk.timestamp,
  });
}
