'use client';

import dynamic from 'next/dynamic';
import TopBar from '@/components/TopBar';
import RightPanel from '@/components/RightPanel';
import EasterEgg from '@/components/EasterEgg';
import TaskProgressTracker from '@/components/TaskProgressTracker';
import AgentVisualizer from '@/components/AgentVisualizer';
import CredentialDialog from '@/components/CredentialDialog';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

const GameCanvas = dynamic(() => import('@/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-canvas rounded-lg border border-[#00f5ff]/20 flex items-center justify-center">
      <div className="text-center">
        <div className="text-[#00f5ff] font-mono text-sm animate-pulse mb-2">
          INITIALIZING SYSTEMS...
        </div>
        <div className="flex gap-1 justify-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-[#00f5ff] rounded-full"
              style={{ animation: `float 1.5s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  ),
});

export default function Home() {
  const [taskIdea, setTaskIdea] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const addTaskWithTitle = useGameStore((s) => s.addTaskWithTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInjectCustom = () => {
    if (!taskIdea.trim()) return;
    setIsInjecting(true);
    addTaskWithTitle(taskIdea.trim());
    setTaskIdea('');
    setIsInjecting(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-panel overflow-hidden">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Game Canvas (fills all available space) */}
        <div className="flex-1 p-3 bg-canvas min-w-0">
          <GameCanvas />
        </div>

        {/* Right - Dashboard Panel */}
        <RightPanel />
      </div>

      {/* Inject Task */}
      <div className="flex justify-center items-center p-4">
        <motion.div
          className="flex items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <input
            ref={inputRef}
            type="text"
            value={taskIdea}
            onChange={(e) => setTaskIdea(e.target.value)}
            placeholder="Give agents a task — e.g. &quot;Build a landing page&quot;..."
            className="w-full max-w-xs px-3 py-1.5 text-sm bg-surface border border-[#f59e0b]/50 text-[#f59e0b] rounded-lg outline-none placeholder-[#f59e0b]/30"
            autoFocus
            disabled={isInjecting}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInjectCustom();
            }}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleInjectCustom}
            disabled={!taskIdea.trim() || isInjecting}
            className="ml-1.5 px-3 py-1.5 text-xs font-medium bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] rounded-lg hover:bg-[#f59e0b]/30 disabled:opacity-30"
          >
            Go
          </motion.button>
        </motion.div>
      </div>

      {/* Task Progress Tracker */}
      <TaskProgressTracker />

      {/* Credential Request Dialog */}
      <CredentialDialog />

      {/* Easter Egg Component */}
      <EasterEgg />
    </div>
  );
}