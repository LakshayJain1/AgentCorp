'use client';

import { useGameStore } from '@/store/gameStore';
import { motion } from 'framer-motion';

const MetricCard = ({
  label,
  value,
  color,
  icon,
  format = 'number',
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
  format?: 'number' | 'percent';
}) => (
  <div className="bg-card border border-border/40 rounded-xl p-3">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-muted text-xs font-medium">
        {icon} {label}
      </span>
    </div>
    <motion.div
      key={value}
      initial={{ scale: 1.2, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      className="text-2xl font-bold"
      style={{ color }}
    >
      {format === 'percent' ? `${Math.round(value)}%` : value}
    </motion.div>
  </div>
);

export default function CompanyMetrics() {
  const simulation = useGameStore((s) => s.simulation);
  const agents = useGameStore((s) => s.agents);
  const activeAgents = agents.filter((a) => a.state === 'working' || a.state === 'walking').length;
  const tasks = useGameStore((s) => s.tasks);
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'failed').length;

  return (
    <div className="bg-panel rounded-xl border border-border/50 p-3">
      <h3 className="text-subtle text-sm font-semibold mb-3">
        Company Metrics
      </h3>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Completed"
          value={simulation.totalTasksCompleted}
          color="#00ff88"
          icon="✅"
        />
        <MetricCard
          label="Failed"
          value={simulation.totalTasksFailed}
          color="#ff6b6b"
          icon="❌"
        />
        <MetricCard
          label="Efficiency"
          value={simulation.efficiency}
          color={simulation.efficiency > 70 ? '#00ff88' : simulation.efficiency > 40 ? '#f9ca24' : '#ff6b6b'}
          icon="⚡"
          format="percent"
        />
        <MetricCard
          label="Morale"
          value={simulation.morale}
          color={simulation.morale > 70 ? '#00ff88' : simulation.morale > 40 ? '#f9ca24' : '#ff6b6b'}
          icon="❤️"
          format="percent"
        />
        <MetricCard
          label="Active Agents"
          value={activeAgents}
          color="#45b7d1"
          icon="👤"
        />
        <MetricCard
          label="Active Tasks"
          value={activeTasks}
          color="#f9ca24"
          icon="📋"
        />
      </div>
    </div>
  );
}
