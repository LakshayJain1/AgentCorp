import { aiHeaders } from './headers';
import { getTestModel } from '@/engine/model';
import { aiFetch } from '@/ai/transport';

export interface StreamResult {
  ok: boolean;
  text: string;
  error?: string;
}

/**
 * Streams a completion from /api/ai (SSE) and calls onDelta for each token
 * chunk. Resolves with the full text. Never throws: callers get {ok:false}
 * and decide how to degrade (e.g. fall back to a templated summary).
 *
 * Mock mode (no server key and no BYOK key) answers with JSON instead of SSE;
 * that is reported as an error so the caller can use its own fallback text.
 */
export async function streamAI(opts: {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}): Promise<StreamResult> {
  let full = '';
  // Dev/test seam: replay a scripted answer as a stream (see engine/model.ts).
  const hook = getTestModel();
  if (hook) {
    const text = await hook({ label: 'summary', system: opts.systemPrompt, prompt: opts.prompt });
    for (const part of String(text).match(/\S+\s*/g) ?? []) {
      if (opts.signal?.aborted) return { ok: false, text: full, error: 'aborted' };
      full += part;
      opts.onDelta(part);
      await new Promise((r) => setTimeout(r, 15));
    }
    return { ok: true, text: full };
  }
  try {
    const res = await aiFetch({
      method: 'POST',
      headers: await aiHeaders(),
      body: JSON.stringify({
        prompt: opts.prompt,
        systemPrompt: opts.systemPrompt,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        stream: true,
      }),
      signal: opts.signal,
    });
    if (!res.ok) return { ok: false, text: '', error: `http ${res.status}` };

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/event-stream') || !res.body) {
      const data = (await res.json().catch(() => null)) as { content?: string | null; error?: string } | null;
      if (data?.content) {
        opts.onDelta(data.content);
        return { ok: true, text: data.content };
      }
      return { ok: false, text: '', error: data?.error ?? 'no content' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamError: string | undefined;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload) as { delta?: string; error?: string };
          if (typeof evt.delta === 'string' && evt.delta) {
            full += evt.delta;
            opts.onDelta(evt.delta);
          } else if (evt.error) {
            streamError = evt.error;
          }
        } catch { /* ignore malformed frame */ }
      }
    }
    if (!full) return { ok: false, text: '', error: streamError ?? 'empty stream' };
    return { ok: true, text: full };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return { ok: false, text: full, error: aborted ? 'aborted' : String(err) };
  }
}
