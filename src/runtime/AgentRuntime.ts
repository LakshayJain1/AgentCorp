import { useGameStore } from '@/store/gameStore';
import { Agent, AgentActivity, Task } from '@/agents/AgentTypes';
import { toolRegistry } from './ToolRegistry';

export class ActivityBuilder {
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

export class AgentRuntime {
  async processTask(task: Task): Promise<void> {
    console.log('[AgentCorp] AgentRuntime.processTask called for:', task.id, task.title);

    const store = useGameStore.getState();
    const builder = new ActivityBuilder((id, activity) => store.pushAgentActivity(id, activity));

    const assignedAgent = store.agents.find((a) => a.id === task.assignedTo);
    console.log('[AgentCorp] looking for assignedTo:', task.assignedTo, '— found:', !!assignedAgent);

    if (!assignedAgent) {
      console.warn('[AgentCorp] no assigned agent found for task:', task.id, task.assignedTo);
      return;
    }

    builder.push(assignedAgent.id, 'thinking', `Working on: "${task.title}"`);
    store.updateWorkStatus(assignedAgent.id, 'thinking');

    const systemContext = `You are a ${assignedAgent.role} at AgentCorp. The user has requested: "${task.title}". Generate a complete, high-quality deliverable. Return only the content. No explanations or markdown fences.`;

    console.log('[AgentCorp] calling ask_agent tool for:', task.id, 'agent:', assignedAgent.name);
    const startTime = Date.now();

    const result = await toolRegistry.executeTool('ask_agent', {
      agentRole: assignedAgent.role,
      question: systemContext,
    });

    const elapsed = Date.now() - startTime;
    console.log('[AgentCorp] ask_agent result:', { success: result.success, outputLength: result.output?.length, error: result.error, elapsed });

    if (result.success && result.output) {
      builder.push(assignedAgent.id, 'tool_result', `Generated deliverable for "${task.title}"`);
      store.updateTask(task.id, {
        deliverable: result.output,
      });
      store.addDeliverableProject({
        id: `project_${Date.now()}`,
        taskId: task.id,
        title: task.title,
        type: task.deliverableType || 'code',
        lang: task.deliverableLang,
        content: result.output,
        createdAt: Date.now(),
        completedBy: assignedAgent.id,
      });
      store.completeTask(task.id);
      store.updateAgent(assignedAgent.id, { currentTaskId: null, mood: 'happy' });
      console.log('[AgentCorp] task completed successfully:', task.id);
    } else {
      builder.push(assignedAgent.id, 'blocked', `Failed to generate deliverable for "${task.title}"`);
      store.failTask(task.id);
      store.updateAgent(assignedAgent.id, { currentTaskId: null, mood: 'frustrated' });
      console.error('[AgentCorp] task failed:', task.id, 'reason:', result.error || 'empty output');
    }
  }
}

export const agentRuntime = new AgentRuntime();
