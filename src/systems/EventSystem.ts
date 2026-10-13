// Ambient office chatter is disabled by design: agents only speak when
// grounded in a real task lifecycle event (assignment, subtask handoff,
// validation retry, completion). This function is kept as a no-op so
// existing tick-loop call sites don't break.
export function generateAmbientChatter(): void {
  return;
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
