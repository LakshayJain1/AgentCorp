'use client';

import { useGameStore } from '@/store/gameStore';
import RoleIcon from '@/components/RoleIcon';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';
import { aiService } from '@/ai/AIService';
import RunSteps from '@/components/RunSteps';
import ApprovalPrompts from '@/components/ApprovalPrompts';
import QuestionPrompts from '@/components/QuestionPrompts';
import { useRunStore } from '@/engine/runEvents';
import { useMemo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Users, Sparkles, MoreHorizontal, Paperclip,
  Smile, Send, Plus, MessageSquare, Building2, X, FileText, Download, Trash2
} from 'lucide-react';

const GameCanvas = dynamic(() => import('@/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full glass-card rounded-3xl flex items-center justify-center">
      <div className="text-center">
        <div className="text-white font-mono text-sm animate-pulse mb-3">INITIALIZING OFFICE...</div>
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
  | { kind: 'agent'; id: string; fromName: string; fromEmoji: string; fromRole: string; toName: string; message: string; timestamp: number }
  | { kind: 'user'; id: string; message: string; timestamp: number }
  | { kind: 'run'; id: string; taskId: string; agentId?: string; message: string; timestamp: number };

export default function CenterPanel() {
  const centerView = useGameStore((s) => s.centerView);
  const setCenterView = useGameStore((s) => s.setCenterView);
  const agents = useGameStore((s) => s.agents);
  const userMessages = useGameStore((s) => s.userMessages);
  const addUserMessage = useGameStore((s) => s.addUserMessage);
  const clearUserMessages = useGameStore((s) => s.clearUserMessages);
  const selectedAgentId = useGameStore((s) => s.selectedAgentId);
  const setSelectedAgent = useGameStore((s) => s.setSelectedAgent);
  const toggleAgentRoster = useGameStore((s) => s.toggleAgentRoster);
  const showAgentRoster = useGameStore((s) => s.showAgentRoster);
  const simulation = useGameStore((s) => s.simulation);
  const setPaused = useGameStore((s) => s.setPaused);

  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent list for @mention autocomplete
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    return agents.filter((a) =>
      a.name.toLowerCase().startsWith(mentionQuery.toLowerCase()),
    ).slice(0, 6);
  }, [agents, mentionQuery]);

  const runs = useRunStore((s) => s.runs);
  const runOrder = useRunStore((s) => s.order);
  const lastRunEventAt = useRunStore((s) => s.lastEventAt);

  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    const msgs: ChatMessage[] = [];
    for (const agent of agents) {
      for (const c of agent.conversations) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const from = agents.find((x) => x.id === c.fromAgentId);
        const to = agents.find((x) => x.id === c.toAgentId);
        msgs.push({ 
          kind: 'agent', 
          id: c.id, 
          fromName: from?.name || 'Unknown', 
          fromEmoji: from?.emoji || '🤖', 
          fromRole: from?.role || 'agent',
          toName: to?.name || 'Unknown', 
          message: c.message, 
          timestamp: c.timestamp 
        });
      }
    }
    for (const um of userMessages) {
      msgs.push({ kind: 'user', id: um.id, message: um.message, timestamp: um.timestamp });
    }
    // One inline "steps" block per run: what the team is doing, in the conversation itself.
    for (const runId of runOrder) {
      const run = runs[runId];
      if (!run) continue;
      msgs.push({
        kind: 'run',
        id: `run_${runId}`,
        taskId: run.taskId,
        agentId: run.agentId,
        // Used as chat history for the AI, so a follow-up can refer to what the run produced.
        message: run.summary ? `[${run.title}] ${run.summary}` : '',
        timestamp: run.startedAt,
      });
    }
    return msgs.sort((a, b) => a.timestamp - b.timestamp);
  }, [agents, userMessages, runs, runOrder]);

  const filteredMessages = useMemo(() => {
    if (!selectedAgentId) return allMessages;
    return allMessages.filter((m) => {
      if (m.kind === 'user') return true;
      const agent = agents.find((a) => a.id === selectedAgentId);
      if (!agent) return true;
      if (m.kind === 'run') return m.agentId === agent.id;
      return m.fromName === agent.name || m.toName === agent.name;
    });
  }, [allMessages, selectedAgentId, agents]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filteredMessages.length]);

  // As a run streams steps/summary, follow it — but only if the reader is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [lastRunEventAt]);

  const handleSend = () => {
    const text = input.trim();
    if (!text && !attachedFile) return;
    const fullText = attachedFile
      ? `${text}\n\n[Attached file: ${attachedFile.name}]\n${attachedFile.content.slice(0, 4000)}`
      : text;
    addUserMessage(fullText);
    // Build last 6 turns of history so the AI has conversational context
    const history = allMessages.filter((m) => m.message).slice(-6).map((m) => ({
      role: m.kind === 'user' ? 'user' as const : 'agent' as const,
      text: m.message,
    }));
    centralOrchestrator.handleUserRequest(fullText, history);
    setInput('');
    setAttachedFile(null);
    setShowEmoji(false);
    setMentionQuery(null);
  };

  const handleNewChat = () => {
    clearUserMessages();
    setSelectedAgent(null);
    setInput('');
    setAttachedFile(null);
    setShowEmoji(false);
    setShowMenu(false);
  };

  const handleSuggestTask = async () => {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const idea = await aiService.generateTaskIdea();
      if (idea) setInput(idea);
    } finally {
      setSuggesting(false);
    }
  };

  const handleExportChat = () => {
    const lines = allMessages.flatMap((m) => {
      const time = new Date(m.timestamp).toLocaleString();
      if (m.kind === 'user') return [`[${time}] YOU: ${m.message}`];
      if (m.kind === 'run') return m.message ? [`[${time}] RUN SUMMARY: ${m.message}`] : [];
      return [`[${time}] ${m.fromName} (${m.fromRole}) -> ${m.toName}: ${m.message}`];
    });
    const blob = new Blob([`# AgentCorp Chat Export\n\n${lines.join('\n')}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentcorp-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024) {
      setInput((prev) => `${prev} [File ${file.name} too large, max 100KB]`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({ name: file.name, content: String(reader.result || '') });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const EMOJIS = ['👍', '👎', '🎉', '🔥', '✅', '❌', '💡', '🐛', '🚀', '👀', '💻', '📊', '❓', '🙏', '👏', '⚡'];

  // Helper to format timestamps exactly as shown in the image: "11:32:57 AM"
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // One fixed bubble look for everyone (agents and the user): neutral black with white text.
  const BUBBLE_BG = 'bg-neutral-900 border border-white/10';
  const BUBBLE_TEXT = 'text-white';

  return (
    <div className="flex-1 lg:w-1/2 lg:flex-none flex flex-col min-w-0 h-full lg:border-r lg:border-l glass-divider bg-black/20">
      {/* Top Toggle & Control Bar */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b glass-divider bg-white/[0.06]">
        <div className="flex gap-1.5 p-1 bg-white/[0.03] rounded-full">
          <button
            onClick={() => setCenterView('chat')}
            className={`relative px-3 sm:px-5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              centerView === 'chat' ? 'text-white' : 'text-navy/55 hover:text-navy/80'
            }`}
          >
            {centerView === 'chat' && (
              <motion.span
                layoutId="centerView"
                className="absolute inset-0 bg-[#253229] rounded-full shadow-sm"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
            <MessageSquare className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Chat</span>
          </button>
          <button
            onClick={() => setCenterView('office')}
            className={`relative px-3 sm:px-5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              centerView === 'office' ? 'text-white' : 'text-navy/55 hover:text-navy/80'
            }`}
          >
            {centerView === 'office' && (
              <motion.span
                layoutId="centerView"
                className="absolute inset-0 bg-[#253229] rounded-full shadow-sm"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
            <Building2 className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">2D Office</span>
          </button>
        </div>

        {/* Toolbar Icons */}
        <div className="flex items-center gap-2 relative">
          {selectedAgentId && (
            <button
              onClick={() => setSelectedAgent(null)}
              title="Clear agent filter"
              className="text-[10px] bg-white/5 hover:bg-white/10 text-navy/60 px-2.5 py-1 rounded-full font-semibold cursor-pointer flex items-center gap-1"
            >
              Filtered: {agents.find((a) => a.id === selectedAgentId)?.name} <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={toggleAgentRoster}
            title={showAgentRoster ? 'Hide agent roster' : 'Show agent roster'}
            className="flex items-center gap-1 bg-white/[0.03] hover:bg-white/[0.08] px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-navy/60" />
            <span className="text-xs font-bold text-navy/70">{agents.filter(a => a.online).length}</span>
          </button>
          <button
            onClick={handleSuggestTask}
            disabled={suggesting}
            title="AI-suggest a task"
            className="p-1.5 hover:bg-white/[0.05] rounded-xl text-navy/50 hover:text-navy/80 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Sparkles className={`w-4 h-4 ${suggesting ? 'animate-pulse' : ''}`} />
          </button>
          <button
            onClick={() => setShowMenu((v) => !v)}
            title="Chat options"
            className="p-1.5 hover:bg-white/[0.05] rounded-xl text-navy/50 hover:text-navy/80 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-10 z-50 w-52 bg-surface border border-navy/10 rounded-2xl shadow-lg p-1.5"
              >
                <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-navy/70 hover:bg-white/5 rounded-xl cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> New chat
                </button>
                <button onClick={handleExportChat} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-navy/70 hover:bg-white/5 rounded-xl cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Export transcript
                </button>
                <button onClick={() => { setPaused(!simulation.paused); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-navy/70 hover:bg-white/5 rounded-xl cursor-pointer">
                  {simulation.paused ? '▶ Resume simulation' : '⏸ Pause simulation'}
                </button>
                <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Clear chat
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat View */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${centerView === 'chat' ? '' : 'hidden'}`}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4 glass-scrollbar min-h-0">
          {filteredMessages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-25">💬</div>
                <p className="text-sm text-navy/55 font-semibold">No messages yet.</p>
                <p className="text-xs text-navy/45 mt-1 font-medium">Type below to start a conversation or assign a task.</p>
              </div>
            </div>
          )}
          {filteredMessages.map((msg) => {
            if (msg.kind === 'run') {
              return <RunSteps key={msg.id} taskId={msg.taskId} />;
            }
            if (msg.kind === 'user') {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                  className="flex gap-3 justify-end"
                >
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div className="flex items-center justify-end gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-navy/50">YOU</span>
                      <span className="text-[9px] text-navy/35 font-medium">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="bg-neutral-900 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm border border-white/10">
                      <p className="text-sm leading-relaxed font-medium">{msg.message}</p>
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                className="flex gap-3"
              >
                {/* Avatar with Emoji background */}
                <div className="shrink-0 w-8 h-8 rounded-full bg-surface shadow-sm border border-navy/5 flex items-center justify-center text-sm">
                  <RoleIcon role={msg.fromRole} size={16} />
                </div>
                
                <div className="flex-1 max-w-[88%] sm:max-w-[80%]">
                  {/* Sender Name, Role, Timestamp Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-navy">{msg.fromName}</span>
                      <span className="text-navy/35 text-[9px]">·</span>
                      <span className="text-[10px] font-bold text-navy/40 uppercase">{msg.fromRole}</span>
                    </div>
                    <span className="text-[9px] text-navy/35 font-medium">{formatTime(msg.timestamp)}</span>
                  </div>

                  {/* Bubble content */}
                  <div className={`rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm ${BUBBLE_BG}`}>
                    <p className={`text-sm leading-relaxed font-medium ${BUBBLE_TEXT}`}>{msg.message}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <QuestionPrompts />
        <ApprovalPrompts />

        {/* Input Bar */}
        <div className="shrink-0 px-3 sm:px-5 py-3 sm:py-4 border-t glass-divider bg-white/[0.06] relative">
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2 bg-ocean-50 border border-white/25 rounded-full px-3 py-1.5 text-xs">
              <FileText className="w-3.5 h-3.5 text-white" />
              <span className="font-semibold text-navy/70 truncate">{attachedFile.name}</span>
              <span className="text-navy/40">({Math.round(attachedFile.content.length / 1024 * 10) / 10} KB attached)</span>
              <button onClick={() => setAttachedFile(null)} className="ml-auto p-1 hover:bg-white/5 rounded cursor-pointer">
                <X className="w-3.5 h-3.5 text-navy/50" />
              </button>
            </div>
          )}
          {/* @mention autocomplete dropdown */}
          <AnimatePresence>
            {mentionCandidates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="mb-1.5 bg-surface border border-navy/10 rounded-2xl shadow-lg overflow-hidden"
              >
                {mentionCandidates.map((agent) => (
                  <button
                    key={agent.id}
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent input blur
                      // Replace the partial @mention with the full name
                      const atIdx = input.lastIndexOf('@');
                      const newInput = input.slice(0, atIdx) + `@${agent.name} `;
                      setInput(newInput);
                      setMentionQuery(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer text-left"
                  >
                    <RoleIcon role={agent.role} size={18} />
                    <div>
                      <span className="text-[13px] font-semibold text-navy/90">{agent.name}</span>
                      <span className="text-[11px] text-navy/40 ml-1.5 capitalize">{agent.role}</span>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 bg-surface border border-navy/10 rounded-2xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-white/20 focus-within:border-white/25 transition-all">
            {/* Left Plus icon = new chat */}
            <button
              onClick={handleNewChat}
              title="Start new chat (clears messages)"
              className="w-8 h-8 rounded-full bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center text-navy/60 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Input field */}
            <input
              type="text"
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                // Detect @mention in progress: find last @ and extract partial name
                const atIdx = val.lastIndexOf('@');
                if (atIdx !== -1) {
                  const partial = val.slice(atIdx + 1);
                  // Only show dropdown if no space after @ yet (still typing name)
                  setMentionQuery(partial.includes(' ') ? null : partial);
                } else {
                  setMentionQuery(null);
                }
              }}
              placeholder={attachedFile ? `Message about ${attachedFile.name}...` : 'Message the team... (use @name to talk to a specific agent)'}
              className="flex-1 bg-transparent text-sm text-navy outline-none placeholder:text-navy/35 font-medium"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setMentionQuery(null); return; }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            {/* Right Action Icons & Send Button */}
            <div className="flex items-center gap-1.5">
              <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.ts,.tsx,.js,.py,.csv" onChange={handleFilePick} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach a text file as task context"
                className="p-1.5 hover:bg-white/[0.05] rounded-lg text-navy/40 hover:text-navy/60 transition-colors cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowEmoji((v) => !v)}
                title="Insert emoji"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${showEmoji ? 'bg-white/5 text-navy/70' : 'text-navy/40 hover:text-navy/60 hover:bg-white/[0.05]'}`}
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() && !attachedFile}
                className="w-8 h-8 rounded-full bg-[#17201C] hover:bg-[#253229] disabled:opacity-25 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <AnimatePresence>
            {showEmoji && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-20 right-5 z-50 bg-surface border border-navy/10 rounded-2xl shadow-lg p-2 grid grid-cols-8 gap-1"
              >
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setInput((prev) => prev + e)} className="w-8 h-8 text-lg hover:bg-white/5 rounded-lg cursor-pointer">
                    {e}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Office View - always mounted, hidden via CSS */}
      <div className={`flex-1 p-3 min-h-0 flex flex-col ${centerView === 'office' ? '' : 'hidden'}`}>
        {/* Mounted only while the Office tab is open: no WebGL context until someone looks at it. */}
        {centerView === 'office' && <GameCanvas />}
      </div>
    </div>
  );
}