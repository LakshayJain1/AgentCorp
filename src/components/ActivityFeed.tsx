'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  thinking: { color: '#59C7FF', label: 'thinking' },
  coding: { color: '#F59E0B', label: 'coding' },
  debugging: { color: '#EF4444', label: 'debugging' },
  researching: { color: '#8B7CF6', label: 'researching' },
  reviewing: { color: '#8B7CF6', label: 'reviewing' },
  communicating: { color: '#6CC04A', label: 'communicating' },
  blocked: { color: '#EF4444', label: 'blocked' },
  tool_call: { color: '#7C3AED', label: 'tool call' },
  tool_result: { color: '#6CC04A', label: 'tool result' },
};

export default function ActivityFeed() {
  const agents = useGameStore((s) => s.agents);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allActivities = useMemo(() => {
    const items = agents.flatMap((a) =>
      a.activity.map((act) => ({
        ...act,
        agentName: a.name,
        agentEmoji: a.emoji,
        agentRole: a.role,
      })),
    );
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }, [agents]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [allActivities.length]);

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 space-y-1.5 max-h-[300px] overflow-y-auto pr-1 fade-out-bottom text-sm"
      >
        {allActivities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400/20 to-cyan-400/20 flex items-center justify-center mb-3">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            </div>
            <span className="text-sm font-semibold text-gray-400 mb-1">Waiting for activity</span>
            <span className="text-xs text-gray-300 mb-4">Agent telemetry will appear here...</span>
            <div className="w-full max-w-[160px] space-y-2">
              <div className="h-1.5 bg-gray-100 rounded-full pulse-skeleton w-3/4 mx-auto" />
              <div className="h-1.5 bg-gray-100 rounded-full pulse-skeleton w-1/2 mx-auto" />
            </div>
          </div>
        )}
        {allActivities.map((act) => {
          const style = TYPE_STYLES[act.type] || { color: '#9CA3AF', label: act.type };
          return (
            <div key={act.id} className="flex items-start gap-2.5 py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 px-2 rounded-lg transition-all">
              <span className="text-sm shrink-0 mt-0.5">{act.agentEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-semibold text-xs">{act.agentName}</span>
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-100"
                    style={{ color: style.color }}
                  >
                    {style.label}
                  </span>
                  <span className="text-gray-400 text-[9px] ml-auto shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{act.message}</p>
                {act.details && (
                  <details className="mt-1 cursor-pointer">
                    <summary className="text-gray-400 text-[9px] hover:text-gray-600 font-semibold uppercase tracking-wider">details</summary>
                    <pre className="text-gray-500 text-[9px] mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded-lg border border-gray-100 font-mono leading-relaxed">
                      {act.details}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
