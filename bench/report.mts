/**
 * Regression report (H2): compares two benchmark result files so a change in pass
 * rate or step count is visible before a release.
 *
 *   npm run bench:report                         newest run vs the run before it (same model, full suite)
 *   npm run bench:report -- --base <file> --head <file>
 *   npm run bench:report -- --write              also save bench/results/REPORT.md
 *   npm run bench:report -- --fail-on-regression exit 1 if any task got worse
 *
 * Models are noisy: with 1 attempt per task a single flip can be luck. The report
 * says so, and the sound way to compare is `npm run bench -- --repeat 3` for both runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'bench', 'results');
const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (n: string) => argv.includes(`--${n}`);

interface Attempt { pass: boolean; steps: number; detail: string; summary?: string }
interface TaskRec { id: string; role: string; attempts: Attempt[]; passCount: number }
interface Result {
  startedAt: string; model: string; repeat: number; commit: string; dirty: boolean; partial: boolean;
  totals: { attempts: number; passed: number; passRate: number; avgSteps: number; avgStepsWhenPassing: number; promptTokens: number; completionTokens: number; modelCalls: number };
  tasks: TaskRec[];
}

const load = (f: string): { file: string; r: Result } => {
  const full = path.isAbsolute(f) ? f : fs.existsSync(path.join(dir, f)) ? path.join(dir, f) : path.resolve(f);
  return { file: path.basename(full), r: JSON.parse(fs.readFileSync(full, 'utf8')) as Result };
};

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
let head: ReturnType<typeof load>;
let base: ReturnType<typeof load> | null = null;

if (opt('head')) head = load(opt('head')!);
else if (files.length) head = load(files[files.length - 1]);
else { console.error('No benchmark results yet. Run: npm run bench'); process.exit(2); }

if (opt('base')) base = load(opt('base')!);
else {
  const earlier = files.filter((f) => f < head.file).map(load).reverse();
  base = earlier.find((e) => e.r.model === head.r.model && !e.r.partial) ?? earlier.find((e) => !e.r.partial) ?? earlier[0] ?? null;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const rate = (t: TaskRec) => (t.attempts.length ? t.passCount / t.attempts.length : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const frac = (t?: TaskRec) => (t ? `${t.passCount}/${t.attempts.length}` : '-');
const stepsOf = (t?: TaskRec) => (t ? avg(t.attempts.map((a) => a.steps)) : NaN);

const lines: string[] = [];
const out = (s = '') => { lines.push(s); console.log(s); };

out(`# Benchmark report`);
out();
out(`Head: ${head.file}  (model ${head.r.model}, commit ${head.r.commit}${head.r.dirty ? '+local changes' : ''}, ${head.r.repeat} attempt(s) per task)`);
if (!base) {
  out('Base: none (this is the first result, so there is nothing to compare against yet)');
  out();
  out(`Pass rate ${head.r.totals.passed}/${head.r.totals.attempts} (${pct(head.r.totals.passRate)}), average steps ${head.r.totals.avgSteps.toFixed(1)}`);
  if (flag('write')) fs.writeFileSync(path.join(dir, 'REPORT.md'), `${lines.join('\n')}\n`);
  process.exit(0);
}
out(`Base: ${base.file}  (model ${base.r.model}, commit ${base.r.commit}${base.r.dirty ? '+local changes' : ''}, ${base.r.repeat} attempt(s) per task)`);
if (base.r.model !== head.r.model) out(`NOTE: different models, so differences may come from the model rather than the code.`);
if (head.r.partial || base.r.partial) out(`NOTE: one of the runs covered only part of the suite; only tasks present in both are compared.`);
out();

const baseById = new Map(base.r.tasks.map((t) => [t.id, t]));
const rows: string[] = [];
let regressions = 0;
let improvements = 0;
for (const t of head.r.tasks) {
  const b = baseById.get(t.id);
  if (!b) { rows.push(`${t.id.padEnd(26)} ${'new'.padEnd(9)} ${frac(t).padEnd(9)} NEW TASK`); continue; }
  const d = rate(t) - rate(b);
  const verdict = d < -1e-9 ? 'REGRESSION' : d > 1e-9 ? 'improved' : 'same';
  if (verdict === 'REGRESSION') regressions++;
  if (verdict === 'improved') improvements++;
  const ds = stepsOf(t) - stepsOf(b);
  rows.push(`${t.id.padEnd(26)} ${frac(b).padEnd(9)} ${frac(t).padEnd(9)} ${verdict.padEnd(11)} steps ${stepsOf(b).toFixed(1)} -> ${stepsOf(t).toFixed(1)} (${ds >= 0 ? '+' : ''}${ds.toFixed(1)})`);
}
out('task                       base      head      change');
out('-'.repeat(86));
for (const r of rows) out(r);
out('-'.repeat(86));

const common = head.r.tasks.filter((t) => baseById.has(t.id));
const sum = (ts: TaskRec[]) => ({ p: ts.reduce((n, t) => n + t.passCount, 0), n: ts.reduce((n, t) => n + t.attempts.length, 0) });
const hs = sum(common);
const bs = sum(common.map((t) => baseById.get(t.id)!));
out();
out(`Pass rate: ${bs.p}/${bs.n} (${pct(bs.p / (bs.n || 1))}) -> ${hs.p}/${hs.n} (${pct(hs.p / (hs.n || 1))})`);
out(`Average steps: ${avg(common.flatMap((t) => baseById.get(t.id)!.attempts.map((a) => a.steps))).toFixed(1)} -> ${avg(common.flatMap((t) => t.attempts.map((a) => a.steps))).toFixed(1)}`);
out(`Tokens (head): ${head.r.totals.promptTokens} in / ${head.r.totals.completionTokens} out over ${head.r.totals.modelCalls} calls`);
out(`${regressions} regression(s), ${improvements} improvement(s).`);
if (Math.min(head.r.repeat, base.r.repeat) < 3 && (regressions || improvements)) {
  out('Caution: with fewer than 3 attempts per task a flip can be luck. Re-run both sides with --repeat 3 before acting on it.');
}
const failing = head.r.tasks.filter((t) => t.passCount < t.attempts.length);
if (failing.length) {
  out();
  out('Why tasks failed in the head run:');
  for (const t of failing) {
    out(`  ${t.id}: ${t.attempts.filter((a) => !a.pass).map((a) => a.detail).slice(0, 2).join(' | ').slice(0, 200)}`);
    const s = t.attempts.find((a) => !a.pass && a.summary)?.summary;
    if (s) out(`      agent said: ${s.slice(0, 220)}`);
  }
}
if (flag('write')) fs.writeFileSync(path.join(dir, 'REPORT.md'), `${lines.join('\n')}\n`);
process.exit(flag('fail-on-regression') && regressions > 0 ? 1 : 0);
