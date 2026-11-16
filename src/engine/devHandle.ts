import { useGameStore } from '@/store/gameStore';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';
import { useRunStore } from './runEvents';
import { useApprovalStore } from './approvals';
import { useQuestionStore } from './questions';
import { useActiveRuns } from './runControl';
import { wipeRunStorage } from './runPersistence';

/**
 * Development/test handle: window.__agentcorp. Lets browser tests (and a human
 * in the console) inspect the engine and drive it without clicking through the
 * UI. Never installed in production builds.
 */
export function installDevHandle(getStatus: () => unknown): void {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
  (window as unknown as { __agentcorp?: unknown }).__agentcorp = {
    engine: getStatus,
    game: useGameStore,
    runs: useRunStore,
    approvals: useApprovalStore,
    questions: useQuestionStore,
    active: useActiveRuns,
    orchestrator: centralOrchestrator,
    wipeRunStorage,
  };
}
