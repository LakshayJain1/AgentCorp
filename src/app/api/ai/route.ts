import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { getToken } from '@/lib/integrations/token-service';
import { getServerTool, listServerToolsAsOpenAI } from '@/lib/integrations/tools';
import { resolveWorkspace } from '@/lib/workspace';
import { postWithFallback, resolveModels } from '@/lib/ai/openrouterFallback';

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

async function callOpenRouter(
  body: RequestBody,
  userId: string,
  workspaceId: string | null,
  apiKey: string = OPENROUTER_API_KEY,
): Promise<{ content: string | null; toolCalls: ToolCallResult[] }> {
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

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const { response, model, skipped } = await postWithFallback(
      fetch,
      API_URL,
      { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      {
        messages,
        temperature: body.temperature ?? 0.3,
        max_tokens: Math.min(body.maxTokens ?? 4096, 4096),
        ...(tools.length > 0 ? { tools } : {}),
      },
      resolveModels(body.model, MODELS_ENV),
    );
    if (skipped.length > 0) console.warn(`[ai] ${skipped.map((k) => `${k.model} ${k.status}`).join(', ')} -> answered by ${model}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return { content: null, toolCalls: executed };
    }

    const data = await response.json();
    const choiceMessage = data?.choices?.[0]?.message as OpenRouterMessage | undefined;
    if (!choiceMessage) return { content: null, toolCalls: executed };

    messages.push(choiceMessage);

    const toolCalls = choiceMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { content: choiceMessage.content || null, toolCalls: executed };
    }

    // Process tool calls in parallel using the caller's server-decrypted token
    await Promise.all(
      toolCalls.map(async (call) => {
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
  return { content: lastAssistant?.content || null, toolCalls: executed };
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
 * Streams plain assistant text from OpenRouter as SSE `{delta}` events.
 * Server-side integration tools are intentionally not offered here: this path
 * is for summaries and chat replies, where we want tokens on screen quickly.
 * Falls back to Gemini (single delta) if OpenRouter is unavailable.
 */
function streamCompletion(body: RequestBody, openRouterKey: string): Response {
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
        if (openRouterKey) {
          const { response: upstream } = await postWithFallback(
            fetch,
            API_URL,
            { 'Content-Type': 'application/json', Authorization: `Bearer ${openRouterKey}` },
            { messages, temperature: body.temperature ?? 0.3, max_tokens: body.maxTokens ?? 1024, stream: true },
            resolveModels(body.model, MODELS_ENV),
          );
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
            console.error('OpenRouter stream error:', upstream.status, await upstream.text().catch(() => ''));
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

    if (body.action === 'check') {
      const hasKey = OPENROUTER_API_KEY.length > 0 || GEMINI_API_KEY.length > 0;
      return NextResponse.json({
        available: hasKey,
        configured: hasKey,
        provider: OPENROUTER_API_KEY.length > 0 ? 'openrouter' : GEMINI_API_KEY.length > 0 ? 'gemini' : 'none',
        message: OPENROUTER_API_KEY.length > 0
          ? 'OpenRouter API key is configured'
          : GEMINI_API_KEY.length > 0
            ? 'Gemini API key is configured (fallback)'
            : 'No API key set. Using mock AI responses.',
      });
    }

    // Server keys only: OpenRouter, then Gemini as the fallback.
    const effectiveOpenRouterKey = OPENROUTER_API_KEY;
    const hasOpenRouter = effectiveOpenRouterKey.length > 0;
    const hasGemini = GEMINI_API_KEY.length > 0;

    if (!hasOpenRouter && !hasGemini) {
      return NextResponse.json({
        content: null,
        error: 'No API key configured',
        mock: true,
      });
    }

    if (body.stream === true) return streamCompletion(body, hasOpenRouter ? effectiveOpenRouterKey : '');

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

    if (hasOpenRouter) {
      const result = await callOpenRouter(body, userId, workspaceId, effectiveOpenRouterKey);
      content = result.content;
      toolCalls = result.toolCalls;
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

    return NextResponse.json({ content: content.trim(), toolCalls });
  } catch (error) {
    console.error('AI route error:', error);
    return NextResponse.json({
      content: null,
      error: 'Internal server error',
    });
  }
}
