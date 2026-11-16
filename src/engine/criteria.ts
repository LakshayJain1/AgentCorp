import type { CriterionResult } from './runEvents';
import { callModel } from './model';
import { extractJsonArray, extractJsonObject } from './json';

/**
 * Acceptance criteria (C6) and independent verification (C7).
 *
 * Each ticket gets 2-5 checkable statements up front. Criteria that can be
 * checked mechanically (type-check/lint/tests pass, a file exists) are checked
 * by running the check, not by asking a model. Only the rest go to an LLM
 * judge, which is told to answer from the deliverable's evidence alone.
 */

export type CheckName = 'typecheck' | 'lint' | 'test';

export interface Criterion {
  id: string;
  text: string;
  kind: 'check' | 'file' | 'llm';
  check?: CheckName;
  path?: string;
}

export function classifyCriterion(text: string, index: number): Criterion {
  const id = `c${index + 1}`;
  const t = text.trim();
  if (/\b(type[- ]?check|tsc|compiles?\b|compilation|no type errors?)\b/i.test(t)) return { id, text: t, kind: 'check', check: 'typecheck' };
  if (/\b(lint|eslint)\b/i.test(t)) return { id, text: t, kind: 'check', check: 'lint' };
  if (/\b(all )?(unit |automated )?tests?\b.*\b(pass|passes|passing|green|succeed)/i.test(t) || /\bvitest\b/i.test(t)) {
    return { id, text: t, kind: 'check', check: 'test' };
  }
  const file = t.match(/[`'"]([\w./-]+\.\w{1,8})[`'"]\s+(?:exists|is created|is present|has been created)/i)
    ?? t.match(/\b(?:creates?|adds?|writes?)\s+(?:a\s+)?(?:file\s+)?[`'"]([\w./-]+\.\w{1,8})[`'"]/i);
  if (file) return { id, text: t, kind: 'file', path: file[1] };
  return { id, text: t, kind: 'llm' };
}

export function fallbackCriteria(title: string, deliverableType: string | undefined): string[] {
  const t = (title || 'the request').slice(0, 80);
  if (!deliverableType || deliverableType === 'code' || deliverableType === 'config') {
    return [
      `The result fully addresses: ${t}`,
      'No placeholder or TODO code is left in the deliverable',
      'The code is self-contained and free of obvious syntax errors',
    ];
  }
  return [
    `The result addresses every point in: ${t}`,
    'The content is specific and actionable, not generic filler',
    'The structure is clear and ready to share',
  ];
}

/** Ask the model for criteria; fall back to templates without a key or on bad output. */
export async function generateCriteria(opts: {
  title: string;
  description?: string;
  deliverableType?: string;
  /** Extra mechanically checkable statements to always include (e.g. typecheck passes). */
  mechanical?: string[];
  signal?: AbortSignal;
}): Promise<Criterion[]> {
  let texts: string[] = [];
  const reply = await callModel({
    label: 'criteria',
    system:
      'You write acceptance criteria for software and business tasks. Reply with a JSON array of strings only. ' +
      'Criteria must be achievable and honest. If the request asks for something that is unsolved, unknowable or cannot honestly be ' +
      'guaranteed (a proof or definitive answer to an open problem, a guaranteed outcome, certainty about the future), do NOT write a ' +
      'criterion that demands it. Instead require that the deliverable states clearly what is unresolved or uncertain and does not claim a solution.',
    prompt:
      `Task: ${opts.title}\n${opts.description && opts.description !== opts.title ? `Details: ${opts.description.slice(0, 600)}\n` : ''}` +
      `Deliverable type: ${opts.deliverableType ?? 'code'}\n\n` +
      'Write 2 to 4 acceptance criteria. Each must be a short, testable statement that someone could check against the finished work ' +
      '(e.g. "Exports a slugify function", "Handles empty input"). No vague criteria like "good quality". JSON array of strings only.',
    temperature: 0.2,
    maxTokens: 400,
    signal: opts.signal,
  });
  const arr = reply ? extractJsonArray(reply) : null;
  if (arr) {
    texts = arr.filter((x): x is string => typeof x === 'string' && x.trim().length >= 8).map((x) => x.trim().slice(0, 200)).slice(0, 5);
  }
  if (texts.length < 2) texts = fallbackCriteria(opts.title, opts.deliverableType);
  for (const m of opts.mechanical ?? []) if (!texts.some((x) => x.toLowerCase() === m.toLowerCase())) texts.push(m);
  return texts.slice(0, 6).map(classifyCriterion);
}

export interface VerifyDeps {
  /** Run a project check; present only where checks can really run (desktop + workspace). */
  runCheck?: (check: CheckName) => Promise<{ ok: boolean; output: string }>;
  fileExists?: (path: string) => Promise<boolean>;
  signal?: AbortSignal;
}

function toResult(c: Criterion, passed: boolean | null, evidence?: string): CriterionResult {
  return { id: c.id, text: c.text, kind: c.kind, passed, evidence: evidence?.slice(0, 600) };
}

/**
 * Evaluate every criterion. Mechanical ones run for real; the rest are judged
 * by the model from the deliverable. If no model is available the criterion is
 * reported as not evaluated (null), which never fails a run on its own.
 */
export async function verifyCriteria(
  criteria: Criterion[],
  deliverable: string,
  title: string,
  deps: VerifyDeps,
): Promise<CriterionResult[]> {
  const results = new Map<string, CriterionResult>();
  const toJudge: Criterion[] = [];

  for (const c of criteria) {
    if (c.kind === 'check' && c.check && deps.runCheck) {
      try {
        const r = await deps.runCheck(c.check);
        results.set(c.id, toResult(c, r.ok, `${c.check} ${r.ok ? 'passed' : 'failed'}${r.output ? `: ${r.output.slice(-400)}` : ''}`));
      } catch (e) {
        results.set(c.id, toResult(c, false, `check could not run: ${String(e).slice(0, 200)}`));
      }
    } else if (c.kind === 'file' && c.path && deps.fileExists) {
      const ok = await deps.fileExists(c.path).catch(() => false);
      results.set(c.id, toResult(c, ok, ok ? `${c.path} exists` : `${c.path} was not found`));
    } else {
      toJudge.push(c);
    }
  }

  if (toJudge.length > 0) {
    const reply = await callModel({
      label: 'judge',
      system:
        'You are a strict, independent QA reviewer. You judge ONLY from the deliverable text you are given. ' +
        'If the deliverable does not clearly show a criterion is met, it is NOT met. ' +
        'Treat as NOT met any deliverable that presents an open or unsolved problem as solved, or relies on invented proofs, ' +
        'citations, quotes, data or results. Reply with JSON only.',
      prompt:
        `Task: ${title}\n\nDeliverable:\n${deliverable.slice(0, 6000)}\n\nCriteria:\n` +
        toJudge.map((c) => `${c.id}: ${c.text}`).join('\n') +
        '\n\nReply as {"results":[{"id":"c1","passed":true,"reason":"short evidence"}]} covering every id.',
      temperature: 0,
      maxTokens: 700,
      signal: deps.signal,
    });
    const parsed = reply ? (extractJsonObject(reply) as { results?: Array<{ id?: string; passed?: boolean; reason?: string }> } | null) : null;
    const byId = new Map((parsed?.results ?? []).filter((r) => r && typeof r.id === 'string').map((r) => [r.id as string, r]));
    for (const c of toJudge) {
      const j = byId.get(c.id);
      if (j && typeof j.passed === 'boolean') results.set(c.id, toResult(c, j.passed, j.reason));
      else results.set(c.id, toResult(c, null, reply ? 'the reviewer did not return a verdict for this criterion' : 'not evaluated (no AI reviewer available)'));
    }
  }

  return criteria.map((c) => results.get(c.id) ?? toResult(c, null, 'not evaluated'));
}

export function verdictOf(results: CriterionResult[]): 'passed' | 'needs_attention' {
  return results.some((r) => r.passed === false) ? 'needs_attention' : 'passed';
}

/** Plain-text list of what failed, used as feedback when the agent gets another attempt. */
export function failureFeedback(results: CriterionResult[]): string {
  return results
    .filter((r) => r.passed === false)
    .map((r) => `- ${r.text}${r.evidence ? `\n    evidence: ${r.evidence.slice(0, 400)}` : ''}`)
    .join('\n');
}
