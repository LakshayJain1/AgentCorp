/**
 * Splits a brief that hands work to several named teammates ("Sam scopes the MVP, Jill researches the
 * market, ...") into one part per teammate. Pure and rule-based: no model call, so it costs nothing and
 * is easy to test.
 */

export interface BriefPart {
  agentName: string;
  /** What this teammate was asked to do, e.g. "researches the market and competitors". */
  text: string;
  /** True for the part that pulls the others together (a go/no-go, a final recommendation). */
  synthesis: boolean;
}

export interface TeamBrief {
  /** The shared idea / context that came before the first name. */
  context: string;
  /** Parts in run order: individual work first, the synthesis part last. */
  parts: BriefPart[];
}

const SYNTHESIS_RE = /\b(go\s*\/\s*no[- ]?go|recommend\w*|ties?\s+(?:it\s+)?(?:all\s+)?(?:together|into)|consolidat\w*|synthes\w*|sign[- ]off|final decision)\b/i;

const MIN_PART_CHARS = 8;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "scopes the MVP and launch plan, " -> "scopes the MVP and launch plan" */
function cleanSegment(s: string): string {
  return s
    .replace(/^[\s:,\-–—]+/, '')
    .replace(/[\s,;.]*(?:and|then|while)?[\s,;.]*$/i, '')
    .trim();
}

/**
 * Returns the split, or null when the message does not clearly assign work to two or more different
 * teammates (so ordinary requests, and messages that merely mention a name, are left alone).
 * Names are matched capitalised and whole-word, the way a person writes them.
 */
export function splitTeamBrief(request: string, agentNames: string[]): TeamBrief | null {
  const names = [...new Set(agentNames.map((n) => n.trim()).filter(Boolean))];
  if (names.length < 2) return null;

  const re = new RegExp(`\\b(${names.map(escapeRe).join('|')})\\b`, 'g');
  const hits: { name: string; start: number; end: number }[] = [];
  for (const m of request.matchAll(re)) {
    hits.push({ name: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[1].length });
  }
  if (new Set(hits.map((h) => h.name)).size < 2) return null;

  const byName = new Map<string, string[]>();
  hits.forEach((h, i) => {
    const next = hits[i + 1];
    const text = cleanSegment(request.slice(h.end, next ? next.start : request.length));
    if (text.length < MIN_PART_CHARS) return;
    byName.set(h.name, [...(byName.get(h.name) ?? []), text]);
  });
  if (byName.size < 2) return null;

  const parts: BriefPart[] = [...byName.entries()].map(([agentName, texts]) => {
    const text = texts.join('; ');
    return { agentName, text, synthesis: SYNTHESIS_RE.test(text) };
  });
  parts.sort((a, b) => Number(a.synthesis) - Number(b.synthesis));

  const context = request.slice(0, hits[0].start).replace(/[\s:,\-–—]+$/, '').trim();
  return { context, parts };
}

/** A short first sentence of the brief, used as the topic of web searches. */
export function briefTopic(context: string, maxChars = 160): string {
  const first = context.split(/(?<=[.!?])\s+/)[0] ?? context;
  return first.replace(/^business idea:\s*/i, '').slice(0, maxChars).trim();
}
