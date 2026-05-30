'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

const ROLE_COLORS: Record<string, string> = {
  ceo: 'var(--color-red)',
  pm: 'var(--color-blue)',
  researcher: 'var(--color-blue)',
  engineer: 'var(--color-amber)',
  qa: '#a29bfe',
  hr: '#f472b6',
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
      {/* Messages Viewport */}
      <div 
        ref={scrollRef} 
        className="flex-1 max-h-[300px] overflow-y-auto space-y-3.5 pr-1.5 fade-out-bottom font-mono text-xs"
      >
        {allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span className="text-3xl text-glow animate-pulse mb-3">💬</span>
            <span className="text-text font-bold uppercase tracking-wider mb-1 text-glow">CHATROOM_IDLE</span>
            <span className="text-subtle text-[10px] mb-4">No intercepted operations sync chat logs...</span>
            <div className="w-full max-w-[160px] space-y-2">
              <div className="h-1 bg-muted rounded pulse-skeleton w-2/3 mx-auto" />
              <div className="h-1 bg-muted rounded pulse-skeleton w-5/6 mx-auto" />
            </div>
          </div>
        )}
        {allMessages.map((msg, i) => {
          const isNewSender = i === 0 || allMessages[i - 1].fromAgentId !== msg.fromAgentId;
          const color = ROLE_COLORS[msg.fromRole] || 'var(--text)';
          return (
            <div key={msg.id} className="flex items-start gap-2.5 hover:bg-text/5 p-1 rounded transition-all">
              {isNewSender && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 border"
                  style={{ borderColor: color, backgroundColor: `${color}15` }}
                  title={msg.fromName}
                >
                  {msg.fromEmoji}
                </div>
              )}
              {!isNewSender && <div className="w-7 shrink-0" />}
              <div className="min-w-0 flex-1">
                {isNewSender && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-text font-bold text-[11px] text-glow">{msg.fromName}</span>
                    <span className="text-[9px] uppercase px-1 rounded border border-border/30 font-bold" style={{ color, borderColor: `${color}40` }}>
                      {msg.fromRole}
                    </span>
                    <span className="text-subtle text-[9px]">→ {msg.toName}</span>
                    <span className="text-subtle text-[9px] ml-auto shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <div
                  className="inline-block px-3 py-2 rounded-lg text-[11px] leading-normal font-sans max-w-[90%] border"
                  style={{
                    backgroundColor: `${color}0a`,
                    borderColor: `${color}30`,
                    color: 'var(--text)',
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
