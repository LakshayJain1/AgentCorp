'use client';

import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';

const MetricCard = ({
  label,
  value,
  status,
  format = 'number',
}: {
  label: string;
  value: number;
  status: 'good' | 'failed' | 'warning' | 'neutral';
  format?: 'number' | 'percent';
}) => {
  const accentColors = {
    good: '#34C759',
    failed: '#FF453A',
    warning: '#FF9F0A',
    neutral: '#0A84FF',
  };

  return (
    <div className="glass-card rounded-2xl p-3.5 flex flex-col justify-between min-h-[85px]">
      <div className="flex items-center gap-1.5 mb-1 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColors[status] }} />
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(23,23,31,0.5)' }}>
          {label}
        </span>
      </div>
      <motion.div
        key={value}
        initial={{ scale: 1.06, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="text-2xl font-bold tracking-tight"
        style={{ color: accentColors[status] }}
      >
        {format === 'percent' ? `${Math.round(value)}%` : value}
      </motion.div>
    </div>
  );
};

export default function CompanyMetrics() {
  const agents = useGameStore((s) => s.agents);
  const activeAgents = agents.filter((a) => a.state === 'working' || a.state === 'walking').length;
  const tasks = useGameStore((s) => s.tasks);
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'failed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const efficiency = useGameStore((s) => s.simulation.efficiency);
  const morale = useGameStore((s) => s.simulation.morale);

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <MetricCard label="Completed" value={completedCount} status="good" />
      <MetricCard label="Failed" value={failedCount} status={failedCount > 0 ? 'failed' : 'neutral'} />
      <MetricCard label="Efficiency" value={efficiency} status={efficiency > 70 ? 'good' : efficiency > 40 ? 'warning' : 'failed'} format="percent" />
      <MetricCard label="Morale" value={morale} status={morale > 70 ? 'good' : morale > 40 ? 'warning' : 'failed'} format="percent" />
      <MetricCard label="Active Agents" value={activeAgents} status="neutral" />
      <MetricCard label="Active Tasks" value={activeTasks} status={activeTasks > 0 ? 'warning' : 'neutral'} />
    </div>
  );
}
