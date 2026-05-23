import { useGameStore } from '@/store/gameStore';
import { Agent, PromotionLevel, PerformanceReview } from '@/agents/AgentTypes';
import { MemoryStore } from '@/memory/MemoryStore';

const PROMOTION_THRESHOLDS: Record<PromotionLevel, { minScore: number; minTasks: number; minSuccessRate: number }> = {
  trial: { minScore: 0, minTasks: 0, minSuccessRate: 0 },
  junior: { minScore: 30, minTasks: 3, minSuccessRate: 0.5 },
  mid: { minScore: 50, minTasks: 10, minSuccessRate: 0.7 },
  senior: { minScore: 70, minTasks: 25, minSuccessRate: 0.85 },
  lead: { minScore: 85, minTasks: 50, minSuccessRate: 0.9 },
  principal: { minScore: 95, minTasks: 100, minSuccessRate: 0.95 },
};

const PROMOTION_LABELS: Record<PromotionLevel, string> = {
  trial: 'Trial',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
};

export class PromotionManager {
  private memStore: MemoryStore;

  constructor(memStore?: MemoryStore) {
    this.memStore = memStore || new MemoryStore();
  }

  evaluateForPromotion(agent: Agent): {
    eligible: boolean;
    nextLevel?: PromotionLevel;
    reason?: string;
  } {
    const currentIdx = this.levelIndex(agent.performance.promotionLevel);
    const levels: PromotionLevel[] = ['trial', 'junior', 'mid', 'senior', 'lead', 'principal'];
    if (currentIdx >= levels.length - 1) {
      return { eligible: false, reason: 'Already at highest level' };
    }

    const nextLevel = levels[currentIdx + 1];
    const threshold = PROMOTION_THRESHOLDS[nextLevel];
    const score = this.computeOverallScore(agent);

    if (score >= threshold.minScore &&
        agent.performance.tasksCompleted >= threshold.minTasks &&
        agent.performance.successRate >= threshold.minSuccessRate) {
      return {
        eligible: true,
        nextLevel,
        reason: `Score ${score}/${threshold.minScore}, tasks ${agent.performance.tasksCompleted}/${threshold.minTasks}, success rate ${(agent.performance.successRate * 100).toFixed(0)}%/${(threshold.minSuccessRate * 100).toFixed(0)}%`,
      };
    }

    return { eligible: false, reason: `Needs score ${threshold.minScore} (has ${score}), tasks ${threshold.minTasks} (has ${agent.performance.tasksCompleted})` };
  }

  conductReview(agent: Agent, reviewer: Agent): PerformanceReview {
    const score = this.computeOverallScore(agent);
    const promotionEval = this.evaluateForPromotion(agent);

    let decision: PerformanceReview['decision'] = 'keep';
    let promotedTo: PromotionLevel | undefined;

    if (promotionEval.eligible && promotionEval.nextLevel) {
      decision = 'promote';
      promotedTo = promotionEval.nextLevel;
      this.applyPromotion(agent.id, promotionEval.nextLevel);
    } else if (score < 30 && agent.performance.tasksCompleted > 5) {
      decision = 'probation';
    } else if (score < 15 && agent.performance.tasksCompleted > 10) {
      decision = 'archive';
    }

    const review: PerformanceReview = {
      id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId: agent.id,
      reviewerId: reviewer.id,
      timestamp: Date.now(),
      score,
      productivityScore: agent.performance.productivityScore,
      reliabilityScore: agent.performance.reliabilityScore,
      collaborationScore: agent.performance.collaborationScore,
      summary: `Review for ${agent.name} (${agent.role}): score ${score}/100, ${agent.performance.tasksCompleted} completed, ${PROMOTION_LABELS[agent.performance.promotionLevel]}. Decision: ${decision}${promotedTo ? ` → ${PROMOTION_LABELS[promotedTo]}` : ''}`,
      decision,
      promotedTo,
    };

    this.memStore.addSharedMemory({
      id: `mem_review_${Date.now()}`,
      type: 'knowledge',
      content: review.summary,
      tags: ['hr', 'review', agent.role, agent.name.toLowerCase(), decision],
      timestamp: Date.now(),
      importance: 5,
    });

    return review;
  }

  private applyPromotion(agentId: string, newLevel: PromotionLevel): void {
    const store = useGameStore.getState();
    store.updateAgentPerformance(agentId, {
      promotionLevel: newLevel,
      productivityScore: Math.min(100, (store.agents.find((a) => a.id === agentId)?.performance.productivityScore || 50) + 10),
      reliabilityScore: Math.min(100, (store.agents.find((a) => a.id === agentId)?.performance.reliabilityScore || 50) + 5),
    });
    store.addEvent({
      id: `promo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'review',
      message: `🎉 ${store.agents.find((a) => a.id === agentId)?.name} promoted to ${PROMOTION_LABELS[newLevel]}!`,
      agentId,
      taskId: null,
    });
  }

  private computeOverallScore(agent: Agent): number {
    return Math.round(
      agent.performance.productivityScore * 0.3 +
      agent.performance.reliabilityScore * 0.3 +
      agent.performance.collaborationScore * 0.2 +
      (agent.performance.successRate * 100) * 0.2,
    );
  }

  private levelIndex(level: PromotionLevel): number {
    return ['trial', 'junior', 'mid', 'senior', 'lead', 'principal'].indexOf(level);
  }

  getLevelLabel(level: PromotionLevel): string {
    return PROMOTION_LABELS[level];
  }

  getThresholds(): typeof PROMOTION_THRESHOLDS {
    return { ...PROMOTION_THRESHOLDS };
  }
}
