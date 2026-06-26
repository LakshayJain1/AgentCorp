'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, Task, SubTask, ValidationResult, GameEvent, SimulationState, AgentRole, OfficeLocation, DeliverableType, AgentActivity, AgentPerformance, AgentWorkStatus, ConversationMessage, TaskExecutionLog, DeliverableProject } from '@/agents/AgentTypes';
import { AGENT_PERSONALITIES } from '@/ai/AgentPersonalities';
import { agentRuntime } from '@/runtime/AgentRuntime';

const TASK_TITLES = [
  'Analyze customer feedback',
  'Fix API issue',
  'Review compliance report',
  'Prepare deployment',
  'Investigate hallucination',
  'Optimize database queries',
  'Update documentation',
  'Refactor authentication module',
  'Design new feature spec',
  'Run security audit',
  'Improve test coverage',
  'Monitor system health',
  'Research competitor product',
  'Triage bug reports',
  'Plan sprint roadmap',
];

const AGENT_NAMES: Record<AgentRole, { name: string; color: number; emoji: string }> = {
  ceo: { name: 'Alex', color: 0xff6b6b, emoji: '👑' },
  pm: { name: 'Sam', color: 0x4ecdc4, emoji: '📋' },
  researcher: { name: 'Jill', color: 0x45b7d1, emoji: '🔬' },
  engineer: { name: 'Mike', color: 0xf9ca24, emoji: '💻' },
  qa: { name: 'Tina', color: 0xa29bfe, emoji: '🔍' },
  hr: { name: 'Riley', color: 0xf472b6, emoji: '📊' },
};

