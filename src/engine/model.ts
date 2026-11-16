import { aiService } from '@/ai/AIService';
import { aiHeaders } from '@/ai/headers';
import { aiFetch } from '@/ai/transport';

/**
 * Single entry point for non-streaming model calls made by the engine
 * (agent loop, criteria generation, QA judge).
 *
 * Server-side integration tools are disabled on these calls (`noTools`): in the
 * loop every external action must go through our own approval gate, so the
 * model must not be able to trigger Slack/Linear tools inside /api/ai on its own.
 *
 * Test seam (non-production builds only): set
 *   window.__AGENTCORP_TEST_MODEL__ = ({label, system, prompt}) => string
 * to script the model deterministically in browser tests. `label` is one of
 * 'loop' | 'criteria' | 'judge' | 'summary'.
 */

export type ModelLabel = 'loop' | 'criteria' | 'judge' | 'summary';

export interface TestModelRequest {
  label: ModelLabel;
  system?: string;
  prompt: string;
}
export type TestModelFn = (req: TestModelRequest) => string | Promise<string>;

declare global {
  interface Window {
    __AGENTCORP_TEST_MODEL__?: TestModelFn;
  }
}

export function getTestModel(): TestModelFn | null {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    return typeof window !== 'undefined' && typeof window.__AGENTCORP_TEST_MODEL__ === 'function'
      ? window.__AGENTCORP_TEST_MODEL__
      : null;
  } catch {
    return null;
  }
}

export async function modelAvailable(): Promise<boolean> {
  if (getTestModel()) return true;
  return aiService.checkApiKey();
}

export async function callModel(opts: {
  label: ModelLabel;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string | null> {
  const hook = getTestModel();
  if (hook) {
    const out = await hook({ label: opts.label, system: opts.system, prompt: opts.prompt });
    return typeof out === 'string' ? out : null;
  }
  try {
    const res = await aiFetch({
      method: 'POST',
      headers: await aiHeaders(),
      body: JSON.stringify({
        systemPrompt: opts.system,
        prompt: opts.prompt,
        temperature: opts.temperature ?? 0.2,
        maxTokens: opts.maxTokens,
        noTools: true,
      }),
      signal: opts.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { content?: string | null } | null;
    return data?.content ?? null;
  } catch {
    return null;
  }
}
