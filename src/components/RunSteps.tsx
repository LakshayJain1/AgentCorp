'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Loader2, AlertTriangle, RotateCcw, ShieldQuestion, X, CircleDot, Play, Trash2, Square } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useRunStore, type RunEvent, type RunEventStatus } from '@/engine/runEvents';
import { resumeInterruptedRun, discardInterruptedRun, cancelRun, useActiveRuns } from '@/engine/runControl';
import RoleIcon from '@/components/RoleIcon';

export interface StepView {
  key: string;
  kind: RunEvent['kind'];
  message: string;
  detail?: string;
  status: RunEventStatus;
  agentId?: string;
  tool?: string;
  startedAt: number;
  endedAt?: number;
}

/** Collapse raw events into one row per step (started + finished share a stepId). */
export function deriveSteps(events: RunEvent[]): StepView[] {
  const steps: StepView[] = [];
  const byStepId = new Map<string, StepView>();
  for (const e of events) {
    if (e.kind === 'run.started' || e.kind === 'summary.delta' || e.kind === 'run.finished') continue;
    const stepId = typeof e.data?.stepId === 'string' ? (e.data.stepId as string) : null;
    const tool = typeof e.data?.tool === 'string' ? (e.data.tool as string) : undefined;
    const status: RunEventStatus = e.status ?? (e.kind === 'run.failed' ? 'error' : e.kind === 'retry' || e.kind === 'blocked' ? 'running' : 'success');
    const open = e.kind === 'step.started' || e.kind === 'tool.call';
    if (stepId && byStepId.has(stepId)) {
      const s = byStepId.get(stepId)!;
      s.message = e.message || s.message;
      s.detail = e.detail ?? s.detail;
      s.status = open ? 'running' : status;
      s.kind = e.kind;
      if (!open) s.endedAt = e.timestamp;
      continue;
    }
    const step: StepView = {
      key: stepId ?? e.id,
      kind: e.kind,
      message: e.message,
      detail: e.detail,
      status: open ? 'running' : status,
      agentId: e.agentId,
      tool,
      startedAt: e.timestamp,
      endedAt: open ? undefined : e.timestamp,
    };
    steps.push(step);
    if (stepId) byStepId.set(stepId, step);
  }
  return steps;
}

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StepIcon({ step }: { step: StepView }) {
  if (step.kind === 'retry') return <RotateCcw className="w-3 h-3 text-amber-400" />;
  if (step.kind === 'blocked') return <ShieldQuestion className="w-3 h-3 text-amber-400" />;
  if (step.status === 'running') return <Loader2 className="w-3 h-3 text-white/60 animate-spin" />;
  if (step.status === 'error') return <X className="w-3 h-3 text-rose-400" />;
  return <Check className="w-3 h-3 text-emerald-400" />;
}

