'use client';

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { useUser, UserButton } from '@clerk/nextjs';
import ScrumMeeting from '@/components/ScrumMeeting';
import { Cpu, Play, Pause } from 'lucide-react';

export default function TopBar() {
  const { isSignedIn } = useUser();
  const simulation = useGameStore((s) => s.simulation);
  const setPaused = useGameStore((s) => s.setPaused);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const addTaskWithTitle = useGameStore((s) => s.addTaskWithTitle);
  const [isInjecting, setIsInjecting] = useState(false);

  const handleInjectCustom = useCallback((taskIdea: string) => {
    if (!taskIdea.trim()) return;
    setIsInjecting(true);
    addTaskWithTitle(taskIdea.trim());
    setIsInjecting(false);
  }, [addTaskWithTitle]);

  return (
    <div className="bg-white border-b border-gray-100 px-5 py-3 flex flex-col md:flex-row items-center justify-between gap-3 z-30 shrink-0 sticky top-0 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center shadow-sm">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            AgentCorp
            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">v2.0</span>
          </h1>
          <p className="text-[10px] text-gray-400 font-medium">
            Autonomous Multi-Agent Workspace
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isSignedIn && (
          <div className="flex items-center gap-2 pr-3 border-r border-gray-100">
            <span className="text-[9px] text-gray-400 font-medium uppercase">Operator</span>
            <UserButton />
          </div>
        )}

        <ScrumMeeting />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setPaused(!simulation.paused)}
          className={`px-3 py-1.5 text-[10px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
            simulation.paused
              ? 'border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100'
              : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
          }`}
        >
          {simulation.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {simulation.paused ? 'Resume' : 'Pause'}
        </motion.button>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
          <span className="text-gray-400 text-[9px] font-semibold uppercase">Speed</span>
          <div className="flex bg-gray-50 border border-gray-200 p-0.5 rounded-lg">
            {[0.5, 1, 2, 4].map((speed) => (
              <motion.button
                key={speed}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSpeed(speed)}
                className={`px-2 py-0.5 text-[9px] font-semibold rounded-md transition-all cursor-pointer ${
                  simulation.speed === speed
                    ? 'bg-gradient-to-r from-sky-400 to-cyan-400 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 bg-transparent'
                }`}
              >
                {speed}x
              </motion.button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
          <span className="text-gray-400 text-[9px] font-semibold uppercase">Efficiency</span>
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="18" cy="18" r="15"
                className="stroke-gray-100"
                strokeWidth="2.5"
                fill="transparent"
              />
              <motion.circle
                cx="18" cy="18" r="15"
                stroke={simulation.efficiency > 70 ? '#6CC04A' : simulation.efficiency > 40 ? '#F59E0B' : '#EF4444'}
                strokeWidth="2.5"
                fill="transparent"
                strokeDasharray="94.25"
                animate={{ strokeDashoffset: 94.25 - (simulation.efficiency / 100) * 94.25 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-700">
              {Math.round(simulation.efficiency)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
