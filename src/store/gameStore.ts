'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, Task, SubTask, ValidationResult, GameEvent, SimulationState, AgentRole, OfficeLocation, DeliverableType, AgentActivity, AgentPerformance, AgentWorkStatus, ConversationMessage, TaskExecutionLog, DeliverableProject } from '@/agents/AgentTypes';
import { AGENT_PERSONALITIES } from '@/ai/AgentPersonalities';
import { configLoader } from '@/config/ConfigLoader';
import { toOfficeLocations } from '@/game/pixi/PixiOfficeLayout';

const DEFAULT_TASK_TITLES = [
  'Analyze customer feedback', 'Fix API issue', 'Review compliance report', 'Prepare deployment',
  'Investigate hallucination', 'Optimize database queries', 'Update documentation',
  'Refactor authentication module', 'Design new feature spec', 'Run security audit',
  'Improve test coverage', 'Monitor system health', 'Research competitor product',
  'Triage bug reports', 'Plan sprint roadmap',
];

const DEFAULT_AGENT_NAMES: Record<AgentRole, { name: string; color: number; emoji: string }> = {
  ceo: { name: 'Alex', color: 0xff6b6b, emoji: '👑' },
  pm: { name: 'Sam', color: 0x4ecdc4, emoji: '📋' },
  researcher: { name: 'Jill', color: 0x45b7d1, emoji: '🔬' },
  engineer: { name: 'Mike', color: 0xf9ca24, emoji: '💻' },
  qa: { name: 'Tina', color: 0xa29bfe, emoji: '🔍' },
  hr: { name: 'Riley', color: 0xf472b6, emoji: '📊' },
};

const DEFAULT_OFFICE_LOCATIONS: OfficeLocation[] = toOfficeLocations();

let cachedTaskTitles: string[] | null = null;
let cachedAgentNames: Record<AgentRole, { name: string; color: number; emoji: string }> | null = null;
let cachedOfficeLocations: OfficeLocation[] | null = null;
let cachedExtraDevNames: string[] | null = null;
let cachedExtraDevColors: number[] | null = null;

export function EXTRA_DEV_NAMES(): string[] {
  return cachedExtraDevNames ?? ['Dave', 'Priya', 'Leo'];
}

export function EXTRA_DEV_COLORS(): number[] {
  return cachedExtraDevColors ?? [0x00cec9, 0xfd79a8, 0x6c5ce7];
}

export function TASK_TITLES(): string[] {
  return cachedTaskTitles ?? DEFAULT_TASK_TITLES;
}

export function AGENT_NAMES(): Record<AgentRole, { name: string; color: number; emoji: string }> {
  return cachedAgentNames ?? DEFAULT_AGENT_NAMES;
}

export function OFFICE_LOCATIONS(): OfficeLocation[] {
  return cachedOfficeLocations ?? DEFAULT_OFFICE_LOCATIONS;
}

export async function loadGameConfig(): Promise<void> {
  if (cachedTaskTitles && cachedAgentNames && cachedOfficeLocations) return;
  try {
    const md = await configLoader.fetchText('/config/game-config.md');

    // Task titles
    const tasksSection = configLoader.getSection(md, 'Task Titles');
    if (tasksSection) {
      cachedTaskTitles = configLoader.parseBulletList(tasksSection);
    }

    // Agent names table
    const namesSection = configLoader.getSection(md, 'Agent Names');
    if (namesSection) {
      const rows = configLoader.parseTable(namesSection);
      const names: Record<string, { name: string; color: number; emoji: string }> = {};
      for (const row of rows) {
        const hex = row.Color || row.ColorHex || '#ff6b6b';
        names[row.Role] = {
          name: row.Name || 'Unknown',
          color: parseInt(hex.replace('#', ''), 16),
          emoji: row.Emoji || '❓',
        };
      }
      cachedAgentNames = names as Record<AgentRole, { name: string; color: number; emoji: string }>;
    }

    // Office locations table
    const locsSection = configLoader.getSection(md, 'Office Locations');
    if (locsSection) {
      const rows = configLoader.parseTable(locsSection);
      cachedOfficeLocations = rows.map(r => ({
        id: r.Id || r.ID || '',
        name: r.Name || '',
        x: parseInt(r.X || '0'),
        y: parseInt(r.Y || '0'),
        role: r.Role as OfficeLocation['role'],
        width: parseInt(r.Width || '80'),
        height: parseInt(r.Height || '60'),
      }));
    }

    // Extra developer names
    const devNamesSection = configLoader.getSection(md, 'Extra Developer Names');
    if (devNamesSection) {
      cachedExtraDevNames = configLoader.parseBulletList(devNamesSection);
    }

    // Extra developer colors
    const devColorsSection = configLoader.getSection(md, 'Extra Developer Colors');
    if (devColorsSection) {
      cachedExtraDevColors = configLoader.parseBulletList(devColorsSection).map(c => parseInt(c.replace('#', ''), 16));
    }
  } catch {
    cachedTaskTitles = DEFAULT_TASK_TITLES;
    cachedAgentNames = DEFAULT_AGENT_NAMES;
    cachedOfficeLocations = DEFAULT_OFFICE_LOCATIONS;
  }
}

