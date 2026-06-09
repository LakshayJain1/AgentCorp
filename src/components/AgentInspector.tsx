'use client';

import { useGameStore, getAgentById } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent } from '@/agents/AgentTypes';
import { X } from 'lucide-react';

const MOOD_COLORS: Record<string, string> = {
  happy: '#6CC04A',
  neutral: '#59C7FF',
  tired: '#F59E0B',
  frustrated: '#EF4444',
  focused: '#8B7CF6',
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#9CA3AF',
  thinking: '#F59E0B',
  researching: '#8B7CF6',
  coding: '#F59E0B',
  debugging: '#EF4444',
  reviewing: '#8B7CF6',
  waiting: '#7C3AED',
  blocked: '#EF4444',
  completed: '#6CC04A',
};

const STATUS_DOTS: Record<string, string> = {
  idle: '#D1D5DB',
  thinking: '#F59E0B',
  researching: '#8B7CF6',
  coding: '#F59E0B',
  debugging: '#EF4444',
  reviewing: '#8B7CF6',
  waiting: '#7C3AED',
  blocked: '#EF4444',
  completed: '#6CC04A',
};

const STATUS_LABELS: Record<string, string> = {
  idle: '💤 Idle',
  thinking: '🤔 Thinking',
  researching: '🔬 Researching',
  coding: '💻 Coding',
  debugging: '🐛 Debugging',
  reviewing: '🔍 Reviewing',
  waiting: '⏳ Waiting',
  blocked: '🚫 Blocked',
  completed: '✅ Completed',
};

const SENIORITY_COLORS: Record<string, string> = {
  junior: '#9CA3AF',
  mid: '#59C7FF',
  senior: '#F59E0B',
  lead: '#8B7CF6',
};