export default function RunSteps({ taskId }: { taskId: string }) {
  const run = useRunStore((s) => s.runs[taskId]);
  const events = useRunStore((s) => s.events[taskId]);
  const agents = useGameStore((s) => s.agents);
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isActive = useActiveRuns((s) => s.ids.includes(taskId));

  const live = run?.status === 'running' || run?.status === 'blocked';
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const steps = useMemo(() => deriveSteps(events ?? []), [events]);
  if (!run) return null;

  const agentOf = (id?: string) => agents.find((a) => a.id === id);
  const retries = (events ?? []).filter((e) => e.kind === 'retry').length;
  const elapsed = (run.finishedAt ?? now) - run.startedAt;
  // Open while work is happening or attention is needed; collapsed once done. The user's click wins.
  const autoOpen = live || run.status === 'interrupted' || run.verdict === 'needs_attention' || run.status === 'failed';
  const open = userToggled ?? autoOpen;

  const headerTone =
    run.status === 'failed' ? 'text-rose-400'
    : run.verdict === 'needs_attention' || run.status === 'interrupted' || run.status === 'blocked' ? 'text-amber-400'
    : run.status === 'finished' ? 'text-emerald-400' : 'text-white/60';
  const HeaderIcon =
    run.status === 'failed' ? X
    : run.status === 'interrupted' || run.verdict === 'needs_attention' || run.status === 'blocked' ? AlertTriangle
    : run.status === 'finished' ? Check : Loader2;

  const statusLabel =
    run.status === 'running' ? 'Working'
    : run.status === 'blocked' ? 'Waiting for you'
    : run.status === 'interrupted' ? 'Interrupted'
    : run.status === 'failed' ? (run.stopped ? 'Stopped' : 'Failed')
    : run.verdict === 'needs_attention' ? 'Needs attention' : 'Done';

  const worker = agentOf(run.agentId);

  return (
    <div className="flex gap-3" data-testid="run-steps" data-run-status={run.status}>
      <div className="shrink-0 w-8 h-8 rounded-full bg-surface shadow-sm border border-white/10 flex items-center justify-center">
        {worker ? <RoleIcon role={worker.role} size={16} /> : <CircleDot className="w-4 h-4 text-white/40" />}
      </div>

      <div className="flex-1 max-w-[88%] sm:max-w-[80%] min-w-0">
        <div className="rounded-2xl rounded-tl-md border border-white/10 bg-neutral-900 text-white overflow-hidden">
          <button
            onClick={() => setUserToggled(!open)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-white/[0.03] transition-colors"
            aria-expanded={open}
          >
            <HeaderIcon className={`w-3.5 h-3.5 shrink-0 ${headerTone} ${run.status === 'running' ? 'animate-spin' : ''}`} />
            <span className="text-xs font-semibold text-white/85 truncate flex-1">{run.title}</span>
            <span className="text-[10px] font-semibold text-white/70">{statusLabel}</span>
            {isActive && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Stop this run"
                title="Stop this run"
                data-testid="run-stop"
                onClick={(e) => { e.stopPropagation(); cancelRun(taskId); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); cancelRun(taskId); } }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white/55 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                <Square className="w-2.5 h-2.5" /> Stop
              </span>
            )}
            <span className="text-[10px] text-white/35 hidden sm:inline">
              {steps.length} step{steps.length === 1 ? '' : 's'}{retries > 0 ? ` · ${retries} retr${retries === 1 ? 'y' : 'ies'}` : ''} · {fmtDuration(elapsed)}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-white/35 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>

          {open && (
            <div className="px-3 pb-3 border-t border-white/10">
              {run.budget && (
                <p className="text-[10px] text-white/40 mt-2" data-testid="run-budget">
                  Budget: {run.budget.stepsUsed}/{run.budget.maxSteps} steps · ~{Math.round(run.budget.tokensUsed / 100) / 10}k/{Math.round(run.budget.maxTokens / 1000)}k tokens
                </p>
              )}

              <ol className="mt-2 space-y-0.5">
                {steps.length === 0 && <li className="text-[11px] text-white/35 py-1">Starting…</li>}
                {steps.map((step) => {
                  const a = agentOf(step.agentId);
                  const isOpen = expandedStep === step.key;
                  const hasDetail = !!step.detail;
                  return (
                    <li key={step.key} data-testid="run-step" data-step-status={step.status}>
                      <button
                        onClick={() => hasDetail && setExpandedStep(isOpen ? null : step.key)}
                        className={`w-full flex items-start gap-2 py-1 text-left ${hasDetail ? 'cursor-pointer hover:bg-white/[0.03] rounded-lg' : 'cursor-default'}`}
                      >
                        <span className="mt-0.5 shrink-0"><StepIcon step={step} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="text-[12px] text-white/75 break-words">{step.message}</span>
                          {a && <span className="text-[10px] text-white/35 ml-1.5">{a.name}</span>}
                          {step.tool && step.tool !== 'generateDeliverable' && (
                            <span className="text-[9px] font-mono text-white/40 bg-white/5 px-1 rounded ml-1.5">{step.tool}</span>
                          )}
                        </span>
                        {step.endedAt && step.endedAt - step.startedAt >= 1000 && (
                          <span className="text-[10px] text-white/30 shrink-0 mt-0.5">{fmtDuration(step.endedAt - step.startedAt)}</span>
                        )}
                      </button>
                      {isOpen && step.detail && (
                        <pre className={`ml-5 mb-1 text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-auto font-mono p-2 rounded-lg ${'text-white/70 bg-white/[0.06]'}`}>{step.detail.slice(0, 4000)}</pre>
                      )}
                    </li>
                  );
                })}
              </ol>

              {run.criteria && run.criteria.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/10" data-testid="run-criteria">
                  <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-1">Acceptance criteria</p>
                  <ul className="space-y-0.5">
                    {run.criteria.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-[11px]" title={c.evidence}>
                        <span className="mt-0.5 shrink-0">
                          {c.passed === true ? <Check className="w-3 h-3 text-emerald-400" />
                            : c.passed === false ? <X className="w-3 h-3 text-rose-400" />
                            : <CircleDot className="w-3 h-3 text-white/30" />}
                        </span>
                        <span className={'text-white/80'}>{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {run.status === 'interrupted' && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => { void resumeInterruptedRun(run.taskId); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white cursor-pointer transition-colors"
                  >
                    <Play className="w-3 h-3" /> Resume
                  </button>
                  <button
                    onClick={() => { void discardInterruptedRun(run.taskId); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/55 hover:text-white/80 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Discard
                  </button>
                </div>
              )}
            </div>
          )}

          {(run.summary || run.summaryStreaming) && (
            <div className="px-3 py-2.5 border-t border-white/10" data-testid="run-summary">
              <p className="text-sm leading-relaxed text-white/85 whitespace-pre-wrap break-words">
                {run.summary}
                {run.summaryStreaming && <span className="inline-block w-1.5 h-3.5 bg-white/50 ml-0.5 align-middle animate-pulse" />}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
