'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Users, Shield, Zap, Coffee,
  UserCheck, AlertTriangle, Play, RefreshCw,
  Heart, Award, CheckCircle2, Clock, ChevronRight, X
} from 'lucide-react';

type SimStep = 'idle' | 'assigning' | 'decomposing' | 'executing' | 'fatigue' | 'cooldown' | 'transfer' | 'testing' | 'deployed';
interface AgentMetrics { energy: number; morale: number; status: string }

const SIM_STEPS: SimStep[] = ['idle', 'assigning', 'decomposing', 'executing', 'fatigue', 'cooldown', 'transfer', 'testing', 'deployed'];

const PHASE_LABELS: Record<SimStep, string> = {
  idle:        'Standby',
  assigning:   'Goal Briefing',
  decomposing: 'Task Decomposition',
  executing:   'Execution',
  fatigue:     'Fatigue Detected',
  cooldown:    'Cooldown',
  transfer:    'Knowledge Transfer',
  testing:     'QA Validation',
  deployed:    'Shipped ✓',
};

// Which agents glow in each step
const ACTIVE_IDS: Partial<Record<SimStep, string[]>> = {
  assigning:   ['ceo', 'pm'],
  decomposing: ['pm', 'dev'],
  executing:   ['dev'],
  fatigue:     ['dev', 'hr'],
  cooldown:    ['hr', 'dev'],
  transfer:    ['dev'],
  testing:     ['qa'],
  deployed:    ['ceo', 'pm', 'dev', 'qa', 'hr'],
};

