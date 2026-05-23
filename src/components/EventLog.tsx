'use client';

import { useGameStore } from '@/store/gameStore';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EVENT_COLORS: Record<string, string> = {
  task: '#f9ca24',
  agent: '#45b7d1',
  system: '#00f5ff',
  conversation: '#a29bfe',
  error: '#ff6b6b',
  complete: '#00ff88',
  review: '#f472b6',
  validation: '#22c55e',
  subtask: '#6366f1',
};

export default function EventLog() {
  const events = useGameStore((s) => s.events);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <div className="bg-panel rounded-xl border border-border/50 p-3 h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-2.5 h-2.5 bg-[#22c55e] rounded-full animate-pulse" />
        <h3 className="text-subtle text-sm font-semibold">
          Event Log
        </h3>
        <span className="text-muted text-xs">
          {events.length} events
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-0.5"
      >
        <AnimatePresence initial={false}>
          {events.slice(0, 35).map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs leading-relaxed py-0.5 px-1.5 rounded hover:bg-white/[0.03]"
            >
              <span className="text-muted mr-1.5">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span style={{ color: EVENT_COLORS[event.type] || '#888' }} className="text-xs font-medium">
                [{event.type}]
              </span>
              <span className="text-gray-300 ml-1">{event.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <div className="text-muted text-sm text-center py-5">
            Waiting for events...
          </div>
        )}
      </div>
    </div>
  );
}
