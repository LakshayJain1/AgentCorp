/**
 * Guards the `action` intent. The LLM classifier is told that "action" is only
 * valid when the relevant integration is connected, but it ignores that (e.g.
 * "deploy my app to Vercel" with Vercel disconnected). This is a deterministic
 * check on top of its answer.
 */

/** Integrations an `action` can run against, with the words that name them. */
const PROVIDER_NAMES: Record<string, RegExp> = {
  linear: /\blinear\b/i,
  slack: /\bslack\b/i,
  vercel: /\bvercel\b/i,
  github: /\b(github|git\s*hub)\b/i,
  notion: /\bnotion\b/i,
};

export const PROVIDER_LABELS: Record<string, string> = {
  linear: 'Linear',
  slack: 'Slack',
  vercel: 'Vercel',
  github: 'GitHub',
  notion: 'Notion',
};

/** Integrations the user's message names explicitly. */
export function providersMentioned(text: string): string[] {
  return Object.entries(PROVIDER_NAMES)
    .filter(([, re]) => re.test(text))
    .map(([id]) => id);
}

export interface ActionGuardResult {
  /** True when the action cannot run and should become `needs_credentials`. */
  downgrade: boolean;
  /** Named integrations that are not connected (what the user needs to connect). */
  missing: string[];
}

/**
 * An action can run when at least one integration it names is connected. If it
 * names none, it can run only if something is connected at all.
 */
export function guardAction(text: string, connected: string[]): ActionGuardResult {
  const mentioned = providersMentioned(text);
  const missing = mentioned.filter((p) => !connected.includes(p));
  if (mentioned.length > 0) {
    return { downgrade: !mentioned.some((p) => connected.includes(p)), missing };
  }
  return { downgrade: connected.length === 0, missing: [] };
}
