'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

const ROLE_COLORS: Record<string, string> = {
  ceo: '#ff6b6b',
  pm: '#4ecdc4',
  researcher: '#45b7d1',
  engineer: '#f9ca24',
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
    <div className="bg-panel rounded-xl border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-subtle text-sm font-semibold">Agent Chat</h3>
        <span className="text-muted text-xs">{allMessages.length} messages</span>
      </div>
      <div ref={scrollRef} className="max-h-[320px] overflow-y-auto space-y-2">
        {allMessages.length === 0 && (
          <div className="text-muted text-xs text-center py-3">No conversations yet.</div>
        )}
        {allMessages.map((msg, i) => {
          const isNewSender = i === 0 || allMessages[i - 1].fromAgentId !== msg.fromAgentId;
          const color = ROLE_COLORS[msg.fromRole] || '#888';
          return (
            <div key={msg.id} className="flex items-start gap-2">
              {isNewSender && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 border"
                  style={{ borderColor: color, backgroundColor: `${color}22` }}
                  title={msg.fromName}
                >
                  {msg.fromEmoji}
                </div>
              )}
              {!isNewSender && <div className="w-6 shrink-0" />}
              <div className="min-w-0 flex-1">
                {isNewSender && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-white text-xs font-medium">{msg.fromName}</span>
                    <span className="text-[10px]" style={{ color }}>{msg.fromRole.toUpperCase()}</span>
                    <span className="text-[10px]" style={{ color: '#4ecdc4' }}>→ {msg.toName}</span>
                    <span className="text-muted text-[10px] ml-auto shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <div
                  className="inline-block px-2.5 py-1.5 rounded-xl text-xs leading-relaxed max-w-[90%]"
                  style={{
                    backgroundColor: `${color}18`,
                    borderLeft: `2px solid ${color}`,
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
