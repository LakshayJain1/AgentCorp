'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

const ROLE_COLORS: Record<string, string> = {
  ceo: '#FF453A',
  pm: '#0A84FF',
  researcher: '#BF5AF2',
  engineer: '#FF9F0A',
  qa: '#BF5AF2',
  hr: '#FF375F',
};

export default function ConversationPanel() {
  const agents = useGameStore((s) => s.agents);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allMessages = useMemo(() => {
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    const seen = new Set<string>();
    const msgs = agents.flatMap((a) =>
      a.conversations.map((c) => ({
        ...c,
        fromName: agentMap.get(c.fromAgentId)?.name || 'Unknown',
        fromEmoji: agentMap.get(c.fromAgentId)?.emoji || '🤖',
        fromRole: agentMap.get(c.fromAgentId)?.role || 'engineer',
        toName: agentMap.get(c.toAgentId)?.name || 'Unknown',
        toEmoji: agentMap.get(c.toAgentId)?.emoji || '🤖',
        toRole: agentMap.get(c.toAgentId)?.role || 'engineer',
      })),
    ).filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    return msgs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20).reverse();
  }, [agents]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 max-h-[300px] overflow-y-auto space-y-3 pr-1 fade-out-bottom"
      >
        {allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400/20 to-magenta-400/20 flex items-center justify-center mb-3">
              <div className="w-2 h-2 rounded-full bg-[#BF5AF2] animate-pulse" />
            </div>
            <span className="text-sm font-semibold text-navy/40 mb-1">No messages yet</span>
            <span className="text-xs text-navy/25 mb-4">Agent conversations will appear here...</span>
            <div className="w-full max-w-[160px] space-y-2">
              <div className="h-1.5 bg-[rgba(23,23,31,0.05)] rounded-full pulse-skeleton w-2/3 mx-auto" />
              <div className="h-1.5 bg-[rgba(23,23,31,0.05)] rounded-full pulse-skeleton w-5/6 mx-auto" />
            </div>
          </div>
        )}
        {allMessages.map((msg, i) => {
          const isNewSender = i === 0 || allMessages[i - 1].fromAgentId !== msg.fromAgentId;
          const color = ROLE_COLORS[msg.fromRole] || '#86868B';
          return (
            <div key={msg.id} className="flex items-start gap-2.5 hover:bg-white/70/50 p-1.5 rounded-lg transition-all">
              {isNewSender && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 border-2"
                  style={{ borderColor: color, backgroundColor: `${color}15` }}
                  title={msg.fromName}
                >
                  {msg.fromEmoji}
                </div>
              )}
              {!isNewSender && <div className="w-7 shrink-0" />}
              <div className="min-w-0 flex-1">
                {isNewSender && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-navy font-semibold text-xs">{msg.fromName}</span>
                    <span
                      className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-white/70 border border-navy/5"
                      style={{ color }}
                    >
                      {msg.fromRole}
                    </span>
                    <span className="text-navy/40 text-[9px]">→ {msg.toName}</span>
                    <span className="text-navy/40 text-[9px] ml-auto shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <div
                  className="inline-block px-3 py-2 rounded-xl text-xs leading-relaxed max-w-[90%]"
                  style={{
                    backgroundColor: `${color}08`,
                    borderColor: `${color}20`,
                    border: `1px solid ${color}20`,
                    color: '#3A3A3C',
                  }}
                >
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
