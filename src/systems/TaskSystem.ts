import { useGameStore, createGameEvent } from '@/store/gameStore';
import { Agent, Task, AgentActivity } from '@/agents/AgentTypes';
import { aiService } from '@/ai/AIService';
import { agentMemory } from '@/runtime/AgentMemory';
import { performanceTracker } from '@/hr/HRSystem';
import { taskDiscovery } from './TaskDiscovery';

type TaskAction = {
  check: (task: Task, agents: Agent[]) => boolean;
  execute: (task: Task, agents: Agent[]) => Promise<{ task: Task; events: string[] }>;
};

const taskActions: TaskAction[] = [
  {
    check: (task) => task.status === 'pending',
    execute: async (task, agents) => {
      console.log(`[TaskSystem] CEO processing pending task: "${task.title}" (id: ${task.id})`);
      const ceo = agents.find((a) => a.role === 'ceo');
      if (!ceo) return { task, events: [] };

      const store = useGameStore.getState();
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

      // Store in shared memory
      agentMemory.addSharedMemory({
        type: 'task',
        content: `CEO prioritized "${task.title}": ${msg}`,
        tags: ['task', 'prioritized', ceo.role],
        importance: 3,
      });

      console.log(`[TaskSystem] ✅ CEO prioritized task: "${task.title}" → status: prioritized`);
      return {
        task: {
          ...task,
          status: 'prioritized' as const,
          createdBy: ceo.id,
          steps: task.steps.map((s, i) => (i === 0 ? { ...s, completed: true } : s)),
          aiContext: { ceoDecision: msg },
        },
        events: [`${ceo.emoji} ${ceo.name}: ${msg}`],
      };
    },
  },
  {
    check: (task) => task.status === 'prioritized',
    execute: async (task, agents) => {
      console.log(`[TaskSystem] PM processing prioritized task: "${task.title}" (id: ${task.id})`);
      const pm = agents.find((a) => a.role === 'pm');
      if (!pm) return { task, events: [] };

      const store = useGameStore.getState();
      store.updateWorkStatus(pm.id, 'thinking');
      store.pushAgentActivity(pm.id, {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId: pm.id,
        type: 'thinking',
        message: `Planning assignment for "${task.title}"`,
        timestamp: Date.now(),
      });

      const workers = agents.filter((a) => a.role !== 'ceo' && a.role !== 'pm' && a.role !== 'qa' && a.role !== 'hr');
      console.log(`[TaskSystem] Available workers: [${workers.map(w => `${w.name}(${w.role}, currentTask=${w.currentTaskId})`).join(', ')}]`);
      const worker = workers[Math.floor(Math.random() * workers.length)];
      if (!worker) { console.log('[TaskSystem] ❌ No workers available!'); return { task, events: [] }; }

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

      console.log(`[TaskSystem] ✅ PM assigned task "${task.title}" → ${worker.name} (${worker.id})`);
      return {
        task: {
          ...task,
          status: 'assigned' as const,
          assignedTo: worker.id,
          steps: task.steps.map((s, i) =>
            i === 1 ? { ...s, completed: true, assignedTo: worker.id } : i === 2 ? { ...s, assignedTo: worker.id } : s,
          ),
          aiContext: { ...task.aiContext, pmAssignment: msg },
        },
        events: [`${pm.emoji} ${pm.name}: ${msg}`],
      };
    },
  },
];

export async function processTasks(): Promise<void> {
  const store = useGameStore.getState();
  const { agents, tasks } = store;

  const activeCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed').length;
  console.log(`[TASK] processTasks() start — ${tasks.length} total, ${activeCount} active`);

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'failed') continue;

    const action = taskActions.find((a) => a.check(task, agents));
    if (action) {
      console.log(`[TASK] Matched action for "${task.title}" (status: ${task.status})`);
    } else {
      console.log(`[TASK] No action for "${task.title}" (status: ${task.status}) - AgentRuntime should handle`);
    }
    if (!action) continue;

    const result = await action.execute(task, agents);

    store.updateSimulation({ tick: store.simulation.tick + 1 });

    for (const msg of result.events) {
      const eventType = (result.task.status === 'completed' ? 'complete' : 'task') as 'complete' | 'task';
      store.addEvent(createGameEvent(eventType, msg, result.task.assignedTo, task.id));
    }

    if (result.task.status === 'completed') {
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
      store.failTask(task.id);
    } else {
      const targetAgentId = result.task.assignedTo || '';
      const newTaskId = result.task.status === 'in_progress' || result.task.status === 'assigned' ? task.id : null;
      console.log(`[TaskSystem] Setting agent ${targetAgentId} currentTaskId = ${newTaskId} (task status: ${result.task.status})`);
      store.updateAgent(targetAgentId, { currentTaskId: newTaskId });
      store.updateTask(task.id, result.task);
    }
  }
}

let lastDiscoveryScan = 0;

export async function maybeCreateNewTask(): Promise<void> {
  const store = useGameStore.getState();
  const activeTasks = store.tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'failed',
  ).length;
  console.log(`[TASK] maybeCreateNewTask — ${activeTasks} active tasks`);

  // If we have room, use discovered real tasks
  if (activeTasks < 6) {
    const now = Date.now();
    const scanInterval = 30000 / Math.max(1, store.simulation.speed);
    if (now - lastDiscoveryScan > scanInterval) {
      lastDiscoveryScan = now;
      console.log('[DISCOVERY] Scanning project for tasks...');
      const proposals = await taskDiscovery.scanProject();
      console.log(`[DISCOVERY] Found ${proposals.length} proposals:`, proposals.map(p => p.title + ' [' + p.source + ']'));
      const untaken = proposals.filter((p) =>
        !store.tasks.some((t) => t.title === p.title),
      );
      if (untaken.length > 0) {
        const next = untaken[0];
        console.log(`[TASK] Creating task from discovery: "${next.title}" (source: ${next.source})`);
        store.addTaskWithTitle(next.title, next.contextFile);
        return;
      } else {
        console.log('[DISCOVERY] All proposals already taken as tasks');
      }
    } else {
      console.log(`[DISCOVERY] Skipping scan, last scan was ${(Date.now() - lastDiscoveryScan)/1000}s ago (interval: ${scanInterval/1000}s)`);
    }
  }

  // Fallback: AI-generated task if below capacity
  if (activeTasks < 8 && Math.random() < 0.02 * store.simulation.speed) {
    const title = await aiService.generateTaskIdea();
    console.log(`[TASK] Creating fallback AI task: "${title}"`);
    store.addTaskWithTitle(title);
  } else if (activeTasks >= 8) {
    console.log(`[TASK] Not creating tasks — ${activeTasks} active (cap: 8)`);
  }
}