export default function AgentEcosystemIllustration() {
  const [step, setStep]         = useState<SimStep>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs]         = useState<{ text: string; kind: 'info' | 'warn' | 'ok' }[]>([
    { text: 'System ready. Press Run Demo to start.', kind: 'info' },
  ]);
  const [metrics, setMetrics] = useState<Record<string, AgentMetrics>>({
    ceo: { energy: 95, morale: 90, status: 'Reviewing Pipeline' },
    pm:  { energy: 90, morale: 88, status: 'Coordinating Teams' },
    dev: { energy: 85, morale: 82, status: 'Coding Landing Page' },
    qa:  { energy: 92, morale: 85, status: 'Idle — Waiting' },
    hr:  { energy: 96, morale: 94, status: 'Monitoring Morale' },
  });

  const addLog = (text: string, kind: 'info' | 'warn' | 'ok' = 'info') =>
    setLogs((p) => [{ text, kind }, ...p.slice(0, 5)]);

  useEffect(() => {
    if (step === 'idle') return;
    let t: NodeJS.Timeout;
    switch (step) {
      case 'assigning':
        addLog('CEO proposed goal: "Redesign AgentCorp UI."');
        setMetrics((m) => ({ ...m, ceo: { ...m.ceo, status: 'Prioritising goals' }, pm: { ...m.pm, status: 'Receiving task brief' } }));
        t = setTimeout(() => setStep('decomposing'), 3000); break;
      case 'decomposing':
        addLog('PM splitting work into UI layout & animation subtasks.');
        setMetrics((m) => ({ ...m, pm: { ...m.pm, status: 'Building subtask schedule' }, dev: { ...m.dev, status: 'Assigned: Scaffold Layout' } }));
        t = setTimeout(() => setStep('executing'), 3000); break;
      case 'executing':
        addLog('Developer writing component modules…');
        setMetrics((m) => ({ ...m, dev: { energy: 55, morale: 75, status: 'Writing code & styling' } }));
        t = setTimeout(() => setStep('fatigue'), 3000); break;
      case 'fatigue':
        addLog('HR Alert: Dev energy below 30 %. Morale critical.', 'warn');
        setMetrics((m) => ({ ...m, dev: { energy: 28, morale: 40, status: 'Fatigued — warning' }, hr: { ...m.hr, status: 'Triggering cooldown' } }));
        t = setTimeout(() => setStep('cooldown'), 3000); break;
      case 'cooldown':
        addLog('Mike entering Coffee cooldown zone.');
        addLog('HR spawning replacement agent Mike-2.');
        setMetrics((m) => ({ ...m, dev: { energy: 40, morale: 65, status: 'On cooldown (gaming)' }, hr: { ...m.hr, status: 'Spawning Dev-2' } }));
        t = setTimeout(() => setStep('transfer'), 3000); break;
      case 'transfer':
        addLog('Knowledge transfer Mike → Mike-2 complete.', 'ok');
        setMetrics((m) => ({ ...m, dev: { energy: 100, morale: 95, status: 'Task inherited. Resuming.' } }));
        t = setTimeout(() => setStep('testing'), 3500); break;
      case 'testing':
        addLog('QA running tsc, eslint, and visual tests…');
        setMetrics((m) => ({ ...m, qa: { energy: 80, morale: 88, status: 'Running tsc & eslint' } }));
        t = setTimeout(() => setStep('deployed'), 3000); break;
      case 'deployed':
        addLog('Build passed. Deployed to Vercel. Success 100 %.', 'ok');
        setMetrics({
          ceo: { energy: 98, morale: 98, status: 'Goal complete!' },
          pm:  { energy: 95, morale: 96, status: 'Sprint complete!' },
          dev: { energy: 90, morale: 95, status: 'Goal met' },
          qa:  { energy: 90, morale: 92, status: 'All tests green' },
          hr:  { energy: 98, morale: 98, status: 'Morale stable' },
        });
        t = setTimeout(() => setStep('idle'), 4500); break;
    }
    return () => clearTimeout(t);
  }, [step]);

  const agents = [
    { id: 'ceo', name: 'Alex (CEO)',  role: 'Chief Executive',  icon: <Award  className="w-4 h-4 text-red-500"    />, ringColor: '#FF453A', x: 50, y: 15 },
    { id: 'pm',  name: 'Sam (PM)',    role: 'Product Manager',  icon: <Users  className="w-4 h-4 text-teal"       />, ringColor: '#06B6D4', x: 18, y: 50 },
    { id: 'dev', name: step === 'transfer' || step === 'testing' || step === 'deployed' ? 'Mike-2 (Dev)' : 'Mike (Dev)', role: 'Engineer', icon: <Cpu className="w-4 h-4 text-amber-500" />, ringColor: '#FF9F0A', x: 50, y: 85 },
    { id: 'qa',  name: 'Tina (QA)',   role: 'QA Engineer',      icon: <Shield className="w-4 h-4 text-violet-500" />, ringColor: '#BF5AF2', x: 82, y: 50 },
    { id: 'hr',  name: 'Riley (HR)',  role: 'People Ops',       icon: <Heart  className="w-4 h-4 text-rose-500"   />, ringColor: '#EC4899', x: 50, y: 50 },
  ] as const;

  const phaseIdx   = SIM_STEPS.indexOf(step);
  const phaseActive = ACTIVE_IDS[step] ?? [];
  const selectedAgent   = agents.find((a) => a.id === selectedId);
  const selectedMetrics = selectedId ? metrics[selectedId] : null;

  return (
    <div className="w-full rounded-3xl border border-ocean-100/80 bg-white shadow-sm overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-navy/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-ocean-600 flex items-center justify-center shadow-sm shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-display font-bold text-navy text-[13px] leading-none">Ecosystem Simulator</h3>
            <p className="text-navy/40 text-[11px] mt-0.5">Interactive multi-agent orchestration demo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step === 'idle' ? (
            <button
              onClick={() => setStep('assigning')}
              className="flex items-center gap-1.5 px-4 py-2 bg-ocean-600 hover:bg-ocean-700 text-white rounded-full text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Demo
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs text-navy/60 font-medium">{PHASE_LABELS[step]}</span>
              <button
                onClick={() => { setStep('idle'); addLog('Simulation reset.'); }}
                className="p-1.5 hover:bg-navy/5 rounded-full transition-colors cursor-pointer text-navy/35"
                title="Reset"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Phase progress strip (only when running) ───────────────────────── */}
      <AnimatePresence>
        {step !== 'idle' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-navy/5"
          >
            <div className="px-5 py-2 flex items-center gap-1 overflow-x-auto">
              {SIM_STEPS.slice(1).map((s, i) => {
                const done   = phaseIdx > i + 1;
                const active = step === s;
                return (
                  <React.Fragment key={s}>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap px-2.5 py-1 rounded-full transition-all duration-300 ${
                      done   ? 'bg-emerald-100 text-emerald-700' :
                      active ? 'bg-ocean-600 text-white' :
                               'bg-navy/5 text-navy/30'
                    }`}>
                      {done && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {PHASE_LABELS[s]}
                    </span>
                    {i < SIM_STEPS.length - 2 && (
                      <ChevronRight className="w-3 h-3 text-navy/15 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body: canvas + sidebar ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row">

        {/* Canvas */}
        <div className="relative flex-1 bg-gradient-to-b from-[#f0f6ff] to-[#f8fafc]" style={{ minHeight: 320 }}>

          {/* SVG edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {[
              { x1:'50%', y1:'15%', x2:'18%', y2:'50%' },
              { x1:'50%', y1:'15%', x2:'50%', y2:'50%' },
              { x1:'18%', y1:'50%', x2:'50%', y2:'85%' },
              { x1:'50%', y1:'85%', x2:'82%', y2:'50%' },
              { x1:'82%', y1:'50%', x2:'50%', y2:'15%' },
            ].map((ln, i) => (
              <line key={i} {...ln} stroke="#cbd5e1" strokeWidth="1.5" />
            ))}
            <line x1="50%" y1="50%" x2="50%" y2="85%" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />

            {step === 'assigning'   && <AnimatedLine x1="50%" y1="15%" x2="18%" y2="50%" color="#0A84FF" />}
            {step === 'decomposing' && <AnimatedLine x1="18%" y1="50%" x2="50%" y2="85%" color="#0A84FF" />}
            {step === 'fatigue'     && <AnimatedLine x1="50%" y1="85%" x2="50%" y2="50%" color="#FF453A" />}
            {step === 'cooldown'    && <AnimatedLine x1="50%" y1="50%" x2="50%" y2="85%" color="#34C759" />}
            {step === 'testing'     && <AnimatedLine x1="50%" y1="85%" x2="82%" y2="50%" color="#BF5AF2" />}
            {step === 'deployed'    && <AnimatedLine x1="82%" y1="50%" x2="50%" y2="15%" color="#34C759" />}
          </svg>

          {/* Coffee badge */}
          <AnimatePresence>
            {step === 'cooldown' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="absolute left-4 bottom-4 flex items-center gap-2 bg-amber-50 border border-amber-200/70 rounded-xl px-2.5 py-2 shadow-sm z-10"
              >
                <div className="p-1 bg-amber-500 rounded-lg"><Coffee className="w-3.5 h-3.5 text-white" /></div>
                <div>
                  <div className="text-[10px] font-bold text-amber-800">Coffee Oasis</div>
                  <div className="text-[9px] text-amber-600">Mike recharging</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent nodes — wrapper div owns the position; motion.div owns the scale */}
          {agents.map((agent) => {
            const m          = metrics[agent.id];
            const isActive   = phaseActive.includes(agent.id);
            const isFatigued = m.energy < 40;
            const isOnBreak  = step === 'cooldown' && agent.id === 'dev';
            const isSelected = selectedId === agent.id;

            return (
              // Outer div: handles absolute placement only — no transform animation here
              <div
                key={agent.id}
                className="absolute"
                style={{ left: `${agent.x}%`, top: `${agent.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {/* Glow ring (behind card) */}
                {isActive && (
                  <span className="absolute -inset-3 rounded-2xl bg-ocean-500/10 blur-md animate-pulse pointer-events-none" />
                )}

                {/* Inner motion wrapper: scale only, no translate */}
                <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                  <button
                    className={`flex flex-col items-center w-[74px] bg-white rounded-2xl p-2 shadow-sm border transition-all duration-300 cursor-pointer focus:outline-none ${
                      isSelected ? 'shadow-md border-transparent' :
                      isActive   ? 'border-ocean-300/70 shadow-md' :
                                   'border-navy/8 hover:border-navy/20'
                    }`}
                    style={isSelected ? { outline: `2px solid ${agent.ringColor}`, outlineOffset: 2 } : {}}
                    onClick={() => setSelectedId(isSelected ? null : agent.id)}
                    aria-label={`${agent.name} — click for details`}
                  >
                    {/* Energy bar */}
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                      <motion.div
                        className={`h-full rounded-full ${m.energy > 60 ? 'bg-emerald-400' : m.energy > 30 ? 'bg-amber-400' : 'bg-rose-500'}`}
                        animate={{ width: `${m.energy}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>

                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border border-navy/5 bg-white shadow-inner ${isOnBreak ? 'animate-bounce' : ''}`}>
                      {isOnBreak ? <Coffee className="w-4 h-4 text-amber-500" /> : agent.icon}
                    </div>

                    <span className="text-[10px] font-bold text-navy leading-tight text-center mt-1 truncate w-full">{agent.name}</span>
                    <span className="text-[8px] text-navy/40 uppercase tracking-wide font-semibold mt-0.5 truncate w-full text-center">{agent.role}</span>
                  </button>
                </motion.div>

                {/* Status badge below card */}
                <AnimatePresence>
                  {isFatigued && !isOnBreak && agent.id === 'dev' && (
                    <motion.span
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 flex items-center justify-center gap-0.5 bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full w-full"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" /> Low energy
                    </motion.span>
                  )}
                  {isOnBreak && (
                    <motion.span
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 block text-center bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full w-full"
                    >
                      Resting…
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Right sidebar: detail panel + activity log */}
        <div className="flex flex-col w-full lg:w-[260px] shrink-0 border-t lg:border-t-0 lg:border-l border-navy/5">

          {/* Agent detail */}
          <div className="border-b border-navy/5" style={{ minHeight: 120 }}>
            <AnimatePresence mode="wait">
              {selectedAgent && selectedMetrics ? (
                <motion.div
                  key={selectedAgent.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-white border border-navy/8 shadow-sm flex items-center justify-center">
                        {selectedAgent.icon}
                      </div>
                      <div>
                        <div className="font-bold text-[12px] text-navy leading-none">{selectedAgent.name}</div>
                        <div className="text-[10px] text-navy/40 mt-0.5">{selectedAgent.role}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedId(null)} className="p-1 hover:bg-navy/5 rounded-full transition-colors cursor-pointer text-navy/30">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {[
                    { label: 'Energy', val: selectedMetrics.energy, color: selectedMetrics.energy > 60 ? 'bg-emerald-400' : selectedMetrics.energy > 30 ? 'bg-amber-400' : 'bg-rose-500' },
                    { label: 'Morale', val: selectedMetrics.morale, color: 'bg-ocean-500' },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] text-navy/50 font-medium mb-0.5">
                        <span>{label}</span><span className="font-mono">{Math.round(val)}%</span>
                      </div>
                      <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                        <motion.div className={`h-full rounded-full ${color}`} animate={{ width: `${val}%` }} transition={{ duration: 0.6 }} />
                      </div>
                    </div>
                  ))}

                  <div className="flex items-start gap-1.5 bg-navy/3 rounded-xl px-2.5 py-2">
                    <Clock className="w-3 h-3 text-navy/30 mt-0.5 shrink-0" />
                    <span className="text-[10px] text-navy/55 leading-relaxed italic">{selectedMetrics.status}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="hint"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-4 flex items-center gap-2 text-navy/30"
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span className="text-[11px]">Click an agent to inspect its status.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Activity log */}
          <div className="flex flex-col flex-1 bg-[#0d0d1a] overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/8 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-white/30 text-[10px] font-mono ml-1.5 uppercase tracking-wider">Activity</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2" style={{ maxHeight: 160 }}>
              <AnimatePresence initial={false}>
                {logs.map((entry, i) => (
                  <motion.p
                    key={`${i}-${entry.text}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`text-[10px] font-mono leading-relaxed ${
                      entry.kind === 'warn' ? 'text-amber-400' :
                      entry.kind === 'ok'   ? 'text-emerald-400' :
                                              'text-white/60'
                    }`}
                  >
                    <span className="text-white/20 mr-1">›</span>{entry.text}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedLine({ x1, y1, x2, y2, color }: { x1: string; y1: string; x2: string; y2: string; color: string }) {
  return (
    <motion.line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color} strokeWidth="2.5" strokeDasharray="6 6"
      initial={{ strokeDashoffset: 60 }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
    />
  );
}
