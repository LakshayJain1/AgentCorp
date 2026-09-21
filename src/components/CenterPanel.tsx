'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('@/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full glass-card rounded-3xl flex items-center justify-center">
      <div className="text-center">
        <div className="text-ocean-600 font-mono text-sm animate-pulse mb-3">INITIALIZING OFFICE...</div>
        <div className="flex gap-1.5 justify-center">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 bg-ocean-500 rounded-full" style={{ animation: `float 1.5s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  ),
});

type ChatMessage =
  | { kind: 'agent'; id: string; fromName: string; fromEmoji: string; toName: string; message: string; timestamp: number }
  | { kind: 'user'; id: string; message: string; timestamp: number };

export default function CenterPanel() {
  const centerView = useGameStore((s) => s.centerView);
  const setCenterView = useGameStore((s) => s.setCenterView);
  const agents = useGameStore((s) => s.agents);
  const userMessages = useGameStore((s) => s.userMessages);
  const addUserMessage = useGameStore((s) => s.addUserMessage);
  const addTaskWithTitle = useGameStore((s) => s.addTaskWithTitle);
  const selectedAgentId = useGameStore((s) => s.selectedAgentId);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    const msgs: ChatMessage[] = [];
    for (const agent of agents) {
      for (const c of agent.conversations) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const from = agents.find((x) => x.id === c.fromAgentId);
        const to = agents.find((x) => x.id === c.toAgentId);
        msgs.push({ kind: 'agent', id: c.id, fromName: from?.name || 'Unknown', fromEmoji: from?.emoji || '🤖', toName: to?.name || 'Unknown', message: c.message, timestamp: c.timestamp });
      }
    }
    for (const um of userMessages) {
      msgs.push({ kind: 'user', id: um.id, message: um.message, timestamp: um.timestamp });
    }
    return msgs.sort((a, b) => a.timestamp - b.timestamp);
  }, [agents, userMessages]);

  const filteredMessages = useMemo(() => {
    if (!selectedAgentId) return allMessages;
    return allMessages.filter((m) => {
      if (m.kind === 'user') return true;
      const agent = agents.find((a) => a.id === selectedAgentId);
      if (!agent) return true;
      return m.fromName === agent.name || m.toName === agent.name;
    });
  }, [allMessages, selectedAgentId, agents]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filteredMessages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    addUserMessage(text);
    addTaskWithTitle(text);
    setInput('');
  };

  return (
    <div className="w-1/2 flex flex-col min-w-0 h-full">
      {/* Toggle — segmented control */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2.5 glass-topbar">
        <div className="flex gap-1 p-1 bg-white/60 rounded-full border border-navy/5 shadow-sm">
          <button
            onClick={() => setCenterView('chat')}
            className={`relative px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
              centerView === 'chat' ? 'text-white' : 'text-navy/50 hover:text-navy/80'
            }`}
          >
            {centerView === 'chat' && (
              <motion.span
                layoutId="centerView"
                className="absolute inset-0 bg-navy rounded-full shadow-sm"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">💬 Chat</span>
          </button>
          <button
            onClick={() => setCenterView('office')}
            className={`relative px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
              centerView === 'office' ? 'text-white' : 'text-navy/50 hover:text-navy/80'
            }`}
          >
            {centerView === 'office' && (
              <motion.span
                layoutId="centerView"
                className="absolute inset-0 bg-navy rounded-full shadow-sm"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">🏢 2D Office</span>
          </button>
        </div>
        {selectedAgentId && (
          <span className="ml-3 text-[10px] text-navy/50">
            Filtered: {agents.find((a) => a.id === selectedAgentId)?.name}
          </span>
        )}
      </div>

      {/* Chat View */}
      <div className={`flex-1 flex flex-col min-w-0 ${centerView === 'chat' ? '' : 'hidden'}`}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 glass-scrollbar">
          {filteredMessages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-25">💬</div>
                <p className="text-sm text-navy/55">No messages yet.</p>
                <p className="text-xs text-navy/45 mt-1">Type below to start a conversation or assign a task.</p>
              </div>
            </div>
          )}
          {filteredMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            >
              {msg.kind === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[75%] glass-card !bg-[rgba(10,132,255,0.08)] !border-[rgba(10,132,255,0.18)] rounded-2xl rounded-br-md px-4 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold text-ocean-600">You</span>
                        <span className="text-[9px] text-navy/45">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-navy leading-relaxed">{msg.message}</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <div className="shrink-0 w-8 h-8 rounded-xl glass-card flex items-center justify-center text-sm mt-0.5">{msg.fromEmoji}</div>
                  <div className="max-w-[75%]">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-navy">{msg.fromName}</span>
                        <span className="text-[9px] text-navy/25">→</span>
                        <span className="text-xs text-navy/60">{msg.toName}</span>
                        <span className="text-[9px] text-navy/45 ml-auto">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="glass-card rounded-2xl rounded-bl-md px-4 py-2.5">
                        <p className="text-sm text-navy/75 leading-relaxed">{msg.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="shrink-0 px-4 py-3 glass-topbar">
          <div className="flex items-center gap-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message or task idea..."
              className="flex-1 px-4 py-2.5 text-sm glass-input text-navy rounded-full outline-none placeholder:text-navy/35"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-5 py-2.5 text-xs font-semibold bg-ocean-600 text-white rounded-full hover:bg-ocean-700 disabled:opacity-30 transition-all duration-200 shadow-[0_4px_16px_rgba(10,132,255,0.3)] cursor-pointer"
            >
              Send
            </motion.button>
          </div>
        </div>
      </div>

      {/* Office View - always mounted, hidden via CSS */}
      <div className={`flex-1 p-3 ${centerView === 'office' ? '' : 'hidden'}`}>
        <GameCanvas />
      </div>
    </div>
  );
}