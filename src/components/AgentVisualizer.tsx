'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

const AgentVisualizer = () => {
  const agents = useGameStore((s) => s.agents);

  return (
    <div className="relative w-full h-full bg-canvas/50 rounded-lg border border-border/40 p-3 overflow-y-auto">
      <div className="text-[#00f5ff] font-mono text-xs mb-2 tracking-wider">
        AGENT STATUS
      </div>
      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-2 text-[11px] font-mono"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: `#${agent.color.toString(16).padStart(6, '0')}` }}
            />
            <span className="text-white/80 w-16 truncate">{agent.name}</span>
            <span className={`${
              agent.mood === 'happy' ? 'text-green-400' :
              agent.mood === 'frustrated' ? 'text-red-400' :
              agent.mood === 'tired' ? 'text-yellow-400' :
              'text-subtle'
            }`}>
              {agent.mood}
            </span>
            <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${agent.energy}%`,
                  backgroundColor: agent.energy > 60 ? '#22c55e' : agent.energy > 30 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <span className="text-white/40 w-8 text-right">{Math.round(agent.energy)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentVisualizer;
