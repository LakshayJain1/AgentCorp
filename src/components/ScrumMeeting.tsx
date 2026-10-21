'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquareText, CheckCircle2, XCircle, Loader2, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { generateDailyScrumTasks, type ScrumResult } from '@/app/workspace/_actions';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function ScrumMeeting() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrumResult | null>(null);
  const [dispatched, setDispatched] = useState<Set<string>>(new Set());

  const tasks = useGameStore((s) => s.tasks);
  const companyName = useGameStore((s) => s.companyName);
  const companyProduct = useGameStore((s) => s.companyProduct);
  const addTaskWithTitle = useGameStore((s) => s.addTaskWithTitle);

  const generate = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setDispatched(new Set());

    const cutoff = Date.now() - DAY_MS;

    const recentCompleted = tasks
      .filter((t) => t.status === 'completed' && (t.completedAt ?? 0) > cutoff)
      .map((t) => t.title)
      .slice(0, 10);

    const recentFailed = tasks
      .filter((t) => t.status === 'failed')
      .map((t) => t.title)
      .slice(0, 5);

    const blocked = tasks
      .filter((t) => t.status === 'in_progress')
      .map((t) => t.title)
      .slice(0, 5);

    try {
      const data = await generateDailyScrumTasks({
        companyName: companyName || 'AgentCorp',
        companyProduct: companyProduct || 'AI agent platform',
        completedTasks: recentCompleted,
        failedTasks: recentFailed,
        blockedTasks: blocked,
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [tasks, companyName, companyProduct]);

  useEffect(() => {
    if (isOpen && !result && !loading) {
      generate();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const dispatch = (title: string) => {
    if (dispatched.has(title)) return;
    addTaskWithTitle(title);
    setDispatched((prev) => new Set(prev).add(title));
  };

  const dispatchAll = () => {
    if (!result) return;
    result.today.forEach((t) => {
      if (!dispatched.has(t)) {
        addTaskWithTitle(t);
      }
    });
    setDispatched(new Set(result.today));
  };

  const allDispatched = result ? result.today.every((t) => dispatched.has(t)) : false;

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <MessageSquareText className="w-3 h-3" />
        Daily Scrum
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 bg-white border border-navy/10 rounded-2xl shadow-xl p-4 w-80 z-50"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-navy">Daily Standup</span>
                {loading && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
              </div>
              <div className="flex items-center gap-1">
                {result && !loading && (
                  <button
                    onClick={generate}
                    title="Regenerate"
                    className="text-navy/30 hover:text-violet-500 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-navy/30 hover:text-navy/60 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="py-6 flex flex-col items-center gap-2 text-navy/40">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                <span className="text-xs">PM is planning today's sprint…</span>
              </div>
            )}

            {/* Result */}
            {!loading && result && (
              <div className="flex flex-col gap-3">

                {/* Yesterday */}
                {result.yesterday.length > 0 && (
                  <section>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/35 mb-1.5">
                      Yesterday
                    </p>
                    <div className="flex flex-col gap-1">
                      {result.yesterday.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-1.5 text-xs text-navy/60"
                        >
                          {item.status === 'done' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                          )}
                          <span className={item.status === 'failed' ? 'line-through text-navy/35' : ''}>
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {result.yesterday.length === 0 && (
                  <p className="text-[11px] text-navy/35 italic">No completed tasks yet — first standup!</p>
                )}

                {/* Divider */}
                <div className="border-t border-navy/6" />

                {/* Today */}
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/35">
                      Today's Sprint
                    </p>
                    {!allDispatched && (
                      <button
                        onClick={dispatchAll}
                        className="text-[10px] font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        Dispatch all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {result.today.map((title, i) => {
                      const sent = dispatched.has(title);
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2 text-xs rounded-lg px-2 py-1.5 transition-colors ${
                            sent ? 'bg-violet-50/50 text-navy/35' : 'bg-navy/3 hover:bg-navy/6 text-navy/70'
                          }`}
                        >
                          <span className="flex-1">{title}</span>
                          <button
                            onClick={() => dispatch(title)}
                            disabled={sent}
                            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                              sent
                                ? 'text-violet-300 bg-violet-50 cursor-default'
                                : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                            }`}
                          >
                            {sent ? '✓ sent' : 'run'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Blockers */}
                {result.blockers.length > 0 && (
                  <>
                    <div className="border-t border-navy/6" />
                    <section>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/60 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Blockers
                      </p>
                      <div className="flex flex-col gap-1">
                        {result.blockers.map((b, i) => (
                          <p key={i} className="text-xs text-amber-700/70 bg-amber-50 rounded-lg px-2 py-1">
                            {b}
                          </p>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
