'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

export default function TaskProgressTracker() {
  const tasks = useGameStore((s) => s.tasks);

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 flex gap-1 px-4 py-1.5 bg-white/80 backdrop-blur border-t border-gray-100 z-50">
      {tasks.slice(-6).map((task) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-gray-300',
          assigned: 'bg-sky-400',
          in_progress: 'bg-amber-400',
          review: 'bg-violet-400',
          completed: 'bg-green-400',
          failed: 'bg-rose-400',
        };
        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 text-xs truncate max-w-[200px]"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusColors[task.status] || 'bg-gray-300'}`} />
            <span className="text-gray-500 truncate">{task.title}</span>
            <span className="text-gray-400 uppercase text-[9px]">{task.status.replace('_', ' ')}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
