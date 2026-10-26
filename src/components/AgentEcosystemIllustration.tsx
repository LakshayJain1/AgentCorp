'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Play, RefreshCw, Heart, Shield,
  Activity, Info, Terminal, FileText,
  ChevronRight, User, Cpu, ChevronDown,
} from 'lucide-react';

type SimStep = 'idle' | 'assigning' | 'decomposing' | 'executing' | 'testing' | 'deployed';
type AgentId = 'ceo' | 'pm' | 'hr' | 'dev' | 'qa';
type AgentStatus = 'Online' | 'Working' | 'Idle' | 'Resting';

interface AgentState { status: AgentStatus; task: string; energy: number }

interface AgentDef {
  id: AgentId; name: string; desc: string;
  cardBg: string; avatarBg: string; accentColor: string;
  icon: React.ReactNode;
  x: number; y: number;
}

const GOALS = ['Launch landing page', 'Ship mobile app', 'Run Q4 sprint', 'Redesign homepage'];

const STATUS_COLOR: Record<AgentStatus, string> = {
  Online: '#10B981', Working: '#3B82F6', Idle: '#9CA3AF', Resting: '#F59E0B',
};

const AGENTS: AgentDef[] = [
  { id: 'ceo', name: 'Alex (CEO)', desc: 'Sets goals & prioritizes',
    cardBg: '#FFF5F5', avatarBg: '#FED7D7', accentColor: '#EF4444',
    icon: <User className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />, x: 50, y: 12 },
  { id: 'pm',  name: 'Sam (PM)',   desc: 'Breaks down requirements',
    cardBg: '#EFF6FF', avatarBg: '#BFDBFE', accentColor: '#3B82F6',
    icon: <User className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />, x: 18, y: 52 },
  { id: 'hr',  name: 'Riley (HR)', desc: 'Keeps the team aligned',
    cardBg: '#FDF4FF', avatarBg: '#E9D5FF', accentColor: '#A855F7',
    icon: <Heart className="w-3.5 h-3.5" style={{ color: '#EC4899' }} />, x: 50, y: 52 },
  { id: 'dev', name: 'Mike (Dev)', desc: 'Builds and ships',
    cardBg: '#F0FDF4', avatarBg: '#BBF7D0', accentColor: '#10B981',
    icon: <Cpu className="w-3.5 h-3.5" style={{ color: '#10B981' }} />, x: 50, y: 86 },
  { id: 'qa',  name: 'Tina (QA)',  desc: 'Tests and ensures quality',
    cardBg: '#F5F3FF', avatarBg: '#DDD6FE', accentColor: '#7C3AED',
    icon: <Shield className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />, x: 82, y: 52 },
];

const PATHS = [
  { d: 'M50,12 C38,22 23,42 18,52',  color: '#C4B5FD', dot: [33, 33] },
  { d: 'M50,12 C50,26 50,38 50,52',  color: '#93C5FD', dot: [50, 32] },
  { d: 'M50,12 C62,22 77,42 82,52',  color: '#C4B5FD', dot: [67, 33] },
  { d: 'M18,52 C23,63 38,77 50,86',  color: '#93C5FD', dot: [33, 69] },
  { d: 'M50,52 C50,61 50,71 50,86',  color: '#93C5FD', dot: [50, 69] },
  { d: 'M82,52 C77,63 62,77 50,86',  color: '#C4B5FD', dot: [67, 69] },
];

const TABS = [
  { id: 'activity'   as const, label: 'Activity',   icon: <Activity className="w-3 h-3" /> },
  { id: 'agent-info' as const, label: 'Agent Info', icon: <Info     className="w-3 h-3" /> },
  { id: 'system-log' as const, label: 'System Log', icon: <Terminal className="w-3 h-3" /> },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function MiniBarChart({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 10 }}>
      {[4, 7, 3, 8, 5].map((h, i) => (
        <div key={i} className="w-[2.5px] rounded-sm opacity-40"
          style={{ height: `${h}px`, backgroundColor: color }} />
      ))}
    </div>
  );
}

