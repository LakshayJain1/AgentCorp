import type { ExecutorEnv } from '@/execution/ToolExecutor';
import { callModel } from './model';
import { extractJsonObject } from './json';
import { BudgetTracker, describeStop, type RunBudget } from './budget';
import { describeTools, normalizeArgs, FINISH_TOOL_NAME, type AgentTool } from './tools';
import { emitRun } from './runBridge';
import type { RunBudgetSnapshot } from './runEvents';
import type { LoopCheckpoint } from './runPersistence';

/**
 * The agent loop (C2): the model picks the next action, we run the tool, show
 * it the result, and repeat until it calls `finish` or a limit is hit.
 *
 * Provider-agnostic on purpose: the model replies with one JSON object per
 * turn ({"tool": "...", "args": {...}}) instead of relying on native
 * function-calling, so it works with whatever model the shared or BYOK key
 * reaches, including free ones. Each turn is one short stateless request, so
 * the loop itself lives entirely in the client and needs no server runtime.
 */

export type LoopStatus = 'finished' | 'budget' | 'loop_detected' | 'cancelled' | 'failed';

export interface LoopParams {
  taskId: string;
  agentId: string;
  agentName: string;
  persona: string;
  goal: string;
  criteria: string[];
  tools: AgentTool[];
  budget: RunBudget;
  env: ExecutorEnv;
  signal?: AbortSignal;
  /** Continue from a saved checkpoint (interrupted run, or a QA retry). */
  resume?: LoopCheckpoint | null;
  /** Message added to the transcript before continuing, e.g. what QA found wrong. */
  feedback?: string;
  onCheckpoint?: (cp: LoopCheckpoint) => void;
}

export interface LoopResult {
  status: LoopStatus;
  summary: string;
  stopReason?: string;
  filesChanged: string[];
  checkpoint: LoopCheckpoint;
  budget: RunBudgetSnapshot;
}

type Entry = LoopCheckpoint['transcript'][number];

const STORE_ENTRY_CHARS = 6000;
const PROMPT_BUDGET_CHARS = 14_000;
const RECENT_FULL = 4; // newest entries shown in full; older tool output is trimmed
const MAX_PARSE_FAILURES = 3;
const MAX_MODEL_FAILURES = 2;
const SAME_FAILURE_LIMIT = 3;
const SAME_CALL_LIMIT = 4;

