'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Plus, BookOpen, Volume2, VolumeX, ChevronRight, ChevronDown, X } from 'lucide-react';

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
      className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-left transition-all duration-200 ${
        isSelected
          ? 'glass-card !bg-white/90 shadow-md border-navy/15'
          : 'hover:bg-[rgba(23,23,31,0.03)]'
      }`}
    >
      <div className="relative shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-sm bg-white"
          style={{ border: `1px solid ${colorHex}26` }}
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
          <span className="text-sm font-bold text-navy truncate">{agent.name}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] font-bold capitalize" style={{ color: colorHex }}>{agent.role.toUpperCase()}</span>
          <span className="text-navy/30 text-[10px]">·</span>
          <span className="text-[10px] text-navy/50 font-medium">Online</span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-navy/30" />
    </motion.button>
  );
}

export default function LeftSidebar() {
  const agents = useGameStore((s) => s.agents);
  const onlineCount = agents.filter((a) => a.online).length;
  const clearUserMessages = useGameStore((s) => s.clearUserMessages);
  const setSelectedAgent = useGameStore((s) => s.setSelectedAgent);
  const isMuted = useGameStore((s) => s.isMuted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const showLibrary = useGameStore((s) => s.showLibrary);
  const toggleLibrary = useGameStore((s) => s.toggleLibrary);
  const simulation = useGameStore((s) => s.simulation);
  const tasks = useGameStore((s) => s.tasks);
  const projects = useGameStore((s) => s.deliverableProjects);
  const [showSimDetails, setShowSimDetails] = useState(false);

  const handleNewChat = () => {
    clearUserMessages();
    setSelectedAgent(null);
  };

  return (
    <div className="w-1/4 shrink-0 h-full min-h-0 glass-sidebar flex flex-col justify-between">
      <div className="flex-1 flex flex-col min-h-0">
        {/* New Chat & Library Buttons */}
        <div className="p-4 flex items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleNewChat}
            title="Start new chat (clears messages and selection)"
            className="flex-1 py-3 px-4 rounded-full bg-gradient-to-r from-ocean to-teal text-white text-xs font-bold flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(10,132,255,0.25)] cursor-pointer hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={toggleLibrary}
            title={showLibrary ? 'Hide team library' : 'Show team library (tasks + deliverables)'}
            className={`p-3 rounded-2xl glass-card cursor-pointer ${showLibrary ? 'text-ocean-600 bg-ocean-50' : 'text-navy/60 hover:text-navy'}`}
          >
            <BookOpen className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Section Label */}
        <div className="px-4 py-1 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-navy/40">Agents</span>
            <p className="text-[10px] text-navy/55 mt-0.5 font-medium">{onlineCount}/{agents.length} online</p>
          </div>
        </div>

        {/* Agents List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1 glass-scrollbar">
          {showLibrary ? (
            <div className="space-y-3 px-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40 mb-1.5">Recent tasks ({tasks.length})</p>
                {tasks.length === 0 ? (
                  <p className="text-[11px] text-navy/40">No tasks yet. Send a message to create one.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto glass-scrollbar">
                    {[...tasks].slice(-8).reverse().map((t) => (
                      <div key={t.id} className="text-[11px] bg-white/70 border border-navy/5 rounded-xl px-2.5 py-1.5">
                        <p className="font-bold text-navy truncate">{t.title}</p>
                        <p className="text-navy/40 text-[10px] capitalize">{t.status}{t.assignedTo ? ` · ${agents.find((a) => a.id === t.assignedTo)?.name || ''}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40 mb-1.5">Deliverables ({projects.length})</p>
                {projects.length === 0 ? (
                  <p className="text-[11px] text-navy/40">No deliverables yet.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto glass-scrollbar">
                    {[...projects].slice(-8).reverse().map((p) => (
                      <div key={p.id} className="text-[11px] bg-white/70 border border-navy/5 rounded-xl px-2.5 py-1.5">
                        <p className="font-bold text-navy truncate">{p.title}</p>
                        <p className="text-navy/40 text-[10px] uppercase">{p.type}{p.lang ? ` · ${p.lang}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={toggleLibrary} className="text-[11px] font-bold text-navy/50 hover:text-navy flex items-center gap-1 cursor-pointer">
                <X className="w-3 h-3" /> Back to agents
              </button>
            </div>
          ) : (
            agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t glass-divider bg-white/40 relative">
        <AnimatePresence>
          {showSimDetails && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-2 right-2 mb-2 bg-white border border-navy/10 rounded-2xl shadow-lg p-3 text-[11px]"
            >
              <p className="font-bold text-navy mb-1.5">Simulation details</p>
              <div className="grid grid-cols-2 gap-1.5 text-navy/60">
                <span>Efficiency</span><span className="text-right font-bold text-navy">{Math.round(simulation.efficiency)}%</span>
                <span>Morale</span><span className="text-right font-bold text-navy">{Math.round(simulation.morale)}%</span>
                <span>CPU</span><span className="text-right font-bold text-navy">{simulation.cpuUsage}%</span>
                <span>Memory</span><span className="text-right font-bold text-navy">{simulation.memoryUsage} GB</span>
                <span>Completed</span><span className="text-right font-bold text-navy">{simulation.totalTasksCompleted}</span>
                <span>Failed</span><span className="text-right font-bold text-navy">{simulation.totalTasksFailed}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold">N</div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${simulation.paused ? 'bg-amber-400' : 'bg-[#34C759] animate-pulse'}`} />
                <span className="text-[11px] font-bold text-navy">{simulation.paused ? 'Simulation paused' : 'Simulation active'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute ambient chatter' : 'Mute ambient chatter'}
              className="p-1.5 hover:bg-navy/5 rounded-lg cursor-pointer text-navy/40 hover:text-navy/70"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowSimDetails((v) => !v)}
              title={showSimDetails ? 'Hide simulation details' : 'Show simulation details'}
              className="p-1.5 hover:bg-navy/5 rounded-lg cursor-pointer text-navy/30 hover:text-navy/60"
            >
              {showSimDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}