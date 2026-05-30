'use client';

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
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
    <div className="bg-panel border-b border-border/40 px-5 py-3 flex flex-col md:flex-row items-center justify-between gap-3 z-30 shrink-0 shadow-lg relative">
      {/* Logo & Company Name */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-text/10 border border-text/40 rounded-lg flex items-center justify-center">
          <span className="text-text text-sm font-bold text-glow">AC</span>
        </div>
        <div>
          <h1 className="text-text text-sm font-bold uppercase tracking-wider text-glow flex items-center gap-1.5">
            AgentCorp <span className="text-[9px] bg-text/10 border border-text/30 px-1 py-0.2 rounded font-mono text-glow">SYS_ON</span>
          </h1>
          <p className="text-subtle text-[10px] font-mono uppercase tracking-wide">
            Autonomous Multi-Agent Workspace
          </p>
        </div>
      </div>

      {/* Controls Area */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Meeting trigger */}
        <ScrumMeeting />

        {/* Play/Pause Terminal Toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setPaused(!simulation.paused)}
          className={`px-3 py-1 font-mono text-[10px] font-bold rounded-lg border uppercase tracking-wider transition-all cursor-pointer ${
            simulation.paused
              ? 'border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20'
              : 'border-text/50 text-text bg-text/10 hover:bg-text/20 text-glow'
          }`}
        >
          {simulation.paused ? '▶ RESUME_SIM' : '⏸ HALT_SIM'}
        </motion.button>

        {/* Speed Segmented Pill Controls */}
        <div className="flex items-center gap-2 border-l border-border/30 pl-3">
          <span className="text-subtle text-[9px] uppercase font-bold tracking-wider">SPEED</span>
          <div className="flex bg-surface border border-border/40 p-0.5 rounded-full">
            {[0.5, 1, 2, 4].map((speed) => (
              <motion.button
                key={speed}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSpeed(speed)}
                className={`px-2 py-0.5 text-[9px] font-bold font-mono rounded-full transition-all cursor-pointer ${
                  simulation.speed === speed
                    ? 'bg-text text-canvas text-glow font-extrabold'
                    : 'text-subtle hover:text-text bg-transparent'
                }`}
              >
                {speed}x
              </motion.button>
            ))}
          </div>
        </div>

        {/* Efficiency Circular Progress Ring */}
        <div className="flex items-center gap-2 border-l border-border/30 pl-3">
          <span className="text-subtle text-[9px] uppercase font-bold tracking-wider">EFFICIENCY</span>
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="18"
                cy="18"
                r="15"
                className="stroke-muted/20"
                strokeWidth="2.5"
                fill="transparent"
              />
              {/* Foreground progress circle */}
              <motion.circle
                cx="18"
                cy="18"
                r="15"
                stroke={
                  simulation.efficiency > 70
                    ? 'var(--text)'
                    : simulation.efficiency > 40
                    ? 'var(--color-amber)'
                    : 'var(--color-red)'
                }
                strokeWidth="2.5"
                fill="transparent"
                strokeDasharray="94.25"
                animate={{ strokeDashoffset: 94.25 - (simulation.efficiency / 100) * 94.25 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-glow">
              {Math.round(simulation.efficiency)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}