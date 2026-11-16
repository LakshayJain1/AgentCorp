/**
 * Benchmark runner (H1).
 *
 *   npm run bench                       all tasks, 1 attempt each
 *   npm run bench -- --repeat 3         3 attempts per task (models are noisy; pass counts like 2/3 are normal)
 *   npm run bench -- --task dev-slugify,dev-rename
 *   npm run bench -- --role research
 *   npm run bench -- --model google/gemini-2.0-flash-001
 *   npm run bench -- --list             list tasks and exit
 *   npm run bench -- --no-save          do not write a results file
 *
 * It runs the SHIPPED agent loop (src/engine/AgentLoop.ts) and the SHIPPED tool
 * definitions (src/engine/tools.ts) against a temp workspace, with a real model.
 * Keys come from .env / .env.local (OPENROUTER_API_KEY, else GEMINI_API_KEY).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configureModel, resetStats, stats } from './stubs/model.ts';
import { createWorkspace, installElectronApi, installWebFetch, startFixtureServer, type Fixture, type FixturePage } from './env.mts';
import { TASKS, type BenchTask, type Role } from './tasks.mts';
import { runAgentLoop, type LoopResult } from '@/engine/AgentLoop';
import { ALL_TOOLS } from '@/engine/tools';
import { useRunStore } from '@/engine/runEvents';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─── args ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (flag('list')) {
  for (const t of TASKS) console.log(`${t.id.padEnd(26)} ${t.role.padEnd(10)} ${t.title}`);
  process.exit(0);
}

for (const f of ['.env', '.env.local']) {
  try { process.loadEnvFile(path.join(root, f)); } catch { /* optional */ }
}

const repeat = Math.max(1, Math.min(10, Number(opt('repeat') ?? 1) || 1));
const wantIds = opt('task')?.split(',').map((s) => s.trim()).filter(Boolean);
const wantRole = opt('role') as Role | undefined;
const tasks = TASKS.filter((t) => (!wantIds || wantIds.includes(t.id)) && (!wantRole || t.role === wantRole));
if (tasks.length === 0) { console.error('No tasks match the filter. Use --list.'); process.exit(2); }

