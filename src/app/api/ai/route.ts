import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { getToken } from '@/lib/integrations/token-service';
import { getServerTool, listServerToolsAsOpenAI } from '@/lib/integrations/tools';
import { resolveWorkspace } from '@/lib/workspace';
import { postWithFallback, resolveModels } from '@/lib/ai/openrouterFallback';
import { GROQ_URL, boostedCap, firstCap, groqExtras, groqModels, isTier, retryDelayMs, type ModelTier } from '@/lib/ai/groq';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Which OpenRouter model(s) answer when the caller does not name one. Unset = the paid default. A local
// .env.local can list free ":free" models, comma-separated: if one is rate-limited the next is tried.
// Production keeps its own environment untouched.
const MODELS_ENV = process.env.OPENROUTER_MODEL;

// The "-latest" alias keeps working when Google retires a specific model (gemini-2.0-flash 404'd in prod).
// Override with GEMINI_MODEL to pin one.
const FALLBACK_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent`;

const MAX_TOOL_TURNS = 3;

interface RequestBody {
  systemPrompt?: string;
  prompt: string;
  context?: Record<string, string>;
  action?: string;
  temperature?: number;
  model?: string;
  /** When true the response is a text/event-stream of `{delta}` events instead of JSON. */
  stream?: boolean;
  maxTokens?: number;
  /** Don't offer server-side integration tools (the agent loop gates those itself). */
  noTools?: boolean;
  /** 'small' for routing/chat/criteria, 'large' (default) for real work. Only Groq distinguishes them. */
  tier?: ModelTier;
}

/** One OpenAI-compatible chat endpoint the route can call. */
interface ChatProvider {
  name: 'groq' | 'openrouter';
  url: string;
  key: string;
  models: string[];
  /** Fields added to every request body (output cap, reasoning effort...). */
  payload: (cap: number) => Record<string, unknown>;
}

function groqProvider(body: RequestBody): ChatProvider {
  const models = groqModels(isTier(body.tier) ? body.tier : 'large');
  return {
    name: 'groq',
    url: GROQ_URL,
    key: GROQ_API_KEY,
    models,
    payload: (cap) => ({ max_completion_tokens: cap, ...groqExtras(models) }),
  };
}

function openRouterProvider(body: RequestBody, key: string = OPENROUTER_API_KEY): ChatProvider {
  return {
    name: 'openrouter',
    url: API_URL,
    key,
    models: resolveModels(body.model, MODELS_ENV),
    payload: (cap) => ({ max_tokens: cap }),
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * POST with the provider's models in order. One short wait-and-retry on a 429 that carries a small
 * retry-after (Groq limits are per minute), never a retry loop.
 */
async function postChat(provider: ChatProvider, payload: Record<string, unknown>) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` };
  let out = await postWithFallback(fetch, provider.url, headers, payload, provider.models);
  if (out.response.status === 429) {
    const wait = retryDelayMs(out.response.headers);
    if (wait !== null) {
      await out.response.text().catch(() => '');
      await sleep(wait);
      out = await postWithFallback(fetch, provider.url, headers, payload, provider.models);
    }
  }
  return out;
}

