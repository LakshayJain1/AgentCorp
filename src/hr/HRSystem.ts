import { useGameStore } from '@/store/gameStore';
import { Agent, AgentPerformance, AgentActivity } from '@/agents/AgentTypes';
import { agentMemory } from '@/runtime/AgentMemory';
import { PromotionManager } from './PromotionManager';
import { MemoryStore } from '@/memory/MemoryStore';

class PerformanceTracker {
  recordToolUse(agentId: string): void {
    const store = useGameStore.getState();
    const agent = store.agents.find((a) => a.id === agentId);
    if (!agent) return;

    store.updateAgentPerformance(agentId, {
      toolUsageCount: agent.performance.toolUsageCount + 1,
    });
  }

  recordTaskComplete(agentId: string, duration: number): void {
    const store = useGameStore.getState();
    const agent = store.agents.find((a) => a.id === agentId);
    if (!agent) return;

    const tc = agent.performance.tasksCompleted + 1;
    const oldAvg = agent.performance.avgCompletionTime;
    const newAvg = oldAvg === 0 ? duration : (oldAvg * (tc - 1) + duration) / tc;

    store.updateAgentPerformance(agentId, {
      tasksCompleted: tc,
      avgCompletionTime: Math.round(newAvg),
      successRate: tc / (tc + agent.performance.tasksFailed),
      productivityScore: Math.min(100, agent.performance.productivityScore + 5),
      reliabilityScore: Math.min(100, agent.performance.reliabilityScore + 2),
      collaborationScore: Math.min(100, agent.performance.collaborationScore + 1),
      seniority: this.computeSeniority(tc, agent.performance.tasksFailed),
    });
  }

  recordTaskFailure(agentId: string, duration?: number): void {
    const store = useGameStore.getState();
    const agent = store.agents.find((a) => a.id === agentId);
    if (!agent) return;

    const tf = agent.performance.tasksFailed + 1;
    store.updateAgentPerformance(agentId, {
      tasksFailed: tf,
      successRate: agent.performance.tasksCompleted / Math.max(1, agent.performance.tasksCompleted + tf),
      reliabilityScore: Math.max(0, agent.performance.reliabilityScore - 10),
      productivityScore: Math.max(0, agent.performance.productivityScore - 8),
    });
  }

  private computeSeniority(completed: number, failed: number): AgentPerformance['seniority'] {
    const total = completed + failed;
    const rate = total === 0 ? 0 : completed / total;
    if (completed >= 50 && rate > 0.9) return 'lead';
    if (completed >= 20 && rate > 0.85) return 'senior';
    if (completed >= 5 && rate > 0.75) return 'mid';
    return 'junior';
  }

  getScore(agent: Agent): number {
    return Math.round(
      agent.performance.productivityScore * 0.3 +
      agent.performance.reliabilityScore * 0.3 +
      agent.performance.collaborationScore * 0.2 +
      agent.efficiency * 0.2,
    );
  }

  private pushActivity(agentId: string, type: AgentActivity['type'], message: string): void {
    const store = useGameStore.getState();
    store.pushAgentActivity(agentId, {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      type,
      message,
      timestamp: Date.now(),
    });
  }

