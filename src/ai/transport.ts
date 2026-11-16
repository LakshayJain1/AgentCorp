import { detectExecutorEnv } from '@/execution/ToolExecutor';
import type { AiBridge, AiStatus } from './byokTypes';

/**
 * Single door for every call to the AI.
 *
 *  - Hosted web app: POST /api/ai (shared server key), exactly as before.
 *  - Desktop app with the user's own key saved (BYOK): the request goes through the
 *    desktop shell, which sends it straight from this computer to the user's chosen
 *    provider. The key never reaches this page and never touches an AgentCorp server.
 *
 * Callers keep using the same request/response shapes they always did ({content},
 * `data: {"delta"}` streams), so nothing downstream needed to change.
 */

export const BYOK_CHANGED_EVENT = 'agentcorp-byok-changed';
export const BYOK_ERROR_EVENT = 'agentcorp-byok-error';

const STATUS_TTL_MS = 10_000;
let cache: { at: number; status: AiStatus | null } | null = null;
let lastError: string | null = null;

function bridge(): AiBridge | null {
  try {
    if (detectExecutorEnv() !== 'desktop') return null;
    const ai = typeof window !== 'undefined' ? window.electronAPI?.ai : undefined;
    return ai && typeof ai.run === 'function' && typeof ai.status === 'function' ? ai : null;
  } catch {
    return null;
  }
}

/** True when this shell can store a user key (desktop app of a recent enough version). */
export function byokSupported(): boolean {
  return bridge() !== null;
}

/** Saved-key status, or null on the web / on a shell without BYOK. Never contains the key. */
export async function getByokStatus(force = false): Promise<AiStatus | null> {
  const ai = bridge();
  if (!ai) return null;
  if (!force && cache && Date.now() - cache.at < STATUS_TTL_MS) return cache.status;
  try {
    const status = await ai.status();
    cache = { at: Date.now(), status };
    return status;
  } catch {
    cache = { at: Date.now(), status: null };
    return null;
  }
}

/** Call after the key/model changed so the next request picks it up immediately. */
export function notifyByokChanged(): void {
  cache = null;
  lastError = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BYOK_CHANGED_EVENT));
}

export function getLastByokError(): string | null {
  return lastError;
}

function reportError(message: string | undefined): void {
  if (!message || message === 'cancelled') return;
  lastError = message;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BYOK_ERROR_EVENT, { detail: message }));
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

interface AiBody {
  prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  action?: string;
}

export async function aiFetch(init: RequestInit & { needsServerTools?: boolean }): Promise<Response> {
  const { needsServerTools, ...rest } = init;
  const viaServer = () => fetch('/api/ai', { ...rest, headers: { 'Content-Type': 'application/json' } });

  // Requests that rely on the server's connector tools (Slack/Linear actions) can only run there.
  if (needsServerTools) return viaServer();
  const ai = bridge();
  if (!ai) return viaServer();
  const status = await getByokStatus();
  if (!status?.configured) return viaServer();

  let body: AiBody = {};
  try {
    body = JSON.parse(String(rest.body ?? '{}')) as AiBody;
  } catch {
    return viaServer();
  }

  if (body.action === 'check') {
    return Response.json({ available: true, configured: true, provider: 'byok', message: 'Using your own API key' });
  }
  if (typeof body.prompt !== 'string' || !body.prompt) return viaServer();

  const req = { prompt: body.prompt, system: body.systemPrompt, temperature: body.temperature, maxTokens: body.maxTokens };
  const signal = rest.signal ?? undefined;
  if (signal?.aborted) throw abortError();

  if (body.stream === true) {
    const enc = new TextEncoder();
    let run: ReturnType<AiBridge['run']> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const onAbort = () => {
          run?.cancel();
          if (!closed) {
            closed = true;
            controller.error(abortError());
          }
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        run = ai.run({ ...req, stream: true }, (delta) => {
          if (!closed) controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        });
        void run.result.then((r) => {
          signal?.removeEventListener('abort', onAbort);
          if (closed) return;
          closed = true;
          if (!r.ok) {
            reportError(r.error);
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: r.error ?? 'AI request failed' })}\n\n`));
          }
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        });
      },
      cancel() {
        run?.cancel();
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
  }

  const run = ai.run(req);
  const onAbort = () => run.cancel();
  signal?.addEventListener('abort', onAbort, { once: true });
  const r = await run.result;
  signal?.removeEventListener('abort', onAbort);
  if (signal?.aborted) throw abortError();
  if (!r.ok || !r.content) {
    reportError(r.error);
    return Response.json({ content: null, error: r.error ?? 'AI request failed' }, { status: 502 });
  }
  return Response.json({ content: r.content.trim(), toolCalls: [] });
}
