import { publishRunEvent } from '@/engine/runEvents';

/** Headless stand-in for src/engine/runBridge.ts: same run-event stream, no game store. */
export function emitRun(taskId: string, e: Record<string, unknown>) {
  return publishRunEvent({ ...(e as object), taskId } as Parameters<typeof publishRunEvent>[0]);
}
