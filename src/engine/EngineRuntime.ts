import { useGameStore } from '@/store/gameStore';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';
import { updateAgentMoods } from '@/systems/ConversationSystem';
import { preloadAllConfigs } from '@/config/preload';
import { initRunPersistence } from './runPersistence';
import { installDevHandle } from './devHandle';

/**
 * EngineRuntime owns everything that used to hang off the Pixi renderer:
 * agent bootstrap, worker registration, the orchestrator tick, mood decay and
 * simulation metrics. The office view is now purely visual — if WebGL fails or
 * the office tab is never opened, the team still works.
 *
 * Timing: a Web Worker drives the loop (worker timers are not throttled in
 * background tabs the way main-thread timers and requestAnimationFrame are).
 * If workers are unavailable it falls back to setInterval.
 */

const BASE_STEP_MS = 50;
const ORCH_BASE_MS = 500; // was: every 30 frames @ 60fps
const MOOD_BASE_MS = 333; // was: every 20 frames
const METRICS_MS = 100; // was: every 6 frames

export interface EngineStatus {
  started: boolean;
  startedAt: number | null;
  orchestratorTicks: number;
  lastOrchestratorTickAt: number | null;
  timer: 'worker' | 'interval' | 'none';
}

const status: EngineStatus = {
  started: false,
  startedAt: null,
  orchestratorTicks: 0,
  lastOrchestratorTickAt: null,
  timer: 'none',
};

let startPromise: Promise<void> | null = null;
/** Bumped on every stop so a start that was still awaiting configs can detect it was cancelled. */
let engineGen = 0;
let stopTimer: (() => void) | null = null;
let lastOrch = 0;
let lastMood = 0;
let lastMetrics = 0;
let orchestratorBusy = false;

function createTimer(cb: () => void, ms: number): { stop: () => void; kind: 'worker' | 'interval' } {
  const fallback = () => {
    const id = setInterval(cb, ms);
    return { stop: () => clearInterval(id), kind: 'interval' as const };
  };
  try {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return fallback();
    const src = `let id=setInterval(()=>postMessage(0),${ms});onmessage=()=>{clearInterval(id);close()}`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    let stopped = false;
    let fb: { stop: () => void } | null = null;
    worker.onmessage = () => cb();
    // A blocked worker (CSP, sandboxing) errors asynchronously: degrade quietly.
    worker.onerror = () => {
      if (stopped || fb) return;
      worker.terminate();
      fb = fallback();
      status.timer = 'interval';
    };
    return {
      kind: 'worker',
      stop: () => {
        stopped = true;
        try { worker.postMessage(0); worker.terminate(); } catch { /* already gone */ }
        fb?.stop();
      },
    };
  } catch {
    return fallback();
  }
}

function computeMetrics(): void {
  const store = useGameStore.getState();
  const agents = store.agents;
  const active = agents.filter((a) => a.workStatus !== 'idle').length;
  const working = agents.filter((a) => a.workStatus === 'coding' || a.workStatus === 'debugging' || a.workStatus === 'researching').length;
  const cpuUsage = Math.min(95, 15 + active * 5 + working * 3);
  const memoryUsage = Math.min(8.0, 2.0 + agents.length * 0.1 + store.tasks.length * 0.05);
  store.updateSimulation({
    cpuUsage: Math.round(cpuUsage),
    memoryUsage: Number(memoryUsage.toFixed(1)),
    tick: store.simulation.tick + 1,
  });
}

function step(): void {
  const store = useGameStore.getState();
  if (store.simulation.paused) return;
  const speed = Math.max(0.25, store.simulation.speed || 1);
  const now = performance.now();

  if (now - lastOrch >= ORCH_BASE_MS / speed && !orchestratorBusy) {
    lastOrch = now;
    orchestratorBusy = true;
    status.orchestratorTicks++;
    status.lastOrchestratorTickAt = Date.now();
    centralOrchestrator.tick()
      .catch((err) => console.error('[Engine] orchestrator tick failed:', err))
      .finally(() => { orchestratorBusy = false; });
  }
  if (now - lastMood >= MOOD_BASE_MS / speed) {
    lastMood = now;
    try { updateAgentMoods(); } catch (err) { console.error('[Engine] mood update failed:', err); }
  }
  if (now - lastMetrics >= METRICS_MS) {
    lastMetrics = now;
    computeMetrics();
  }
}

/** Idempotent. Safe to call from the workspace shell and (defensively) from the renderer. */
export function startEngine(): Promise<void> {
  if (startPromise) return startPromise;
  const gen = ++engineGen;
  startPromise = (async () => {
    // Personalities, intent patterns and templates must be parsed before any
    // agent speaks; this used to happen as a side effect of Pixi init.
    await preloadAllConfigs();
    if (gen !== engineGen) return; // stopped while loading configs

    // Bring back runs from before this session (marked "interrupted" if they never finished).
    await initRunPersistence().catch((err) => console.warn('[Engine] run persistence unavailable:', err));
    if (gen !== engineGen) return;

    const store = useGameStore.getState();
    // initAgents() replaces the agent list (and with it every conversation), so
    // only run it when the roster is actually empty.
    if (store.agents.length === 0) store.initAgents();
    centralOrchestrator.initWorkers();

    const now = performance.now();
    lastOrch = lastMood = lastMetrics = now;
    const timer = createTimer(step, BASE_STEP_MS);
    stopTimer = timer.stop;
    status.timer = timer.kind;
    status.started = true;
    status.startedAt = Date.now();
    installDevHandle(getEngineStatus);
    console.log(`[Engine] started (timer: ${timer.kind})`);
    // A reload between two parts of a team brief leaves the later parts unstarted; pick them up.
    centralOrchestrator.resumeTeamBriefs();
  })().catch((err) => {
    console.error('[Engine] failed to start:', err);
    if (gen === engineGen) startPromise = null;
    throw err;
  });
  return startPromise;
}

export function stopEngine(): void {
  engineGen++;
  stopTimer?.();
  stopTimer = null;
  startPromise = null;
  status.started = false;
  status.timer = 'none';
  orchestratorBusy = false;
}

export function getEngineStatus(): EngineStatus {
  return { ...status };
}
