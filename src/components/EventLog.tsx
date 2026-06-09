'use client';

import { useGameStore } from '@/store/gameStore';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EVENT_COLORS: Record<string, string> = {
  task: '#F59E0B',
  agent: '#59C7FF',
  system: '#6CC04A',
  conversation: '#8B7CF6',
  error: '#EF4444',
  complete: '#6CC04A',
  review: '#EC4899',
  validation: '#6CC04A',
  subtask: '#7C3AED',
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
    <div className="flex flex-col text-sm text-gray-900">
      <div className="flex items-center gap-2 mb-2 px-1 border-b border-gray-100 pb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        <h4 className="text-gray-600 font-semibold text-xs uppercase tracking-wider">Event Monitor</h4>
        <span className="text-gray-400 text-[9px] ml-auto">{events.length} lines</span>
      </div>

      <div
        ref={containerRef}
        className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 fade-out-bottom"
      >
        <AnimatePresence initial={false}>
          {events.slice(0, 35).map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xs leading-relaxed py-0.5 px-1.5 rounded-lg hover:bg-gray-50 flex items-start gap-1.5"
            >
              <span className="text-gray-400 shrink-0">
                [{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
              </span>
              <span style={{ color: EVENT_COLORS[event.type] || '#6B7280' }} className="font-semibold shrink-0">
                {event.type.toUpperCase()}:
              </span>
              <span className="text-gray-700 leading-relaxed">{event.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse mb-2.5" />
            <span className="text-sm font-semibold text-gray-400 mb-1">No events</span>
            <span className="text-xs text-gray-300 mb-3">System events will appear here...</span>
            <div className="w-full max-w-[100px] space-y-2">
              <div className="h-1.5 bg-gray-100 rounded-full pulse-skeleton w-3/4 mx-auto" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
