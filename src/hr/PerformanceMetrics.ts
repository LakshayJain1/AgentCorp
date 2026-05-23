import { Agent, AgentPerformance, PromotionLevel } from '@/agents/AgentTypes';

export class PerformanceMetrics {
  computeScore(agent: Agent): number {
    return Math.round(
      agent.performance.productivityScore * 0.3 +
      agent.performance.reliabilityScore * 0.3 +
      agent.performance.collaborationScore * 0.2 +
      agent.efficiency * 0.2,
    );
  }

  computeSeniority(completed: number, failed: number): AgentPerformance['seniority'] {
    const total = completed + failed;
    const rate = total === 0 ? 0 : completed / total;
    if (completed >= 50 && rate > 0.9) return 'lead';
    if (completed >= 20 && rate > 0.85) return 'senior';
    if (completed >= 5 && rate > 0.75) return 'mid';
    return 'junior';
  }

  computePromotionLevel(completed: number, successRate: number, currentLevel: PromotionLevel): PromotionLevel {
    const levels: PromotionLevel[] = ['trial', 'junior', 'mid', 'senior', 'lead', 'principal'];
    const currentIdx = levels.indexOf(currentLevel);

    for (let i = levels.length - 1; i > currentIdx; i--) {
      const level = levels[i];
      const threshold = this.getThreshold(level);
      if (completed >= threshold.tasks && successRate >= threshold.rate) {
        return level;
      }
    }
    return currentLevel;
  }

  private getThreshold(level: PromotionLevel): { tasks: number; rate: number } {
    switch (level) {
      case 'principal': return { tasks: 100, rate: 0.95 };
      case 'lead': return { tasks: 50, rate: 0.9 };
      case 'senior': return { tasks: 20, rate: 0.85 };
      case 'mid': return { tasks: 5, rate: 0.75 };
      case 'junior': return { tasks: 1, rate: 0.5 };
      case 'trial': return { tasks: 0, rate: 0 };
    }
  }

  getScoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Satisfactory';
    if (score >= 40) return 'Needs Improvement';
    return 'Critical';
  }
}

export const performanceMetrics = new PerformanceMetrics();