export const OFFICE_LOCATIONS: OfficeLocation[] = [
  { id: 'ceo_office', name: 'CEO Office', x: 64, y: 94, role: 'ceo', width: 100, height: 80 },
  { id: 'pm_desk', name: 'PM Desk', x: 292, y: 104, role: 'pm', width: 80, height: 60 },
  { id: 'server_rack', name: 'Server Rack', x: 64, y: 280, role: 'researcher', width: 100, height: 70 },
  { id: 'coding_desk', name: 'Coding Desk', x: 292, y: 284, role: 'engineer', width: 80, height: 60 },
  { id: 'qa_desk', name: 'QA Desk', x: 472, y: 284, role: 'qa', width: 80, height: 60 },
  { id: 'hr_desk', name: 'HR Desk', x: 472, y: 80, role: 'hr', width: 80, height: 60 },
  { id: 'coffee_machine', name: 'Coffee Machine', x: 464, y: 88, role: 'coffee', width: 60, height: 50 },
  { id: 'meeting_room', name: 'Meeting Room', x: 328, y: 224, role: 'meeting', width: 160, height: 50 },
  { id: 'gaming_zone', name: 'Gaming Zone', x: 180, y: 330, role: 'gaming', width: 70, height: 60 },
];

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
  const info = AGENT_NAMES[role];
  const location = OFFICE_LOCATIONS.find(l => l.role === role);
  return {
    id: generateId('agent'),
    name: info.name,
    role,
    traits: AGENT_PERSONALITIES[role] || AGENT_PERSONALITIES.engineer,
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
  const title = providedTitle || TASK_TITLES[Math.floor(Math.random() * TASK_TITLES.length)];
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

interface GameStore {
  agents: Agent[];
  tasks: Task[];
  events: GameEvent[];
  simulation: SimulationState;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  credentialRequest: CredentialRequest | null;
  deliverableProjects: DeliverableProject[];

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

  // Deliverable Projects
  addDeliverableProject: (project: DeliverableProject) => void;
  generateDeliverableForTask: (taskId: string) => Promise<void>;

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

  initAgents: () => {
    const roles: AgentRole[] = ['ceo', 'pm', 'researcher', 'engineer', 'qa', 'hr'];
    const agents = roles.map(createAgent);
    const initialEvent = createGameEvent('system', 'AgentCorp systems initialized. All agents ready.');

    // Seed some mock projects so the folder isn't empty
    const mockProjects: DeliverableProject[] = [
      {
        id: `project_seed_1`,
        taskId: 'seed_1',
        title: 'Customer Dashboard',
        type: 'code',
        lang: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Customer Dashboard</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:system-ui,sans-serif; background:#0f0f1e; color:#ddd; }
.layout { display:grid; grid-template-columns:240px 1fr; min-height:100vh; }
.sidebar { background:#1a1a2e; padding:1.5rem; border-right:1px solid #2a2a4e; }
.sidebar h2 { color:#6c63ff; font-size:1rem; margin-bottom:1.5rem; }
.sidebar a { display:block; color:#888; padding:0.5rem; text-decoration:none; }
.sidebar a:hover { color:#fff; background:#2a2a4e; border-radius:4px; }
.main { padding:2rem; }
.stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:2rem; }
.card { background:#1a1a2e; border:1px solid #2a2a4e; border-radius:8px; padding:1.2rem; }
.card h3 { color:#888; font-size:0.8rem; text-transform:uppercase; }
.card .value { font-size:2rem; font-weight:bold; color:#6c63ff; margin-top:0.25rem; }
</style></head>
<body>
<div class="layout">
<nav class="sidebar"><h2>AgentCorp</h2><a href="#">Overview</a><a href="#">Analytics</a><a href="#">Users</a><a href="#">Settings</a></nav>
<div class="main"><h1>Customer Dashboard</h1>
<div class="stats">
<div class="card"><h3>Users</h3><div class="value">12,847</div></div>
<div class="card"><h3>Revenue</h3><div class="value">$48,290</div></div>
<div class="card"><h3>Active</h3><div class="value">3,421</div></div>
</div></div></div></body></html>`,
        createdAt: Date.now() - 86400000 * 3,
        completedBy: null,
      },
      {
        id: `project_seed_2`,
        taskId: 'seed_2',
        title: 'API Rate Limiter Spec',
        type: 'spec',
        lang: 'markdown',
        content: `# API Rate Limiter Specification

## Overview
Rate limiting middleware for public API endpoints to prevent abuse.

## Requirements
- 100 requests/minute per API key
- 1000 requests/minute per IP
- Configurable limits per endpoint
- Redis-backed sliding window

## Implementation
\`\`\`typescript
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
}
\`\`\`

## Endpoints
| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /api/v1/* | 100 | 1 min |
| POST /api/v1/* | 50 | 1 min |
| DELETE /api/v1/* | 20 | 1 min |`,
        createdAt: Date.now() - 86400000 * 2,
        completedBy: null,
      },
      {
        id: `project_seed_3`,
        taskId: 'seed_3',
        title: 'Security Audit Report',
        type: 'report',
        lang: 'markdown',
        content: `# Security Audit Report

**Date:** ${new Date().toISOString().split('T')[0]}
**Status:** Complete

## Summary
Comprehensive security audit of AgentCorp infrastructure.

## Findings

### Critical
- None found

### High
- JWT secret key rotation not enforced
- No rate limiting on auth endpoints

### Medium
- Missing CSRF protection on mutation endpoints
- Debug mode enabled in production config

## Recommendations
1. Implement automated key rotation
2. Add rate limiting middleware
3. Enable CSRF tokens
4. Disable debug mode in production`,
        createdAt: Date.now() - 86400000,
        completedBy: null,
      },
    ];

    set({ agents, events: [initialEvent], deliverableProjects: mockProjects, tasks: [] });
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

    // Agents will process this task through the deliverable pipeline
    console.log('[AgentCorp] calling generateDeliverableForTask for:', task.id);
    get().generateDeliverableForTask(task.id);
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
    // Generate a deliverable project for the completed task
    get().generateDeliverableForTask(taskId);
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
    const ev = createGameEvent('system', `Task "${task?.title}" paused — waiting for ${credentialLabel} from operator`);
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

      get().generateDeliverableForTask(req.taskId);
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

    get().generateDeliverableForTask(taskId);
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

  generateDeliverableForTask: async (taskId) => {
    console.log('[AgentCorp] generateDeliverableForTask called:', taskId);
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      console.warn('[AgentCorp] generateDeliverableForTask — task not found:', taskId);
      return;
    }
    console.log('[AgentCorp] generateDeliverableForTask — task found:', { id: task.id, status: task.status, assignedTo: task.assignedTo });

    // agentRuntime.processTask already creates the deliverable project and completes/fails the task
    console.log('[AgentCorp] calling agentRuntime.processTask');
    await agentRuntime.processTask(task);
    console.log('[AgentCorp] agentRuntime.processTask returned');
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
      const extraDevNames = ['Dave', 'Priya', 'Leo'];
      const extraDevColors = [0x00cec9, 0xfd79a8, 0x6c5ce7];
      for (let i = 1; i < developersCount; i++) {
        const devName = extraDevNames[(i - 1) % extraDevNames.length];
        const extraAgent: import('@/agents/AgentTypes').Agent = {
          id: generateId('agent'),
          name: devName,
          role: 'engineer',
          traits: AGENT_PERSONALITIES['engineer'],
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
          color: extraDevColors[(i - 1) % extraDevColors.length],
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
