'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

export default function TaskProgressTracker() {
  const tasks = useGameStore((s) => s.tasks);

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 flex gap-1 px-4 py-1 bg-panel/80 backdrop-blur border-t border-border/40 z-50">
      {tasks.slice(-6).map((task) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-gray-500',
          assigned: 'bg-blue-500',
          in_progress: 'bg-yellow-500',
          review: 'bg-purple-500',
          completed: 'bg-green-500',
          failed: 'bg-red-500',
        };
        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 text-[10px] font-mono truncate max-w-[200px]"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusColors[task.status] || 'bg-gray-500'}`} />
            <span className="text-white/60 truncate">{task.title}</span>
            <span className="text-white/30 uppercase text-[8px]">{task.status.replace('_', ' ')}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
