import type { ExecutorEnv } from '@/execution/ToolExecutor';
import type { RunBudgetSnapshot } from './runEvents';

/**
 * Budgets for autonomous runs (F1). An agent that can call tools in a loop can
 * also burn a lot of model calls, so every run has hard limits, and the web
 * tier (which uses the shared server key) has a daily cap on top.
 */

export interface RunBudget {
  maxSteps: number;
  maxTokens: number;
  maxMs: number;
}

const DEFAULTS: Record<ExecutorEnv, RunBudget> = {
  // Shared server key: keep runs small.
  vercel: { maxSteps: 8, maxTokens: 40_000, maxMs: 3 * 60_000 },
  // User's own machine and (usually) own key.
  desktop: { maxSteps: 30, maxTokens: 150_000, maxMs: 15 * 60_000 },
};

/** Web tier daily cap on loop steps across all runs (shared key protection). */
const WEB_DAILY_STEP_CAP = 120;
const OVERRIDE_KEY = 'agentcorp_budget_override';
const DAILY_KEY = 'agentcorp_daily_steps';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/**
 * Defaults per tier. On desktop the user may raise or lower them by setting
 * localStorage `agentcorp_budget_override` = {"maxSteps":50,...}. There is no
 * UI for it yet; the clamp keeps a typo from creating an unbounded run.
 */
export function defaultBudget(env: ExecutorEnv): RunBudget {
  const base = DEFAULTS[env];
  if (env !== 'desktop') return { ...base };
  const o = readJson<Partial<RunBudget>>(OVERRIDE_KEY) ?? {};
  const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : fallback;
  return {
    maxSteps: clamp(o.maxSteps, 1, 200, base.maxSteps),
    maxTokens: clamp(o.maxTokens, 1_000, 1_000_000, base.maxTokens),
    maxMs: clamp(o.maxMs, 10_000, 2 * 60 * 60_000, base.maxMs),
  };
}

export function dailyStepsRemaining(env: ExecutorEnv): number {
  if (env === 'desktop') return Number.POSITIVE_INFINITY;
  const today = new Date().toISOString().slice(0, 10);
  const rec = readJson<{ date: string; steps: number }>(DAILY_KEY);
  const used = rec && rec.date === today ? rec.steps : 0;
  return Math.max(0, WEB_DAILY_STEP_CAP - used);
}

export function consumeDailyStep(env: ExecutorEnv): void {
  if (env === 'desktop') return;
  const today = new Date().toISOString().slice(0, 10);
  const rec = readJson<{ date: string; steps: number }>(DAILY_KEY);
  const used = rec && rec.date === today ? rec.steps : 0;
  writeJson(DAILY_KEY, { date: today, steps: used + 1 });
}

export type BudgetStop = 'steps' | 'tokens' | 'time' | 'daily';

export class BudgetTracker {
  stepsUsed = 0;
  tokensUsed = 0;
  private startedAt = Date.now();

  constructor(private readonly budget: RunBudget, private readonly env: ExecutorEnv, initial?: { stepsUsed?: number; tokensUsed?: number }) {
    this.stepsUsed = initial?.stepsUsed ?? 0;
    this.tokensUsed = initial?.tokensUsed ?? 0;
  }

  /** ~4 characters per token is close enough for budgeting. */
  addText(...texts: string[]): void {
    this.tokensUsed += Math.ceil(texts.reduce((n, t) => n + t.length, 0) / 4);
  }

  step(): void {
    this.stepsUsed++;
    consumeDailyStep(this.env);
  }

  /** Time spent waiting on the user (approvals) must not eat the run's time budget. */
  excludeMs(ms: number): void {
    if (ms > 0) this.startedAt += ms;
  }

  exceeded(): BudgetStop | null {
    if (this.stepsUsed >= this.budget.maxSteps) return 'steps';
    if (this.tokensUsed >= this.budget.maxTokens) return 'tokens';
    if (Date.now() - this.startedAt >= this.budget.maxMs) return 'time';
    if (dailyStepsRemaining(this.env) <= 0) return 'daily';
    return null;
  }

  snapshot(): RunBudgetSnapshot {
    return {
      stepsUsed: this.stepsUsed,
      maxSteps: this.budget.maxSteps,
      tokensUsed: this.tokensUsed,
      maxTokens: this.budget.maxTokens,
      elapsedMs: Date.now() - this.startedAt,
      maxMs: this.budget.maxMs,
    };
  }
}

export function describeStop(stop: BudgetStop): string {
  switch (stop) {
    case 'steps': return 'step limit reached';
    case 'tokens': return 'token budget reached';
    case 'time': return 'time limit reached';
    case 'daily': return 'daily limit for the shared key reached (use the desktop app with your own key for more)';
  }
}
