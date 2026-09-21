'use client';

import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';
import { useUser, UserButton } from '@clerk/nextjs';
import ScrumMeeting from '@/components/ScrumMeeting';
import { Cpu, Play, Pause } from 'lucide-react';

export default function TopBar() {
  const { isSignedIn } = useUser();
  const simulation = useGameStore((s) => s.simulation);
  const setPaused = useGameStore((s) => s.setPaused);

  return (
    <div className="glass-topbar px-5 py-2.5 flex items-center justify-between gap-3 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-ocean to-teal flex items-center justify-center shadow-[0_4px_14px_rgba(10,132,255,0.3)]">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-navy flex items-center gap-2 font-display tracking-tight">
            AgentCorp
            <span className="text-[9px] bg-white/80 text-navy/50 px-1.5 py-0.5 rounded-md font-medium border border-navy/5">v2.0</span>
          </h1>
          <p className="text-[10px] text-navy/50 font-medium">Autonomous Multi-Agent Workspace</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isSignedIn && (
          <div className="flex items-center gap-2 pr-3 border-r glass-divider">
            <span className="text-[9px] text-navy/50 font-medium uppercase">Operator</span>
            <UserButton />
          </div>
        )}

        <ScrumMeeting />

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setPaused(!simulation.paused)}
          className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${simulation.paused
              ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
              : 'glass-card text-navy/60 hover:text-navy'
            }`}
        >
          {simulation.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {simulation.paused ? 'Resume' : 'Pause'}
        </motion.button>

        <div className="flex items-center gap-2.5 pl-3 border-l glass-divider">
          <span className="text-navy/50 text-[9px] font-semibold uppercase">Efficiency</span>
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="15" className="stroke-[rgba(23,23,31,0.08)]" strokeWidth="2.5" fill="transparent" />
              <motion.circle
                cx="18" cy="18" r="15"
                stroke={simulation.efficiency > 70 ? '#34C759' : simulation.efficiency > 40 ? '#FF9F0A' : '#FF3B30'}
                strokeWidth="2.5"
                fill="transparent"
                strokeDasharray="94.25"
                animate={{ strokeDashoffset: 94.25 - (simulation.efficiency / 100) * 94.25 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-navy">
              {Math.round(simulation.efficiency)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}