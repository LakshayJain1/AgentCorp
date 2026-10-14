import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const FALLBACK_MODEL = 'gemini-2.0-flash';
const FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent`;

interface RequestBody {
  systemPrompt?: string;
  prompt: string;
  context?: Record<string, string>;
  action?: string;
  temperature?: number;
  model?: string;
}

async function callOpenRouter(body: RequestBody, apiKey: string = OPENROUTER_API_KEY): Promise<string | null> {
  const messages: { role: string; content: string }[] = [];

  if (body.systemPrompt) {
    const contextStr = body.context
      ? `\n\nAdditional context:\n${Object.entries(body.context).map(([k, v]) => `${k}: ${v}`).join('\n')}`
      : '';
    messages.push({ role: 'system', content: body.systemPrompt + contextStr });
  }

  messages.push({ role: 'user', content: body.prompt });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: body.model || 'openai/gpt-4o-mini',
      messages,
      temperature: body.temperature ?? 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter API error:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
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

    let content: string | null = null;

    if (hasOpenRouter) {
      content = await callOpenRouter(body, effectiveOpenRouterKey);
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

    return NextResponse.json({ content: content.trim() });
  } catch (error) {
    console.error('AI route error:', error);
    return NextResponse.json({
      content: null,
      error: 'Internal server error',
    });
  }
}
