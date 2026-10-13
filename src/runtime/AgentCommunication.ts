import { useGameStore } from '@/store/gameStore';
import { Agent, AgentActivity } from '@/agents/AgentTypes';
import { aiService } from '@/ai/AIService';
import { agentMemory } from './AgentMemory';

class ActivityBuilder {
  private activityFn: (agentId: string, activity: AgentActivity) => void;

  constructor(activityFn: (agentId: string, activity: AgentActivity) => void) {
    this.activityFn = activityFn;
  }

  push(agentId: string, type: AgentActivity['type'], message: string, details?: string): void {
    this.activityFn(agentId, {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      type,
      message,
      details,
      timestamp: Date.now(),
    });
  }
}

export class AgentMessaging {
  async sendAndWaitReply(
    from: Agent,
    to: Agent,
    message: string,
    activity: ActivityBuilder,
  ): Promise<string> {
    const store = useGameStore.getState();

    // Show the message in UI
    store.sendMessage(from.id, to.id, message);

    activity.push(from.id, 'communicating', `→ ${to.name}: ${message}`);

    // Get AI response for the target agent
    const response = await aiService.askAgent(
      to.role,
      to.name,
      to.traits,
      `You received this message from ${from.name} (${from.role}): "${message}". Respond professionally and concisely (1-2 sentences).`,
      { fromAgent: from.name, fromRole: from.role },
    );

    const reply = response.content || `${to.name} acknowledges your message.`;

    // Show reply
    store.sendMessage(to.id, from.id, reply);
    activity.push(to.id, 'communicating', `→ ${from.name}: ${reply}`);

    // Store in agent memories
    agentMemory.addAgentMemory(from.id, {
      type: 'coworker',
      content: `Conversation with ${to.name}: "${message}" → "${reply}"`,
      tags: ['conversation', to.role, to.name.toLowerCase()],
      importance: 3,
    });

    return reply;
  }

  async broadcastToTeam(
    from: Agent,
    message: string,
    activity: ActivityBuilder,
  ): Promise<void> {
    const store = useGameStore.getState();
    const team = store.agents.filter((a) => a.id !== from.id);

    for (const member of team) {
      store.sendMessage(from.id, member.id, message);
      activity.push(from.id, 'communicating', `📢 ${member.name}: ${message}`);
    }
  }
}

export const agentMessaging = new AgentMessaging();
