'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ExecutionLogViewer() {
  const tasks = useGameStore((s) => s.tasks);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allLogs = useMemo(() => {
    const logs = tasks.flatMap((t) => t.executionLogs.map((l) => ({ ...l, taskTitle: t.title })));
    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  }, [tasks]);

  const agents = useGameStore((s) => s.agents);
  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents) m.set(a.id, `${a.emoji} ${a.name}`);
    return m;
  }, [agents]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [allLogs.length]);

  const statusColor = (s: string) => s === 'success' ? '#34C759' : s === 'error' ? '#FF453A' : '#FF9F0A';

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-navy/70 text-xs font-semibold uppercase tracking-wider">Execution Log</h3>
        <span className="text-navy/55 text-[10px]">{allLogs.length} entries</span>
      </div>
      <div ref={scrollRef} className="max-h-[180px] overflow-y-auto glass-scrollbar">
        {allLogs.length === 0 && (
          <div className="text-center py-6">
            <div className="text-2xl mb-2 opacity-30">⚙️</div>
            <p className="text-xs text-navy/55">No logs yet</p>
          </div>
        )}
        {allLogs.map((log) => (
          <div key={log.id} className="py-1.5 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.02)] transition-colors">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor(log.status) }} />
              <span className="text-navy/55 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-violet-600 font-semibold shrink-0">{log.tool}</span>
              <span className="text-navy/25">·</span>
              <span className="text-navy/80 truncate">{log.action}</span>
              <span className="ml-auto text-navy/55 text-[9px] shrink-0">{agentMap.get(log.agentId) || log.agentId.slice(0, 8)}</span>
            </div>
            {log.status === 'success' && log.output && (
              <pre className="text-navy/55 text-[9px] mt-1 ml-3 whitespace-pre-wrap truncate hover:whitespace-pre-wrap bg-white/70/80 p-1.5 rounded-lg cursor-pointer font-mono">{log.output.slice(0, 300)}</pre>
            )}
            {log.status === 'error' && log.output && (
              <pre className="text-rose-500 text-[9px] mt-1 ml-3 whitespace-pre-wrap bg-rose-50/50 p-1.5 rounded-lg font-mono">{log.output}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
