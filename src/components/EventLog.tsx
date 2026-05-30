'use client';

import { useGameStore } from '@/store/gameStore';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EVENT_COLORS: Record<string, string> = {
  task: 'var(--color-amber)',
  agent: 'var(--color-blue)',
  system: '#00f5ff',
  conversation: '#a29bfe',
  error: 'var(--color-red)',
  complete: 'var(--text)',
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
    <div className="flex flex-col font-mono text-xs text-text">
      {/* Mini Event Header inside card */}
      <div className="flex items-center gap-2 mb-2 px-1 border-b border-border/20 pb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-text animate-pulse" />
        <h4 className="text-text font-bold uppercase tracking-wider text-glow">EVENT_MONITOR</h4>
        <span className="text-subtle text-[9px] ml-auto">{events.length} lines</span>
      </div>

      {/* Scrollable logs list */}
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
              className="text-[10px] leading-relaxed py-0.5 px-1 rounded hover:bg-text/5 flex items-start gap-1.5"
            >
              <span className="text-subtle shrink-0">
                [{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
              </span>
              <span style={{ color: EVENT_COLORS[event.type] || 'var(--text)' }} className="font-bold shrink-0">
                {event.type.toUpperCase()}:
              </span>
              <span className="text-text/95 leading-normal font-sans">{event.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <span className="w-2.5 h-2.5 rounded-full bg-text animate-ping mb-2.5" />
            <span className="text-text font-bold uppercase tracking-wider mb-1 text-glow">CONSOLE_STANDBY</span>
            <span className="text-subtle text-[9px] mb-3">Intercepting system operations bus...</span>
            <div className="w-full max-w-[100px] space-y-2 animate-pulse">
              <div className="h-1 bg-muted rounded pulse-skeleton w-3/4 mx-auto" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
