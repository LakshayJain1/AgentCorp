'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  thinking: { color: '#0A84FF', label: 'thinking' },
  coding: { color: '#FF9F0A', label: 'coding' },
  debugging: { color: '#FF453A', label: 'debugging' },
  researching: { color: '#BF5AF2', label: 'researching' },
  reviewing: { color: '#BF5AF2', label: 'reviewing' },
  communicating: { color: '#34C759', label: 'communicating' },
  blocked: { color: '#FF453A', label: 'blocked' },
  tool_call: { color: '#5E5CE6', label: 'tool call' },
  tool_result: { color: '#34C759', label: 'tool result' },
};

export default function ActivityFeed() {
  const agents = useGameStore((s) => s.agents);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allActivities = useMemo(() => {
    const items = agents.flatMap((a) =>
      a.activity.map((act) => ({ ...act, agentName: a.name, agentEmoji: a.emoji, agentRole: a.role })),
    );
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }, [agents]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [allActivities.length]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-navy/70 text-xs font-semibold uppercase tracking-wider">Activity Stream</h3>
        <span className="text-navy/55 text-[10px]">{allActivities.length} events</span>
      </div>
      <div ref={scrollRef} className="space-y-1 max-h-[260px] overflow-y-auto glass-scrollbar">
        {allActivities.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2 opacity-30">📡</div>
            <p className="text-xs text-navy/55">Waiting for activity...</p>
          </div>
        )}
        {allActivities.map((act) => {
          const style = TYPE_STYLES[act.type] || { color: '#86868B', label: act.type };
          return (
            <div key={act.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.02)] transition-colors">
              <span className="text-sm shrink-0 mt-0.5">{act.agentEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-navy font-semibold text-[11px]">{act.agentName}</span>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-white/70" style={{ color: style.color }}>{style.label}</span>
                  <span className="text-navy/55 text-[9px] ml-auto shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="text-navy/70 text-xs mt-0.5 leading-relaxed">{act.message}</p>
                {act.details && (
                  <details className="mt-1 cursor-pointer">
                    <summary className="text-navy/55 text-[9px] hover:text-navy/80 font-semibold uppercase tracking-wider">details</summary>
                    <pre className="text-navy/55 text-[9px] mt-1 whitespace-pre-wrap bg-white/70/80 p-2 rounded-lg font-mono leading-relaxed">{act.details}</pre>
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