let eventIdCounter = 0;
let taskIdCounter = 0;
let agentIdCounter = 0;
let msgIdCounter = 0;

function generateId(prefix: string): string {
  const counter =
    prefix === 'event' ? ++eventIdCounter :
    prefix === 'task' ? ++taskIdCounter :
    prefix === 'msg' ? ++msgIdCounter :
    ++agentIdCounter;
  return `${prefix}_${counter}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function createAgent(role: AgentRole): Agent {
  const info = AGENT_NAMES()[role];
  const location = OFFICE_LOCATIONS().find(l => l.role === role);
  return {
    id: generateId('agent'),
    name: info.name,
    role,
    traits: AGENT_PERSONALITIES()[role] || AGENT_PERSONALITIES().engineer,
    energy: 100,
    maxEnergy: 100,
    mood: 'neutral',
    state: 'idle',
    fsmState: 'idle' as const,
    workStatus: 'idle',
    currentTaskId: null,
    currentSubTaskId: null,
    workerRole: role === 'engineer' ? 'developer' as const : role === 'qa' ? 'qa_worker' as const : role === 'researcher' ? 'research_worker' as const : null,
    x: location ? location.x - 20 + Math.random() * 40 : 200 + Math.random() * 100,
    y: location ? location.y - 10 + Math.random() * 20 : 200 + Math.random() * 80,
    targetX: location ? location.x + (Math.random() - 0.5) * 50 : 200 + Math.random() * 100,
    targetY: location ? location.y + (Math.random() - 0.5) * 25 : 200 + Math.random() * 80,
    conversations: [],
    efficiency: 75 + Math.floor(Math.random() * 20),
    color: info.color,
    emoji: info.emoji,
    officeLocation: location?.id || 'general',
    aiReady: false,
    activity: [],
    performance: {
      tasksCompleted: 0,
      tasksFailed: 0,
      avgCompletionTime: 0,
      successRate: 1,
      collaborationScore: 50,
      reliabilityScore: 75,
      toolUsageCount: 0,
      specializationTags: [],
      seniority: 'junior',
      productivityScore: 50,
      promotionLevel: 'trial',
      reviewsCount: 0,
      lastReviewAt: null,
    },
    memory: [],
    online: true,
    lastActiveAt: Date.now(),
    lastGoalTime: 0,
  };
}

function detectDeliverableType(title: string): { type: DeliverableType; lang?: string } {
  const t = title.toLowerCase();

  // Framework-specific checks (must come before generic "website")
  if (t.includes('next.js') || t.includes('nextjs') || t.includes('next ')) {
    return { type: 'code', lang: 'nextjs' };
  }
  if (t.includes('react') || t.includes('component') || t.includes('jsx') || t.includes('tsx')) {
    return { type: 'code', lang: 'react' };
  }
  if (t.includes('vue') || t.includes('vuejs') || t.includes('nuxt')) {
    return { type: 'code', lang: 'vue' };
  }
  if (t.includes('node') || t.includes('express') || t.includes('api server') || t.includes('rest api') || t.includes('graphql')) {
    return { type: 'code', lang: 'node' };
  }
  if (t.includes('python') || t.includes('django') || t.includes('flask') || t.includes('fastapi')) {
    return { type: 'code', lang: 'python' };
  }

  // Generic code types
  if (t.includes('landing page') || t.includes('website') || t.includes('web page') || t.includes('frontend') || t.includes('ui') || t.includes('portfolio')) {
    return { type: 'code', lang: 'html' };
  }
  if (t.includes('api') || t.includes('backend') || t.includes('server') || t.includes('database') || t.includes('migration') || t.includes('script')) {
    return { type: 'code', lang: 'typescript' };
  }
  if (t.includes('test') || t.includes('coverage') || t.includes('regression')) {
    return { type: 'code', lang: 'typescript' };
  }
  if (t.includes('config') || t.includes('deploy') || t.includes('pipeline') || t.includes('ci/cd') || t.includes('docker')) {
    return { type: 'config', lang: 'yaml' };
  }
  if (t.includes('doc') || t.includes('readme') || t.includes('guide') || t.includes('manual')) {
    return { type: 'doc', lang: 'markdown' };
  }
  if (t.includes('research') || t.includes('analysis') || t.includes('report') || t.includes('findings') || t.includes('investigat')) {
    return { type: 'report', lang: 'markdown' };
  }
  if (t.includes('spec') || t.includes('design') || t.includes('architecture') || t.includes('plan') || t.includes('roadmap')) {
    return { type: 'spec', lang: 'markdown' };
  }
  if (t.includes('feedback') || t.includes('review') || t.includes('audit') || t.includes('compliance')) {
    return { type: 'analysis', lang: 'markdown' };
  }
  return { type: 'code', lang: 'typescript' };
}

function createTask(providedTitle?: string, contextFile?: string): Task {
  const title = providedTitle || TASK_TITLES()[Math.floor(Math.random() * TASK_TITLES().length)];
  const dt = detectDeliverableType(title);
  return {
    id: generateId('task'),
    title,
    description: `${title} - Priority task #${taskIdCounter}`,
    priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as Task['priority'],
    status: 'pending',
    assignedTo: null,
    createdBy: null,
    createdAt: Date.now(),
    completedAt: null,
    steps: [
      { description: 'CEO prioritize', completed: false, assignedTo: 'ceo' },
      { description: 'PM assign resources', completed: false, assignedTo: 'pm' },
      { description: 'Execute work', completed: false, assignedTo: null },
      { description: 'QA validation', completed: false, assignedTo: 'qa' },
      { description: 'Mark complete', completed: false, assignedTo: null },
    ],
    deliverableType: dt.type,
    deliverableLang: dt.lang,
    executionLogs: [],
    subtasks: [],
    parentTaskId: null,
    aiContext: contextFile ? { contextFile } : undefined,
  };
}

