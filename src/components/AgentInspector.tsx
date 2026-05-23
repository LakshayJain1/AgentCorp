'use client';

import { useGameStore, getAgentById } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent } from '@/agents/AgentTypes';

const MOOD_COLORS: Record<string, string> = {
  happy: '#00ff88',
  neutral: '#00f5ff',
  tired: '#f9ca24',
  frustrated: '#ff6b6b',
  focused: '#a29bfe',
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#888',
  thinking: '#f59e0b',
  researching: '#45b7d1',
  coding: '#f9ca24',
  debugging: '#ef4444',
  reviewing: '#a29bfe',
  waiting: '#6366f1',
  blocked: '#dc2626',
  completed: '#22c55e',
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
  junior: '#888',
  mid: '#45b7d1',
  senior: '#f9ca24',
  lead: '#a29bfe',
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
      className="bg-card border border-border/40 rounded-xl p-3 hover:border-[#6366f1]/40 transition-all cursor-pointer"
      onClick={() => setSelectedAgent(agent.id)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="text-2xl">{agent.emoji}</div>
            {agent.online && (
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#22c55e] rounded-full border-2 border-[#16161f]" />
            )}
          </div>
          <div>
            <div className="text-white text-sm font-semibold flex items-center gap-1.5">
              {agent.name}
              {agent.performance.seniority !== 'junior' && (
                <span
                  className="text-[10px] font-medium px-1 py-0.5 rounded"
                  style={{
                    backgroundColor: `${SENIORITY_COLORS[agent.performance.seniority]}20`,
                    color: SENIORITY_COLORS[agent.performance.seniority],
                  }}
                >
                  {agent.performance.seniority}
                </span>
              )}
            </div>
            <div
              className="text-xs font-medium capitalize"
              style={{ color: `#${agent.color.toString(16).padStart(6, '0')}` }}
            >
              {agent.role}
            </div>
          </div>
        </div>
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: MOOD_COLORS[agent.mood] }}
        />
      </div>

      {/* Live status */}
      <div
        className="text-xs font-medium mb-2"
        style={{ color: STATUS_COLORS[agent.workStatus] || '#888' }}
      >
        {STATUS_LABELS[agent.workStatus] || agent.workStatus}
      </div>

      {/* Current task */}
      {currentTask && (
        <div className="text-[#f59e0b]/80 text-xs truncate mb-2 bg-[#f59e0b]/5 rounded-lg px-2 py-1">
          📋 {currentTask.title}
        </div>
      )}

      {/* Performance bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-muted mb-0.5">
          <span>Score</span>
          <span className={`font-medium ${score > 70 ? 'text-[#22c55e]' : score > 45 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>{score}/100</span>
        </div>
        <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${score}%` }}
            className={`h-full rounded-full ${
              score > 70 ? 'bg-[#22c55e]' : score > 45 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'
            }`}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-muted">
        <span>✅ {agent.performance.tasksCompleted}</span>
        <span>❌ {agent.performance.tasksFailed}</span>
        <span>🔧 {agent.performance.toolUsageCount}</span>
        <span className="ml-auto">
          {agent.online ? '🟢 online' : '🔴 offline'}
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
    <div className="bg-panel rounded-xl border border-border/50 p-3">
      <h3 className="text-subtle text-sm font-semibold mb-3">
        Employees
      </h3>

      <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </AnimatePresence>
      </div>

      {/* Selected Agent Detail */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-card border border-[#a78bfa]/40 rounded-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[#a78bfa] text-sm font-semibold">
                {selectedAgent.emoji} {selectedAgent.name}
              </h4>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-muted hover:text-[#ef4444] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Role</div>
                  <div className="text-white font-medium capitalize">{selectedAgent.role}</div>
                </div>
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Seniority</div>
                  <div className="text-white font-medium capitalize">{selectedAgent.performance.seniority}</div>
                </div>
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Status</div>
                  <div className="font-medium" style={{ color: STATUS_COLORS[selectedAgent.workStatus] }}>
                    {STATUS_LABELS[selectedAgent.workStatus] || selectedAgent.workStatus}
                  </div>
                </div>
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Mood</div>
                  <div className="font-medium" style={{ color: MOOD_COLORS[selectedAgent.mood] }}>
                    {selectedAgent.mood}
                  </div>
                </div>
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Productivity</div>
                  <div className="font-medium">{selectedAgent.performance.productivityScore}</div>
                </div>
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Reliability</div>
                  <div className="font-medium">{selectedAgent.performance.reliabilityScore}</div>
                </div>
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Collaboration</div>
                  <div className="font-medium">{selectedAgent.performance.collaborationScore}</div>
                </div>
                <div className="bg-panel rounded-lg p-2">
                  <div className="text-muted">Success Rate</div>
                  <div className="font-medium">{(selectedAgent.performance.successRate * 100).toFixed(0)}%</div>
                </div>
              </div>

              {/* Recent activity */}
              {selectedAgent.activity.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  <span className="text-muted block mb-1.5 text-xs font-semibold">Recent Activity</span>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {selectedAgent.activity.slice(0, 5).map((act) => (
                      <div key={act.id} className="text-[10px] text-subtle flex gap-1">
                        <span className="text-muted shrink-0">
                          {new Date(act.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="truncate">{act.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memory */}
              {selectedAgent.memory.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  <span className="text-muted block mb-1.5 text-xs font-semibold">Memory</span>
                  <div className="space-y-1 max-h-[100px] overflow-y-auto">
                    {selectedAgent.memory.slice(-4).map((mem) => (
                      <div key={mem.id} className="text-[10px] text-subtle truncate">
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
