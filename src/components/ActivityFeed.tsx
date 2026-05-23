'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  thinking: { color: '#888', label: '🤔 thinking' },
  coding: { color: '#f9ca24', label: '💻 coding' },
  debugging: { color: '#ff6b6b', label: '🐛 debugging' },
  researching: { color: '#45b7d1', label: '🔬 researching' },
  reviewing: { color: '#a29bfe', label: '🔍 reviewing' },
  communicating: { color: '#4ecdc4', label: '💬 communicating' },
  blocked: { color: '#ef4444', label: '🚫 blocked' },
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
    <div className="bg-panel rounded-xl border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-subtle text-sm font-semibold">Live Activity</h3>
        <span className="text-muted text-xs">{allActivities.length} events</span>
      </div>
      <div ref={scrollRef} className="space-y-1 max-h-[260px] overflow-y-auto">
        {allActivities.length === 0 && (
          <div className="text-muted text-xs text-center py-3">Waiting for agent activity...</div>
        )}
        {allActivities.map((act) => {
          const style = TYPE_STYLES[act.type] || { color: '#888', label: act.type };
          return (
            <div key={act.id} className="flex items-start gap-2 py-1 border-b border-border/20 last:border-0">
              <span className="text-xs shrink-0 mt-0.5">{act.agentEmoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-xs font-medium">{act.agentName}</span>
                  <span className="text-[10px]" style={{ color: style.color }}>{style.label}</span>
                  <span className="text-muted text-[10px] ml-auto shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-subtle text-xs mt-0.5 leading-relaxed">{act.message}</p>
                {act.details && (
                  <details className="mt-0.5">
                    <summary className="text-muted text-[10px] cursor-pointer hover:text-subtle">details</summary>
                    <pre className="text-muted text-[10px] mt-0.5 whitespace-pre-wrap bg-[#0a0a12] p-1.5 rounded">{act.details}</pre>
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