export function createGameEvent(
  type: GameEvent['type'],
  message: string,
  agentId: string | null = null,
  taskId: string | null = null,
): GameEvent {
  return {
    id: generateId('event'),
    timestamp: Date.now(),
    type,
    message,
    agentId,
    taskId,
  };
}

export interface CredentialRequest {
  id: string;
  taskId: string;
  taskTitle: string;
  reason: string;
  credentialKey: string;
  credentialLabel: string;
  status: 'pending' | 'provided' | 'dismissed';
  value?: string;
}

export interface UserMessage {
  id: string;
  message: string;
  timestamp: number;
}

type CenterView = 'chat' | 'office';

interface GameStore {
  agents: Agent[];
  tasks: Task[];
  events: GameEvent[];
  simulation: SimulationState;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  credentialRequest: CredentialRequest | null;
  deliverableProjects: DeliverableProject[];
  userMessages: UserMessage[];
  centerView: CenterView;

  initAgents: () => void;
  addTask: () => void;
  addTaskWithTitle: (title: string, contextFile?: string) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  syncAgents: (updates: Array<{ id: string } & Record<string, unknown>>) => void;
  addEvent: (event: GameEvent) => void;
  setSelectedAgent: (id: string | null) => void;
  setSelectedTask: (id: string | null) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  updateSimulation: (updates: Partial<SimulationState>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  completeTask: (taskId: string) => void;
  failTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  requestCredential: (taskId: string, reason: string, credentialKey: string, credentialLabel: string) => void;
  provideCredential: (credentialKey: string, value: string) => void;
  dismissCredentialRequest: () => void;

  // New Runtime API
  pushAgentActivity: (agentId: string, activity: AgentActivity) => void;
  sendMessage: (fromId: string, toId: string, message: string) => void;
  addTaskExecutionLog: (taskId: string, log: TaskExecutionLog) => void;
  updateAgentPerformance: (agentId: string, updates: Partial<AgentPerformance>) => void;
  updateWorkStatus: (agentId: string, status: AgentWorkStatus) => void;

  // Subtask API
  addSubtask: (taskId: string, subtask: SubTask) => void;
  updateSubtaskStatus: (subtaskId: string, status: SubTask['status']) => void;
  updateSubtaskAgent: (subtaskId: string, agentId: string) => void;
  updateSubtaskValidation: (subtaskId: string, result: ValidationResult) => void;
  updateSubtaskDeliverable: (subtaskId: string, content: string, path?: string) => void;

  // Center Panel
  addUserMessage: (message: string) => void;
  clearUserMessages: () => void;
  setCenterView: (view: CenterView) => void;
  toggleAgentRoster: () => void;
  showAgentRoster: boolean;
  
  // Audio
  isMuted: boolean;
  toggleMute: () => void;
  
  // Library
  showLibrary: boolean;
  toggleLibrary: () => void;

  // Deliverable Projects
  addDeliverableProject: (project: DeliverableProject) => void;

  // User Personalization & Connectors Tab
  isInitialized: boolean;
  companyName: string;
  companyProduct: string;
  developersCount: number;
  connectors: {
    github: { connected: boolean; repoUrl: string; token: string; autoCommit: boolean };
    vercel: { connected: boolean; token: string; autoDeploy: boolean };
    slack: { connected: boolean; webhookUrl: string; broadcastEvents: boolean };
    ai: { provider: 'gemini' | 'openrouter'; apiKey: string };
  };
  initializePersonalizedOffice: (
    companyName: string,
    companyProduct: string,
    developersCount: number,
    connectors: GameStore['connectors']
  ) => void;
  updateConnectors: (connectors: Partial<GameStore['connectors']>) => void;
}

let projectIdCounter = 0;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
  agents: [],
  tasks: [],
  events: [],
  simulation: {
    speed: 1,
    paused: false,
    tick: 0,
    efficiency: 85,
    morale: 75,
    cpuUsage: 23,
    memoryUsage: 2.4,
    totalTasksCompleted: 0,
    totalTasksFailed: 0,
  },
  isInitialized: false,
  companyName: 'AgentCorp',
  companyProduct: 'Autonomous Developer Sandbox & OS',
  developersCount: 1,
  connectors: {
    github: { connected: false, repoUrl: '', token: '', autoCommit: false },
    vercel: { connected: false, token: '', autoDeploy: false },
    slack: { connected: false, webhookUrl: '', broadcastEvents: false },
    ai: { provider: 'gemini', apiKey: '' },
  },
  selectedAgentId: null,
  selectedTaskId: null,
  credentialRequest: null,
  deliverableProjects: [],
  userMessages: [],
  centerView: 'chat',
  showAgentRoster: true,
  isMuted: false,
  showLibrary: false,

