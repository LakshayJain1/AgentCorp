'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';

export default function ExecutionLogViewer() {
  const tasks = useGameStore((s) => s.tasks);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allLogs = useMemo(() => {
    const logs = tasks.flatMap((t) =>
      t.executionLogs.map((l) => ({ ...l, taskTitle: t.title })),
    );
    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  }, [tasks]);

  const agents = useGameStore((s) => s.agents);
  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents) m.set(a.id, `${a.emoji} ${a.name}`);
    return m;
  }, [agents]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [allLogs.length]);

  const statusColor = (s: string) =>
    s === 'success' ? '#22c55e' : s === 'error' ? 'var(--color-red)' : 'var(--color-amber)';

  return (
    <div className="flex flex-col font-mono text-xs text-text">
      {/* Mini Header Inside Container */}
      <div className="flex items-center gap-2 mb-2 px-1 border-b border-border/20 pb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-text animate-pulse" />
        <h4 className="text-text font-bold uppercase tracking-wider text-glow">EXECUTION_LOG</h4>
        <span className="text-subtle text-[9px] ml-auto">{allLogs.length} entries</span>
      </div>

      {/* Scrollable logs viewer */}
      <div 
        ref={scrollRef} 
        className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 fade-out-bottom"
      >
        {allLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <span className="text-3xl text-glow animate-pulse mb-2.5">💻</span>
            <span className="text-text font-bold uppercase tracking-wider mb-1 text-glow">COMPILATION_STANDBY</span>
            <span className="text-subtle text-[9px] mb-3">No sandbox task builds executed yet...</span>
            <div className="w-full max-w-[100px] space-y-2 animate-pulse">
              <div className="h-1 bg-muted rounded pulse-skeleton w-2/3 mx-auto" />
            </div>
          </div>
        )}
        {allLogs.map((log) => (
          <div key={log.id} className="border-b border-border/10 py-1 hover:bg-text/5 px-1 rounded transition-all">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: statusColor(log.status) }}
              />
              <span className="text-subtle shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-[#6366f1] font-bold shrink-0">{log.tool}</span>
              <span className="text-subtle">·</span>
              <span className="text-text/80 truncate leading-normal font-sans">{log.action}</span>
              <span className="ml-auto text-subtle text-[9px] shrink-0">
                {agentMap.get(log.agentId) || log.agentId.slice(0, 8)}
              </span>
            </div>
            {log.status === 'success' && log.output && (
              <pre className="text-subtle text-[9px] mt-1 ml-3 whitespace-pre-wrap truncate hover:whitespace-pre-wrap hover:bg-[#050805] p-1.5 rounded border border-border/30 cursor-pointer">
                {log.output.slice(0, 300)}
              </pre>
            )}
            {log.status === 'error' && log.output && (
              <pre className="text-red-400 text-[9px] mt-1 ml-3 whitespace-pre-wrap bg-red-950/20 p-1.5 rounded border border-red-900/40">
                {log.output}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
