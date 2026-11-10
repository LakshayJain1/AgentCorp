import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getToken } from '@/lib/integrations/token-service';
import { getServerTool, listServerToolsAsOpenAI } from '@/lib/integrations/tools';
import { resolveWorkspace } from '@/lib/workspace';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const FALLBACK_MODEL = 'gemini-2.0-flash';
const FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent`;

const MAX_TOOL_TURNS = 3;

interface RequestBody {
  systemPrompt?: string;
  prompt: string;
  context?: Record<string, string>;
  action?: string;
  temperature?: number;
  model?: string;
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

  const tools = listServerToolsAsOpenAI();

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.model || 'openai/gpt-4o-mini',
        messages,
        temperature: body.temperature ?? 0.3,
        max_tokens: 4096,
        ...(tools.length > 0 ? { tools } : {}),
      }),
    });

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
        if (!tool) {
          result = `Error: unknown tool ${call.function.name}`;
        } else if (!workspaceId) {
          result = `Error: workspace not available for tool execution`;
        } else {
          let args: Record<string, string> = {};
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
              result = await tool.run(token, args);
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

export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.sub;

  try {
    const body: RequestBody = await req.json();

    // BYOK: desktop app sends the user's own key in x-byok-key header.
    // It takes precedence over server env vars so Vercel env never needed for desktop users.
    const byokKey = req.headers.get('x-byok-key') || '';

    if (body.action === 'check') {
      const hasKey = byokKey.length > 0 || OPENROUTER_API_KEY.length > 0 || GEMINI_API_KEY.length > 0;
      return NextResponse.json({
        available: hasKey,
        configured: hasKey,
        provider: byokKey.length > 0 ? 'byok' : OPENROUTER_API_KEY.length > 0 ? 'openrouter' : GEMINI_API_KEY.length > 0 ? 'gemini' : 'none',
        message: byokKey.length > 0
          ? 'Using your own API key'
          : OPENROUTER_API_KEY.length > 0
            ? 'OpenRouter API key is configured'
            : GEMINI_API_KEY.length > 0
              ? 'Gemini API key is configured (fallback)'
              : 'No API key set. Using mock AI responses.',
      });
    }

    // Resolve which key to use: BYOK > server OpenRouter > server Gemini
    const effectiveOpenRouterKey = byokKey.length > 0 ? byokKey : OPENROUTER_API_KEY;
    const hasOpenRouter = effectiveOpenRouterKey.length > 0;
    const hasGemini = GEMINI_API_KEY.length > 0;

    if (!hasOpenRouter && !hasGemini) {
      return NextResponse.json({
        content: null,
        error: 'No API key configured',
        mock: true,
      });
    }

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