  initAgents: () => {
    const roles: AgentRole[] = ['ceo', 'pm', 'researcher', 'engineer', 'qa', 'hr'];
    const agents = roles.map(createAgent);
    const initialEvent = createGameEvent('system', 'AgentCorp systems initialized. All agents ready.');

    set({ agents, events: [initialEvent], deliverableProjects: [], tasks: [] });
  },

  addTask: () => {
    const task = createTask();
    const event = createGameEvent('task', `New task created: ${task.title}`);
    set((state) => ({
      tasks: [...state.tasks, task],
      events: [event, ...state.events.slice(0, 49)],
    }));
  },

  addTaskWithTitle: (title: string, contextFile?: string) => {
    console.log('[AgentCorp] addTaskWithTitle called:', title);
    const task = createTask(title, contextFile);
    console.log('[AgentCorp] created task:', { id: task.id, title: task.title, status: task.status, assignedTo: task.assignedTo });
    const event = createGameEvent('task', `New task created: ${task.title}`);
    set((state) => ({
      tasks: [...state.tasks, task],
      events: [event, ...state.events.slice(0, 49)],
    }));
    // Task will be picked up by CentralOrchestrator.tick() via TaskSystem
    console.log('[AgentCorp] task added to queue, CentralOrchestrator will process it');
  },

