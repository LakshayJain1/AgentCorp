import { Agent, Task } from '@/agents/AgentTypes';

export type LoopPhase = 'DEFINE' | 'PLAN' | 'BUILD' | 'VERIFY' | 'REVIEW' | 'SHIP';

export type LoopLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface LoopState {
  goal: string;
  successCriteria: string;
  level: LoopLevel;
  planApproval: 'pending' | 'approved' | 'not-needed';
  currentPhase: LoopPhase;
  attemptCounts: Record<LoopPhase, number>;
  buildVerifyCycles: number;
  blockedReason: string | null;
  updatedAt: number;
}

// Budgets — loop stops and escalates when hit, never retries silently.
export const MAX_SLICE_RETRIES = 2;
export const MAX_BUILD_VERIFY_CYCLES = 2;
// Align with existing engine: Planner ≤5 subtasks, Validator retry ≤3, task cap 8.
export const MAX_SUBTASKS_PER_TASK = 5;
export const MAX_VALIDATION_RETRIES = 3;

export const LOOP_PHASE_ORDER: LoopPhase[] = [
  'DEFINE',
  'PLAN',
  'BUILD',
  'VERIFY',
  'REVIEW',
  'SHIP',
];

export function createInitialLoopState(
  goal: string,
  successCriteria: string,
  level: LoopLevel = 'L3',
): LoopState {
  return {
    goal,
    successCriteria,
    level,
    planApproval: 'pending',
    currentPhase: 'DEFINE',
    attemptCounts: { DEFINE: 0, PLAN: 0, BUILD: 0, VERIFY: 0, REVIEW: 0, SHIP: 0 },
    buildVerifyCycles: 0,
    blockedReason: null,
    updatedAt: Date.now(),
  };
}

// Headless seam: phases operate on plain snapshots, never on Zustand/React directly.
export interface LoopStoreSnapshot {
  tasks: Task[];
  agents: Agent[];
}

export type StoreAccessor = () => LoopStoreSnapshot;

// Deterministic exit checks — evidence-based, never agent assertion.
export function isDefineComplete(specExists: boolean, confirmed: boolean): boolean {
  return specExists && confirmed;
}

export function isPlanComplete(
  taskCount: number,
  allHaveCriteria: boolean,
  planApproval: LoopState['planApproval'],
): boolean {
  return taskCount > 0 && allHaveCriteria && planApproval === 'approved';
}

export function shouldEscalateSlice(retryCount: number): boolean {
  return retryCount >= MAX_SLICE_RETRIES;
}

export function shouldEscalateBuildVerify(cycles: number): boolean {
  return cycles >= MAX_BUILD_VERIFY_CYCLES;
}
