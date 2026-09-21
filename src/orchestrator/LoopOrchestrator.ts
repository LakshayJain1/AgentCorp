import { MemoryStore } from '@/memory/MemoryStore';
import {
  LOOP_PHASE_ORDER,
  LoopPhase,
  LoopState,
  MAX_BUILD_VERIFY_CYCLES,
  MAX_SLICE_RETRIES,
  StoreAccessor,
  createInitialLoopState,
  shouldEscalateBuildVerify,
  shouldEscalateSlice,
} from './LoopTypes';

// LoopOrchestrator formalizes the proven BUILD<->VERIFY inner loop
// (worker.tick -> ValidatorAgent length+AI score>=60 -> TaskQueue.reEnqueue retry<=3)
// inside an outer DEFINE -> PLAN -> BUILD -> VERIFY -> REVIEW -> SHIP engine.
//
// Headless: all phase logic runs on injected StoreAccessor + MemoryStore snapshots.
// No React/Zustand/GameScene imports here — CentralOrchestrator injects the adapter.
export class LoopOrchestrator {
  private state: LoopState;
  private memStore: MemoryStore | null;
  private storeAccessor: StoreAccessor | null;
  private storageKey = 'agentcorp_loop_state';

  constructor(opts?: {
    goal?: string;
    successCriteria?: string;
    memStore?: MemoryStore;
    storeAccessor?: StoreAccessor;
  }) {
    this.state = createInitialLoopState(
      opts?.goal ?? 'Autonomous task completion via phased loop',
      opts?.successCriteria ?? 'All tasks completed, tsc+build pass',
    );
    this.memStore = opts?.memStore ?? null;
    this.storeAccessor = opts?.storeAccessor ?? null;
    this.load();
  }

  getState(): LoopState {
    return { ...this.state, attemptCounts: { ...this.state.attemptCounts } };
  }

  approvePlan(): void {
    this.state.planApproval = 'approved';
    this.advanceTo('PLAN');
  }

  advanceTo(phase: LoopPhase): void {
    this.state.currentPhase = phase;
    this.state.attemptCounts[phase] += 1;
    this.state.updatedAt = Date.now();
    this.persist();
  }

  nextPhase(): LoopPhase | null {
    const idx = LOOP_PHASE_ORDER.indexOf(this.state.currentPhase);
    return idx >= 0 && idx < LOOP_PHASE_ORDER.length - 1 ? LOOP_PHASE_ORDER[idx + 1] : null;
  }

  // Inner-loop accounting: call when a slice fails. Returns 'retry' or 'escalate'.
  recordSliceFailure(retryCount: number): 'retry' | 'escalate' {
    this.state.attemptCounts.BUILD += 1;
    this.state.updatedAt = Date.now();
    this.persist();
    return shouldEscalateSlice(retryCount) ? 'escalate' : 'retry';
  }

  // Call when VERIFY sends work back to BUILD. Escalates after budget.
  recordBuildVerifyCycle(): 'retry' | 'escalate' {
    this.state.buildVerifyCycles += 1;
    this.state.attemptCounts.VERIFY += 1;
    this.state.updatedAt = Date.now();
    if (shouldEscalateBuildVerify(this.state.buildVerifyCycles)) {
      this.block('build-verify budget exhausted after 2 cycles');
      return 'escalate';
    }
    this.persist();
    return 'retry';
  }

  block(reason: string): void {
    this.state.blockedReason = reason;
    this.state.updatedAt = Date.now();
    this.persist();
  }

  clearBlock(): void {
    this.state.blockedReason = null;
    this.state.buildVerifyCycles = 0;
    this.state.updatedAt = Date.now();
    this.persist();
  }

  snapshot(): { phase: LoopPhase; cycles: number; blocked: string | null } {
    return {
      phase: this.state.currentPhase,
      cycles: this.state.buildVerifyCycles,
      blocked: this.state.blockedReason,
    };
  }

  private persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      }
    } catch {
      // storage unavailable (SSR) — state stays in memory
    }
    try {
      this.memStore?.addSharedMemory({
        id: `loop_${Date.now()}`,
        type: 'task',
        content: `Loop ${this.state.currentPhase} cycles=${this.state.buildVerifyCycles} blocked=${this.state.blockedReason ?? 'none'}`,
        tags: ['loop', this.state.currentPhase.toLowerCase()],
        timestamp: Date.now(),
        importance: 2,
      });
    } catch {
      // memory unavailable — ignore
    }
  }

  private load(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LoopState;
      if (parsed && Array.isArray(LOOP_PHASE_ORDER) && parsed.currentPhase) {
        this.state = { ...this.state, ...parsed };
      }
    } catch {
      // corrupted storage — keep initial state
    }
  }
}

export const MAX_RETRIES_EXPORT = MAX_SLICE_RETRIES;
export const MAX_CYCLES_EXPORT = MAX_BUILD_VERIFY_CYCLES;
