'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

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
    s === 'success' ? '#6CC04A' : s === 'error' ? '#EF4444' : '#F59E0B';

  return (
    <div className="flex flex-col text-sm text-gray-900">
      <div className="flex items-center gap-2 mb-2 px-1 border-b border-gray-100 pb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
        <h4 className="text-gray-600 font-semibold text-xs uppercase tracking-wider">Execution Log</h4>
        <span className="text-gray-400 text-[9px] ml-auto">{allLogs.length} entries</span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 fade-out-bottom"
      >
        {allLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-400/20 to-purple-400/20 flex items-center justify-center mb-2.5">
              <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
            </div>
            <span className="text-sm font-semibold text-gray-400 mb-1">No logs yet</span>
            <span className="text-xs text-gray-300 mb-3">Execution logs will appear here...</span>
            <div className="w-full max-w-[100px] space-y-2">
              <div className="h-1.5 bg-gray-100 rounded-full pulse-skeleton w-2/3 mx-auto" />
            </div>
          </div>
        )}
        {allLogs.map((log) => (
          <div key={log.id} className="border-b border-gray-50 py-1 hover:bg-gray-50/50 px-1 rounded-lg transition-all">
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: statusColor(log.status) }}
              />
              <span className="text-gray-400 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-violet-600 font-semibold shrink-0">{log.tool}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600 truncate leading-relaxed">{log.action}</span>
              <span className="ml-auto text-gray-400 text-[9px] shrink-0">
                {agentMap.get(log.agentId) || log.agentId.slice(0, 8)}
              </span>
            </div>
            {log.status === 'success' && log.output && (
              <pre className="text-gray-500 text-[9px] mt-1 ml-3 whitespace-pre-wrap truncate hover:whitespace-pre-wrap hover:bg-gray-50 p-1.5 rounded-lg border border-gray-100 cursor-pointer font-mono">
                {log.output.slice(0, 300)}
              </pre>
            )}
            {log.status === 'error' && log.output && (
              <pre className="text-rose-600 text-[9px] mt-1 ml-3 whitespace-pre-wrap bg-rose-50/50 p-1.5 rounded-lg border border-rose-100 font-mono">
                {log.output}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
