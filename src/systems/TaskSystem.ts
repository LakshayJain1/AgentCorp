import { useGameStore, createGameEvent } from '@/store/gameStore';
import { Agent, Task } from '@/agents/AgentTypes';
import { aiService } from '@/ai/AIService';
import { agentMemory } from '@/runtime/AgentMemory';
import { performanceTracker } from '@/hr/HRSystem';

type TaskAction = {
  check: (task: Task, agents: Agent[]) => boolean;
  execute: (task: Task, agents: Agent[]) => Promise<{ task: Task; events: string[] }>;
};

const taskActions: TaskAction[] = [
  {
    check: (task) => task.status === 'pending',
    execute: async (task, agents) => {
      const ceo = agents.find((a) => a.role === 'ceo');
      if (!ceo) return { task, events: [] };

      const store = useGameStore.getState();
      console.log('[AgentCorp] TaskSystem CEO prioritizing:', task.id, task.title);

      store.updateWorkStatus(ceo.id, 'thinking');
      store.pushAgentActivity(ceo.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: ceo.id,
        type: 'thinking',
        message: `Prioritizing "${task.title}"`,
        timestamp: Date.now(),
      });

      const aiResponse = await aiService.askTaskAgent(
        ceo.role, ceo.name, ceo.traits, task.title, 'pending',
      );
      const msg = aiResponse.content || `${ceo.name} is prioritizing "${task.title}"`;

      store.pushAgentActivity(ceo.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: ceo.id,
        type: 'thinking',
        message: msg,
        timestamp: Date.now(),
      });

      store.updateWorkStatus(ceo.id, 'completed');

      agentMemory.addSharedMemory({
        type: 'task',
        content: `CEO prioritized "${task.title}": ${msg}`,
        tags: ['task', 'prioritized', ceo.role],
        importance: 3,
      });

      const updatedTask = {
        ...task,
        status: 'prioritized' as const,
        createdBy: ceo.id,
        steps: task.steps.map((s, i) => (i === 0 ? { ...s, completed: true } : s)),
        aiContext: { ceoDecision: msg },
      };

      console.log('[AgentCorp] CEO done — task now:', updatedTask.status);
      return { task: updatedTask, events: [`${ceo.emoji} ${ceo.name}: ${msg}`] };
    },
  },
  {
    check: (task) => task.status === 'prioritized',
    execute: async (task, agents) => {
      const pm = agents.find((a) => a.role === 'pm');
      if (!pm) return { task, events: [] };

      const store = useGameStore.getState();
      console.log('[AgentCorp] TaskSystem PM assigning:', task.id, task.title);

      store.updateWorkStatus(pm.id, 'thinking');
      store.pushAgentActivity(pm.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: pm.id,
        type: 'thinking',
        message: `Planning assignment for "${task.title}"`,
        timestamp: Date.now(),
      });

      // P4: skill-based pick (was random). Analysis-flavored tasks go to
      // researchers, build-flavored to engineers; ties break by least load.
      const workers = agents.filter((a) => a.role !== 'ceo' && a.role !== 'pm' && a.role !== 'qa' && a.role !== 'hr');
      const researchKind = task.deliverableType === 'analysis' || task.deliverableType === 'research';
      const wantRole: 'researcher' | 'engineer' = researchKind ? 'researcher' : 'engineer';
      const loadOf = (id: string) => agents.filter((a) => a.currentTaskId && a.id === id).length;
      const ranked = [...workers].sort((x, y) => {
        const affinity = (a: (typeof workers)[number]) =>
          a.role === wantRole ? 0 : 1;
        const ax = affinity(x) * 10 + (x.currentTaskId ? 5 : 0) + loadOf(x.id);
        const ay = affinity(y) * 10 + (y.currentTaskId ? 5 : 0) + loadOf(y.id);
        return ax - ay;
      });
      const worker = ranked[0];
      if (!worker) {
        console.warn('[AgentCorp] no worker available to assign task:', task.id);
        return { task, events: [] };
      }

      const aiResponse = await aiService.askTaskAgent(
        pm.role, pm.name, pm.traits, task.title, 'prioritized',
        { assignee: worker.name, assigneeRole: worker.role },
      );
      const msg = aiResponse.content || `${pm.name} assigned "${task.title}" to ${worker.name}`;

      store.pushAgentActivity(pm.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: pm.id,
        type: 'communicating',
        message: `Assigned "${task.title}" → ${worker.name}`,
        timestamp: Date.now(),
      });

      store.sendMessage(pm.id, worker.id, `You've been assigned: "${task.title}". Priority: ${task.priority}.`);
      store.updateWorkStatus(pm.id, 'completed');

      const updatedTask = {
        ...task,
        status: 'assigned' as const,
        assignedTo: worker.id,
        steps: task.steps.map((s, i) =>
          i === 1 ? { ...s, completed: true, assignedTo: worker.id } : i === 2 ? { ...s, assignedTo: worker.id } : s,
        ),
        aiContext: { ...task.aiContext, pmAssignment: msg },
      };

      console.log('[AgentCorp] PM done — task now:', updatedTask.status, 'assigned to:', worker.name, worker.id);
      return { task: updatedTask, events: [`${pm.emoji} ${pm.name}: ${msg}`] };
    },
  },
];

export async function processTasks(): Promise<void> {
  const store = useGameStore.getState();
  const { agents, tasks } = store;

  console.log('[AgentCorp] processTasks called — total tasks:', tasks.length, 'statuses:', tasks.map(t => t.status));

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'failed') continue;

    const action = taskActions.find((a) => a.check(task, agents));
    if (!action) {
      console.log('[AgentCorp] no action for task:', task.id, task.title.slice(0, 30), 'status:', task.status);
      continue;
    }

    console.log('[AgentCorp] running action for task:', task.id, 'current status:', task.status);
    const result = await action.execute(task, agents);

    store.updateSimulation({ tick: store.simulation.tick + 1 });

    for (const msg of result.events) {
      const eventType = (result.task.status === 'completed' ? 'complete' : 'task') as 'complete' | 'task';
      store.addEvent(createGameEvent(eventType, msg, result.task.assignedTo, task.id));
    }

    if (result.task.status === 'completed') {
      console.log('[AgentCorp] task completed by TaskSystem:', task.id);
      store.completeTask(task.id);
      const agent = agents.find((a) => a.id === task.assignedTo);
      if (agent) {
        store.updateAgent(agent.id, {
          currentTaskId: null,
          efficiency: Math.min(100, agent.efficiency + 2),
          mood: 'happy',
        });
      }
    } else if (result.task.status === 'failed') {
      console.error('[AgentCorp] task failed by TaskSystem:', task.id);
      store.failTask(task.id);
    } else {
      const targetAgentId = result.task.assignedTo || '';
      const newTaskId = result.task.status === 'in_progress' || result.task.status === 'assigned' ? task.id : null;
      store.updateAgent(targetAgentId, { currentTaskId: newTaskId });
      store.updateTask(task.id, result.task);
      console.log('[AgentCorp] task updated:', task.id, 'new status:', result.task.status, 'assignedTo:', result.task.assignedTo);
    }
  }
}
