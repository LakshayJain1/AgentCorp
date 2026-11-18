/**
 * Decides HOW a missing credential is asked for.
 *
 * - Providers that exist in the Integrations tab (OAuth) are never asked for as a
 *   pasted token: the user is sent to that tab, and the task resumes when the
 *   server reports the provider connected.
 * - Anything else (cloud, database, Stripe, ...) still gets the paste prompt.
 */

export interface CredKey {
  key: string;
  label: string;
  reason: string;
}

/** Providers that can be connected from the Integrations tab. Keep in sync with the server registry. */
export const INTEGRATION_PROVIDER_IDS = ['github', 'slack', 'linear', 'vercel', 'notion'] as const;

/** Catch-all keys matched by loose words ("login", "token", "plugin"); noise once a specific provider is known. */
const GENERIC_KEYS = new Set(['api_credentials', 'mcp_credentials']);

/** `github_token`, `slack_webhook`, `linear_connection`... -> the Integrations-tab provider, or null. */
export function providerForKey(key: string): string | null {
  const prefix = key.split('_')[0];
  return (INTEGRATION_PROVIDER_IDS as readonly string[]).includes(prefix) ? prefix : null;
}

export interface RoutedKeys {
  /** Integrations-tab providers the user must connect (deduped, not yet connected). */
  integrations: string[];
  /** Real secrets that still need a pasted value. */
  secrets: CredKey[];
}

export function routeCredentialKeys(keys: CredKey[], connected: string[]): RoutedKeys {
  const integrations: string[] = [];
  const secrets: CredKey[] = [];
  for (const k of keys) {
    const provider = providerForKey(k.key);
    if (provider) {
      if (!connected.includes(provider) && !integrations.includes(provider)) integrations.push(provider);
      continue; // connected providers need nothing at all
    }
    if (secrets.some((s) => s.key === k.key)) continue;
    secrets.push(k);
  }
  return {
    integrations,
    secrets: integrations.length > 0 ? secrets.filter((s) => !GENERIC_KEYS.has(s.key)) : secrets,
  };
}
