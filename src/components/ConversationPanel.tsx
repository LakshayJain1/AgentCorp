'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

export default function ConversationPanel() {
  const agents = useGameStore((s) => s.agents);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    const msgs = agents.flatMap((a) =>
      a.conversations.map((c) => ({
        ...c,
        fromName: agents.find((x) => x.id === c.fromAgentId),
        toName: agents.find((x) => x.id === c.toAgentId),
      })),
    ).filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    return msgs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 40);
  }, [agents]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [allMessages.length]);

  return (
    <div className="bg-panel rounded-xl border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-subtle text-sm font-semibold">Agent Chat</h3>
        <span className="text-muted text-xs">{allMessages.length} messages</span>
      </div>
      <div ref={scrollRef} className="max-h-[280px] overflow-y-auto">
        {allMessages.length === 0 && (
          <div className="text-muted text-xs text-center py-3">No conversations yet.</div>
        )}
        {allMessages.map((msg) => (
          <div key={msg.id} className="border-b border-border/10 py-2 last:border-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{msg.fromName?.emoji || '🤖'}</span>
              <span className="text-white text-xs font-medium">{msg.fromName?.name || 'Unknown'}</span>
              <span className="text-muted text-[10px]">→</span>
              <span className="text-xs">{msg.toName?.emoji || '🤖'}</span>
              <span className="text-gray-300 text-xs font-medium">{msg.toName?.name || 'Unknown'}</span>
              <span className="text-muted text-[10px] ml-auto">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-subtle text-xs mt-0.5 ml-6">{msg.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
