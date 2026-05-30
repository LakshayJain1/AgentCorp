'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  thinking: { color: 'var(--text)', label: '🤔 thinking' },
  coding: { color: 'var(--color-amber)', label: '💻 coding' },
  debugging: { color: 'var(--color-red)', label: '🐛 debugging' },
  researching: { color: 'var(--color-blue)', label: '🔬 researching' },
  reviewing: { color: '#a29bfe', label: '🔍 reviewing' },
  communicating: { color: '#4ecdc4', label: '💬 communicating' },
  blocked: { color: 'var(--color-red)', label: '🚫 blocked' },
  tool_call: { color: '#6366f1', label: '🔧 tool call' },
  tool_result: { color: '#22c55e', label: '✅ tool result' },
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
      {/* Scrollable Feed List */}
      <div 
        ref={scrollRef} 
        className="flex-1 space-y-2 max-h-[300px] overflow-y-auto pr-1.5 fade-out-bottom font-mono text-xs"
      >
        {allActivities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span className="text-3xl text-glow animate-pulse mb-3">📡</span>
            <span className="text-text font-bold uppercase tracking-wider mb-1 text-glow">MONITOR_STANDBY</span>
            <span className="text-subtle text-[10px] mb-4">Waiting for agent simulation telemetry...</span>
            <div className="w-full max-w-[160px] space-y-2">
              <div className="h-1 bg-muted rounded pulse-skeleton w-3/4 mx-auto" />
              <div className="h-1 bg-muted rounded pulse-skeleton w-1/2 mx-auto" />
            </div>
          </div>
        )}
        {allActivities.map((act) => {
          const style = TYPE_STYLES[act.type] || { color: 'var(--text)', label: act.type };
          return (
            <div key={act.id} className="flex items-start gap-2.5 py-1.5 border-b border-border/20 last:border-0 hover:bg-text/5 px-1.5 rounded transition-all">
              <span className="text-sm shrink-0 mt-0.5">{act.agentEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-text font-bold text-[11px] text-glow">{act.agentName}</span>
                  <span className="text-[9px] uppercase px-1 py-0.2 bg-surface rounded border border-border/30" style={{ color: style.color }}>{style.label}</span>
                  <span className="text-subtle text-[9px] ml-auto shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="text-text/80 text-[11px] mt-1 leading-normal font-sans">{act.message}</p>
                {act.details && (
                  <details className="mt-1 cursor-pointer">
                    <summary className="text-subtle text-[9px] hover:text-text uppercase font-bold tracking-wider">details</summary>
                    <pre className="text-subtle text-[9px] mt-1 whitespace-pre-wrap bg-[#050805] p-2 rounded border border-border/40 font-mono leading-normal">
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