interface ToolCallResult {
  id: string;
  name: string;
  args: Record<string, string>;
  result: string;
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface ChatResult {
  content: string | null;
  toolCalls: ToolCallResult[];
  /** True when the final reply was still cut off by the output limit after one larger retry. */
  truncated?: boolean;
  usage?: { model: string; promptTokens: number; completionTokens: number };
}

async function callChat(
  provider: ChatProvider,
  body: RequestBody,
  userId: string,
  workspaceId: string | null,
): Promise<ChatResult> {
  const messages: OpenRouterMessage[] = [];
  const executed: ToolCallResult[] = [];

  if (body.systemPrompt) {
    const contextStr = body.context
      ? `\n\nAdditional context:\n${Object.entries(body.context).map(([k, v]) => `${k}: ${v}`).join('\n')}`
      : '';
    messages.push({ role: 'system', content: body.systemPrompt + contextStr });
  }

  messages.push({ role: 'user', content: body.prompt });

  const tools = body.noTools ? [] : listServerToolsAsOpenAI();
  let cap = firstCap(body.maxTokens);
  let retriedLength = false;
  let truncated = false;
  let usage: ChatResult['usage'];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const { response, model, skipped } = await postChat(provider, {
      messages,
      temperature: body.temperature ?? 0.3,
      ...provider.payload(cap),
      ...(tools.length > 0 ? { tools } : {}),
    });
    if (skipped.length > 0) console.warn(`[ai] ${skipped.map((k) => `${k.model} ${k.status}`).join(', ')} -> answered by ${model}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${provider.name} API error:`, response.status, errorText);
      return { content: null, toolCalls: executed };
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const choiceMessage = choice?.message as OpenRouterMessage | undefined;
    if (!choiceMessage) return { content: null, toolCalls: executed };

    const u = data?.usage;
    if (u) {
      usage = { model, promptTokens: Number(u.prompt_tokens) || 0, completionTokens: Number(u.completion_tokens) || 0 };
      console.log(`[ai] ${provider.name} ${model} tier=${body.tier ?? 'large'} in=${usage.promptTokens} out=${usage.completionTokens} finish=${choice?.finish_reason ?? '?'}`);
    }

    const toolCalls = choiceMessage.tool_calls;
    const hasTools = !!toolCalls && toolCalls.length > 0;

    // A reply cut off by the output cap (reasoning models can use most of it before answering) is retried once
    // with a larger cap instead of being passed on half-written (a truncated JSON plan or deliverable breaks downstream).
    if (choice?.finish_reason === 'length' && !hasTools) {
      if (!retriedLength && cap < boostedCap(cap)) {
        retriedLength = true;
        cap = boostedCap(cap);
        turn--;
        continue;
      }
      truncated = true;
    }

    messages.push(choiceMessage);

    if (!hasTools) {
      return { content: choiceMessage.content || null, toolCalls: executed, truncated: truncated || undefined, usage };
    }

    // Process tool calls in parallel using the caller's server-decrypted token
    await Promise.all(
      toolCalls!.map(async (call) => {
        const tool = getServerTool(call.function.name);
        let result = '';
        let args: Record<string, string> = {};
        if (!tool) {
          result = `Error: unknown tool ${call.function.name}`;
        } else if (!workspaceId) {
          result = `Error: workspace not available for tool execution`;
        } else {
          try {
            args = JSON.parse(call.function.arguments || '{}') as Record<string, string>;
          } catch {
            args = {};
          }
          try {
            const token = await getToken(userId, workspaceId, tool.provider);
            if (!token) {
              result = `Error: ${tool.provider} is not connected. Connect it in Integrations tab.`;
            } else {
              result = await tool.run(token, args, { workspaceId });
            }
          } catch (e) {
            result = `Error executing tool: ${e instanceof Error ? e.message : String(e)}`;
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result,
        });
        // Report what actually ran so the UI can show it (this array used to stay empty).
        executed.push({ id: call.id, name: call.function.name, args, result });
      }),
    );
  }

  // Fallback: return the latest assistant content if max turns reached
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  return { content: lastAssistant?.content || null, toolCalls: executed, truncated: truncated || undefined, usage };
}

