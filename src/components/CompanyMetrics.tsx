'use client';

import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';

const MetricCard = ({
  label,
  value,
  status,
  icon,
  format = 'number',
}: {
  label: string;
  value: number;
  status: 'good' | 'failed' | 'warning' | 'neutral';
  icon: string;
  format?: 'number' | 'percent';
}) => {
  const borderColors = {
    good: 'border-l-4 border-l-[#00ff88]',
    failed: 'border-l-4 border-l-[#ff4d4d]',
    warning: 'border-l-4 border-l-[#ffb400]',
    neutral: 'border-l-4 border-l-[#00f5ff]',
  };

  const textColors = {
    good: 'text-[#00ff88] text-glow',
    failed: 'text-[#ff4d4d]',
    warning: 'text-[#ffb400]',
    neutral: 'text-[#00f5ff]',
  };

  return (
    <div className={`bg-card border border-border/30 rounded-lg p-3 flex flex-col justify-between min-h-[90px] transition-all hover:bg-surface/30 ${borderColors[status]}`}>
      <div className="flex items-center gap-1.5 mb-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: status === 'good' ? '#00ff88' : status === 'failed' ? '#ff4d4d' : status === 'warning' ? '#ffb400' : '#00f5ff' }} />
        <span className="text-[9px] text-subtle font-bold uppercase tracking-wider font-mono">
          {label}
        </span>
      </div>
      <motion.div
        key={value}
        initial={{ scale: 1.15, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`text-2xl font-black font-mono tracking-tight ${textColors[status]} text-glow`}
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      <MetricCard
        label="Completed"
        value={completedCount}
        status="good"
        icon="✅"
      />
      <MetricCard
        label="Failed"
        value={failedCount}
        status={failedCount > 0 ? 'failed' : 'neutral'}
        icon="❌"
      />
      <MetricCard
        label="Efficiency"
        value={efficiency}
        status={efficiency > 70 ? 'good' : efficiency > 40 ? 'warning' : 'failed'}
        icon="⚡"
        format="percent"
      />
      <MetricCard
        label="Morale"
        value={morale}
        status={morale > 70 ? 'good' : morale > 40 ? 'warning' : 'failed'}
        icon="❤️"
        format="percent"
      />
      <MetricCard
        label="Active Agents"
        value={activeAgents}
        status="neutral"
        icon="👤"
      />
      <MetricCard
        label="Active Tasks"
        value={activeTasks}
        status={activeTasks > 0 ? 'warning' : 'neutral'}
        icon="📋"
      />
    </div>
  );
}
