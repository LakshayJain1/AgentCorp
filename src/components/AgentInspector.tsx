'use client';

import { useGameStore, getAgentById } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent } from '@/agents/AgentTypes';

const MOOD_COLORS: Record<string, string> = {
  happy: '#00ff88',
  neutral: '#00f5ff',
  tired: 'var(--color-amber)',
  frustrated: 'var(--color-red)',
  focused: '#a29bfe',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--subtle)',
  thinking: 'var(--color-amber)',
  researching: 'var(--color-blue)',
  coding: 'var(--color-amber)',
  debugging: 'var(--color-red)',
  reviewing: '#a29bfe',
  waiting: '#6366f1',
  blocked: 'var(--color-red)',
  completed: 'var(--text)',
};

const STATUS_DOTS: Record<string, string> = {
  idle: '#3d5e3d',
  thinking: '#ffb400',
  researching: '#00f5ff',
  coding: '#ffb400',
  debugging: '#ff4d4d',
  reviewing: '#a29bfe',
  waiting: '#6366f1',
  blocked: '#ff4d4d',
  completed: '#00ff88',
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
  junior: 'var(--subtle)',
  mid: 'var(--color-blue)',
  senior: 'var(--color-amber)',
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
      className="bg-card/40 border border-border/30 rounded-lg p-3 hover:border-text/50 hover:bg-text/5 transition-all cursor-pointer"
      onClick={() => setSelectedAgent(agent.id)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="text-xl">{agent.emoji}</div>
            {agent.online && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#00ff88] rounded-full border border-[#050805] animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-text font-bold text-[11px] flex items-center gap-1.5 text-glow truncate">
              {agent.name}
              {agent.performance.seniority !== 'junior' && (
                <span
                  className="text-[8px] font-bold px-1 rounded uppercase shrink-0"
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
              className="text-[9px] font-bold uppercase tracking-wide truncate mt-0.5"
              style={{ color: `#${agent.color.toString(16).padStart(6, '0')}` }}
            >
              {agent.role}
            </div>
          </div>
        </div>
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: MOOD_COLORS[agent.mood] }}
        />
      </div>

      {/* Live status */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: STATUS_DOTS[agent.workStatus] || 'var(--subtle)',
                   boxShadow: `0 0 4px ${STATUS_DOTS[agent.workStatus] || 'var(--subtle)'}` }}
        />
        <div
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: STATUS_COLORS[agent.workStatus] || 'var(--subtle)' }}
        >
          {STATUS_LABELS[agent.workStatus] || agent.workStatus}
        </div>
      </div>

      {/* Current task */}
      {currentTask && (
        <div className="text-[#f59e0b] text-[9px] truncate mb-2 bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded px-1.5 py-0.5 font-mono">
          📋 {currentTask.title}
        </div>
      )}

      {/* Performance bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[8px] text-subtle uppercase font-bold tracking-wide mb-0.5">
          <span>PERF_INDEX</span>
          <span className={`font-bold ${score > 70 ? 'text-[#00ff88]' : score > 45 ? 'text-[#ffb400]' : 'text-[#ff4d4d]'}`}>{score}/100</span>
        </div>
        <div className="w-full h-1 bg-surface rounded overflow-hidden">
          <motion.div
            animate={{ width: `${score}%` }}
            className={`h-full ${
              score > 70 ? 'bg-[#00ff88]' : score > 45 ? 'bg-[#ffb400]' : 'bg-[#ff4d4d]'
            }`}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2.5 text-[8px] text-subtle font-bold font-mono">
        <span>✅ {agent.performance.tasksCompleted}</span>
        <span>❌ {agent.performance.tasksFailed}</span>
        <span>🔧 {agent.performance.toolUsageCount}</span>
        <span className="ml-auto uppercase text-[7px]">
          {agent.online ? 'CONN_ON' : 'CONN_OFF'}
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
    <div className="font-mono text-xs text-text flex flex-col h-full">
      {/* Personnel Database Header */}
      <div className="flex items-center gap-2 mb-3 px-1 border-b border-border/30 pb-2 shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#00ff88]" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-glow">PERSONNEL_DATABASE</h2>
        <span className="text-[10px] text-subtle ml-auto">{agents.length} agents</span>
      </div>
      {/* Scrollable roster grid */}
      <div className="grid grid-cols-1 gap-2 max-h-[440px] overflow-y-auto pr-1 fade-out-bottom shrink-0">
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
            className="mt-3 p-3 bg-card/60 border border-text/40 rounded-lg shadow-lg relative overflow-hidden shrink-0 border-glow"
          >
            <div className="flex items-center justify-between mb-2.5 border-b border-border/30 pb-1.5">
              <h4 className="text-text font-bold text-[11px] uppercase tracking-wider text-glow">
                {selectedAgent.emoji} {selectedAgent.name}
              </h4>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-subtle hover:text-[#ff4d4d] text-[11px] cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2 text-[10px] leading-normal font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-canvas border border-border/20 rounded p-1.5">
                  <div className="text-subtle text-[8px] uppercase font-bold">Role</div>
                  <div className="text-text font-bold capitalize">{selectedAgent.role}</div>
                </div>
                <div className="bg-canvas border border-border/20 rounded p-1.5">
                  <div className="text-subtle text-[8px] uppercase font-bold">Seniority</div>
                  <div className="text-text font-bold capitalize">{selectedAgent.performance.seniority}</div>
                </div>
                <div className="bg-canvas border border-border/20 rounded p-1.5">
                  <div className="text-subtle text-[8px] uppercase font-bold">Status</div>
                  <div className="font-bold uppercase" style={{ color: STATUS_COLORS[selectedAgent.workStatus] }}>
                    {selectedAgent.cooldownRemainingSeconds && selectedAgent.cooldownRemainingSeconds > 0
                      ? `⏳ COOLDOWN (${Math.ceil(selectedAgent.cooldownRemainingSeconds)}s)`
                      : selectedAgent.workStatus}
                  </div>
                </div>
                <div className="bg-canvas border border-border/20 rounded p-1.5">
                  <div className="text-subtle text-[8px] uppercase font-bold">Mood</div>
                  <div className="font-bold uppercase" style={{ color: MOOD_COLORS[selectedAgent.mood] }}>
                    {selectedAgent.mood}
                  </div>
                </div>
                <div className="bg-canvas border border-border/20 rounded p-1.5">
                  <div className="text-subtle text-[8px] uppercase font-bold">Efficiency</div>
                  <div className="font-bold text-glow">{Math.round(selectedAgent.efficiency)}%</div>
                </div>
                <div className="bg-canvas border border-border/20 rounded p-1.5">
                  <div className="text-subtle text-[8px] uppercase font-bold">Success Rate</div>
                  <div className="font-bold text-glow">{(selectedAgent.performance.successRate * 100).toFixed(0)}%</div>
                </div>
              </div>

              {/* Recent activity */}
              {selectedAgent.activity.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <span className="text-subtle block mb-1 text-[8px] font-bold uppercase tracking-wider">Intercepted Telemetry</span>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-0.5">
                    {selectedAgent.activity.slice(0, 5).map((act) => (
                      <div key={act.id} className="text-[9px] text-text/80 flex gap-1 font-mono">
                        <span className="text-subtle shrink-0">
                          {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="truncate leading-none">{act.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memory */}
              {selectedAgent.memory.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <span className="text-subtle block mb-1 text-[8px] font-bold uppercase tracking-wider">Cognitive Memory Buffer</span>
                  <div className="space-y-1 max-h-[80px] overflow-y-auto pr-0.5">
                    {selectedAgent.memory.slice(-4).map((mem) => (
                      <div key={mem.id} className="text-[9px] text-text/80 truncate font-mono">
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