function ConsoleWindow({
  logs, onClear,
}: {
  logs: { text: string; green?: boolean }[];
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: '#151520' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: '#1c1c2e' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F57' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEBC2E' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28C840' }} />
          <span className="text-white/40 text-[10px] font-semibold ml-2 tracking-wide">System Console</span>
        </div>
        <button onClick={onClear}
          className="text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer">
          Clear
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-1 overflow-y-auto" style={{ maxHeight: 110 }}>
        <AnimatePresence initial={false}>
          {logs.map((entry, i) => (
            <motion.p key={`${i}-${entry.text}`}
              initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`text-[10px] font-mono leading-relaxed ${entry.green ? 'text-green-400' : 'text-white/50'}`}>
              {entry.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── AgentCard ─────────────────────────────────────────────────────────────────

function AgentCard({
  agent, agentStates, compact = false,
}: {
  agent: AgentDef;
  agentStates: Record<AgentId, AgentState>;
  compact?: boolean;
}) {
  const state = agentStates[agent.id];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="rounded-2xl shadow-sm overflow-hidden w-full"
      style={{ backgroundColor: agent.cardBg, border: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div className={`flex items-start gap-2 ${compact ? 'px-2.5 pt-2 pb-1.5' : 'px-2.5 pt-2.5 pb-2'}`}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: agent.avatarBg }}>
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[11px] font-bold text-gray-900 truncate">{agent.name}</span>
            <span className="flex items-center gap-[3px] text-[9px] font-semibold whitespace-nowrap shrink-0"
              style={{ color: STATUS_COLOR[state.status] }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[state.status] }} />
              {state.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-400 truncate">{agent.desc}</span>
            {!compact && <MiniBarChart color={agent.accentColor} />}
          </div>
        </div>
      </div>
      <div className="h-px" style={{ background: 'rgba(255,255,255,0.7)' }} />
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <FileText className="w-2.5 h-2.5 text-gray-300 shrink-0" />
        <span className="text-[9px] text-gray-500 flex-1 truncate">{state.task}</span>
        <ChevronRight className="w-2.5 h-2.5 text-gray-300 shrink-0" />
      </div>
    </motion.div>
  );
}

// ── RightPanelContent ─────────────────────────────────────────────────────────

function RightPanelContent({
  compact = false,
  activeTab,
  setActiveTab,
  activityLog,
  consoleLogs,
  setConsoleLogs,
  agentStates,
}: {
  compact?: boolean;
  activeTab: 'activity' | 'agent-info' | 'system-log';
  setActiveTab: (tab: 'activity' | 'agent-info' | 'system-log') => void;
  activityLog: { time: string; text: string; color: string }[];
  consoleLogs: { text: string; green?: boolean }[];
  setConsoleLogs: React.Dispatch<React.SetStateAction<{ text: string; green?: boolean }[]>>;
  agentStates: Record<AgentId, AgentState>;
}) {
  return (
    <>
      {/* Tab bar */}
      <div className="flex items-end px-3 pt-2.5 border-b border-gray-100 gap-0 shrink-0">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-2 pb-2 text-[10px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] font-semibold text-gray-800">Live Activity</span>
            </div>
            <span className="text-[9px] font-semibold bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">
              ✏️ Demo Mode
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-2">
            {activityLog.length === 0 && (
              <p className="text-[10px] text-gray-400 italic">Activity appears once demo starts.</p>
            )}
            <AnimatePresence initial={false}>
              {activityLog.map((entry, i) => (
                <motion.div key={`${i}-${entry.text}`}
                  initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[4px]"
                    style={{ backgroundColor: entry.color }} />
                  <div>
                    <span className="text-[9px] text-gray-400 font-mono mr-1">{entry.time}</span>
                    <span className="text-[10px] text-gray-700">{entry.text}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Agent Info tab */}
      {activeTab === 'agent-info' && (
        <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
          {AGENTS.map((agent) => {
            const state = agentStates[agent.id];
            return (
              <div key={agent.id} className="rounded-xl px-2.5 py-2 border border-gray-100"
                style={{ backgroundColor: agent.cardBg }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-gray-800">{agent.name}</span>
                  <span className="text-[9px] font-semibold" style={{ color: STATUS_COLOR[state.status] }}>
                    {state.status}
                  </span>
                </div>
                <p className="text-[9px] text-gray-500 truncate mb-1">{state.task}</p>
                <div className="h-1 bg-gray-200/70 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full"
                    style={{ backgroundColor: agent.accentColor }}
                    animate={{ width: `${state.energy}%` }}
                    transition={{ duration: 0.6 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* System Log tab */}
      {activeTab === 'system-log' && (
        <div className={`flex-1 overflow-y-auto ${compact ? 'px-3 py-3' : 'p-3'}`}>
          <ConsoleWindow logs={consoleLogs}
            onClear={() => setConsoleLogs([{ text: '> Console cleared.' }])} />
        </div>
      )}

      {/* Console always visible below activity / agent-info */}
      {activeTab !== 'system-log' && (
        <div className="shrink-0 px-3 pb-3">
          <ConsoleWindow logs={consoleLogs}
            onClear={() => setConsoleLogs([{ text: '> Console cleared.' }])} />
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const RESET_STATES: Record<AgentId, AgentState> = {
  ceo: { status: 'Online',  task: 'Reviewing pipeline...',  energy: 95 },
  pm:  { status: 'Idle',    task: 'Awaiting brief...',       energy: 90 },
  hr:  { status: 'Online',  task: 'Monitoring morale',       energy: 96 },
  dev: { status: 'Idle',    task: 'Waiting for tasks...',    energy: 85 },
  qa:  { status: 'Idle',    task: 'Idle — waiting',          energy: 92 },
};

export default function AgentEcosystemIllustration() {
  const [step, setStep]           = useState<SimStep>('idle');
  const [goalIdx, setGoalIdx]     = useState(0);
  const [goalOpen, setGoalOpen]   = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'agent-info' | 'system-log'>('activity');
  const [activityLog, setActivityLog] = useState<{ time: string; text: string; color: string }[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<{ text: string; green?: boolean }[]>([
    { text: '> System ready. Press Run Demo to start.' },
  ]);
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(RESET_STATES);

  const nowStr = () => {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const pushActivity = (text: string, color: string) =>
    setActivityLog((p) => [{ time: nowStr(), text, color }, ...p.slice(0, 9)]);
  const pushConsole = (text: string, green = false) =>
    setConsoleLogs((p) => [...p.slice(-7), { text: `> ${text}`, green }]);

  useEffect(() => {
    if (step === 'idle') return;
    const goal = GOALS[goalIdx];
    let t: NodeJS.Timeout;
    switch (step) {
      case 'assigning':
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAgentStates((s) => ({ ...s,
          ceo: { status: 'Working', task: 'Defining the product goal...', energy: 94 },
          pm:  { status: 'Working', task: 'Creating product plan...',      energy: 90 },
        }));
        pushActivity(`Alex created goal: "${goal}"`, '#3B82F6');
        pushConsole('Initializing agents...');
        pushConsole(`Goal received: ${goal}`);
        t = setTimeout(() => setStep('decomposing'), 3000); break;

      case 'decomposing':
        setAgentStates((s) => ({ ...s,
          hr:  { status: 'Working', task: 'Syncing team resources',   energy: 94 },
          dev: { status: 'Working', task: 'Implementing features...', energy: 82 },
        }));
        pushActivity('Sam started product planning',  '#F59E0B');
        pushActivity('Riley synced team resources',   '#8B5CF6');
        pushConsole('Routing tasks to team...');
        t = setTimeout(() => setStep('executing'), 3000); break;

      case 'executing':
        setAgentStates((s) => ({ ...s,
          qa: { status: 'Working', task: 'Running test suite...', energy: 88 },
        }));
        pushActivity('Mike started implementing features', '#3B82F6');
        pushActivity('Tina running automated tests',       '#8B5CF6');
        pushConsole('Agents online. Simulation started.', true);
        t = setTimeout(() => setStep('testing'), 3500); break;

      case 'testing':
        setAgentStates((s) => ({ ...s,
          qa:  { status: 'Working', task: 'Final validation checks...', energy: 80 },
          dev: { status: 'Working', task: 'Fixing QA feedback...',       energy: 70 },
        }));
        pushActivity('Tina flagged 2 issues for review', '#8B5CF6');
        pushConsole('QA pass 1 complete. 2 issues flagged.');
        t = setTimeout(() => setStep('deployed'), 3500); break;

      case 'deployed':
        setAgentStates({
          ceo: { status: 'Online', task: 'Goal complete!',   energy: 98 },
          pm:  { status: 'Online', task: 'Sprint complete!', energy: 95 },
          hr:  { status: 'Online', task: 'Morale stable',    energy: 98 },
          dev: { status: 'Online', task: 'Shipped to prod',  energy: 90 },
          qa:  { status: 'Online', task: 'All tests green',  energy: 90 },
        });
        pushActivity(`Deployed: ${goal} ✓`, '#10B981');
        pushConsole('Build passed. Deployed successfully.', true);
        t = setTimeout(() => setStep('idle'), 5000); break;
    }
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleRunDemo = () => {
    if (step !== 'idle') {
      setStep('idle');
      setAgentStates(RESET_STATES);
      setActivityLog([]);
      setConsoleLogs([{ text: '> Simulation reset.' }]);
    } else {
      setActivityLog([]);
      setConsoleLogs([{ text: '> Starting simulation...' }]);
      setStep('assigning');
    }
  };

  const isRunning = step !== 'idle';

  const panelProps = { activeTab, setActiveTab, activityLog, consoleLogs, setConsoleLogs, agentStates };

  return (
    <div className="w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Zap className="w-4 sm:w-[18px] h-4 sm:h-[18px] text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-[13px] sm:text-[14px] leading-none">
              Ecosystem Simulator
            </h3>
            <p className="text-gray-400 text-[10px] sm:text-[11px] mt-[3px] hidden sm:block">
              Interactive multi-agent orchestration demo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Goal dropdown — hidden on xs, shown sm+ */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setGoalOpen((v) => !v)}
              className="flex items-center gap-1.5 border border-gray-200 rounded-full px-3 py-1.5 text-[11px] sm:text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <span className="text-sm leading-none">🎯</span>
              <span className="hidden md:inline">Goal: </span>
              <span className="max-w-[110px] truncate">{GOALS[goalIdx]}</span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>
            <AnimatePresence>
              {goalOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-lg py-1.5 z-30 min-w-[190px]"
                >
                  {GOALS.map((g, i) => (
                    <button key={i} onClick={() => { setGoalIdx(i); setGoalOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-[12px] font-medium hover:bg-gray-50 transition-colors cursor-pointer ${i === goalIdx ? 'text-blue-600' : 'text-gray-700'}`}>
                      {g}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={handleRunDemo}
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[12px] sm:text-[13px] font-semibold shadow-sm transition-all cursor-pointer ${
              isRunning ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}>
            {isRunning
              ? <><RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> Reset</>
              : <><Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" /> Run Demo</>}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE  (< md)  —  stacked: agent grid on top, panel below
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:hidden">
        {/* Agent grid */}
        <div className="p-3" style={{ background: 'linear-gradient(135deg,#EFF6FF 0%,#FAFAFA 50%,#F5F3FF 100%)' }}>
          {/* CEO spans full row */}
          <div className="mb-2">
            <AgentCard agent={AGENTS[0]} agentStates={agentStates} compact />
          </div>
          {/* Two columns: PM + HR */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <AgentCard agent={AGENTS[1]} agentStates={agentStates} compact />
            <AgentCard agent={AGENTS[2]} agentStates={agentStates} compact />
          </div>
          {/* Two columns: Dev + QA */}
          <div className="grid grid-cols-2 gap-2">
            <AgentCard agent={AGENTS[3]} agentStates={agentStates} compact />
            <AgentCard agent={AGENTS[4]} agentStates={agentStates} compact />
          </div>
        </div>

        {/* Activity panel */}
        <div className="flex flex-col border-t border-gray-100" style={{ minHeight: 260 }}>
          <RightPanelContent compact {...panelProps} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TABLET + DESKTOP  (≥ md)  —  horizontal: sidebar | canvas | panel
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex md:h-[340px] lg:h-[380px]">

        {/* Left zoom sidebar — desktop only */}
        <div className="hidden lg:flex flex-col items-center gap-1.5 pt-4 pb-4 px-2 border-r border-gray-100 shrink-0">
          {[
            { title: 'Zoom in',  content: <span className="text-base font-light leading-none">+</span> },
            { title: 'Zoom out', content: <span className="text-base font-light leading-none">−</span> },
            { title: 'Fit view', content: <RefreshCw className="w-3 h-3" /> },
          ].map((btn) => (
            <button key={btn.title} title={btn.title}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer">
              {btn.content}
            </button>
          ))}
          <div className="w-px flex-1 bg-gray-100 my-1" />
          <button title="Filter" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M4 7h6M6 10.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#EFF6FF 0%,#FAFAFA 50%,#F5F3FF 100%)' }}>

          {/* SVG bezier connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100" preserveAspectRatio="none">
            {PATHS.map((p, i) => (
              <path key={i} d={p.d} stroke={p.color} strokeWidth="0.55" fill="none"
                vectorEffect="non-scaling-stroke" />
            ))}
          </svg>

          {/* Junction dots */}
          {PATHS.map((p, i) => (
            <div key={i} className="absolute rounded-full border-2 border-white shadow-sm"
              style={{
                width: 9, height: 9,
                left: `${p.dot[0]}%`, top: `${p.dot[1]}%`,
                transform: 'translate(-50%,-50%)',
                backgroundColor: p.color, zIndex: 0,
              }} />
          ))}

          {/* Agent nodes — card width scales: 140px on md, 160px on lg */}
          {AGENTS.map((agent) => (
            <div key={agent.id} className="absolute" style={{
              left: `${agent.x}%`, top: `${agent.y}%`,
              transform: 'translate(-50%,-50%)', zIndex: 1,
            }}>
              <div className="w-[140px] lg:w-[162px]">
                <AgentCard agent={agent} agentStates={agentStates} />
              </div>
            </div>
          ))}
        </div>

        {/* Right panel */}
        <div className="w-[220px] lg:w-[252px] shrink-0 border-l border-gray-100 flex flex-col bg-white">
          <RightPanelContent {...panelProps} />
        </div>
      </div>
    </div>
  );
}
