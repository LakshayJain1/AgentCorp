'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useMemo, useState, useRef, useEffect } from 'react';
import ScrumMeeting from '@/components/ScrumMeeting';
import { Cpu, Play, Pause, Search, Command, X } from 'lucide-react';

export default function TopBar() {
  const { user, isLoading } = useUser();
  const isSignedIn = !isLoading && !!user;
  const simulation = useGameStore((s) => s.simulation);
  const setPaused = useGameStore((s) => s.setPaused);
  const agents = useGameStore((s) => s.agents);
  const tasks = useGameStore((s) => s.tasks);
  const projects = useGameStore((s) => s.deliverableProjects);
  const setSelectedAgent = useGameStore((s) => s.setSelectedAgent);
  const setSelectedTask = useGameStore((s) => s.setSelectedTask);
  const setCenterView = useGameStore((s) => s.setCenterView);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        boxRef.current?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { agents: [], tasks: [], projects: [], messages: [] as { id: string; from: string; text: string }[] };
    return {
      agents: agents.filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)).slice(0, 4),
      tasks: tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 4),
      projects: projects.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 4),
      messages: [],
    };
  }, [query, agents, tasks, projects]);

  const hasResults = results.agents.length + results.tasks.length + results.projects.length > 0;

  return (
    <div className="glass-topbar px-5 py-2.5 flex items-center gap-3 z-30 shrink-0">
      {/* Left: Logo & Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-ocean to-teal flex items-center justify-center shadow-[0_4px_14px_rgba(10,132,255,0.3)]">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-navy flex items-center gap-2 font-display tracking-tight">
            AgentCorp
            <span className="text-[9px] bg-white/80 text-navy/50 px-1.5 py-0.5 rounded-md font-medium border border-navy/5">v2.0</span>
          </h1>
          <p className="hidden md:block text-[10px] text-navy/50 font-medium">Autonomous Multi-Agent Workspace</p>
        </div>
      </div>

      {/* Center: Search Bar — hidden on small screens */}
      <div className="hidden md:flex flex-1 justify-center px-4">
        <div ref={boxRef} className="relative w-full max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search agents, deliverables, or conversations..."
            className="w-full pl-10 pr-16 py-2 text-sm glass-input text-navy rounded-full outline-none placeholder:text-navy/35 focus:ring-2 focus:ring-ocean-200 transition-all"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-navy/5 rounded-full cursor-pointer">
              <X className="w-3.5 h-3.5 text-navy/40" />
            </button>
          ) : null}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/80 border border-navy/5">
            <Command className="w-2.5 h-2.5 text-navy/40" />
            <span className="text-[8px] text-navy/40 font-medium">K</span>
          </div>
          <AnimatePresence>
            {focused && query.trim().length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 left-0 right-0 bg-white border border-navy/10 rounded-2xl shadow-xl p-2 z-50 max-h-80 overflow-y-auto"
              >
                {!hasResults && (
                  <p className="text-xs text-navy/40 px-3 py-2">No matches for “{query}”.</p>
                )}
                {results.agents.length > 0 && (
                  <div className="mb-1">
                    <p className="text-[10px] font-bold uppercase text-navy/40 px-3 py-1">Agents</p>
                    {results.agents.map((a) => (
                      <button
                        key={a.id}
                        onMouseDown={() => { setSelectedAgent(a.id); setCenterView('chat'); setQuery(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-navy/5 rounded-xl cursor-pointer"
                      >
                        <span className="text-xs font-bold text-navy">{a.emoji} {a.name}</span>
                        <span className="text-[10px] text-navy/40 ml-2 uppercase">{a.role} · {a.workStatus}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.tasks.length > 0 && (
                  <div className="mb-1">
                    <p className="text-[10px] font-bold uppercase text-navy/40 px-3 py-1">Tasks</p>
                    {results.tasks.map((t) => (
                      <button
                        key={t.id}
                        onMouseDown={() => { setSelectedTask(t.id); setQuery(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-navy/5 rounded-xl cursor-pointer"
                      >
                        <span className="text-xs font-bold text-navy truncate block">{t.title}</span>
                        <span className="text-[10px] text-navy/40 capitalize">{t.status}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.projects.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-navy/40 px-3 py-1">Deliverables</p>
                    {results.projects.map((p) => (
                      <div key={p.id} className="px-3 py-2">
                        <span className="text-xs font-bold text-navy truncate block">{p.title}</span>
                        <span className="text-[10px] text-navy/40 uppercase">{p.type}{p.lang ? ` · ${p.lang}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {isSignedIn && (
          <div className="flex items-center gap-2 pr-3 border-r glass-divider">
            <span className="hidden md:inline text-[9px] text-navy/50 font-medium uppercase">Operator</span>
            <div className="flex items-center gap-1.5">
              {user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="avatar" className="w-6 h-6 rounded-full border border-navy/10" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-ocean to-teal flex items-center justify-center text-white text-[9px] font-bold">
                  {(user?.name?.[0] || user?.email?.[0] || 'A').toUpperCase()}
                </div>
              )}
              <span className="hidden md:inline text-xs font-semibold text-navy">
                {(user?.name as string | undefined) || (user?.email as string | undefined) || 'Operator'}
              </span>
              <a href="/auth/logout" className="hidden md:inline text-[9px] text-navy/40 hover:text-navy/70 font-medium transition-colors">
                Sign out
              </a>
            </div>
          </div>
        )}

        <ScrumMeeting />

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setPaused(!simulation.paused)}
          className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
            simulation.paused
              ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
              : 'glass-card text-navy/60 hover:text-navy'
          }`}
        >
          {simulation.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {simulation.paused ? 'Resume' : 'Pause'}
        </motion.button>

        <div className="hidden md:flex items-center gap-2.5 pl-3 border-l glass-divider">
          <span className="text-navy/50 text-[9px] font-semibold uppercase">Efficiency</span>
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="15" className="stroke-[rgba(23,23,31,0.08)]" strokeWidth="2.5" fill="transparent" />
              <motion.circle
                cx="18" cy="18" r="15"
                stroke={simulation.efficiency > 70 ? '#34C759' : simulation.efficiency > 40 ? '#FF9F0A' : '#FF3B30'}
                strokeWidth="2.5"
                fill="transparent"
                strokeDasharray="94.25"
                animate={{ strokeDashoffset: 94.25 - (simulation.efficiency / 100) * 94.25 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-navy">
              {Math.round(simulation.efficiency)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}