'use client';

import dynamic from 'next/dynamic';
import TopBar from '@/components/TopBar';
import EasterEgg from '@/components/EasterEgg';
import TaskProgressTracker from '@/components/TaskProgressTracker';
import CredentialDialog from '@/components/CredentialDialog';
import SetupWizard from '@/components/SetupWizard';
import CompanyMetrics from '@/components/CompanyMetrics';
import ActivityFeed from '@/components/ActivityFeed';
import ConversationPanel from '@/components/ConversationPanel';
import ProjectsFolder from '@/components/ProjectsFolder';
import AgentInspector from '@/components/AgentInspector';
import EventLog from '@/components/EventLog';
import TaskQueue from '@/components/TaskQueue';
import ExecutionLogViewer from '@/components/ExecutionLogViewer';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

// Premium Typewriter CRT Boot sequence loading animation
const BootLoader = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const bootLines = [
    'AGENTCORP CORE OS v2.0.6_PHASER',
    'SYSTEM ROM VERIFICATION... OK',
    'ALLOCATING GRAPHICS BUFFER (560x400)... SUCCESS',
    'ESTABLISHING SYSTEM TICK SIGNAL... 60Hz',
    'MOUNTING LOCAL FILE DELIVERABLES STORAGE... OK',
    'SYNCHRONIZING CENTRAL ZUSTAND ORCHESTRATOR...',
    'INITIALIZING SYSTEMS...',
  ];

  useEffect(() => {
    let currentLineIndex = 0;
    const interval = setInterval(() => {
      if (currentLineIndex < bootLines.length) {
        setLogs((prev) => [...prev, bootLines[currentLineIndex]]);
        currentLineIndex++;
      } else {
        clearInterval(interval);
      }
    }, 380);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] bg-canvas rounded-xl border border-border p-5 flex flex-col justify-between font-mono text-xs text-[#00ff88] border-glow">
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] text-subtle border-b border-border/30 pb-2">
          <span>BIOS Version 4.88-B</span>
          <span>DATE: May 28, 2026</span>
        </div>
        <div className="space-y-1 pt-2">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-subtle shrink-0">&gt;</span>
              <span>{log}</span>
              {idx === logs.length - 1 && idx < bootLines.length - 1 && (
                <span className="terminal-cursor" />
              )}
            </div>
          ))}
          {logs.length === bootLines.length && (
            <div className="pt-4 text-center text-[#ffb400] font-bold animate-pulse text-glow uppercase tracking-wider text-xs">
              *** BOOT COMPLETE - DEPLOYING USER INTERFACE ***
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center text-[9px] text-subtle border-t border-border/30 pt-3 mt-4">
        <span>RAM: 640KB BASE / 32MB EXTENDED</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />
          <span>SIM_STATUS: CONNECTED</span>
        </div>
      </div>
    </div>
  );
};

const GameCanvas = dynamic(() => import('@/game/GameCanvas'), {
  ssr: false,
  loading: () => <BootLoader />,
});