function AgentCard({ agent }: { agent: Agent }) {
  const setSelectedAgent = useGameStore((s) => s.setSelectedAgent);
  const tasks = useGameStore((s) => s.tasks);
  const currentTask = tasks.find((t) => t.id === agent.currentTaskId);
  const score = Math.round(
    agent.performance.productivityScore * 0.3 +
    agent.performance.reliabilityScore * 0.3 +
    agent.performance.collaborationScore * 0.2 +
    agent.efficiency * 0.2,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => setSelectedAgent(agent.id)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="text-xl">{agent.emoji}</div>
            {agent.online && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border-2 border-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-gray-900 font-semibold text-xs flex items-center gap-1.5 truncate">
              {agent.name}
              {agent.performance.seniority !== 'junior' && (
                <span
                  className="text-[8px] font-semibold px-1 py-0.5 rounded-md shrink-0"
                  style={{
                    backgroundColor: `${SENIORITY_COLORS[agent.performance.seniority]}15`,
                    color: SENIORITY_COLORS[agent.performance.seniority],
                    border: `1px solid ${SENIORITY_COLORS[agent.performance.seniority]}25`,
                  }}
                >
                  {agent.performance.seniority.slice(0, 3)}
                </span>
              )}
            </div>
            <div
              className="text-[9px] font-semibold uppercase tracking-wide truncate mt-0.5"
              style={{ color: `#${agent.color.toString(16).padStart(6, '0')}` }}
            >
              {agent.role}
            </div>
          </div>
        </div>
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: MOOD_COLORS[agent.mood] || '#9CA3AF' }}
        />
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: STATUS_DOTS[agent.workStatus] || '#D1D5DB' }}
        />
        <div
          className="text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: STATUS_COLORS[agent.workStatus] || '#9CA3AF' }}
        >
          {STATUS_LABELS[agent.workStatus] || agent.workStatus}
        </div>
      </div>

      {currentTask && (
        <div className="text-amber-600 text-[9px] truncate mb-2 bg-amber-50 border border-amber-100 rounded-lg px-2 py-0.5">
          📋 {currentTask.title}
        </div>
      )}

      <div className="mb-2">
        <div className="flex justify-between text-[8px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
          <span>Performance</span>
          <span className="font-bold" style={{ color: score > 70 ? '#6CC04A' : score > 45 ? '#F59E0B' : '#EF4444' }}>{score}/100</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${score}%` }}
            className={`h-full rounded-full ${
              score > 70 ? 'bg-green-400' : score > 45 ? 'bg-amber-400' : 'bg-rose-400'
            }`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5 text-[8px] text-gray-400 font-semibold">
        <span>✅ {agent.performance.tasksCompleted}</span>
        <span>❌ {agent.performance.tasksFailed}</span>
        <span>🔧 {agent.performance.toolUsageCount}</span>
        <span className="ml-auto uppercase text-[7px]">
          {agent.online ? 'Online' : 'Offline'}
        </span>
      </div>
    </motion.div>
  );
}

export default function AgentInspector() {
  const agents = useGameStore((s) => s.agents);
  const selectedAgentId = useGameStore((s) => s.selectedAgentId);
  const setSelectedAgent = useGameStore((s) => s.setSelectedAgent);
  const selectedAgent = getAgentById(selectedAgentId);

  return (
    <div className="text-sm text-gray-900 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 px-1 border-b border-gray-100 pb-2 shrink-0">
        <div className="w-2 h-2 rounded-full bg-sky-400" />
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Personnel</h2>
        <span className="text-[10px] text-gray-400 ml-auto">{agents.length} agents</span>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-[440px] overflow-y-auto pr-1 fade-out-bottom shrink-0">
        <AnimatePresence>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3.5 bg-white border border-gray-200 rounded-xl card-shadow relative overflow-hidden shrink-0"
          >
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
              <h4 className="text-gray-900 font-semibold text-xs">
                {selectedAgent.emoji} {selectedAgent.name}
              </h4>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                  <div className="text-gray-400 text-[9px] font-semibold uppercase">Role</div>
                  <div className="text-gray-900 font-semibold capitalize">{selectedAgent.role}</div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                  <div className="text-gray-400 text-[9px] font-semibold uppercase">Seniority</div>
                  <div className="text-gray-900 font-semibold capitalize">{selectedAgent.performance.seniority}</div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                  <div className="text-gray-400 text-[9px] font-semibold uppercase">Status</div>
                  <div className="font-semibold uppercase" style={{ color: STATUS_COLORS[selectedAgent.workStatus] || '#9CA3AF' }}>
                    {selectedAgent.cooldownRemainingSeconds && selectedAgent.cooldownRemainingSeconds > 0
                      ? `⏳ Cooldown (${Math.ceil(selectedAgent.cooldownRemainingSeconds)}s)`
                      : selectedAgent.workStatus}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                  <div className="text-gray-400 text-[9px] font-semibold uppercase">Mood</div>
                  <div className="font-semibold uppercase" style={{ color: MOOD_COLORS[selectedAgent.mood] || '#9CA3AF' }}>
                    {selectedAgent.mood}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                  <div className="text-gray-400 text-[9px] font-semibold uppercase">Efficiency</div>
                  <div className="font-bold text-gray-900">{Math.round(selectedAgent.efficiency)}%</div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                  <div className="text-gray-400 text-[9px] font-semibold uppercase">Success Rate</div>
                  <div className="font-bold text-gray-900">{(selectedAgent.performance.successRate * 100).toFixed(0)}%</div>
                </div>
              </div>

              {selectedAgent.activity.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-400 block mb-1 text-[9px] font-semibold uppercase tracking-wider">Recent Activity</span>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-0.5">
                    {selectedAgent.activity.slice(0, 5).map((act) => (
                      <div key={act.id} className="text-xs text-gray-500 flex gap-1">
                        <span className="text-gray-400 shrink-0">
                          {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="truncate leading-none">{act.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAgent.memory.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-400 block mb-1 text-[9px] font-semibold uppercase tracking-wider">Memory Buffer</span>
                  <div className="space-y-1 max-h-[80px] overflow-y-auto pr-0.5">
                    {selectedAgent.memory.slice(-4).map((mem) => (
                      <div key={mem.id} className="text-xs text-gray-500 truncate">
                        🧠 {mem.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
