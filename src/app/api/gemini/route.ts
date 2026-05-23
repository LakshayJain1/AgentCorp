import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface RequestBody {
  systemPrompt?: string;
  prompt: string;
  context?: Record<string, string>;
  action?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();

    if (body.action === 'check') {
      return NextResponse.json({
        available: true,
        configured: GEMINI_API_KEY.length > 0,
        message: GEMINI_API_KEY.length > 0
          ? 'Gemini API key is configured'
          : 'No API key set. Using mock AI responses.',
      });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        content: null,
        error: 'API key not configured',
        mock: true,
      });
    }

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

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 150,
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
      return NextResponse.json({
        content: null,
        error: `Gemini API error: ${response.status}`,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Gemini route error:', error);
    return NextResponse.json({
      content: null,
      error: 'Internal server error',
    });
  }
}
