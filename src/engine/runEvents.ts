import { create } from 'zustand';

/**
 * One event model for "what is the team doing right now".
 *
 * Before this there were three overlapping sources (orchestrator StreamEvent,
 * ExecutionStreamChunk, task.executionLogs) and the chat consumed none of them.
 * Everything that wants to show progress — the inline chat steps block, the
 * right-hand log, run persistence — reads from here.
 */

export type RunEventKind =
  | 'run.started'
  | 'step.started'
  | 'step.progress'
  | 'step.finished'
  | 'tool.call'
  | 'tool.result'
  | 'validation.result'
  | 'retry'
  | 'blocked'
  | 'summary.delta'
  | 'run.finished'
  | 'run.failed';

export type RunEventStatus = 'running' | 'success' | 'error';

export interface RunEvent {
  id: string;
  /** One run per task for now; kept separate so a task can have several attempts later. */
  runId: string;
  taskId: string;
  subtaskId?: string;
  agentId?: string;
  kind: RunEventKind;
  /** Short human-readable line shown in the UI. */
  message: string;
  /** Longer payload (tool output, error text, QA report). Shown on expand. */
  detail?: string;
  status?: RunEventStatus;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type RunStatus = 'running' | 'blocked' | 'finished' | 'failed' | 'interrupted';

export interface RunBudgetSnapshot {
  stepsUsed: number;
  maxSteps: number;
  tokensUsed: number;
  maxTokens: number;
  elapsedMs: number;
  maxMs: number;
}

export interface CriterionResult {
  id: string;
  text: string;
  kind: 'check' | 'file' | 'llm';
  passed: boolean | null; // null = not evaluated
  evidence?: string;
}

export interface RunMeta {
  runId: string;
  taskId: string;
  title: string;
  agentId?: string;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  /** Streamed final answer. Appended to by `summary.delta` events. */
  summary: string;
  summaryStreaming: boolean;
  /** 'needs_attention' when it finished but acceptance criteria were not all met. */
  verdict?: 'passed' | 'needs_attention';
  criteria?: CriterionResult[];
  budget?: RunBudgetSnapshot;
  /** 'loop' = tool-using agent loop, 'direct' = single-shot deliverable. */
  mode?: 'loop' | 'direct';
}

const MAX_EVENTS_PER_RUN = 400;
const MAX_RUNS = 60;

interface RunStoreState {
  runs: Record<string, RunMeta>;
  events: Record<string, RunEvent[]>;
  /** runIds, oldest first. */
  order: string[];
  /** Timestamp of the most recent event; lets the chat auto-scroll as a run progresses. */
  lastEventAt: number;
  publish: (e: Omit<RunEvent, 'id' | 'timestamp' | 'runId'> & { id?: string; timestamp?: number; runId?: string }) => RunEvent;
  patchRun: (runId: string, patch: Partial<RunMeta>) => void;
  hydrate: (runs: RunMeta[], events: RunEvent[]) => void;
  removeRun: (runId: string) => void;
  clear: () => void;
}

let counter = 0;
function newEventId(): string {
  counter = (counter + 1) % 1_000_000;
  return `rev_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const runIdForTask = (taskId: string): string => taskId;

export const useRunStore = create<RunStoreState>((set) => ({
  runs: {},
  events: {},
  order: [],
  lastEventAt: 0,

  publish: (input) => {
    const event: RunEvent = {
      ...input,
      id: input.id ?? newEventId(),
      runId: input.runId ?? runIdForTask(input.taskId),
      timestamp: input.timestamp ?? Date.now(),
    };
    set((state) => {
      const runId = event.runId;
      const prevEvents = state.events[runId] ?? [];
      const nextEvents = prevEvents.length >= MAX_EVENTS_PER_RUN
        ? [...prevEvents.slice(prevEvents.length - MAX_EVENTS_PER_RUN + 1), event]
        : [...prevEvents, event];

      let meta = state.runs[runId];
      if (!meta) {
        meta = {
          runId,
          taskId: event.taskId,
          title: typeof event.data?.title === 'string' ? (event.data.title as string) : 'Task',
          agentId: event.agentId,
          status: 'running',
          startedAt: event.timestamp,
          summary: '',
          summaryStreaming: false,
        };
      }
      const next: RunMeta = { ...meta };
      if (event.agentId && !next.agentId) next.agentId = event.agentId;
      if (typeof event.data?.title === 'string' && event.kind === 'run.started') next.title = event.data.title as string;
      if (event.data?.mode === 'loop' || event.data?.mode === 'direct') next.mode = event.data.mode as 'loop' | 'direct';
      if (event.data?.budget) next.budget = event.data.budget as RunBudgetSnapshot;
      if (event.data?.criteria) next.criteria = event.data.criteria as CriterionResult[];

      switch (event.kind) {
        case 'run.started':
          next.status = 'running';
          next.startedAt = event.timestamp;
          next.finishedAt = undefined;
          break;
        case 'blocked':
          next.status = 'blocked';
          break;
        case 'summary.delta':
          next.summary = (event.data?.replace ? '' : next.summary) + event.message;
          next.summaryStreaming = true;
          if (next.status === 'blocked') next.status = 'running';
          break;
        case 'run.finished':
          next.status = 'finished';
          next.finishedAt = event.timestamp;
          next.summaryStreaming = false;
          if (event.data?.verdict === 'passed' || event.data?.verdict === 'needs_attention') {
            next.verdict = event.data.verdict as RunMeta['verdict'];
          }
          break;
        case 'run.failed':
          next.status = 'failed';
          next.finishedAt = event.timestamp;
          next.summaryStreaming = false;
          break;
        default:
          if (next.status === 'blocked') next.status = 'running';
      }

      const isNew = !state.runs[runId];
      let order = isNew ? [...state.order, runId] : state.order;
      let runs = { ...state.runs, [runId]: next };
      let events = { ...state.events, [runId]: nextEvents };
      if (order.length > MAX_RUNS) {
        const drop = order.slice(0, order.length - MAX_RUNS);
        order = order.slice(order.length - MAX_RUNS);
        runs = Object.fromEntries(Object.entries(runs).filter(([id]) => !drop.includes(id)));
        events = Object.fromEntries(Object.entries(events).filter(([id]) => !drop.includes(id)));
      }
      return { runs, events, order, lastEventAt: event.timestamp };
    });
    return event;
  },

  patchRun: (runId, patch) => {
    set((state) => (state.runs[runId] ? { runs: { ...state.runs, [runId]: { ...state.runs[runId], ...patch } } } : state));
  },

  hydrate: (runs, events) => {
    set((state) => {
      const nextRuns = { ...state.runs };
      const nextEvents = { ...state.events };
      let order = [...state.order];
      for (const r of runs) {
        if (nextRuns[r.runId]) continue; // live data wins over stored data
        nextRuns[r.runId] = r;
        order.push(r.runId);
      }
      for (const e of events) {
        if (state.runs[e.runId]) continue;
        (nextEvents[e.runId] ??= []).push(e);
      }
      for (const id of Object.keys(nextEvents)) nextEvents[id].sort((a, b) => a.timestamp - b.timestamp);
      order = order
        .filter((id, i, arr) => arr.indexOf(id) === i && nextRuns[id])
        .sort((a, b) => nextRuns[a].startedAt - nextRuns[b].startedAt);
      return { runs: nextRuns, events: nextEvents, order };
    });
  },

  removeRun: (runId) => {
    set((state) => {
      const runs = { ...state.runs };
      const events = { ...state.events };
      delete runs[runId];
      delete events[runId];
      return { runs, events, order: state.order.filter((id) => id !== runId) };
    });
  },

  clear: () => set({ runs: {}, events: {}, order: [], lastEventAt: 0 }),
}));

/** Non-React publisher for orchestrator / agent code. */
export function publishRunEvent(
  e: Omit<RunEvent, 'id' | 'timestamp' | 'runId'> & { id?: string; timestamp?: number; runId?: string },
): RunEvent {
  return useRunStore.getState().publish(e);
}