  async evaluateTeam(hrAgent: Agent): Promise<void> {
    const store = useGameStore.getState();
    const members = store.agents.filter((a) => a.id !== hrAgent.id && a.online);
    const promotionManager = new PromotionManager();

    this.pushActivity(hrAgent.id, 'thinking', '📊 Running team performance evaluation...');

    // Visible HR announcement event
    store.addEvent({
      id: `hr_review_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'review',
      message: `📋 HR Performance Review — evaluating ${members.length} team members`,
      agentId: hrAgent.id,
      taskId: null,
    });

    for (const member of members) {
      const score = this.getScore(member);
      const bar = this.scoreBar(score);
      const status = score > 75 ? '✅ Healthy' : score > 50 ? '⚠️ Needs attention' : '🔴 Critical';

      this.pushActivity(
        hrAgent.id,
        score > 50 ? 'researching' : 'blocked',
        `${member.emoji} ${member.name} (${member.role}): ${bar} ${score}/100 — ${status}`,
      );

      // Check for promotion eligibility using PromotionManager
      const promotionEval = promotionManager.evaluateForPromotion(member);
      if (promotionEval.eligible && promotionEval.nextLevel) {
        const review = promotionManager.conductReview(member, hrAgent);
        this.pushActivity(
          hrAgent.id,
          'reviewing',
          `🎉 ${member.name} promoted to ${promotionManager.getLevelLabel(review.promotedTo!)}! Score: ${score}/100`,
        );
        store.addEvent({
          id: `hr_promo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          type: 'review',
          message: `🎉 ${member.emoji} ${member.name} promoted to ${promotionManager.getLevelLabel(review.promotedTo!)}`,
          agentId: hrAgent.id,
          taskId: null,
        });
      }

      // Store evaluation in shared memory
      agentMemory.addSharedMemory({
        type: 'knowledge',
        content: `HR evaluation: ${member.name} (${member.role}) — score ${score}/100, seniority ${member.performance.seniority}, promotion level ${member.performance.promotionLevel}, ${member.performance.tasksCompleted} tasks completed`,
        tags: ['hr', 'evaluation', member.role, member.name.toLowerCase()],
        importance: 3,
      });

      // Underperformance alert and replacement
      const isWorker = member.role === 'engineer' || member.role === 'qa' || member.role === 'researcher';
      if (score < 50 && isWorker) {
        this.pushActivity(hrAgent.id, 'blocked', `🚨 Replacing underperforming agent ${member.name} (${member.role}). Onboarding replacement...`);

        store.addEvent({
          id: `hr_replace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          type: 'review',
          message: `🚨 HR: Replacing ${member.name} (${member.role}) due to low score (${score}/100). Hiring replacement...`,
          agentId: hrAgent.id,
          taskId: null,
        });

        // Generate a new unique candidate name
        const candidateNames = ['Devon', 'Kira', 'Logan', 'Nadia', 'Zack', 'Elena', 'Connor', 'Fiona', 'Gavin', 'Hope', 'Ian', 'Julia'];
        let candidateName = candidateNames[Math.floor(Math.random() * candidateNames.length)];
        const currentNames = store.agents.map(a => a.name);
        for (let attempt = 0; attempt < 20; attempt++) {
          if (!currentNames.includes(candidateName)) break;
          candidateName = candidateNames[Math.floor(Math.random() * candidateNames.length)];
        }

        store.updateAgent(member.id, {
          name: `Onboarding: ${candidateName}`,
          cooldownRemainingSeconds: 60, // 60s onboarding cooldown
          cooldownType: 'onboarding',
          online: false, // Temporarily offline
          workStatus: 'waiting',
          fsmState: 'idle',
          efficiency: 0,
        });
      } else if (score < 40 && member.performance.tasksCompleted > 3) {
        this.pushActivity(hrAgent.id, 'blocked', `🚨 ${member.name} underperforming (score: ${score}). Placed on probation.`);

        store.addEvent({
          id: `hr_alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          type: 'error',
          message: `🚨 HR Alert: ${member.name} score is critical (${score}/100) — placed on probation`,
          agentId: hrAgent.id,
          taskId: null,
        });
      }
    }

    this.pushActivity(hrAgent.id, 'thinking', '✅ Team evaluation complete');
    store.addEvent({
      id: `hr_done_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'review',
      message: `📊 HR evaluation complete — ${members.filter(m => this.getScore(m) > 75).length}/${members.length} agents in good standing`,
      agentId: hrAgent.id,
      taskId: null,
    });
  }

  private scoreBar(score: number): string {
    const filled = Math.round(score / 20);
    return '█'.repeat(filled) + '░'.repeat(5 - filled);
  }
}

export const performanceTracker = new PerformanceTracker();
