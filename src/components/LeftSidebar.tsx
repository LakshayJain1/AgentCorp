'use client';

import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';

const STATUS_DOT: Record<string, { color: string; pulse: boolean }> = {
  idle: { color: 'rgba(23,23,31,0.18)', pulse: false },
  thinking: { color: '#FF9F0A', pulse: true },
  researching: { color: '#0A84FF', pulse: true },
  coding: { color: '#FF9F0A', pulse: true },
  debugging: { color: '#FF453A', pulse: true },
  reviewing: { color: '#BF5AF2', pulse: true },
  waiting: { color: '#5E5CE6', pulse: false },
  blocked: { color: '#FF3B30', pulse: true },
  completed: { color: '#34C759', pulse: false },
};

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  researching: 'Researching',
  coding: 'Coding',
  debugging: 'Debugging',
  reviewing: 'Reviewing',
  waiting: 'Waiting',
  blocked: 'Blocked',
  completed: 'Done',
};

function AgentRow({ agent }: { agent: { id: string; name: string; role: string; emoji: string; color: number; online: boolean; workStatus: string; currentTaskId: string | null } }) {
  const selectedAgentId = useGameStore((s) => s.selectedAgentId);
  const setSelectedAgent = useGameStore((s) => s.setSelectedAgent);
  const tasks = useGameStore((s) => s.tasks);
  const isSelected = selectedAgentId === agent.id;
  const currentTask = agent.currentTaskId ? tasks.find((t) => t.id === agent.currentTaskId) : null;
  const statusInfo = STATUS_DOT[agent.workStatus] || STATUS_DOT.idle;
  const colorHex = `#${agent.color.toString(16).padStart(6, '0')}`;

  return (
    <motion.button
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left transition-all duration-200 ${
        isSelected
          ? 'glass-card !bg-[rgba(10,132,255,0.08)] !border-[rgba(10,132,255,0.25)]'
          : 'hover:bg-[rgba(23,23,31,0.03)]'
      }`}
    >
      <div className="relative shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-sm"
          style={{ backgroundColor: `${colorHex}14`, border: `1px solid ${colorHex}26` }}
        >
          {agent.emoji}
        </div>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${agent.online ? 'bg-[#34C759]' : 'bg-gray-200'}`}
          style={{ borderColor: 'rgba(255,255,255,0.9)' }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-navy truncate">{agent.name}</span>
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.pulse ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: statusInfo.color }}
          />
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] capitalize font-medium" style={{ color: colorHex }}>{agent.role}</span>
          {currentTask && (
            <>
              <span className="text-navy/30 text-[10px]">·</span>
              <span className="text-[10px] text-navy/50 truncate max-w-[100px]">{currentTask.title}</span>
            </>
          )}
          {!currentTask && (
            <>
              <span className="text-navy/30 text-[10px]">·</span>
              <span className="text-[10px] text-navy/50">{STATUS_LABEL[agent.workStatus] || 'Idle'}</span>
            </>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export default function LeftSidebar() {
  const agents = useGameStore((s) => s.agents);
  const onlineCount = agents.filter((a) => a.online).length;

  return (
    <div className="w-1/4 shrink-0 h-full glass-sidebar flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <span className="text-[10px] font-semibold glass-section-label uppercase tracking-wider">Agents</span>
        <p className="text-[10px] text-navy/50 mt-0.5">{onlineCount}/{agents.length} online</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-0.5 glass-scrollbar">
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </div>

      <div className="px-4 py-2.5 border-t glass-divider">
        <div className="flex items-center gap-1.5 text-[10px] text-navy/55">
          <div className="w-1.5 h-1.5 bg-[#34C759] rounded-full animate-pulse" />
          <span>Simulation active</span>
        </div>
      </div>
    </div>
  );
}