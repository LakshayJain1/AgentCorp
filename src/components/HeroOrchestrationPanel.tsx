'use client';

import { useRef } from 'react';
import { motion, MotionConfig, useInView } from 'framer-motion';

type Status = 'completed' | 'working' | 'queued';

interface DeptAgent {
  id: string;
  label: string;
  task: string;
  status: Status;
}

const SPRING = { type: 'spring' as const, bounce: 0, duration: 0.5 };

const DEPT_AGENTS: DeptAgent[] = [
  { id: 'research',    label: 'Research',    task: 'Market analysis',   status: 'completed' },
  { id: 'marketing',   label: 'Marketing',   task: 'Campaign strategy', status: 'working'   },
  { id: 'engineering', label: 'Engineering', task: 'Landing page',      status: 'working'   },
  { id: 'finance',     label: 'Finance',     task: 'Budget forecast',   status: 'queued'    },
];

const STATUS_CFG = {
  completed: {
    label: 'Done',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    pulse: false,
  },
  working: {
    label: 'Active',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    pulse: true,
  },
  queued: {
    label: 'Queued',
    badge: 'bg-[#F5F6FA] text-[#8A98AB] border-[#E5E8EF]',
    dot: 'bg-[#C4C9D4]',
    pulse: false,
  },
} satisfies Record<Status, { label: string; badge: string; dot: string; pulse: boolean }>;

function PulseDot({ color, pulse }: { color: string; pulse: boolean }) {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      {pulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-50`} />
      )}
      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${color}`} />
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border ${cfg.badge}`}>
      <PulseDot color={cfg.dot} pulse={cfg.pulse} />
      {cfg.label}
    </span>
  );
}

export default function HeroOrchestrationPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-5%' });

  const completedCount = DEPT_AGENTS.filter(a => a.status === 'completed').length;
  const progressPct = Math.round((completedCount / DEPT_AGENTS.length) * 100);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...SPRING, duration: 0.6 }}
          className="bg-mist border border-[#E6E6E6] rounded-[32px] overflow-hidden"
        >

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F0F2F6] bg-[#FAFBFC]">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="h-2 w-2 rounded-full bg-[#0071E3]" />
              <span className="font-semibold text-[#17171F]">AgentCorp</span>
              <span className="text-[#C8CCDA] mx-0.5 select-none">·</span>
              <span className="text-[#5E6C82]">Q4 Campaign Sprint</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
              <PulseDot color="bg-emerald-500" pulse={true} />
              Active
            </span>
          </div>

          <div className="p-4 space-y-3">

            {/* CEO agent */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ ...SPRING, delay: 0.1 }}
              className="relative rounded-[20px] p-3.5 bg-white border border-[#E6E6E6] overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0071E3]" />
              <div className="pl-1.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#17171F]">CEO</span>
                    <span className="text-[10px] text-[#8A98AB]">Alex</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#0071E3] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                    <PulseDot color="bg-blue-500" pulse={true} />
                    Orchestrating
                  </span>
                </div>
                <div className="text-[13px] font-semibold text-[#17171F] leading-snug mb-1.5">
                  Launch Q4 product campaign
                </div>
                <div className="text-[11px] text-[#8A98AB]">
                  4 tasks assigned · 1 complete · 2 active · 1 queued
                </div>
              </div>
            </motion.div>

            {/* Delegation connector */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="flex justify-center"
              aria-hidden="true"
            >
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-px h-3 bg-[#DEE2EA]" />
                <span className="text-[9px] font-semibold uppercase tracking-widest text-[#B0B9C6] px-2.5">Delegating</span>
                <div className="w-px h-3 bg-[#DEE2EA]" />
              </div>
            </motion.div>

            {/* Department agents */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEPT_AGENTS.map((agent, i) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ ...SPRING, delay: 0.35 + i * 0.09 }}
                  className="rounded-lg p-3 bg-white border border-[#EAECF2] hover:border-[#C0CDE0] hover:shadow-sm transition-all duration-200 cursor-default"
                >
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-[#8A98AB] mb-1">
                    {agent.label}
                  </div>
                  <div className="text-[12px] font-semibold text-[#17171F] leading-snug mb-2.5">
                    {agent.task}
                  </div>
                  <StatusBadge status={agent.status} />
                </motion.div>
              ))}
            </div>

            {/* Execution summary */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.75, duration: 0.4 }}
              className="pt-0.5"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#8A98AB]">Task progress</span>
                <span className="text-[11px] font-semibold text-[#5E6C82]">
                  {completedCount} of {DEPT_AGENTS.length} complete
                </span>
              </div>
              <div className="h-[3px] bg-[#F0F2F7] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#0071E3] rounded-full"
                  initial={{ width: '0%' }}
                  animate={inView ? { width: `${progressPct}%` } : {}}
                  transition={{ delay: 0.9, duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
