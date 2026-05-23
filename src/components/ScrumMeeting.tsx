'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

export default function ScrumMeeting() {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<string[]>([]);
  const addTaskWithTitle = useGameStore((s) => s.addTaskWithTitle);

  useEffect(() => {
    // Simulate fetching tasks for the meeting
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
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#6366f1]/50 text-[#6366f1] bg-[#6366f1]/10 hover:bg-[#6366f1]/20 transition-all"
      >
        Daily Scrum
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute top-full right-0 mt-2 bg-surface border border-[#6366f1]/60 rounded-lg shadow-xl p-4 w-64 z-50"
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-white font-semibold text-sm">Scrum Meeting</h2>
            <button onClick={() => setIsOpen(false)} className="text-subtle hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.map((task, index) => (
              <div key={index} className="bg-elevated p-2 rounded-md text-xs text-gray-300">
                {task}
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add a new task..."
            className="mt-2 w-full px-2 py-1 text-xs bg-surface border border-[#6366f1]/50 text-[#f59e0b] rounded-lg outline-none placeholder-[#f59e0b]/30"
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