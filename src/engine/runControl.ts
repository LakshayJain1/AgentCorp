import { create } from 'zustand';
import { useGameStore } from '@/store/gameStore';
import { useRunStore } from './runEvents';
import { deleteStoredRun } from './runPersistence';

/**
 * Registry of runs that are executing right now in this tab/app, plus the
 * controls the UI needs: cancel, resume an interrupted run, discard it.
 *
 * Active-run count is mirrored to the desktop shell so it can keep the machine
 * awake and offer to hide to the tray instead of closing mid-run.
 */

const controllers = new Map<string, AbortController>();

/** Reactive set of running task ids (drives the Stop button). */
export const useActiveRuns = create<{ ids: string[] }>(() => ({ ids: [] }));

function syncActive(): void {
  const ids = [...controllers.keys()];
  useActiveRuns.setState({ ids });
  try { void window.electronAPI?.runs?.setActive(ids.length); } catch { /* not on desktop / old shell */ }
}

export function registerRun(taskId: string): AbortController {
  controllers.get(taskId)?.abort();
  const ctrl = new AbortController();
  controllers.set(taskId, ctrl);
  syncActive();
  return ctrl;
}

export function unregisterRun(taskId: string, ctrl?: AbortController): void {
  // A newer attempt may have replaced this controller; don't drop that one.
  if (ctrl && controllers.get(taskId) !== ctrl) return;
  controllers.delete(taskId);
  syncActive();
}

export function isRunActive(taskId: string): boolean {
  return controllers.has(taskId);
}

export function cancelRun(taskId: string): void {
  controllers.get(taskId)?.abort();
}

// The orchestrator owns how a run restarts; it registers itself here so this
// module (imported by UI) never imports the orchestrator (which imports UI-free
// engine code) and creates a cycle.
type ResumeHandler = (taskId: string) => Promise<void>;
let resumeHandler: ResumeHandler | null = null;
export function setResumeHandler(fn: ResumeHandler): void { resumeHandler = fn; }

export async function resumeInterruptedRun(taskId: string): Promise<void> {
  if (!resumeHandler) return;
  await resumeHandler(taskId);
}

/** Drop an interrupted run: remove it from view and storage and fail its task. */
export async function discardInterruptedRun(taskId: string): Promise<void> {
  cancelRun(taskId);
  useRunStore.getState().removeRun(taskId);
  await deleteStoredRun(taskId);
  const store = useGameStore.getState();
  const task = store.tasks.find((t) => t.id === taskId);
  if (task && task.status !== 'completed' && task.status !== 'failed') store.failTask(taskId);
}
