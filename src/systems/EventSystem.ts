import { useGameStore, createGameEvent } from '@/store/gameStore';

const CHATTER_MESSAGES = [
  'QA rejected the deployment.',
  'Research found 3 relevant documents.',
  'Engineer is debugging the API.',
  'Coffee levels critically low.',
  'Task completed successfully.',
  'Server load is looking good.',
  'New feature request came in.',
  'Code review in progress.',
  'Meeting scheduled for sprint planning.',
  'Database migration completed.',
  'Build pipeline is green.',
  'Customer reported a critical bug.',
  'Docs have been updated.',
  'Performance improved by 23%.',
  'Memory usage is stable.',
  'API response times are normal.',
  'New employee onboarding started.',
  'System health check passed.',
  'Nightly backup completed.',
];

const ENERGY_EVENTS = [
  '{name} is feeling drained.',
  '{name} needs coffee urgently.',
  '{name} is running on fumes.',
];

export function generateAmbientChatter(): void {
  const store = useGameStore.getState();
  if (store.simulation.paused) return;
  if (Math.random() > 0.03 * store.simulation.speed) return;

  const agents = store.agents;
  if (agents.length === 0) return;

  const agent = agents[Math.floor(Math.random() * agents.length)];
  const isLowEnergy = agent.energy < 30;
  const message = isLowEnergy
    ? ENERGY_EVENTS[Math.floor(Math.random() * ENERGY_EVENTS.length)].replace('{name}', agent.name)
    : CHATTER_MESSAGES[Math.floor(Math.random() * CHATTER_MESSAGES.length)];

  store.addEvent(
    createGameEvent('conversation', `${agent.emoji} ${agent.name}: ${message}`, agent.id),
  );
  store.sendMessage(agent.id, agent.id, message);
}

export function generateOfficeNoise(): string[] {
  const noises = [
    '💻 Keyboard clacking...',
    '☕ Coffee machine brewing...',
    '📞 Phone ringing in distance...',
    '🖨️ Printer humming...',
    '🔔 Slack notification...',
    '🌬️ AC hum...',
    '🖥️ Monitor flickering...',
    '📎 Paper shuffling...',
    '🚪 Door opens and closes...',
    '⚡ Server fans spinning...',
  ];
  const count = 1 + Math.floor(Math.random() * 3);
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    selected.push(noises[Math.floor(Math.random() * noises.length)]);
  }
  return selected;
}