function stable(v: unknown): string {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${k}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function argSummary(args: Record<string, string>): string {
  const first = args.path ?? args.pattern ?? args.check ?? args.url ?? (args.cmd ? `${args.cmd} ${args.args ?? ''}` : undefined) ?? args.dir ?? args.summary ?? args.text ?? '';
  const s = first.replace(/\s+/g, ' ').trim();
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function buildSystem(p: LoopParams): string {
  return [
    `You are ${p.agentName}, ${p.persona}. You are working autonomously on ONE task, using tools. A person will read your final summary, so be accurate and honest.`,
    '',
    'Each turn, reply with EXACTLY ONE JSON object and nothing else:',
    '{"thought": "<one short sentence>", "tool": "<tool name>", "args": { ... }}',
    '',
    'Tools you can use:',
    describeTools(p.tools),
    '',
    'Rules:',
    '- Look before you change anything: list_files, read_file, search_files (when available).',
    '- Change files with write_file, always giving the COMPLETE new file content.',
    '- Verify your work with run_check (when available) and fix failures you see. Never claim a check passed unless you saw it pass.',
    '- If a tool returns an error, change your approach. Do not repeat the same failing call.',
    `- When the task is complete, or you cannot make further progress, call ${FINISH_TOOL_NAME} with an honest summary (what you did, which files, what is not done).`,
    '- Output the JSON object only: no prose, no markdown fences.',
  ].join('\n');
}

function renderHistory(transcript: Entry[]): string {
  const total = transcript.reduce((n, e) => n + e.text.length, 0);
  const lines = transcript.map((e, i) => {
    const age = transcript.length - i;
    let text = e.text;
    // Older observations are the first thing to shrink when context grows.
    if (e.role === 'tool' && age > RECENT_FULL && total > PROMPT_BUDGET_CHARS / 2) text = text.length > 400 ? `${text.slice(0, 400)}…[trimmed]` : text;
    return `[${e.role}] ${text}`;
  });
  let joined = lines.join('\n\n');
  if (joined.length > PROMPT_BUDGET_CHARS && transcript.length > 10) {
    // Deterministic compaction: keep the opening and the most recent turns, summarise the middle.
    const head = lines.slice(0, 2);
    const tail = lines.slice(-8);
    const middle = transcript.slice(2, -8);
    const tools = middle.filter((e) => e.role === 'assistant').map((e) => {
      const o = extractJsonObject(e.text) as { tool?: string } | null;
      return o?.tool ?? '?';
    });
    const note = `[earlier steps omitted to save space: ${middle.length} entries; tools used: ${[...new Set(tools)].join(', ') || 'n/a'}]`;
    joined = [...head, note, ...tail].join('\n\n');
  }
  return joined;
}

function buildPrompt(p: LoopParams, transcript: Entry[]): string {
  const crit = p.criteria.length ? `\n\nAcceptance criteria (the work will be checked against these):\n${p.criteria.map((c) => `- ${c}`).join('\n')}` : '';
  const hist = transcript.length ? `\n\nWhat has happened so far (oldest first):\n${renderHistory(transcript)}` : '\n\n(No actions yet.)';
  return `Task:\n${p.goal}${crit}${hist}\n\nReply now with the next action as a single JSON object.`;
}

function parseAction(text: string): { tool: string; args: unknown; thought?: string } | null {
  const o = extractJsonObject(text) as Record<string, unknown> | null;
  if (!o || typeof o.tool !== 'string' || !o.tool) return null;
  return {
    tool: o.tool,
    args: o.args ?? o.arguments ?? o.input ?? {},
    thought: typeof o.thought === 'string' ? o.thought : undefined,
  };
}

export async function runAgentLoop(p: LoopParams): Promise<LoopResult> {
  const budget = new BudgetTracker(p.budget, p.env, { stepsUsed: p.resume?.stepsUsed, tokensUsed: p.resume?.tokensUsed });
  const transcript: Entry[] = p.resume ? [...p.resume.transcript] : [];
  const filesChanged = new Set<string>(p.resume?.filesChanged ?? []);
  let step = p.resume?.step ?? 0;
  let qaRound = p.resume?.qaRound ?? 0;
  if (p.feedback) transcript.push({ role: 'user', text: p.feedback.slice(0, STORE_ENTRY_CHARS) });

  const system = buildSystem(p);
  const toolByName = new Map(p.tools.map((t) => [t.name, t]));
  const failCounts = new Map<string, number>();
  const callCounts = new Map<string, number>();
  let parseFailures = 0;
  let modelFailures = 0;
  let lastThought = '';

  const checkpoint = (): LoopCheckpoint => ({
    taskId: p.taskId,
    workerId: p.agentId,
    step,
    tokensUsed: budget.tokensUsed,
    stepsUsed: budget.stepsUsed,
    filesChanged: [...filesChanged],
    transcript: transcript.slice(-60),
    qaRound,
    savedAt: Date.now(),
  });

  const done = (status: LoopStatus, summary: string, stopReason?: string): LoopResult => {
    const cp = checkpoint();
    p.onCheckpoint?.(cp);
    return { status, summary, stopReason, filesChanged: [...filesChanged], checkpoint: cp, budget: budget.snapshot() };
  };

  for (;;) {
    if (p.signal?.aborted) return done('cancelled', 'The run was stopped.', 'cancelled by the user');
    const stop = budget.exceeded();
    if (stop) {
      const why = describeStop(stop);
      return done('budget', lastThought ? `Stopped before finishing (${why}). Last note: ${lastThought}` : `Stopped before finishing (${why}).`, why);
    }

    // ── ask the model for the next action ────────────────────────────
    const prompt = buildPrompt(p, transcript);
    const reply = await callModel({ label: 'loop', system, prompt, temperature: 0.2, maxTokens: 2500, signal: p.signal });
    budget.addText(system, prompt, reply ?? '');
    if (p.signal?.aborted) return done('cancelled', 'The run was stopped.', 'cancelled by the user');
    if (!reply) {
      if (++modelFailures >= MAX_MODEL_FAILURES) return done('failed', 'The AI service did not respond, so the run could not continue.', 'model unavailable');
      continue;
    }
    modelFailures = 0;

    const action = parseAction(reply);
    if (!action) {
      budget.step();
      transcript.push({ role: 'assistant', text: reply.slice(0, STORE_ENTRY_CHARS) });
      transcript.push({ role: 'user', text: 'That was not a single valid JSON object. Reply with exactly one object like {"thought":"...","tool":"<name>","args":{...}} and nothing else.' });
      emitRun(p.taskId, { kind: 'step.progress', agentId: p.agentId, status: 'error', message: 'Model reply was not valid JSON; asking again', data: { budget: budget.snapshot() } });
      if (++parseFailures >= MAX_PARSE_FAILURES) return done('failed', 'The model kept replying in an unusable format, so the run was stopped.', 'unparseable model output');
      p.onCheckpoint?.(checkpoint());
      continue;
    }
    parseFailures = 0;
    if (action.thought) lastThought = action.thought;

    step++;
    budget.step();
    const stepId = `${p.taskId}_s${step}`;
    transcript.push({ role: 'assistant', text: JSON.stringify({ thought: action.thought, tool: action.tool, args: action.args }).slice(0, STORE_ENTRY_CHARS) });

    // ── finish ──────────────────────────────────────────────────────
    if (action.tool === FINISH_TOOL_NAME) {
      const raw = action.args && typeof action.args === 'object' ? (action.args as Record<string, unknown>).summary : undefined;
      const summary = (typeof raw === 'string' && raw.trim()) || action.thought || 'Task finished.';
      emitRun(p.taskId, {
        kind: 'tool.result', agentId: p.agentId, status: 'success', message: 'finish',
        detail: summary, data: { stepId, tool: FINISH_TOOL_NAME, budget: budget.snapshot() },
      });
      return done('finished', summary);
    }

    // ── unknown tool ────────────────────────────────────────────────
    const tool = toolByName.get(action.tool);
    if (!tool) {
      const msg = `Unknown tool "${action.tool}". Available tools: ${p.tools.map((t) => t.name).join(', ')}.`;
      emitRun(p.taskId, { kind: 'tool.result', agentId: p.agentId, status: 'error', message: `${action.tool}: not available here`, detail: msg, data: { stepId, tool: action.tool, budget: budget.snapshot() } });
      transcript.push({ role: 'tool', text: `ERROR ${msg}` });
      p.onCheckpoint?.(checkpoint());
      continue;
    }

    const normalized = normalizeArgs(tool, action.args);
    if ('error' in normalized) {
      const msg = `${tool.name}: ${normalized.error}`;
      emitRun(p.taskId, { kind: 'tool.result', agentId: p.agentId, status: 'error', message: msg, data: { stepId, tool: tool.name, budget: budget.snapshot() } });
      transcript.push({ role: 'tool', text: `ERROR ${msg}` });
      p.onCheckpoint?.(checkpoint());
      continue;
    }
    const args = normalized.args;
    const sig = `${tool.name}:${stable(args)}`;

    // ── repeated identical call with nothing changing ───────────────
    const calls = (callCounts.get(sig) ?? 0) + 1;
    callCounts.set(sig, calls);
    if (calls >= SAME_CALL_LIMIT && tool.risk !== 'write') {
      return done('loop_detected', `Stopped: the same call (${tool.name}) was repeated ${calls} times without progress.${lastThought ? ` Last note: ${lastThought}` : ''}`, 'repeated identical tool call');
    }

    // ── run it ──────────────────────────────────────────────────────
    const summary = argSummary(args);
    const label = summary ? `${tool.name} ${summary}` : tool.name;
    emitRun(p.taskId, {
      kind: 'tool.call', agentId: p.agentId, status: 'running', message: label,
      detail: action.thought, data: { stepId, tool: tool.name, budget: budget.snapshot() },
    });
    if (tool.risk === 'external') {
      emitRun(p.taskId, { kind: 'blocked', agentId: p.agentId, status: 'running', message: `Waiting for your approval: ${label}`, data: { stepId } });
    }

    const waitStart = Date.now();
    let result: Awaited<ReturnType<AgentTool['run']>>;
    try {
      result = await tool.run(args, {
        taskId: p.taskId,
        agentId: p.agentId,
        signal: p.signal,
        recordWrite: (path) => filesChanged.add(path),
      });
    } catch (e) {
      result = { ok: false, output: '', error: `tool crashed: ${String(e).slice(0, 300)}` };
    }
    if (tool.risk === 'external') budget.excludeMs(Date.now() - waitStart);

    const observation = result.ok
      ? (result.output || '(no output)')
      : `ERROR ${result.error ?? 'failed'}${result.output ? `\n${result.output}` : ''}`;
    emitRun(p.taskId, {
      kind: 'tool.result', agentId: p.agentId, status: result.ok ? 'success' : 'error', message: label,
      detail: `${action.thought ? `# ${action.thought}\n\n` : ''}${observation}`.slice(0, 4000),
      data: { stepId, tool: tool.name, budget: budget.snapshot() },
    });
    transcript.push({ role: 'tool', text: `${tool.name} ${result.ok ? 'OK' : 'FAILED'}: ${observation}`.slice(0, STORE_ENTRY_CHARS) });

    if (!result.ok) {
      const n = (failCounts.get(sig) ?? 0) + 1;
      failCounts.set(sig, n);
      if (n >= SAME_FAILURE_LIMIT) {
        return done('loop_detected', `Stopped: ${tool.name} failed ${n} times with the same input (${result.error ?? 'error'}).`, 'repeated failing tool call');
      }
    }
    if (tool.risk === 'write' && result.ok) callCounts.clear(); // the world changed; repeating a read is legitimate now

    qaRound = p.resume?.qaRound ?? qaRound;
    p.onCheckpoint?.(checkpoint());
  }
}
