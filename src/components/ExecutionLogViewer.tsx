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
    s === 'success' ? '#22c55e' : s === 'error' ? '#ef4444' : '#f59e0b';

  return (
    <div className="bg-panel rounded-xl border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-subtle text-sm font-semibold">Execution Log</h3>
        <span className="text-muted text-xs">{allLogs.length} entries</span>
      </div>
      <div ref={scrollRef} className="max-h-[300px] overflow-y-auto font-mono">
        {allLogs.length === 0 && (
          <div className="text-muted text-xs text-center py-3">No execution logs yet.</div>
        )}
        {allLogs.map((log) => (
          <div key={log.id} className="border-b border-border/10 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: statusColor(log.status) }}
              />
              <span className="text-muted shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-[#6366f1] font-medium">{log.tool}</span>
              <span className="text-muted">·</span>
              <span className="text-subtle truncate">{log.action}</span>
              <span className="ml-auto text-muted text-[10px] shrink-0">
                {agentMap.get(log.agentId) || log.agentId.slice(0, 8)}
              </span>
            </div>
            {log.status === 'success' && log.output && (
              <pre className="text-muted text-[10px] mt-0.5 ml-3 whitespace-pre-wrap truncate hover:whitespace-pre-wrap hover:bg-[#0a0a12] rounded cursor-pointer">
                {log.output.slice(0, 300)}
              </pre>
            )}
            {log.status === 'error' && log.output && (
              <pre className="text-[#ef4444]/70 text-[10px] mt-0.5 ml-3 whitespace-pre-wrap">
                {log.output}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