async function callGeminiFallback(body: RequestBody): Promise<string | null> {
  const contextStr = body.context
    ? `\n\nAdditional context:\n${Object.entries(body.context).map(([k, v]) => `${k}: ${v}`).join('\n')}`
    : '';

  const contents = [];
  if (body.systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `${body.systemPrompt}\n\nRemember my role and personality when responding.${contextStr}` }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I will respond in character as my assigned role.' }],
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: body.prompt }],
  });

  const response = await fetch(`${FALLBACK_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: body.temperature ?? 0.3,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

const encoder = new TextEncoder();
const sse = (obj: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

/**
 * Streams plain assistant text as SSE `{delta}` events from the first configured provider that answers
 * (Groq, then OpenRouter), then Gemini as a single delta.
 * Server-side integration tools are intentionally not offered here: this path
 * is for summaries and chat replies, where we want tokens on screen quickly.
 */
function streamCompletion(body: RequestBody, providers: ChatProvider[]): Response {
  const messages: OpenRouterMessage[] = [];
  if (body.systemPrompt) {
    const contextStr = body.context
      ? `\n\nAdditional context:\n${Object.entries(body.context).map(([k, v]) => `${k}: ${v}`).join('\n')}`
      : '';
    messages.push({ role: 'system', content: body.systemPrompt + contextStr });
  }
  messages.push({ role: 'user', content: body.prompt });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        for (const provider of providers) {
          if (sent) break;
          const { response: upstream } = await postChat(provider, {
            messages,
            temperature: body.temperature ?? 0.3,
            ...provider.payload(Math.min(body.maxTokens ?? 1024, 4096)),
            stream: true,
          });
          if (upstream.ok && upstream.body) {
            const reader = upstream.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
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
                  const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
                  if (typeof delta === 'string' && delta.length > 0) {
                    controller.enqueue(sse({ delta }));
                    sent = true;
                  }
                } catch { /* keep-alive comments / partial JSON */ }
              }
            }
          } else {
            console.error(`${provider.name} stream error:`, upstream.status, await upstream.text().catch(() => ''));
          }
        }
        if (!sent && GEMINI_API_KEY) {
          const text = await callGeminiFallback(body);
          if (text) { controller.enqueue(sse({ delta: text.trim() })); sent = true; }
        }
        if (!sent) controller.enqueue(sse({ error: 'AI provider returned empty response' }));
      } catch (err) {
        console.error('AI stream error:', err);
        controller.enqueue(sse({ error: 'stream failed' }));
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: RequestBody = await req.json();

    // BYOK keys are never accepted here: the desktop app calls the provider directly from the
    // user's computer (desktop/ai-providers.js), so a user's key never reaches this server.

    const hasGroq = GROQ_API_KEY.length > 0;
    const hasOpenRouter = OPENROUTER_API_KEY.length > 0;
    const hasGemini = GEMINI_API_KEY.length > 0;

    if (body.action === 'check') {
      const hasKey = hasGroq || hasOpenRouter || hasGemini;
      return NextResponse.json({
        available: hasKey,
        configured: hasKey,
        provider: hasGroq ? 'groq' : hasOpenRouter ? 'openrouter' : hasGemini ? 'gemini' : 'none',
        message: hasGroq
          ? 'Groq API key is configured'
          : hasOpenRouter
            ? 'OpenRouter API key is configured'
            : hasGemini
              ? 'Gemini API key is configured (fallback)'
              : 'No API key set. Using mock AI responses.',
      });
    }

    // Server keys only, in order: Groq, OpenRouter, then Gemini as the last fallback.
    const providers: ChatProvider[] = [];
    if (hasGroq) providers.push(groqProvider(body));
    if (hasOpenRouter) providers.push(openRouterProvider(body));

    if (providers.length === 0 && !hasGemini) {
      return NextResponse.json({
        content: null,
        error: 'No API key configured',
        mock: true,
      });
    }

    if (body.stream === true) return streamCompletion(body, providers);

    // Resolve the caller's workspace once so provider tools can fetch their
    // decrypted token. Absent DB config is handled by getToken -> 503.
    let workspaceId: string | null = null;
    try {
      workspaceId = await resolveWorkspace(userId);
    } catch {
      workspaceId = null;
    }

    let content: string | null = null;
    let toolCalls: ToolCallResult[] = [];
    let truncated: boolean | undefined;
    let usage: ChatResult['usage'];

    for (const provider of providers) {
      const result = await callChat(provider, body, userId, workspaceId);
      content = result.content;
      toolCalls = result.toolCalls;
      truncated = result.truncated;
      usage = result.usage;
      if (content) break;
    }

    if (!content && hasGemini) {
      content = await callGeminiFallback(body);
    }

    if (!content) {
      return NextResponse.json({
        content: null,
        error: 'AI provider returned empty response',
        mock: true,
      });
    }

    return NextResponse.json({ content: content.trim(), toolCalls, ...(truncated ? { truncated } : {}), ...(usage ? { usage } : {}) });
  } catch (error) {
    console.error('AI route error:', error);
    return NextResponse.json({
      content: null,
      error: 'Internal server error',
    });
  }
}
