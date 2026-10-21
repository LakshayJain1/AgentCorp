'use server';

export interface ScrumYesterdayItem {
  title: string;
  status: 'done' | 'failed';
}

export interface ScrumResult {
  yesterday: ScrumYesterdayItem[];
  today: string[];
  blockers: string[];
}

interface ScrumInput {
  companyName: string;
  companyProduct: string;
  completedTasks: string[];
  failedTasks: string[];
  blockedTasks: string[];
}

export async function generateDailyScrumTasks(input: ScrumInput): Promise<ScrumResult> {
  const yesterday: ScrumYesterdayItem[] = [
    ...input.completedTasks.map((t) => ({ title: t, status: 'done' as const })),
    ...input.failedTasks.map((t) => ({ title: t, status: 'failed' as const })),
  ];

  const fallback: ScrumResult = {
    yesterday,
    today: [
      `Build core features for ${input.companyProduct}`,
      'Write and run unit tests',
      'Review open pull requests',
      'Fix bugs from previous sprint',
      'Update documentation',
    ],
    blockers: input.blockedTasks,
  };

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const res = await fetch(`${baseUrl}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: `You are the PM at ${input.companyName || 'our company'}, building ${input.companyProduct || 'our product'}. You run the daily standup. Respond ONLY with valid JSON — no markdown fences, no extra text.`,
        prompt: `Yesterday completed: ${input.completedTasks.length ? input.completedTasks.join(' | ') : 'nothing yet'}
Yesterday failed: ${input.failedTasks.length ? input.failedTasks.join(' | ') : 'none'}
Currently blocked: ${input.blockedTasks.length ? input.blockedTasks.join(' | ') : 'none'}

Based on this, generate today's sprint. Return exactly:
{"today":["task 1","task 2","task 3","task 4","task 5"],"blockers":["blocker if any"]}

Rules:
- Re-queue failed tasks with a fresh approach if relevant
- Build follow-on work from completed tasks
- Tasks should be short actionable titles (≤8 words) specific to ${input.companyProduct}
- 5 tasks exactly`,
        temperature: 0.75,
      }),
    });

    if (!res.ok) return fallback;

    const data = await res.json();
    if (!data.content) return fallback;

    // Strip accidental markdown fences
    let raw = (data.content as string).trim();
    if (raw.startsWith('```')) raw = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(raw) as { today: string[]; blockers: string[] };
    return {
      yesterday,
      today: Array.isArray(parsed.today) ? parsed.today.slice(0, 8) : fallback.today,
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers : input.blockedTasks,
    };
  } catch {
    return fallback;
  }
}
