'use client';

import { useOrgViewer } from '@/hooks/useOrgViewer';
import BrandLogo from '@/components/BrandLogo'
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Radio, WifiOff, Clock, Users, CheckSquare, Zap, BarChart2 } from 'lucide-react';
import { useAuthUser } from '@/hooks/useAuthUser';
import type { OrgSnapshot } from '@/app/api/org-state/route';

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-white/20',
  thinking: 'bg-amber-400',
  coding: 'bg-ocean',
  debugging: 'bg-rose-400',
  reviewing: 'bg-violet-400',
  researching: 'bg-teal-400',
  communicating: 'bg-green-400',
  completed: 'bg-green-500',
  waiting: 'bg-black/30',
  blocked: 'bg-rose-500',
};

const TASK_STATUS_PILL: Record<string, string> = {
  pending: 'bg-white/8 text-navy/50',
  prioritized: 'bg-amber-500/10 text-amber-400',
  assigned: 'bg-ocean-50 text-white',
  in_progress: 'bg-violet-500/10 text-violet-400',
  review: 'bg-teal-500/10 text-teal-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-rose-500/10 text-rose-400',
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function AgentCard({ agent, tasks }: {
  agent: OrgSnapshot['agents'][number];
  tasks: OrgSnapshot['tasks'];
}) {
  const task = agent.currentTaskId ? tasks.find((t) => t.id === agent.currentTaskId) : null;
  const dot = STATUS_COLORS[agent.workStatus] ?? 'bg-white/20';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-navy/6 hover:bg-white/10 transition-colors">
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xl leading-none">
          {agent.emoji}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white/10 ${dot}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-navy truncate">{agent.name}</p>
        <p className="text-[10px] text-navy/45 uppercase font-medium">{agent.role} · {agent.workStatus}</p>
        {task && (
          <p className="text-[9px] text-navy/35 truncate mt-0.5">↳ {task.title}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[9px] text-navy/40">{agent.energy}%</div>
        <div className="w-10 h-1 rounded-full bg-white/8 mt-1 overflow-hidden">
          <div
            className="h-full rounded-full bg-ocean transition-all"
            style={{ width: `${agent.energy}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function LiveBanner({ snapshot, status, ts }: {
  snapshot: OrgSnapshot;
  status: 'live' | 'stale';
  ts: number | null;
}) {
  return (
    <div className="glass-topbar px-5 py-2.5 flex items-center gap-3 z-30 shrink-0">
      <div className="flex items-center gap-3 shrink-0">
        <BrandLogo size={36} className="shadow-none" />
        <div>
          <h1 className="text-sm font-bold text-navy font-display tracking-tight">
            {snapshot.companyName}
          </h1>
          <p className="text-[10px] text-navy/50 font-medium truncate max-w-[180px]">{snapshot.companyProduct}</p>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-4 text-[10px] text-navy/50 font-medium">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{snapshot.agents.filter((a) => a.online).length} online</span>
          <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" />{snapshot.simulation.totalTasksCompleted} done</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{Math.round(snapshot.simulation.efficiency)}% efficiency</span>
        </div>

        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold ${
          status === 'live'
            ? 'bg-green-500/10 text-green-400 border border-green-500/25'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
        }`}>
          {status === 'live'
            ? <><Radio className="w-3 h-3 animate-pulse" /> Live</>
            : <><Clock className="w-3 h-3" /> {ts ? timeAgo(ts) : 'Stale'}</>
          }
        </div>

        <div className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-[10px] font-semibold text-violet-400">
          View only
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-8 h-8 text-navy/30" />
        </div>
        <h2 className="text-base font-bold text-navy mb-2">Workspace not broadcasting</h2>
        <p className="text-sm text-navy/50 leading-relaxed">
          The workspace owner hasn&apos;t published their state yet, or the link has expired.
          Ask them to open their workspace to start broadcasting.
        </p>
      </div>
    </div>
  );
}

function NoAccessState({ email }: { email?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-8 h-8 text-navy/30" />
        </div>
        <h2 className="text-base font-bold text-navy mb-2">You haven&apos;t been invited to this workspace</h2>
        <p className="text-sm text-navy/50 leading-relaxed">
          {email ? <>You&apos;re signed in as <strong>{email}</strong>, which</> : <>This account</>}{' '}doesn&apos;t have an invitation.
          Ask the owner to invite this email address, or sign in with the address they invited.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2 border-white/25 border-t-ocean mx-auto mb-4"
        />
        <p className="text-sm text-navy/50 font-medium">Connecting to workspace…</p>
      </div>
    </div>
  );
}

export default function WorkspaceViewer({ orgId }: { orgId: string }) {
  const { snapshot, ts, status } = useOrgViewer(orgId);
  const { user } = useAuthUser();

  if (status === 'loading') {
    return (
      <div className="h-screen w-screen flex flex-col ws-bg overflow-hidden">
        <div className="glass-topbar px-5 py-2.5 flex items-center gap-3 z-30 shrink-0">
          <BrandLogo size={36} />
          <span className="text-sm font-bold text-navy font-display">AgentCorp</span>
          <div className="flex-1" />
          <span className="text-[10px] text-navy/40">Joining workspace…</span>
        </div>
        <LoadingState />
      </div>
    );
  }

  if (status === 'not_found' || status === 'no_access' || !snapshot) {
    return (
      <div className="h-screen w-screen flex flex-col ws-bg overflow-hidden">
        <div className="glass-topbar px-5 py-2.5 flex items-center gap-3 z-30 shrink-0">
          <BrandLogo size={36} />
          <span className="text-sm font-bold text-navy font-display">AgentCorp</span>
          <div className="flex-1" />
          {user?.name && (
            <span className="text-[10px] text-navy/40">{user.name}</span>
          )}
        </div>
        {status === 'no_access' ? <NoAccessState email={user?.email} /> : <NotFoundState />}
      </div>
    );
  }

  const activeTasks = snapshot.tasks.filter((t) => !['completed', 'failed'].includes(t.status));
  const completedTasks = snapshot.tasks.filter((t) => t.status === 'completed');
  const onlineAgents = snapshot.agents.filter((a) => a.online);

  return (
    <div className="h-screen w-screen flex flex-col ws-bg overflow-hidden">
      <LiveBanner snapshot={snapshot} status={status as 'live' | 'stale'} ts={ts} />

      <div className="flex-1 overflow-hidden min-h-0 flex">
        {/* Left: Agents */}
        <div className="w-72 shrink-0 border-r border-navy/8 flex flex-col overflow-hidden bg-white/[0.06]">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold uppercase text-navy/40 tracking-wider">
              Agents · {onlineAgents.length} online
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {snapshot.agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} tasks={snapshot.tasks} />
            ))}
          </div>
        </div>

        {/* Center: Live activity feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-navy/6">
            <p className="text-[10px] font-bold uppercase text-navy/40 tracking-wider">Live Activity</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 flex flex-col-reverse">
            <AnimatePresence initial={false}>
              {[...snapshot.events].reverse().map((ev) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5 group"
                >
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-ocean/40 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-navy/70 leading-relaxed">{ev.message}</p>
                    <p className="text-[9px] text-navy/30 mt-0.5">{timeAgo(ev.timestamp)}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Tasks + Stats */}
        <div className="w-72 shrink-0 border-l border-navy/8 flex flex-col overflow-hidden bg-white/[0.06]">
          {/* Stats row */}
          <div className="px-4 pt-4 pb-3 border-b border-navy/6 grid grid-cols-2 gap-2">
            {[
              { label: 'Active', val: activeTasks.length, icon: <BarChart2 className="w-3 h-3" /> },
              { label: 'Done', val: completedTasks.length, icon: <CheckSquare className="w-3 h-3" /> },
              { label: 'Efficiency', val: `${Math.round(snapshot.simulation.efficiency)}%`, icon: <Zap className="w-3 h-3" /> },
              { label: 'Deliverables', val: snapshot.deliverableProjects.length, icon: <Cpu className="w-3 h-3" /> },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.06] rounded-xl px-3 py-2 border border-navy/6">
                <div className="flex items-center gap-1 text-navy/40 mb-1">{s.icon}<span className="text-[9px] font-semibold uppercase">{s.label}</span></div>
                <p className="text-sm font-bold text-navy">{s.val}</p>
              </div>
            ))}
          </div>

          {/* Task list */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase text-navy/40 tracking-wider">Tasks</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {snapshot.tasks.length === 0 && (
              <p className="text-[10px] text-navy/30 px-2 py-4 text-center">No tasks yet</p>
            )}
            {[...snapshot.tasks].reverse().map((task) => (
              <div key={task.id} className="px-3 py-2 rounded-xl bg-white/[0.06] border border-navy/6">
                <p className="text-xs font-semibold text-navy truncate">{task.title}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TASK_STATUS_PILL[task.status] ?? 'bg-white/8 text-navy/50'}`}>
                    {task.status}
                  </span>
                  {task.deliverableType && (
                    <span className="text-[9px] text-navy/30 uppercase">{task.deliverableType}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
