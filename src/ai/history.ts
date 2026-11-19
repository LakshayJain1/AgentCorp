export interface ChatTurn {
  role: 'user' | 'agent';
  text: string;
}

/**
 * Keeps only the last few turns and shortens each one, so every prompt that carries conversation
 * history costs a bounded number of tokens no matter how long the chat has run.
 * The newest turn is never shortened below `maxChars`, and a cut turn ends with an ellipsis so the model
 * can tell it was shortened rather than reading a half sentence as complete.
 */
export function trimHistory(history: ChatTurn[] | undefined, opts: { maxMessages?: number; maxChars?: number } = {}): ChatTurn[] {
  const maxMessages = opts.maxMessages ?? 4;
  const maxChars = opts.maxChars ?? 300;
  if (!history || history.length === 0) return [];
  return history
    .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
    .slice(-maxMessages)
    .map((m) => ({ role: m.role, text: m.text.length > maxChars ? `${m.text.slice(0, maxChars).trimEnd()}…` : m.text }));
}