export default function Home() {
  const [taskIdea, setTaskIdea] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const addTaskWithTitle = useGameStore((s) => s.addTaskWithTitle);
  const isInitialized = useGameStore((s) => s.isInitialized);
  const companyName = useGameStore((s) => s.companyName);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInjectCustom = () => {
    if (!taskIdea.trim()) return;
    setIsInjecting(true);
    addTaskWithTitle(taskIdea.trim());
    setTaskIdea('');
    setIsInjecting(false);
  };

  // Show Setup Wizard if the office hasn't been initialized yet
  if (!isInitialized) {
    return <SetupWizard />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-canvas text-text font-mono relative overflow-hidden crt-screen">
      {/* Subtle CRT Screen overlay texture */}
      <div className="crt-scanlines" />

      {/* Top Bar / Control Room Bar */}
      <TopBar />

      {/* Main Grid Content — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* ROW 1: Simulation Screen & Employees Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulation Viewport (CRT styling) */}
          <div className="lg:col-span-2 bg-panel rounded-2xl border border-border p-4 shadow-xl flex flex-col min-h-[460px] border-glow">
            <div className="flex items-center justify-between mb-3 px-1 border-b border-border/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-glow">
                  SIMULATION_MONITOR
                </h2>
              </div>
              <span className="text-[10px] text-subtle">CRT-MON-01</span>
            </div>
            <div className="flex-1 min-w-0 relative rounded-xl overflow-hidden bg-[#050805]">
              <GameCanvas />
            </div>
          </div>

          {/* Personnel Database (Employees Roster) */}
          <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl flex flex-col border-glow max-h-[508px] overflow-hidden">
            <AgentInspector />
          </div>
        </div>

        {/* ROW 2: Metrics Panel (spanning all columns) */}
        <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl border-glow">
          <div className="flex items-center justify-between mb-3 px-1 border-b border-border/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-glow">
                COMPANY_METRICS
              </h2>
            </div>
            <span className="text-[10px] text-subtle">KPI_STREAM_LIVE</span>
          </div>
          <CompanyMetrics />
        </div>

        {/* ROW 3: Communications & Live Feeds (Activity Feed & Agent Chat) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Live Activity Feed */}
          <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl flex flex-col border-glow">
            <div className="flex items-center justify-between mb-3 px-1 border-b border-border/30 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-glow">
                  LIVE_ACTIVITY_STREAM
                </h2>
              </div>
              <span className="text-[10px] text-subtle">SSE_CONN_ESTABLISHED</span>
            </div>
            <div className="flex-1 min-h-0">
              <ActivityFeed />
            </div>
          </div>

          {/* Agent Chat Terminal */}
          <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl flex flex-col border-glow">
            <div className="flex items-center justify-between mb-3 px-1 border-b border-border/30 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-glow">
                  COMMUNICATION_CHATROOM
                </h2>
              </div>
              <span className="text-[10px] text-subtle">DECRYPTED_CHANNEL</span>
            </div>
            <div className="flex-1 min-h-0">
              <ConversationPanel />
            </div>
          </div>
        </div>

        {/* ROW 4: Logistics & Operations (Task Queue, Exec Logs, Projects Folder) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Task Backlog Console */}
          <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl flex flex-col border-glow">
            <div className="flex items-center justify-between mb-3 px-1 border-b border-border/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-glow">
                  TASK_BACKLOG_QUEUE
                </h2>
              </div>
              <span className="text-[10px] text-subtle font-mono">PRIORITIZED</span>
            </div>
            <TaskQueue />
          </div>

          {/* Execution Log */}
          <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl flex flex-col border-glow">
            <ExecutionLogViewer />
          </div>

          {/* Completed Deliverables Archive */}
          <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl flex flex-col border-glow">
            <ProjectsFolder />
          </div>
        </div>

        {/* Event Log — spans full width */}
        <div className="bg-panel rounded-2xl border border-border p-4 shadow-xl border-glow">
          <EventLog />
        </div>

      </div>

      {/* Fixed Task Input Bar at Bottom */}
      <div className="bg-panel border-t border-border/40 px-4 md:px-6 py-3 flex justify-center shrink-0">
        <div className="flex items-center gap-3 w-full max-w-2xl">
          <span className="text-amber-400 text-[11px] font-bold font-mono shrink-0">INJECT&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={taskIdea}
            onChange={(e) => setTaskIdea(e.target.value)}
            placeholder={`Directive for ${companyName} agents...`}
            className="flex-1 px-3 py-1.5 text-sm bg-canvas border border-border/50 text-text rounded-lg outline-none placeholder-muted/60 font-mono"
            autoFocus
            disabled={isInjecting}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInjectCustom();
            }}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleInjectCustom}
            disabled={!taskIdea.trim() || isInjecting}
            className="px-4 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider border border-amber-400/50 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 rounded-lg disabled:opacity-30 transition-all cursor-pointer"
          >
            Execute
          </motion.button>
        </div>
      </div>

      {/* Task Progress Tracker Overlay */}
      <TaskProgressTracker />

      {/* Credential Request Dialog */}
      <CredentialDialog />

      {/* Easter Egg Component */}
      <EasterEgg />
    </div>
  );
}