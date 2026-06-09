'use client';

import { useRouter } from 'next/navigation';
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
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Cpu, Loader2, Sparkles } from 'lucide-react';

const BootLoader = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((p) => (p.length >= 3 ? '' : p + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full min-h-[460px] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-200/50">
          <Cpu className="w-8 h-8 text-white" />
        </div>
        <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-sky-400/20 to-cyan-400/20 blur-xl animate-pulse" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-800">Loading Simulation{dots}</h2>
        <p className="text-sm text-gray-400 mt-1">Preparing your AI workspace</p>
      </div>
      <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
    </div>
  );
};

const GameCanvas = dynamic(() => import('@/game/GameCanvas'), {
  ssr: false,
  loading: () => <BootLoader />,
});

export default function WorkspacePage() {
  const router = useRouter();
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

  useEffect(() => {
    if (!isInitialized) {
      router.replace('/onboard');
    }
  }, [isInitialized, router]);

  if (!isInitialized) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-white text-gray-900">
      <TopBar />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 card-shadow flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between mb-3 px-1 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sky-400" />
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Simulation Monitor
                </h2>
              </div>
              <span className="text-[10px] text-gray-400">Live</span>
            </div>
            <div className="flex-1 min-w-0 relative rounded-xl overflow-hidden bg-gray-50">
              <GameCanvas />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow flex flex-col max-h-[508px] overflow-hidden">
            <AgentInspector />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow">
          <div className="flex items-center justify-between mb-3 px-1 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Company Metrics
              </h2>
            </div>
            <span className="text-[10px] text-gray-400">Live KPIs</span>
          </div>
          <CompanyMetrics />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sky-400" />
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Activity Stream
                </h2>
              </div>
              <span className="text-[10px] text-gray-400">Live Feed</span>
            </div>
            <div className="flex-1 min-h-0">
              <ActivityFeed />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Communications
                </h2>
              </div>
              <span className="text-[10px] text-gray-400">Agent Chat</span>
            </div>
            <div className="flex-1 min-h-0">
              <ConversationPanel />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Task Queue
                </h2>
              </div>
              <span className="text-[10px] text-gray-400">Backlog</span>
            </div>
            <TaskQueue />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow flex flex-col">
            <ExecutionLogViewer />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow flex flex-col">
            <ProjectsFolder />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 card-shadow">
          <EventLog />
        </div>
      </div>

      <div className="bg-white border-t border-gray-100 px-4 md:px-6 py-3 flex justify-center shrink-0">
        <div className="flex items-center gap-3 w-full max-w-2xl">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={taskIdea}
            onChange={(e) => setTaskIdea(e.target.value)}
            placeholder={`Assign a task to ${companyName} agents...`}
            className="flex-1 px-4 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-900 rounded-xl outline-none placeholder-gray-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 transition-all"
            autoFocus
            disabled={isInjecting}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInjectCustom();
            }}
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleInjectCustom}
            disabled={!taskIdea.trim() || isInjecting}
            className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-sky-400 to-cyan-400 text-white rounded-xl hover:from-sky-500 hover:to-cyan-500 disabled:opacity-40 transition-all shadow-sm cursor-pointer"
          >
            Execute
          </motion.button>
        </div>
      </div>

      <TaskProgressTracker />
      <CredentialDialog />
      <EasterEgg />
    </div>
  );
}
