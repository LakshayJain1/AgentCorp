import 'server-only';

import { githubProvider } from './providers/github';
import { linearProvider } from './providers/linear';
import { slackProvider } from './providers/slack';
import type { ProviderAdapter, ProviderId } from './providers/types';

/**
 * Only implemented providers are listed. Adding one here is the single
 * registration point for OAuth, the integrations API, and the tool gateway.
 */
const ADAPTERS: Partial<Record<ProviderId, ProviderAdapter>> = {
  github: githubProvider,
  slack: slackProvider,
  linear: linearProvider,
};

export function getProvider(id: string): ProviderAdapter | null {
  return (ADAPTERS as Record<string, ProviderAdapter | undefined>)[id] ?? null;
}

export function listProviders(): ProviderAdapter[] {
  return Object.values(ADAPTERS).filter((a): a is ProviderAdapter => Boolean(a));
}

export function isProviderId(id: string): id is ProviderId {
  return Boolean(getProvider(id));
}
