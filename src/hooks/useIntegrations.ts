'use client';

import { useCallback, useEffect, useState } from 'react';

export interface IntegrationConnection {
  provider: string;
  accountId: string | null;
  scopes: string[];
  connectedAt: string;
  expiresAt: string | null;
}

export interface IntegrationProvider {
  id: string;
  label: string;
  scopes: string[];
}

export interface UseIntegrations {
  connections: IntegrationConnection[];
  providers: IntegrationProvider[];
  loading: boolean;
  error: string | null;
  code: string | null;
  refresh: () => Promise<void>;
  disconnect: (provider: string) => Promise<boolean>;
}

interface IntegrationsResponse {
  success?: boolean;
  connections?: IntegrationConnection[];
  providers?: IntegrationProvider[];
  error?: string;
  code?: string;
}

/**
 * Reads the server's integration state. This is the only source of truth for
 * "connected" — never localStorage.
 */
export function useIntegrations(): UseIntegrations {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as IntegrationsResponse | null;

      if (res.status === 401) {
        setError('Sign in to manage integrations.');
        setCode('unauthorized');
        setConnections([]);
        setProviders([]);
        return;
      }
      if (!res.ok || !data?.success) {
        setError(data?.error ?? `Could not load integrations (${res.status}).`);
        setCode(data?.code ?? 'load_failed');
        setConnections([]);
        setProviders([]);
        return;
      }

      setConnections(data.connections ?? []);
      setProviders(data.providers ?? []);
      setError(null);
      setCode(null);
    } catch {
      setError('Could not reach the integrations service.');
      setCode('network_error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetching from the integrations API is an external-system sync, not a
    // render loop; the rule's synchronous-setState warning does not apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const disconnect = useCallback(
    async (provider: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/integrations?provider=${encodeURIComponent(provider)}`, {
          method: 'DELETE',
        });
        const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
        if (!res.ok || !data?.success) {
          setError(data?.error ?? `Could not disconnect ${provider} (${res.status}).`);
          return false;
        }
        await refresh();
        return true;
      } catch {
        setError(`Could not disconnect ${provider}.`);
        return false;
      }
    },
    [refresh],
  );

  return { connections, providers, loading, error, code, refresh, disconnect };
}
