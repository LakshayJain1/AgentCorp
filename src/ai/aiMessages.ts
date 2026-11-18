/** Shown in chat in place of a made-up reply when the AI provider fails. */
export const AI_UNAVAILABLE_MESSAGE =
  '⚠️ The AI service is unavailable right now, so I can\'t give you a real answer. Please try again in a moment.';

/** True when a piece of text is that placeholder (so it can be kept out of places where it would read as the agent's words). */
export function isAiUnavailableText(text: string | undefined): boolean {
  return Boolean(text) && text!.includes('The AI service is unavailable right now');
}
