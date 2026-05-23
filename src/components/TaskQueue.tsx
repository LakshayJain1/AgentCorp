'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/agents/AgentTypes';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#888',
  medium: '#f9ca24',
  high: '#ff6b6b',
  critical: '#ff0000',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#888',
  prioritized: '#f9ca24',
  assigned: '#45b7d1',
  in_progress: '#a29bfe',
  review: '#00f5ff',
  completed: '#00ff88',
  failed: '#ff6b6b',
};

const TYPE_ICONS: Record<string, string> = {
  code: '💻',
  doc: '📝',
  report: '📊',
  spec: '📋',
  config: '⚙️',
  analysis: '🔬',
  design: '🎨',
};

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-card border border-[#6366f1]/40 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border/60 p-5 flex items-start justify-between z-10">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="text-xl">{TYPE_ICONS[task.deliverableType || 'code']}</span>
                <h2 className="text-white text-lg font-semibold">{task.title}</h2>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-lg"
                  style={{ backgroundColor: `${STATUS_COLORS[task.status]}20`, color: STATUS_COLORS[task.status] }}
                >
                  {task.status.replace('_', ' ')}
                </span>
                <span className="text-xs font-medium capitalize" style={{ color: PRIORITY_COLORS[task.priority] }}>
                  {task.priority}
                </span>
                {task.deliverableType && (
                  <span className="text-muted text-xs">
                    {task.deliverableType} {task.deliverableLang ? `(${task.deliverableLang})` : ''}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-muted hover:text-[#ef4444] text-lg">✕</button>
          </div>

          {/* Task Timeline */}
          <div className="p-5 border-b border-border/40">
            <h3 className="text-muted text-xs font-semibold mb-3 uppercase tracking-wider">Timeline</h3>
            <div className="space-y-2">
              {task.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${step.completed ? 'bg-[#22c55e]' : 'bg-elevated border border-[#3a3a5a]'}`} />
                  <span className={step.completed ? 'text-subtle' : 'text-muted'}>{step.description}</span>
                  {step.aiOutput && <span className="text-muted truncate ml-2 text-xs">— {step.aiOutput}...</span>}
                </div>
              ))}
            </div>
          </div>

          {/* AI Context */}
          {task.aiContext && Object.keys(task.aiContext).length > 0 && (
            <div className="p-5 border-b border-border/40">
              <h3 className="text-muted text-xs font-semibold mb-3 uppercase tracking-wider">AI Decisions</h3>
              <div className="space-y-1.5">
                {Object.entries(task.aiContext).map(([key, value]) => (
                  <div key={key} className="text-sm text-subtle">
                    <span className="text-[#a78bfa] font-medium">{key}:</span> {value}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution Logs */}
          {task.executionLogs.length > 0 && (
            <div className="p-5 border-b border-border/40">
              <h3 className="text-[#6366f1] text-xs font-semibold mb-3 uppercase tracking-wider">
                Execution Log ({task.executionLogs.length} steps)
              </h3>
              <div className="space-y-1 max-h-[200px] overflow-y-auto font-mono">
                {task.executionLogs.slice(-10).map((log) => (
                  <div key={log.id} className="text-[11px] flex items-start gap-2">
                    <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                      log.status === 'success' ? 'bg-[#22c55e]' :
                      log.status === 'error' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'
                    }`} />
                    <div className="min-w-0">
                      <div className="text-subtle">
                        <span className="text-[#6366f1]">{log.tool}</span>
                        <span className="text-muted mx-1">·</span>
                        {log.action}
                      </div>
                      {log.output && (
                        <pre className="text-muted text-[10px] mt-0.5 whitespace-pre-wrap truncate hover:whitespace-pre-wrap bg-[#0a0a12] p-1 rounded">
                          {log.output.slice(0, 400)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverable */}
          {task.deliverable && (
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <h3 className="text-[#22c55e] text-xs font-semibold uppercase tracking-wider">Deliverable</h3>
                <span className="text-muted text-xs">
                  {task.deliverable.length} chars
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(task.deliverable || '');
                  }}
                  className="ml-auto text-muted hover:text-white text-xs font-medium"
                >
                  📋 Copy
                </button>
              </div>
              <pre className="bg-[#0e0e18] border border-border/40 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed max-h-[300px] overflow-y-auto">
                <code className="text-gray-300 whitespace-pre-wrap">{task.deliverable}</code>
              </pre>
            </div>
          )}

          {!task.deliverable && task.status === 'completed' && (
            <div className="p-5 text-center text-muted text-sm">
              No deliverable generated for this task.
            </div>
          )}

          {task.status !== 'completed' && task.status !== 'failed' && (
            <div className="p-5 text-center text-[#f59e0b]/60 text-sm">
              ⏳ Task in progress — deliverable appears when completed.
            </div>
          )}
        </motion.div>
      </motion.div>
  );
}

function TaskItem({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border/40 rounded-xl p-3 hover:border-[#6366f1]/40 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">{TYPE_ICONS[task.deliverableType || 'code']}</span>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
            <span className="text-white text-sm font-medium truncate">
              {task.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
              style={{ backgroundColor: `${STATUS_COLORS[task.status]}20`, color: STATUS_COLORS[task.status] }}
            >
              {task.status.replace('_', ' ')}
            </span>
            {task.deliverable && (
              <span className="text-[#22c55e]/60 text-xs">✅ has output</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress dots for steps */}
      {task.status !== 'completed' && task.status !== 'failed' && (
        <div className="flex gap-1 mt-2">
          {task.steps.map((step, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-all ${
                step.completed ? 'bg-[#22c55e]' : 'bg-elevated'
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function TaskQueue() {
  const tasks = useGameStore((s) => s.tasks);
  const selectedTaskId = useGameStore((s) => s.selectedTaskId);
  const setSelectedTask = useGameStore((s) => s.setSelectedTask);
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'failed');
  const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'failed');
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <>
      <div className="bg-panel rounded-xl border border-border/50 p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-subtle text-sm font-semibold">
            Task Queue
          </h3>
          <span className="text-muted text-xs">
            {activeTasks.length} active · {completedTasks.length} done
          </span>
        </div>

        <div className="space-y-2 max-h-[220px] overflow-y-auto">
          <AnimatePresence>
            {activeTasks.slice(0, 6).map((task) => (
              <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task.id)} />
            ))}
          </AnimatePresence>
          {activeTasks.length === 0 && (
            <div className="text-muted text-sm text-center py-5">
              No active tasks. Add one or wait for auto-generation.
            </div>
          )}
        </div>

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <>
            <div className="mt-3 pt-3 border-t border-border/40">
              <h4 className="text-[#22c55e]/60 text-xs font-semibold mb-2">
                Completed
              </h4>
            </div>
            <div className="space-y-2 max-h-[140px] overflow-y-auto">
              <AnimatePresence>
                {completedTasks.slice(0, 3).map((task) => (
                  <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task.id)} />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
