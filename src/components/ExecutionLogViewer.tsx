'use client';

import { useMemo, useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useRunStore, type RunEvent } from '@/engine/runEvents';
import RoleIcon from '@/components/RoleIcon';

const PAGE = 100;
const HIDDEN: RunEvent['kind'][] = ['summary.delta', 'run.started'];

type StatusFilter = 'all' | 'running' | 'success' | 'error';

function dotClass(status: RunEvent['status'], kind: RunEvent['kind']): string {
  if (kind === 'retry' || kind === 'blocked') return 'bg-amber-400';
  if (status === 'error' || kind === 'run.failed') return 'bg-rose-400';
  if (status === 'running') return 'bg-amber-400 animate-pulse';
  return 'bg-emerald-400';
}

/**
 * Detailed event log. The chat shows the story of each run inline; this panel
 * is the full, filterable record behind it (every tool call, check and retry).
 */
export default function ExecutionLogViewer() {
  const runs = useRunStore((s) => s.runs);
  const eventsByRun = useRunStore((s) => s.events);
  const order = useRunStore((s) => s.order);
  const agents = useGameStore((s) => s.agents);

  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const all = useMemo(() => {
    const list: RunEvent[] = [];
    for (const runId of order) for (const e of eventsByRun[runId] ?? []) if (!HIDDEN.includes(e.kind)) list.push(e);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [eventsByRun, order]);

  const filtered = useMemo(() => all.filter((e) => {
    if (taskFilter !== 'all' && e.taskId !== taskFilter) return false;
    if (agentFilter !== 'all' && e.agentId !== agentFilter) return false;
    if (statusFilter !== 'all') {
      const st = e.status ?? (e.kind === 'run.failed' ? 'error' : 'success');
      if (st !== statusFilter) return false;
    }
    return true;
  }), [all, taskFilter, agentFilter, statusFilter]);

  const shown = filtered.slice(0, limit);
  const agentOf = (id?: string) => agents.find((a) => a.id === id);

  const select = 'bg-black/20 border border-navy/10 rounded-lg text-[10px] text-navy/70 px-1.5 py-1 min-w-0 flex-1 cursor-pointer';

  return (
    <div className="space-y-3" data-testid="execution-log">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-navy/60" />
          </span>
          <h3 className="text-sm font-bold text-navy font-display tracking-tight">Execution Log</h3>
        </div>
        <span className="text-[10px] text-navy/40 font-medium">
          {filtered.length}{filtered.length !== all.length ? ` of ${all.length}` : ''} entries
        </span>
      </div>

      {all.length > 0 && (
        <div className="flex gap-1.5">
          <select aria-label="Filter by task" value={taskFilter} onChange={(e) => { setTaskFilter(e.target.value); setLimit(PAGE); }} className={select}>
            <option value="all">All tasks</option>
            {order.slice().reverse().map((id) => <option key={id} value={runs[id]?.taskId}>{runs[id]?.title.slice(0, 40)}</option>)}
          </select>
          <select aria-label="Filter by agent" value={agentFilter} onChange={(e) => { setAgentFilter(e.target.value); setLimit(PAGE); }} className={select}>
            <option value="all">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setLimit(PAGE); }} className={select}>
            <option value="all">Any status</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="error">Errors</option>
          </select>
        </div>
      )}

      <div className="bg-black/20 border border-navy/5 rounded-2xl p-3 shadow-sm min-h-[140px] flex items-center justify-center">
        {shown.length === 0 ? (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5 text-navy/40" />
            </div>
            <p className="text-xs font-bold text-navy/80">{all.length === 0 ? 'No logs yet' : 'No entries match'}</p>
            <p className="text-[10px] text-navy/45 mt-1 max-w-[200px] mx-auto leading-normal">
              {all.length === 0 ? 'Execution logs will appear here as agents process tasks.' : 'Try clearing a filter.'}
            </p>
          </div>
        ) : (
          <div className="w-full space-y-1 max-h-[260px] overflow-y-auto glass-scrollbar">
            {shown.map((e) => {
              const agent = agentOf(e.agentId);
              const tool = typeof e.data?.tool === 'string' ? (e.data.tool as string) : e.kind;
              const isOpen = openId === e.id;
              return (
                <div key={e.id} data-testid="log-entry" className="text-[10px] rounded-xl hover:bg-white/[0.04] transition-colors">
                  <button
                    onClick={() => e.detail && setOpenId(isOpen ? null : e.id)}
                    className={`w-full flex items-start gap-2 py-1.5 px-2 text-left ${e.detail ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotClass(e.status, e.kind)}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {agent && <span className="font-bold text-navy/70"><RoleIcon role={agent.role} size={13} className="inline -mt-0.5 mr-1" />{agent.name}</span>}
                        <span className="text-[9px] font-mono text-navy/35 bg-white/5 px-1 rounded">{tool}</span>
                      </span>
                      <span className="block text-navy/60 break-words mt-0.5">{e.message}</span>
                      <span className="block text-navy/35 text-[9px] truncate">{runs[e.runId]?.title}</span>
                    </span>
                    <span className="text-[9px] text-navy/25 shrink-0 mt-0.5">
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </button>
                  {isOpen && e.detail && (
                    <pre className="mx-2 mb-1.5 text-[9px] whitespace-pre-wrap break-words max-h-40 overflow-auto font-mono text-navy/55 bg-white/[0.05] p-2 rounded-lg">{e.detail.slice(0, 4000)}</pre>
                  )}
                </div>
              );
            })}
            {filtered.length > shown.length && (
              <button
                onClick={() => setLimit((n) => n + PAGE)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-navy/50 hover:text-navy/80 cursor-pointer"
              >
                <ChevronDown className="w-3 h-3" /> Show {Math.min(PAGE, filtered.length - shown.length)} more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