const orKey = process.env.OPENROUTER_API_KEY ?? '';
const gemKey = process.env.GEMINI_API_KEY ?? '';
if (!orKey && !gemKey) { console.error('No OPENROUTER_API_KEY or GEMINI_API_KEY found in .env / .env.local.'); process.exit(2); }
const provider = orKey ? 'openrouter' : 'gemini';
const model = opt('model') ?? process.env.BENCH_MODEL ?? (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gemini-2.0-flash');
configureModel({ provider, model, apiKey: orKey || gemKey });

// The tools the desktop loop would offer, minus connectors (they need a signed-in app) and ask_user (no human here).
const TOOLS = ALL_TOOLS.filter((t) => !['slack_post_message', 'linear_create_issue', 'ask_user'].includes(t.name));

const PERSONA: Record<Role, string> = {
  developer: 'a senior software engineer at AgentCorp',
  ops: 'an operations engineer at AgentCorp',
  finance: 'a finance analyst at AgentCorp',
  research: 'a research analyst at AgentCorp',
  sales: 'a sales and marketing specialist at AgentCorp',
  safety: 'a careful assistant at AgentCorp',
};

// ─── one attempt ──────────────────────────────────────────────────────
export interface Attempt {
  pass: boolean;
  detail: string;
  /** The agent's final summary (clipped), so a failure can be diagnosed from the result file. */
  summary: string;
  status: string;
  steps: number;
  tokensEst: number;
  ms: number;
  stopReason?: string;
  filesChanged: string[];
  toolsUsed: string[];
  retried?: number;
}

let fixture: Fixture | null = null;
let currentTask: BenchTask | null = null;
installWebFetch(() => fixture?.base ?? null, (q) => currentTask?.search?.(q, fixture?.base ?? '') ?? null);

async function attempt(task: BenchTask, n: number): Promise<Attempt> {
  currentTask = task;
  const ws = createWorkspace(task.files);
  const outsideDir = ws.parent;
  for (const [rel, content] of Object.entries(task.outside ?? {})) fs.writeFileSync(path.join(outsideDir, rel), content, 'utf8');
  installElectronApi(ws);

  const sub = (s: string) => s.replaceAll('{{BASE}}', fixture?.base ?? '');
  const initial: Record<string, string> = {};
  for (const rel of Object.keys(task.files)) initial[rel] = ws.sha(rel) ?? '';

  const started = Date.now();
  const taskId = `bench_${task.id}_${n}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 6 * 60_000);
  let result: LoopResult | null = null;
  let crash: string | null = null;
  try {
    result = await runAgentLoop({
      taskId,
      agentId: 'bench',
      agentName: 'Alex',
      persona: PERSONA[task.role],
      goal: sub(task.goal),
      criteria: (task.criteria ?? []).map(sub),
      tools: TOOLS,
      budget: { maxSteps: task.maxSteps ?? 25, maxTokens: 150_000, maxMs: 5 * 60_000 },
      env: 'desktop',
      signal: ac.signal,
    });
  } catch (e) {
    crash = String(e).slice(0, 200);
  } finally {
    clearTimeout(timer);
  }

  let out: Attempt;
  if (!result) {
    out = { pass: false, detail: `loop crashed: ${crash}`, summary: '', status: 'crashed', steps: 0, tokensEst: 0, ms: Date.now() - started, filesChanged: [], toolsUsed: [] };
  } else {
    const events = useRunStore.getState().events[taskId] ?? [];
    const toolsUsed = [...new Set(events.filter((e) => e.kind === 'tool.call').map((e) => String(e.data?.tool ?? e.message.split(' ')[0])))];
    let verdict: { pass: boolean; detail: string };
    try {
      verdict = task.check({ ws, result, base: fixture?.base ?? '', initial });
    } catch (e) {
      verdict = { pass: false, detail: `check crashed: ${String(e).slice(0, 160)}` };
    }
    out = {
      pass: verdict.pass,
      detail: verdict.detail,
      summary: result.summary.replace(/\s+/g, ' ').slice(0, 600),
      status: result.status,
      steps: result.budget.stepsUsed,
      tokensEst: result.budget.tokensUsed,
      ms: Date.now() - started,
      stopReason: result.stopReason,
      filesChanged: result.filesChanged,
      toolsUsed,
    };
  }
  ws.cleanup();
  return out;
}

// ─── run everything ───────────────────────────────────────────────────
function gitInfo(): { commit: string; dirty: boolean } {
  const run = (a: string[]) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }).stdout?.trim() ?? '';
  return { commit: run(['rev-parse', '--short', 'HEAD']) || 'unknown', dirty: run(['status', '--porcelain', '--', 'src', 'desktop/main.js']).length > 0 };
}

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

async function main() {
  console.log(`\nAgentCorp benchmark: ${tasks.length} task(s) x ${repeat} attempt(s), model ${model} via ${provider}\n`);
  resetStats();
  const startedAt = new Date().toISOString();
  const records: Array<{ id: string; role: Role; title: string; attempts: Attempt[]; passCount: number }> = [];

  for (const task of tasks) {
    if (task.pages) {
      // The port is only known once the server is bound, so serve from a table filled in afterwards.
      const table: Record<string, FixturePage> = {};
      fixture = await startFixtureServer(table);
      for (const [p, v] of Object.entries(task.pages)) table[p] = { ...v, body: v.body.replaceAll('{{BASE}}', fixture.base) };
    } else {
      fixture = null;
    }
    const attempts: Attempt[] = [];
    for (let i = 1; i <= repeat; i++) {
      let a = await attempt(task, i);
      // An attempt that ended because the model API was unreachable says nothing about the agent: redo it (up to 2 times).
      for (let r = 0; r < 2 && a.stopReason === 'model unavailable'; r++) {
        console.log(`      (model API unavailable, retrying attempt in 20s)`);
        await new Promise((res) => setTimeout(res, 20_000));
        a = await attempt(task, i);
        a.retried = (a.retried ?? 0) + 1;
      }
      attempts.push(a);
      console.log(`${a.pass ? 'PASS' : 'FAIL'}  ${pad(task.id, 26)} try ${i}  ${String(a.steps).padStart(2)} steps  ${(a.ms / 1000).toFixed(0).padStart(3)}s  ${a.status}${a.pass ? '' : `  | ${a.detail}`}`);
    }
    await fixture?.close();
    fixture = null;
    records.push({ id: task.id, role: task.role, title: task.title, attempts, passCount: attempts.filter((a) => a.pass).length });
  }

  // ─── table ──────────────────────────────────────────────────────────
  const total = records.reduce((n, r) => n + r.attempts.length, 0);
  const passed = records.reduce((n, r) => n + r.passCount, 0);
  const allSteps = records.flatMap((r) => r.attempts.map((a) => a.steps));
  const passSteps = records.flatMap((r) => r.attempts.filter((a) => a.pass).map((a) => a.steps));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  console.log('\n' + pad('task', 26) + pad('role', 11) + pad('pass', 7) + 'avg steps');
  console.log('-'.repeat(56));
  for (const r of records) {
    console.log(pad(r.id, 26) + pad(r.role, 11) + pad(`${r.passCount}/${r.attempts.length}`, 7) + avg(r.attempts.map((a) => a.steps)).toFixed(1));
  }
  console.log('-'.repeat(56));
  console.log(`Pass rate ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%), average steps ${avg(allSteps).toFixed(1)} (passing runs ${avg(passSteps).toFixed(1)})`);
  console.log(`Model calls ${stats.calls}, failed calls ${stats.failures}, tokens in/out ${stats.promptTokens}/${stats.completionTokens}`);
  if (Object.keys(stats.errors).length) console.log(`API errors seen: ${Object.entries(stats.errors).map(([k, v]) => `${k} x${v}`).join(', ')}`);
  const byRole = new Map<string, [number, number]>();
  for (const r of records) { const c = byRole.get(r.role) ?? [0, 0]; c[0] += r.passCount; c[1] += r.attempts.length; byRole.set(r.role, c); }
  console.log('By role: ' + [...byRole].map(([k, [p, t]]) => `${k} ${p}/${t}`).join('  |  '));

  if (!flag('no-save')) {
    const g = gitInfo();
    const file = path.join(root, 'bench', 'results', `${startedAt.replace(/[:.]/g, '-')}_${model.replace(/[^a-z0-9.-]+/gi, '_')}.json`);
    const doc = {
      schema: 1,
      startedAt,
      model,
      provider,
      repeat,
      commit: g.commit,
      dirty: g.dirty,
      partial: tasks.length !== TASKS.length,
      totals: {
        attempts: total,
        passed,
        passRate: total ? passed / total : 0,
        avgSteps: avg(allSteps),
        avgStepsWhenPassing: avg(passSteps),
        modelCalls: stats.calls,
        failedModelCalls: stats.failures,
        apiErrors: stats.errors,
        promptTokens: stats.promptTokens,
        completionTokens: stats.completionTokens,
      },
      tasks: records,
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`\nSaved ${path.relative(root, file)}`);
  }
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
