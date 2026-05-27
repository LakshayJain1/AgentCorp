import { useGameStore, createGameEvent } from '@/store/gameStore';
import { Agent } from '@/agents/AgentTypes';
import { aiService } from '@/ai/AIService';

const CONVERSATION_PAIRS = [
  { from: 'ceo', to: 'pm' },
  { from: 'pm', to: 'engineer' },
  { from: 'pm', to: 'researcher' },
  { from: 'engineer', to: 'qa' },
  { from: 'qa', to: 'engineer' },
  { from: 'researcher', to: 'pm' },
  { from: 'ceo', to: 'engineer' },
  { from: 'pm', to: 'qa' },
];

const MOCK_MESSAGES: Record<string, Record<string, string[]>> = {
  ceo: {
    pm: ["What's the sprint status?", "We need to ship this quarter.", 'Prioritize the critical tasks.', "Good work on the roadmap."],
    engineer: ['How is the new feature coming along?', 'Any technical debt we should address?'],
  },
  pm: {
    engineer: ['Can you estimate this task?', "The client needs an update.", "Let's scope this properly.", 'Any blockers I can help with?'],
    researcher: ['Research those competitors.', 'Found any new patterns?', 'Share your findings in the doc.', 'We need data on this.'],
    qa: ['What does the test coverage look like?', 'Can you run a regression suite?'],
  },
  engineer: {
    qa: ['PR is ready for review.', 'Fixed that edge case.', 'Can you test this branch?', 'Deployment should be clean now.'],
  },
  qa: {
    engineer: ['Found a regression here.', 'This test is flaky.', 'Edge case not handled.', 'Looks good to me!'],
  },
  researcher: {
    pm: ['Found interesting patterns.', 'The data supports our approach.', 'New framework discovered.', "Here's the analysis report."],
  },
};

export async function maybeStartConversation(): Promise<void> {
  const store = useGameStore.getState();
  if (store.simulation.paused) return;
  if (Math.random() > 0.02 * store.simulation.speed) return;

  const pair = CONVERSATION_PAIRS[Math.floor(Math.random() * CONVERSATION_PAIRS.length)];
  const fromAgent = store.agents.find((a) => a.role === pair.from);
  const toAgent = store.agents.find((a) => a.role === pair.to);

  if (!fromAgent || !toAgent) return;

  // Try AI first, fall back to mock
  const aiResponse = await aiService.askAgent(
    fromAgent.role, fromAgent.name, fromAgent.traits,
    `Start a brief conversation with ${toAgent.name} (${toAgent.role.toUpperCase()}). Keep it professional and work-related.`,
    { conversationPartner: toAgent.name, partnerRole: toAgent.role },
  );

  let message: string;
  if (aiResponse.content && !aiResponse.error) {
    message = aiResponse.content;
  } else {
    // Fallback to mock
    const fromMsgs = MOCK_MESSAGES[pair.from]?.[pair.to];
    message = fromMsgs?.[Math.floor(Math.random() * fromMsgs.length)] || `Hey ${toAgent.name}, how's it going?`;
  }

  store.addEvent(
    createGameEvent(
      'conversation',
      `${fromAgent.emoji} ${fromAgent.name} → ${toAgent.name}: "${message}"`,
      fromAgent.id,
    ),
  );

  store.sendMessage(fromAgent.id, toAgent.id, message);

  store.updateAgent(fromAgent.id, {
    state: 'communicating',
  });

  // The toAgent responds after a short delay
  setTimeout(async () => {
    const currentStore = useGameStore.getState();
    const updatedToAgent = currentStore.agents.find((a) => a.id === toAgent.id);
    if (updatedToAgent) {
      const replyResponse = await aiService.askAgent(
        toAgent.role, toAgent.name, toAgent.traits,
        `Reply briefly to this message from ${fromAgent.name} (${fromAgent.role.toUpperCase()}): "${message}". Keep your reply professional and work-related, 1 sentence.`,
        { conversationPartner: fromAgent.name, partnerRole: fromAgent.role },
      );
      const reply = (replyResponse.content && !replyResponse.error)
        ? replyResponse.content
        : 'Got it, thanks!';
      currentStore.sendMessage(toAgent.id, fromAgent.id, reply);
      currentStore.updateAgent(toAgent.id, { state: 'communicating' });
    }
  }, 2000);
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
