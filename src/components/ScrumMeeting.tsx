'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, MessageSquareText } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

export default function ScrumMeeting() {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<string[]>([]);
  const addTaskWithTitle = useGameStore((s) => s.addTaskWithTitle);

  useEffect(() => {
    const fetchedTasks = ['Task 1', 'Task 2', 'Task 3'];
    setTasks(fetchedTasks);
  }, []);

  const handleAddTask = (task: string) => {
    addTaskWithTitle(task);
    setTasks((prev) => [...prev, task]);
  };

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <MessageSquareText className="w-3 h-3" />
        Daily Scrum
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute top-full right-0 mt-2 bg-white border border-navy/10 rounded-xl card-shadow p-4 w-64 z-50"
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-navy font-semibold text-sm">Scrum Meeting</h2>
            <button onClick={() => setIsOpen(false)} className="text-navy/40 hover:text-navy/70 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.map((task, index) => (
              <div key={index} className="bg-white/70 p-2 rounded-lg text-xs text-navy/70 border border-navy/5">
                {task}
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add a new task..."
            className="mt-2 w-full px-3 py-1.5 text-xs bg-white/70 border border-navy/10 rounded-xl text-navy placeholder:text-navy/35 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                handleAddTask(e.currentTarget.value.trim());
                e.currentTarget.value = '';
              }
            }}
          />
        </motion.div>
      )}
    </div>
  );
}
