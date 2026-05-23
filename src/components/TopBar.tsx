'use client';

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';
import ScrumMeeting from '@/components/ScrumMeeting';

export default function TopBar() {
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
    <div className="bg-card border-b border-border/60 px-5 py-3 flex items-center justify-between z-30">
      {/* Logo & Company Name */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#6366f1]/10 border border-[#6366f1]/30 rounded-lg flex items-center justify-center">
          <span className="text-[#6366f1] text-sm font-bold">AC</span>
        </div>
        <div>
          <h1 className="text-white text-base font-semibold">
            AgentCorp
          </h1>
          <p className="text-muted text-xs">
            AI Employee Simulation
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <ThemeToggle />

        <ScrumMeeting />

        {/* Play/Pause */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setPaused(!simulation.paused)}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-all ${
            simulation.paused
              ? 'border-[#ef4444]/50 text-[#ef4444] bg-[#ef4444]/10'
              : 'border-[#22c55e]/50 text-[#22c55e] bg-[#22c55e]/10'
          }`}
        >
          {simulation.paused ? '▶ Resume' : '⏸ Pause'}
        </motion.button>

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted text-xs font-medium">Speed</span>
          {[0.5, 1, 2, 4].map((speed) => (
            <motion.button
              key={speed}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSpeed(speed)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                simulation.speed === speed
                  ? 'border-[#6366f1] text-[#6366f1] bg-[#6366f1]/15'
                  : 'border-border text-muted bg-transparent hover:border-[#6366f1]/40 hover:text-gray-300'
              }`}
            >
              {speed}x
            </motion.button>
          ))}
        </div>

        {/* Efficiency Meter */}
        <div className="flex items-center gap-2.5">
          <span className="text-muted text-xs font-medium">Efficiency</span>
          <div className="w-24 h-2.5 bg-surface rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${simulation.efficiency}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                simulation.efficiency > 70
                  ? 'bg-[#22c55e]'
                  : simulation.efficiency > 40
                  ? 'bg-[#f59e0b]'
                  : 'bg-[#ef4444]'
              }`}
            />
          </div>
          <span className="text-subtle text-sm font-medium min-w-[3rem]">
            {Math.round(simulation.efficiency)}%
          </span>
        </div>
      </div>
    </div>
  );
}