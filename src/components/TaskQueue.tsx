'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/agents/AgentTypes';
import { X, Copy, Loader2 } from 'lucide-react';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#86868B',
  medium: '#FF9F0A',
  high: '#FF453A',
  critical: '#FF453A',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#86868B',
  prioritized: '#FF9F0A',
  assigned: '#0A84FF',
  in_progress: '#BF5AF2',
  review: '#0A84FF',
  completed: '#34C759',
  failed: '#FF453A',
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card !bg-white/80 !backdrop-blur-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 glass-card !bg-white/90 !backdrop-blur-xl p-5 flex items-start justify-between z-10 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-xl shrink-0">{TYPE_ICONS[task.deliverableType || 'code']}</span>
              <h2 className="text-navy text-sm font-bold">{task.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-lg" style={{ color: STATUS_COLORS[task.status], backgroundColor: `${STATUS_COLORS[task.status]}10` }}>
                {task.status.replace('_', ' ')}
              </span>
              <span className="text-[9px] font-semibold uppercase" style={{ color: PRIORITY_COLORS[task.priority] }}>{task.priority}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-navy/55 hover:text-rose-500 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 border-b glass-divider">
          <h3 className="text-navy font-semibold text-xs mb-3 uppercase tracking-wider">Timeline</h3>
          <div className="space-y-2">
            {task.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full shrink-0 ${step.completed ? 'bg-green-400' : 'bg-gray-200'}`} />
                <span className={step.completed ? 'text-navy/55 line-through' : 'text-navy/80'}>{step.description}</span>
                {step.aiOutput && <span className="text-navy/55 text-xs ml-auto shrink-0 truncate max-w-[160px]">{step.aiOutput.slice(0, 30)}...</span>}
              </div>
            ))}
          </div>
        </div>

        {task.aiContext && Object.keys(task.aiContext).length > 0 && (
          <div className="p-5 border-b glass-divider">
            <h3 className="text-navy font-semibold text-xs mb-3 uppercase tracking-wider">AI Context</h3>
            <div className="space-y-1.5 text-sm">
              {Object.entries(task.aiContext).map(([key, value]) => (
                <div key={key} className="text-navy/70 flex gap-2">
                  <span className="text-navy/55 uppercase shrink-0">{key}:</span>
                  <span className="leading-relaxed">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {task.executionLogs.length > 0 && (
          <div className="p-5 border-b glass-divider">
            <h3 className="text-violet-600 font-semibold text-xs mb-3 uppercase tracking-wider">Execution Logs ({task.executionLogs.length})</h3>
            <div className="space-y-2.5 max-h-[200px] overflow-y-auto glass-scrollbar">
              {task.executionLogs.slice(-10).map((log) => (
                <div key={log.id} className="text-xs flex items-start gap-2 pb-1.5">
                  <div className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-green-400' : log.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-navy/80">
                      <span className="text-violet-600 font-semibold">{log.tool}</span>
                      <span className="text-navy/55 mx-1">·</span>
                      {log.action}
                    </div>
                    {log.output && (
                      <pre className="text-navy/55 text-[9px] mt-1 whitespace-pre-wrap bg-white/70/80 p-2 rounded-lg max-h-[100px] overflow-y-auto font-mono">{log.output.slice(0, 500)}</pre>
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
              <span className="text-navy/55 text-[9px]">{task.deliverable.length} chars</span>
              <button onClick={() => navigator.clipboard.writeText(task.deliverable || '')} className="ml-auto text-navy/55 hover:text-navy/80 text-[10px] font-semibold uppercase flex items-center gap-1 cursor-pointer">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="bg-white/70/80 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed max-h-[300px] overflow-y-auto glass-scrollbar">
              <code className="text-navy/80 whitespace-pre-wrap">{task.deliverable}</code>
            </pre>
          </div>
        )}

        {!task.deliverable && task.status === 'completed' && <div className="p-5 text-center text-navy/55 text-sm">No deliverable.</div>}
        {task.status !== 'completed' && task.status !== 'failed' && (
          <div className="p-5 text-center text-navy/55 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> In progress...
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
      className="glass-card rounded-xl p-3 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">{TYPE_ICONS[task.deliverableType || 'code']}</span>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
            <span className="text-navy font-bold text-xs truncate">{task.title}</span>
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-semibold" style={{ color: STATUS_COLORS[task.status], backgroundColor: `${STATUS_COLORS[task.status]}10` }}>
              {task.status.replace('_', ' ')}
            </span>
            {task.deliverable && <span className="text-green-500/70 text-[9px] font-semibold">✓ Output Ready</span>}
          </div>
        </div>
      </div>
      {task.status !== 'completed' && task.status !== 'failed' && (
        <div className="flex gap-1 mt-3">
          {task.steps.map((step, i) => (
            <div key={i} className={`h-1 rounded-full transition-all flex-1 ${step.completed ? 'bg-green-400' : 'bg-[rgba(23,23,31,0.05)]'}`} />
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
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-navy/70 text-xs font-semibold uppercase tracking-wider">Task Queue</h3>
        <span className="text-navy/55 text-[10px]">{activeTasks.length} active · {completedTasks.length} done</span>
      </div>
      <div className="space-y-2 max-h-[220px] overflow-y-auto glass-scrollbar">
        <AnimatePresence>
          {activeTasks.slice(0, 6).map((task) => (
            <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task.id)} />
          ))}
        </AnimatePresence>
        {activeTasks.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2 opacity-30">📋</div>
            <p className="text-xs text-navy/55">No active tasks</p>
          </div>
        )}
      </div>
      {completedTasks.length > 0 && (
        <div className="mt-3 pt-3 border-t glass-divider">
          <h4 className="text-navy/55 text-[10px] font-semibold uppercase tracking-wider mb-2">Completed</h4>
          <div className="space-y-2 max-h-[140px] overflow-y-auto glass-scrollbar">
            <AnimatePresence>
              {completedTasks.slice(0, 3).map((task) => (
                <TaskItem key={task.id} task={task} onClick={() => setSelectedTask(task.id)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      <AnimatePresence>
        {selectedTask && <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />}
      </AnimatePresence>
    </div>
  );
}
