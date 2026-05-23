export type AgentRole = 'ceo' | 'pm' | 'researcher' | 'engineer' | 'qa' | 'hr';

export type WorkerRole = 'developer' | 'qa_worker' | 'research_worker' | 'documentation';

export type AgentState = 'idle' | 'walking' | 'working' | 'communicating' | 'resting';

export type AgentMood = 'happy' | 'neutral' | 'tired' | 'frustrated' | 'focused';

export type AgentWorkStatus =
  | 'idle'
  | 'thinking'
  | 'researching'
  | 'coding'
  | 'debugging'
  | 'reviewing'
  | 'waiting'
  | 'blocked'
  | 'completed';

export type AgentFSMState =
  | 'idle'
  | 'thinking'
  | 'coding'
  | 'debugging'
  | 'reviewing'
  | 'blocked'
  | 'completed';

export const AGENT_FSM_TRANSITIONS: Record<AgentFSMState, AgentFSMState[]> = {
  idle: ['thinking'],
  thinking: ['coding', 'blocked', 'idle'],
  coding: ['debugging', 'reviewing', 'blocked'],
  debugging: ['coding', 'reviewing', 'blocked'],
  reviewing: ['completed', 'coding', 'blocked'],
  blocked: ['thinking', 'idle'],
  completed: ['idle'],
};

export interface SubTask {
  id: string;
  parentTaskId: string;
  description: string;
  type: 'code' | 'research' | 'qa' | 'documentation' | 'analysis';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  assignedRole: WorkerRole | null;
  assignedAgentId: string | null;
  estimatedEffort: number;
  dependencies: string[];
  deliverable?: string;
  validationResult?: ValidationResult;
  createdAt: number;
  completedAt: number | null;
}

export interface WorkerAssignment {
  subtaskId: string;
  workerRole: WorkerRole;
  workerAgentId: string;
  assignedAt: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  details: string[];
  testOutput?: string;
  lintOutput?: string;
  typeCheckOutput?: string;
  validatorAgentId: string;
  validatedAt: number;
  retryCount: number;
}

export interface AgentTrait {
  personality: string[];
  skills: string[];
  communicationStyle: string;
  catchphrases: string[];
}

export interface AgentActivity {
  id: string;
  agentId: string;
  type: 'thinking' | 'coding' | 'debugging' | 'researching' | 'reviewing' | 'communicating' | 'blocked' | 'tool_call' | 'tool_result';
  message: string;
  details?: string;
  timestamp: number;
}

export interface AgentPerformance {
  tasksCompleted: number;
  tasksFailed: number;
  avgCompletionTime: number;
  successRate: number;
  collaborationScore: number;
  reliabilityScore: number;
  toolUsageCount: number;
  specializationTags: string[];
  seniority: 'junior' | 'mid' | 'senior' | 'lead';
  productivityScore: number;
  promotionLevel: PromotionLevel;
  reviewsCount: number;
  lastReviewAt: number | null;
}

export type PromotionLevel = 'trial' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal';

export interface PerformanceReview {
  id: string;
  agentId: string;
  reviewerId: string;
  timestamp: number;
  score: number;
  productivityScore: number;
  reliabilityScore: number;
  collaborationScore: number;
  summary: string;
  decision: 'promote' | 'keep' | 'archive' | 'probation';
  promotedTo?: PromotionLevel;
}

export interface AgentMemoryEntry {
  id: string;
  type: 'task' | 'code' | 'pattern' | 'mistake' | 'knowledge' | 'coworker';
  content: string;
  tags: string[];
  timestamp: number;
  importance: number;
}

export interface MemoryVector {
  id: string;
  vector: number[];
  metadata: Record<string, string>;
  content: string;
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  workerRole: WorkerRole | null;
  traits: AgentTrait;
  energy: number;
  maxEnergy: number;
  mood: AgentMood;
  state: AgentState;
  fsmState: AgentFSMState;
  currentTaskId: string | null;
  currentSubTaskId: string | null;
  workStatus: AgentWorkStatus;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  conversations: ConversationMessage[];
  efficiency: number;
  color: number;
  emoji: string;
  officeLocation: string;
  aiReady: boolean;
  activity: AgentActivity[];
  performance: AgentPerformance;
  memory: AgentMemoryEntry[];
  online: boolean;
  lastActiveAt: number;
}

export type DeliverableType = 'code' | 'doc' | 'report' | 'spec' | 'config' | 'analysis' | 'design' | 'research';

export interface TaskStep {
  description: string;
  completed: boolean;
  assignedTo: string | null;
  aiOutput?: string;
}

export interface TaskExecutionLog {
  id: string;
  taskId: string;
  agentId: string;
  action: string;
  tool: string;
  input: string;
  output: string;
  duration: number;
  timestamp: number;
  status: 'running' | 'success' | 'error';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'prioritized' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'failed' | 'awaiting_credentials';
  assignedTo: string | null;
  createdBy: string | null;
  createdAt: number;
  completedAt: number | null;
  steps: TaskStep[];
  aiContext?: Record<string, string>;
  deliverableType?: DeliverableType;
  deliverable?: string;
  deliverableLang?: string;
  executionLogs: TaskExecutionLog[];
  subtasks: SubTask[];
  parentTaskId: string | null;
  validationResult?: ValidationResult;
  plannerOutput?: string;
}

export interface ConversationMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  message: string;
  timestamp: number;
  read: boolean;
  threadId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface SandboxConfig {
  enabled: boolean;
  image?: string;
  memoryLimit?: string;
  timeout: number;
  allowedPaths: string[];
  allowedCommands: string[];
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: 'task' | 'agent' | 'system' | 'conversation' | 'error' | 'complete' | 'activity' | 'execution' | 'validation' | 'subtask' | 'review';
  message: string;
  agentId: string | null;
  taskId: string | null;
  details?: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  role: AgentRole | 'general' | 'coffee' | 'meeting';
  width: number;
  height: number;
}

export interface SimulationState {
  speed: number;
  paused: boolean;
  tick: number;
  efficiency: number;
  morale: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
}

export interface AIRequest {
  agentRole: AgentRole;
  agentName: string;
  agentTraits: AgentTrait;
  prompt: string;
  context?: Record<string, string>;
}

export type AIResponse = {
  content: string;
  error?: string;
};

export interface StreamEvent {
  type: 'log' | 'status' | 'subtask' | 'validation' | 'review' | 'error';
  data: unknown;
  timestamp: number;
  streamId: string;
}

export interface ExecutionStreamChunk {
  taskId: string;
  subtaskId: string;
  agentId: string;
  type: 'start' | 'progress' | 'tool_call' | 'tool_result' | 'error' | 'complete';
  message: string;
  details?: string;
  timestamp: number;
}
