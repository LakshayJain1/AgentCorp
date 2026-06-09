'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/agents/AgentTypes';
import { X, Copy, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#9CA3AF',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#EF4444',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#9CA3AF',
  prioritized: '#F59E0B',
  assigned: '#59C7FF',
  in_progress: '#8B7CF6',
  review: '#59C7FF',
  completed: '#6CC04A',
  failed: '#EF4444',
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 card-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-xl shrink-0">{TYPE_ICONS[task.deliverableType || 'code']}</span>
              <h2 className="text-gray-900 text-sm font-bold">{task.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="text-[9px] font-semibold px-2 py-0.5 rounded-lg border uppercase"
                style={{ color: STATUS_COLORS[task.status], borderColor: `${STATUS_COLORS[task.status]}30`, backgroundColor: `${STATUS_COLORS[task.status]}10` }}
              >
                {task.status.replace('_', ' ')}
              </span>
              <span className="text-[9px] font-semibold uppercase" style={{ color: PRIORITY_COLORS[task.priority] }}>
                Priority: {task.priority}
              </span>
              {task.deliverableType && (
                <span className="text-gray-400 text-[9px] uppercase">
                  Type: {task.deliverableType} {task.deliverableLang ? `(${task.deliverableLang})` : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-rose-500 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 border-b border-gray-100">
          <h3 className="text-gray-900 font-semibold text-xs mb-3 uppercase tracking-wider">Timeline</h3>
          <div className="space-y-2">
            {task.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                <div className={`w-2 h-2 rounded-full shrink-0 ${step.completed ? 'bg-green-400' : 'bg-gray-200'}`} />
                <span className={step.completed ? 'text-gray-400 line-through' : 'text-gray-700'}>{step.description}</span>
                {step.aiOutput && <span className="text-gray-400 text-xs ml-auto shrink-0">— {step.aiOutput.slice(0, 30)}...</span>}
              </div>
            ))}
          </div>
        </div>

        {task.aiContext && Object.keys(task.aiContext).length > 0 && (
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-gray-900 font-semibold text-xs mb-3 uppercase tracking-wider">AI Context</h3>
            <div className="space-y-1.5 text-sm">
              {Object.entries(task.aiContext).map(([key, value]) => (
                <div key={key} className="text-gray-600 flex gap-2">
                  <span className="text-gray-400 uppercase shrink-0">{key}:</span>
                  <span className="leading-relaxed">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.executionLogs.length > 0 && (
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-violet-600 font-semibold text-xs mb-3 uppercase tracking-wider">
              Execution Logs ({task.executionLogs.length} ticks)
            </h3>
            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {task.executionLogs.slice(-10).map((log) => (
                <div key={log.id} className="text-xs flex items-start gap-2 border-b border-gray-50 pb-1.5">
                  <div className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                    log.status === 'success' ? 'bg-green-400' :
                    log.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-700">
                      <span className="text-violet-600 font-semibold">{log.tool}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      {log.action}
                    </div>
                    {log.output && (
                      <pre className="text-gray-500 text-[9px] mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded-lg border border-gray-100 max-h-[100px] overflow-y-auto font-mono">
                        {log.output.slice(0, 500)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.deliverable && (
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <h3 className="text-green-600 font-semibold text-xs uppercase tracking-wider">Deliverable</h3>
              <span className="text-gray-400 text-[9px]">
                {task.deliverable.length} chars
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(task.deliverable || '')}
                className="ml-auto text-gray-500 hover:text-gray-700 text-[10px] font-semibold uppercase flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="bg-gray-50 border border-gray-100 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed max-h-[300px] overflow-y-auto">
              <code className="text-gray-700 whitespace-pre-wrap">{task.deliverable}</code>
            </pre>
          </div>
        )}

        {!task.deliverable && task.status === 'completed' && (
          <div className="p-5 text-center text-gray-400 text-sm">
            No deliverable payload for this request.
          </div>
        )}

        {task.status !== 'completed' && task.status !== 'failed' && (
          <div className="p-5 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Operation active — deliverable will sync upon completion.
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
      className="bg-white border border-gray-100 rounded-xl p-3.5 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">{TYPE_ICONS[task.deliverableType || 'code']}</span>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
            <span className="text-gray-900 font-semibold text-xs truncate">
              {task.title}
            </span>
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-lg border font-semibold uppercase"
              style={{ color: STATUS_COLORS[task.status], borderColor: `${STATUS_COLORS[task.status]}30`, backgroundColor: `${STATUS_COLORS[task.status]}08` }}
            >
              {task.status.replace('_', ' ')}
            </span>
            {task.deliverable && (
              <span className="text-green-500/70 text-[9px] font-semibold">✓ Output Ready</span>
            )}
          </div>
        </div>
      </div>

      {task.status !== 'completed' && task.status !== 'failed' && (
        <div className="flex gap-1 mt-3">
          {task.steps.map((step, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all flex-1 ${
                step.completed ? 'bg-green-400' : 'bg-gray-100'
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
    <div className="text-sm text-gray-900">
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 fade-out-bottom">
        <AnimatePresence>
          {activeTasks.slice(0, 6).map((task) => (
            <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task.id)} />
          ))}
        </AnimatePresence>
        {activeTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-400/20 flex items-center justify-center mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <span className="text-sm font-semibold text-gray-400 mb-1">Queue cleared</span>
            <span className="text-xs text-gray-300 mb-4">No active tasks</span>
            <div className="w-full max-w-[140px] space-y-2">
              <div className="h-1.5 bg-gray-100 rounded-full pulse-skeleton w-3/4 mx-auto" />
            </div>
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <h4 className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-2.5">
            Completed
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

      <AnimatePresence>
        {selectedTask && (
          <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
