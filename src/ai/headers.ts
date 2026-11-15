import { detectExecutorEnv } from '@/execution/ToolExecutor';

/**
 * Headers for calls to /api/ai. On the desktop app the user's own key (BYOK,
 * stored encrypted by the OS keystore and never sent anywhere but this call's
 * header) takes precedence over the shared server key, so heavy agent loops
 * don't burn the shared quota.
 */
export async function getByokKey(): Promise<string | null> {
  try {
    if (detectExecutorEnv() !== 'desktop') return null;
    const api = typeof window !== 'undefined' ? window.electronAPI?.apiKey : undefined;
    if (!api) return null;
    return (await api.get('openrouter')) || (await api.get('gemini')) || null;
  } catch {
    return null;
  }
}

export async function aiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = await getByokKey();
  if (key) headers['x-byok-key'] = key;
  return headers;
}
