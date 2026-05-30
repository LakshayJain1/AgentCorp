'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/agents/AgentTypes';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'var(--subtle)',
  medium: 'var(--color-amber)',
  high: 'var(--color-red)',
  critical: 'var(--color-red)',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--subtle)',
  prioritized: 'var(--color-amber)',
  assigned: 'var(--color-blue)',
  in_progress: '#a29bfe',
  review: '#00f5ff',
  completed: 'var(--text)',
  failed: 'var(--color-red)',
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-panel border-2 border-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 shadow-2xl font-mono text-xs text-text border-glow"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-panel border-b border-border/40 p-5 flex items-start justify-between z-10">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="text-xl shrink-0">{TYPE_ICONS[task.deliverableType || 'code']}</span>
                <h2 className="text-text text-sm font-bold uppercase tracking-wider text-glow">{task.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-border/50 uppercase"
                  style={{ color: STATUS_COLORS[task.status] }}
                >
                  {task.status.replace('_', ' ')}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: PRIORITY_COLORS[task.priority] }}>
                  PRIORITY: {task.priority}
                </span>
                {task.deliverableType && (
                  <span className="text-subtle text-[9px] uppercase">
                    TYPE: {task.deliverableType} {task.deliverableLang ? `(${task.deliverableLang})` : ''}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-subtle hover:text-[#ff4d4d] text-base cursor-pointer">✕</button>
          </div>

          {/* Task Timeline */}
          <div className="p-5 border-b border-border/20">
            <h3 className="text-text font-bold text-[10px] mb-3 uppercase tracking-wider text-glow">Decomposition Timeline</h3>
            <div className="space-y-2">
              {task.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-[11px] leading-normal font-sans">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${step.completed ? 'bg-[#00ff88] text-glow animate-pulse' : 'bg-canvas border border-border'}`} />
                  <span className={step.completed ? 'text-text/75 line-through' : 'text-text'}>{step.description}</span>
                  {step.aiOutput && <span className="text-subtle font-mono text-[9px] ml-auto shrink-0">— {step.aiOutput.slice(0, 30)}...</span>}
                </div>
              ))}
            </div>
          </div>

          {/* AI Context */}
          {task.aiContext && Object.keys(task.aiContext).length > 0 && (
            <div className="p-5 border-b border-border/20">
              <h3 className="text-text font-bold text-[10px] mb-3 uppercase tracking-wider text-glow">Cognitive Context Decisions</h3>
              <div className="space-y-1.5 font-mono text-[10px]">
                {Object.entries(task.aiContext).map(([key, value]) => (
                  <div key={key} className="text-text/90 flex gap-2">
                    <span className="text-subtle uppercase shrink-0">{key}:</span>
                    <span className="leading-normal">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution Logs */}
          {task.executionLogs.length > 0 && (
            <div className="p-5 border-b border-border/20">
              <h3 className="text-[#6366f1] font-bold text-[10px] mb-3 uppercase tracking-wider text-glow">
                Sandbox Execution Operations ({task.executionLogs.length} ticks)
              </h3>
              <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                {task.executionLogs.slice(-10).map((log) => (
                  <div key={log.id} className="text-[10px] flex items-start gap-2 border-b border-border/10 pb-1.5">
                    <span className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                      log.status === 'success' ? 'bg-[#22c55e]' :
                      log.status === 'error' ? 'bg-[#ff4d4d]' : 'bg-[#ffb400]'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-text/90">
                        <span className="text-[#6366f1] font-bold">{log.tool}</span>
                        <span className="text-subtle mx-1">·</span>
                        {log.action}
                      </div>
                      {log.output && (
                        <pre className="text-subtle text-[9px] mt-1 whitespace-pre-wrap bg-[#050805] p-2 rounded border border-border/30 max-h-[100px] overflow-y-auto">
                          {log.output.slice(0, 500)}
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
                <h3 className="text-[#00ff88] font-bold text-[10px] uppercase tracking-wider text-glow">Deliverable Output</h3>
                <span className="text-subtle text-[9px]">
                  {task.deliverable.length} chars
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(task.deliverable || '');
                  }}
                  className="ml-auto text-text/80 hover:text-text text-[10px] font-bold uppercase cursor-pointer"
                >
                  [Copy Content]
                </button>
              </div>
              <pre className="bg-[#050805] border border-border/40 rounded p-4 overflow-x-auto text-[10px] leading-normal max-h-[300px] overflow-y-auto">
                <code className="text-text/90 whitespace-pre-wrap">{task.deliverable}</code>
              </pre>
            </div>
          )}

          {!task.deliverable && task.status === 'completed' && (
            <div className="p-5 text-center text-subtle text-[11px]">
              No direct deliverable payload generated for this request.
            </div>
          )}

          {task.status !== 'completed' && task.status !== 'failed' && (
            <div className="p-5 text-center text-subtle text-[11px] animate-pulse">
              ⏳ Operation active — deliverable will sync upon execution success.
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
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, x: 10 }}
      transition={{ duration: 0.15 }}
      className="bg-card border border-border/30 rounded p-3.5 hover:bg-text/5 hover:border-text/50 transition-all cursor-pointer flex flex-col justify-between"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">{TYPE_ICONS[task.deliverableType || 'code']}</span>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
            <span className="text-text font-bold text-[11px] truncate text-glow">
              {task.title}
            </span>
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <span
              className="text-[9px] px-1 rounded border border-border/40 font-bold uppercase"
              style={{ color: STATUS_COLORS[task.status], borderColor: `${STATUS_COLORS[task.status]}30` }}
            >
              {task.status.replace('_', ' ')}
            </span>
            {task.deliverable && (
              <span className="text-[#00ff88]/60 text-[9px] font-bold">✓ OUTPUT_STAGED</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress dots for steps */}
      {task.status !== 'completed' && task.status !== 'failed' && (
        <div className="flex gap-1.5 mt-3">
          {task.steps.map((step, i) => (
            <div
              key={i}
              className={`h-1 rounded transition-all flex-1 ${
                step.completed ? 'bg-[#00ff88] text-glow' : 'bg-surface border border-border/20'
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
    <div className="font-mono text-xs text-text">
      {/* Active Tasks Feed */}
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 fade-out-bottom">
        <AnimatePresence>
          {activeTasks.slice(0, 6).map((task) => (
            <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task.id)} />
          ))}
        </AnimatePresence>
        {activeTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <span className="text-3xl text-glow animate-pulse mb-3">📋</span>
            <span className="text-text font-bold uppercase tracking-wider mb-1 text-glow">BACKLOG_CLEARED</span>
            <span className="text-subtle text-[10px] mb-4">All operations queues fully processed!</span>
            <div className="w-full max-w-[140px] space-y-2 animate-pulse">
              <div className="h-1 bg-muted rounded pulse-skeleton w-3/4 mx-auto" />
            </div>
          </div>
        )}
      </div>

      {/* Completed tasks list inside queue widget */}
      {completedTasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/20">
          <h4 className="text-subtle text-[10px] font-bold uppercase tracking-wider mb-2.5">
            COMPLETED_OPERATIONS
          </h4>
          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
            <AnimatePresence>
              {completedTasks.slice(0, 3).map((task) => (
                <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task.id)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Task Detail Modal popup */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