  updateAgent: (id, updates) => {
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  },

  syncAgents: (updates) => {
    set((state) => {
      const map = new Map(updates.map((u) => [u.id, u]));
      return {
        agents: state.agents.map((a) => {
          const u = map.get(a.id);
          return u ? { ...a, ...u } : a;
        }),
      };
    });
  },

  addEvent: (event) => {
    set((state) => {
      const seen = new Set(state.events.map((e) => e.id));
      if (seen.has(event.id)) {
        console.warn(`[DEDUP] addEvent skipped — event ${event.id} already exists`);
        return state;
      }
      return { events: [event, ...state.events.slice(0, 49)] };
    });
  },

  setSelectedAgent: (id) => {
    set({ selectedAgentId: id });
  },

  setSelectedTask: (id) => {
    set({ selectedTaskId: id });
  },

  setPaused: (paused) => {
    set((state) => ({ simulation: { ...state.simulation, paused } }));
  },

  setSpeed: (speed) => {
    set((state) => ({ simulation: { ...state.simulation, speed } }));
  },

  updateSimulation: (updates) => {
    set((state) => ({ simulation: { ...state.simulation, ...updates } }));
  },

  updateTask: (taskId, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    }));
  },

  completeTask: (taskId) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;
      const updatedTasks = state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'completed' as const, completedAt: Date.now() } : t,
      );
      const event = createGameEvent('complete', `Task completed: ${task.title}`);
      return {
        tasks: updatedTasks,
        events: [event, ...state.events.slice(0, 49)],
        simulation: {
          ...state.simulation,
          totalTasksCompleted: state.simulation.totalTasksCompleted + 1,
          efficiency: Math.min(100, state.simulation.efficiency + 1),
          morale: Math.min(100, state.simulation.morale + 2),
        },
      };
    });
  },

  failTask: (taskId) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;
      const updatedTasks = state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'failed' as const } : t,
      );
      const event = createGameEvent('error', `Task failed: ${task.title}`);
      return {
        tasks: updatedTasks,
        events: [event, ...state.events.slice(0, 49)],
        simulation: {
          ...state.simulation,
          totalTasksFailed: state.simulation.totalTasksFailed + 1,
          efficiency: Math.max(0, state.simulation.efficiency - 5),
          morale: Math.max(0, state.simulation.morale - 3),
        },
      };
    });
  },

  requestCredential: (taskId, reason, credentialKey, credentialLabel) => {
    const store = get();
    const pm = store.agents.find((a) => a.role === 'pm');
    const task = store.tasks.find((t) => t.id === taskId);

    // Mark task as awaiting credentials
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'awaiting_credentials' as const } : t,
      ),
      credentialRequest: {
        id: generateId('cred'),
        taskId,
        taskTitle: task?.title ?? 'Unknown task',
        reason,
        credentialKey,
        credentialLabel,
        status: 'pending',
      },
    }));

    // PM escalates to user via conversation
    if (pm) {
      const userAgent = get().agents.find((a) => a.role === 'ceo');
      if (userAgent) {
        get().sendMessage(pm.id, userAgent.id, `🚨 We need ${credentialLabel} for task "${task?.title}". This requires credentials I don't have. Escalating to the human operator.`);
      }
    }

    // Add event
    const ev = createGameEvent('system', `Task "${task?.title}" paused. Waiting for ${credentialLabel} from operator`);
    set((state) => ({ events: [ev, ...state.events.slice(0, 49)] }));
  },

  provideCredential: (credentialKey, value) => {
    const store = get();
    const req = store.credentialRequest;
    if (!req || req.status !== 'pending') return;

    set((state) => ({
      credentialRequest: req ? { ...req, status: 'provided', value } : null,
    }));

    // Mark task as in_progress and resume
    const task = store.tasks.find((t) => t.id === req.taskId);
    if (task) {
      const pm = get().agents.find((a) => a.role === 'pm');
      if (pm) {
        get().sendMessage(pm.id, pm.id, `✅ Credentials provided by operator. Resuming task "${task.title}".`);
      }

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === req.taskId ? { ...t, status: 'in_progress' as const, aiContext: { ...t.aiContext, [credentialKey]: value } } : t,
        ),
      }));
      // Task will be picked up by CentralOrchestrator.tick() via normal pipeline
    }

    const ev = createGameEvent('system', `Credentials provided for "${req.taskTitle}". Task resumed.`);
    set((state) => ({ events: [ev, ...state.events.slice(0, 49)] }));
  },

  dismissCredentialRequest: () => {
    const store = get();
    const req = store.credentialRequest;
    if (!req) return;

    set((state) => ({
      credentialRequest: null,
      tasks: state.tasks.map((t) =>
        t.id === req.taskId ? { ...t, status: 'failed' as const } : t,
      ),
    }));

    const pm = get().agents.find((a) => a.role === 'pm');
    if (pm) {
      get().sendMessage(pm.id, pm.id, `❌ Operator dismissed credential request. Task "${req.taskTitle}" failed.`);
    }
    const ev = createGameEvent('system', `Credential request dismissed. Task "${req.taskTitle}" cancelled.`);
    set((state) => ({ events: [ev, ...state.events.slice(0, 49)] }));
  },

  resumeTask: (taskId) => {
    const store = get();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== 'awaiting_credentials') return;

    set((state) => ({
      credentialRequest: null,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'in_progress' as const } : t,
      ),
    }));
    // Task will be picked up by CentralOrchestrator.tick() via normal pipeline
  },

  // === NEW RUNTIME API ===
  pushAgentActivity: (agentId, activity) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? { ...a, activity: [activity, ...a.activity.slice(0, 19)], lastActiveAt: Date.now() }
          : a,
      ),
      events: [
        {
          id: generateId('event'),
          timestamp: Date.now(),
          type: 'activity',
          message: activity.message,
          agentId,
          taskId: null,
          details: activity.details,
        },
        ...state.events.slice(0, 49),
      ],
    }));
  },

  sendMessage: (fromId, toId, message) => {
    const msg: ConversationMessage = {
      id: generateId('msg'),
      fromAgentId: fromId,
      toAgentId: toId,
      message,
      timestamp: Date.now(),
      read: false,
    };
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === fromId || a.id === toId
          ? { ...a, conversations: [...a.conversations.slice(-19), msg], lastActiveAt: Date.now() }
          : a,
      ),
      events: [
        {
          id: generateId('event'),
          timestamp: Date.now(),
          type: 'conversation',
          message,
          agentId: fromId,
          taskId: null,
        },
        ...state.events.slice(0, 49),
      ],
    }));
  },

  addTaskExecutionLog: (taskId, log) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, executionLogs: [...t.executionLogs.slice(-99), log] } : t,
      ),
      events: [
        {
          id: generateId('event'),
          timestamp: Date.now(),
          type: 'execution',
          message: `[${log.tool}] ${log.action}`,
          agentId: log.agentId,
          taskId,
          details: log.output,
        },
        ...state.events.slice(0, 49),
      ],
    }));
  },

  updateAgentPerformance: (agentId, updates) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? { ...a, performance: { ...a.performance, ...updates } }
          : a,
      ),
    }));
  },

  updateWorkStatus: (agentId, status) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, workStatus: status, lastActiveAt: Date.now() } : a,
      ),
    }));
  },

  // Subtask API
  addSubtask: (taskId, subtask) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t,
      ),
    }));
  },

  updateSubtaskStatus: (subtaskId, status) => {
    set((state) => ({
      tasks: state.tasks.map((t) => ({
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === subtaskId
            ? { ...s, status, completedAt: status === 'completed' || status === 'failed' ? Date.now() : s.completedAt }
            : s,
        ),
      })),
    }));
  },

  updateSubtaskAgent: (subtaskId, agentId) => {
    set((state) => ({
      tasks: state.tasks.map((t) => ({
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, assignedAgentId: agentId, status: 'assigned' as const } : s,
        ),
      })),
    }));
  },

  updateSubtaskValidation: (subtaskId, result) => {
    set((state) => ({
      tasks: state.tasks.map((t) => ({
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, validationResult: result } : s,
        ),
      })),
    }));
  },

  updateSubtaskDeliverable: (subtaskId, content, path) => {
    set((state) => ({
      tasks: state.tasks.map((t) => ({
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, deliverable: content } : s,
        ),
      })),
    }));
  },

  // Deliverable Projects
  addDeliverableProject: (project) => {
    set((state) => ({
      deliverableProjects: [project, ...state.deliverableProjects],
    }));
  },

  initializePersonalizedOffice: (companyName, companyProduct, developersCount, connectors) => {
    set({
      isInitialized: true,
      companyName,
      companyProduct,
      developersCount,
      connectors,
      tasks: [],
    });
    
    // Re-initialize base agents
    get().initAgents();

    // Spawn additional engineer agents for each dev beyond 1
    if (developersCount > 1) {
      const devNames = EXTRA_DEV_NAMES();
      const devColors = EXTRA_DEV_COLORS();
      for (let i = 1; i < developersCount; i++) {
        const devName = devNames[(i - 1) % devNames.length];
        const extraAgent: import('@/agents/AgentTypes').Agent = {
          id: generateId('agent'),
          name: devName,
          role: 'engineer',
          traits: AGENT_PERSONALITIES().engineer,
          energy: 100,
          maxEnergy: 100,
          mood: 'neutral',
          state: 'idle',
          fsmState: 'idle' as const,
          workStatus: 'idle',
          currentTaskId: null,
          currentSubTaskId: null,
          workerRole: 'developer' as const,
          x: 292 + i * 30 + Math.random() * 20,
          y: 284 + i * 20 + Math.random() * 15,
          targetX: 292 + i * 30,
          targetY: 284 + i * 20,
          conversations: [],
          efficiency: 75 + Math.floor(Math.random() * 20),
          color: devColors[(i - 1) % devColors.length],
          emoji: '💻',
          officeLocation: 'coding_desk',
          aiReady: false,
          activity: [],
          performance: {
            tasksCompleted: 0, tasksFailed: 0, avgCompletionTime: 0,
            successRate: 1, collaborationScore: 50, reliabilityScore: 75,
            toolUsageCount: 0, specializationTags: [], seniority: 'junior',
            productivityScore: 50, promotionLevel: 'trial', reviewsCount: 0,
            lastReviewAt: null,
          },
          memory: [],
          online: true,
          lastActiveAt: Date.now(),
        };
        set((state) => ({ agents: [...state.agents, extraAgent] }));
      }
      const devEvent = createGameEvent('system', `🚀 ${developersCount} developer agents spawned on the office floor!`);
      get().addEvent(devEvent);
    }
    
    // Add custom event log
    const event = createGameEvent('system', `🏢 Personalized office for ${companyName} initialized! All departments active.`);
    get().addEvent(event);
  },

  addUserMessage: (message) => {
    const userMsg: UserMessage = {
      id: generateId('msg'),
      message,
      timestamp: Date.now(),
    };
    set((state) => ({
      userMessages: [...state.userMessages, userMsg],
    }));
  },

  clearUserMessages: () => {
    set({ userMessages: [] });
  },

  setCenterView: (view) => {
    set({ centerView: view });
  },

  toggleAgentRoster: () => {
    set((state) => ({ showAgentRoster: !state.showAgentRoster }));
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  toggleLibrary: () => {
    set((state) => ({ showLibrary: !state.showLibrary }));
  },

  updateConnectors: (updates) => {
    set((state) => ({
      connectors: {
        ...state.connectors,
        ...updates,
      },
    }));
    
    const event = createGameEvent('system', `⚙️ Connected integration settings updated.`);
    get().addEvent(event);
  },
}),
    {
      name: 'agentcorp-storage',
      partialize: (state) => ({
        isInitialized: state.isInitialized,
        companyName: state.companyName,
        companyProduct: state.companyProduct,
        developersCount: state.developersCount,
        connectors: state.connectors,
      }),
    },
  ),
);

export function getAgentById(id: string | null): Agent | undefined {
  if (!id) return undefined;
  return useGameStore.getState().agents.find((a) => a.id === id);
}
