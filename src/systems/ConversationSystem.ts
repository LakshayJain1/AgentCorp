import { useGameStore, createGameEvent } from '@/store/gameStore';

// Random ambient conversations are disabled by design: agents only speak
// when grounded in a real task lifecycle event (assignment, subtask handoff,
// validation retry, completion). See announceTaskHandoff below. This function
// is kept as a no-op so existing tick-loop call sites don't break.
export async function maybeStartConversation(): Promise<void> {
  return;
}

// Track agents currently in conversations to prevent overlaps
const agentsInConversation = new Set<string>();

export function isAgentInConversation(agentId: string): boolean {
  return agentsInConversation.has(agentId);
}

/**
 * Task-grounded handoff message between two agents about a specific task.
 * Only call this from real lifecycle points (assignment, subtask dispatch,
 * validation retry, completion) — never on a timer.
 */
export function announceTaskHandoff(
  fromAgentId: string,
  toAgentId: string,
  taskTitle: string,
  kind: 'assigned' | 'subtask_complete' | 'validation_retry' | 'deliverable_ready',
): void {
  if (!fromAgentId || !toAgentId || fromAgentId === toAgentId) return;
  const store = useGameStore.getState();
  const fromAgent = store.agents.find((a) => a.id === fromAgentId);
  const toAgent = store.agents.find((a) => a.id === toAgentId);
  if (!fromAgent || !toAgent) return;

  const short = taskTitle.length > 60 ? `${taskTitle.slice(0, 60)}…` : taskTitle;
  const message =
    kind === 'assigned'
      ? `You've been assigned: "${short}". Starting work now.`
      : kind === 'subtask_complete'
        ? `Subtask for "${short}" done — handing off for validation.`
        : kind === 'validation_retry'
          ? `Validation flagged "${short}" — reworking now.`
          : `All work on "${short}" is done — deliverable ready for review.`;

  store.sendMessage(fromAgent.id, toAgent.id, message);
  store.addEvent(
    createGameEvent('conversation', `${fromAgent.emoji} ${fromAgent.name} → ${toAgent.name}: "${message}"`, fromAgent.id),
  );
}

export function updateAgentMoods(): void {
  const store = useGameStore.getState();
  for (const agent of store.agents) {
    let mood = agent.mood;
    if (agent.energy < 20) {
      mood = 'tired';
    } else if (agent.energy < 50) {
      mood = agent.efficiency > 70 ? 'neutral' : 'frustrated';
    } else if (agent.currentTaskId && agent.energy > 60) {
      mood = 'focused';
    } else if (agent.energy > 80) {
      mood = 'happy';
    }

    if (mood !== agent.mood) {
      store.updateAgent(agent.id, { mood });
    }
  }
}