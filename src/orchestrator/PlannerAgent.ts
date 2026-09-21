import { useGameStore } from '@/store/gameStore';
import { Task, SubTask, WorkerRole } from '@/agents/AgentTypes';
import { aiService } from '@/ai/AIService';

interface PlannerOutput {
  breakdown: PlannerSubtask[];
  reasoning: string;
}

interface PlannerSubtask {
  description: string;
  type: SubTask['type'];
  estimatedEffort: number;
  dependencies: string[];
  assignableRoles: WorkerRole[];
  acceptanceCriteria?: string;
  verifyCommand?: string;
}

export class PlannerAgent {
  private processing = false;

  async processPendingTasks(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const store = useGameStore.getState();
      const pendingTasks = store.tasks.filter((t) => t.status === 'assigned' && t.subtasks.length === 0);

      for (const task of pendingTasks.slice(0, 2)) {
        await this.planTask(task);
      }
    } finally {
      this.processing = false;
    }
  }

  private async planTask(task: Task): Promise<void> {
    const store = useGameStore.getState();

    store.updateTask(task.id, { status: 'in_progress' });
    store.addEvent({
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'system',
      message: `Planning subtasks for: "${task.title}"`,
      agentId: null,
      taskId: task.id,
    });

    const plan = await this.generatePlan(task);

    // P4: per-task isolation — one branch per task on the user's repo.
    // All subtasks inherit repoRef so the validator's CI hook engages.
    let taskBranch: string | undefined;
    if (task.repoScope?.repo) {
      const slug = task.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'task';
      const candidate = `agentcorp/${slug}-${Date.now().toString(36)}`;
      try {
        const res = await fetch('/api/github/branch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo: task.repoScope.repo,
            branch: candidate,
            base: task.repoScope.base ?? 'main',
          }),
        });
        const data = (await res.json().catch(() => null)) as { success?: boolean; branch?: string } | null;
        if (res.ok && data?.success && data.branch) {
          taskBranch = data.branch;
          store.updateTask(task.id, { taskBranch });
        }
      } catch {
        // Branch unavailable (no token / API down) — subtasks run unscoped, legacy scoring.
      }
    }

    const subtasks: SubTask[] = plan.breakdown.map((item, idx) => ({
      id: `sub_${task.id}_${idx}_${Date.now()}`,
      parentTaskId: task.id,
      description: item.description,
      type: item.type,
      status: 'pending' as const,
      assignedRole: item.assignableRoles[0] || null,
      assignedAgentId: null,
      estimatedEffort: item.estimatedEffort,
      dependencies: item.dependencies,
      acceptanceCriteria: item.acceptanceCriteria,
      verifyCommand: item.verifyCommand ?? (taskBranch && task.repoScope
        ? `ci:${task.repoScope.repo}@${taskBranch}`
        : undefined),
      repoRef: taskBranch && task.repoScope ? { repo: task.repoScope.repo, ref: taskBranch } : undefined,
      createdAt: Date.now(),
      completedAt: null,
    }));

    for (const sub of subtasks) {
      store.addSubtask(task.id, sub);
    }

    // Clear the agent's currentTaskId — orchestrator now manages via currentSubTaskId
    if (task.assignedTo) {
      store.updateAgent(task.assignedTo, { currentTaskId: null });
    }

    store.updateTask(task.id, { plannerOutput: plan.reasoning });
    store.addEvent({
      id: `plan_done_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'subtask',
      message: `Task "${task.title}" broken into ${subtasks.length} subtasks`,
      agentId: null,
      taskId: task.id,
      details: subtasks.map((s) => `[${s.type}] ${s.description}`).join('\n'),
    });
  }

  private async generatePlan(task: Task): Promise<PlannerOutput> {
    const prompt = `You are a senior technical planner. Break down the following task into structured subtasks:

TASK: "${task.title}"
${task.description ? `DESCRIPTION: ${task.description}` : ''}
${task.aiContext?.contextFile ? `CONTEXT FILE: ${task.aiContext.contextFile}` : ''}
DELIVERABLE TYPE: ${task.deliverableType || 'code'}

 For each subtask, specify:
 1. Description (what needs to be done)
 2. Type (code, research, qa, documentation, analysis)
 3. Estimated effort (1-10 scale)
 4. Dependencies (list dependent subtask indices, 0-based)
 5. Assignable roles (developer, qa_worker, research_worker, documentation)
 6. acceptanceCriteria (one checkable sentence, e.g. "logout clears session and redirects to /login")
 7. verifyCommand (one of: "ci:<repo>@<branch>" | "desktop:typecheck|lint|test")

 Return ONLY valid JSON with this structure:
 {
   "reasoning": "brief explanation of the breakdown",
   "breakdown": [
     {
       "description": "subtask description",
       "type": "code|research|qa|documentation|analysis",
       "estimatedEffort": 5,
       "dependencies": [],
       "assignableRoles": ["developer"],
       "acceptanceCriteria": "checkable done-state",
       "verifyCommand": "desktop:typecheck"
     }
   ]
 }

 Keep subtasks focused and actionable. Maximum 5 subtasks.`;

    try {
      const response = await aiService.askAgent(
        'pm',
        'Planner',
        {
          personality: ['analytical', 'structured', 'methodical'],
          skills: ['task decomposition', 'project planning', 'effort estimation'],
          communicationStyle: 'precise and structured',
          catchphrases: [],
        },
        prompt,
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as PlannerOutput;
      }
    } catch {
      // Fallback to mock plan below
    }

    return this.mockPlan(task);
  }

  private mockPlan(task: Task): PlannerOutput {
    const type: SubTask['type'] =
      task.deliverableType === 'doc' ? 'documentation' :
      task.deliverableType === 'analysis' ? 'analysis' :
      task.deliverableType === 'design' ? 'analysis' :
      'code';

    const breakdown: PlannerSubtask[] = [
      {
        description: `Research and analyze requirements for: ${task.title}`,
        type: 'research',
        estimatedEffort: 3,
        dependencies: [],
        assignableRoles: ['research_worker'],
        acceptanceCriteria: 'Requirements and constraints documented with sources',
        verifyCommand: 'desktop:typecheck',
      },
      {
        description: `Implement the solution for: ${task.title}`,
        type,
        estimatedEffort: 7,
        dependencies: ['sub_1'],
        assignableRoles: ['developer'],
        acceptanceCriteria: 'Implementation matches the researched requirements with no placeholder logic',
        verifyCommand: 'desktop:typecheck',
      },
      {
        description: `Write tests for the implementation`,
        type: 'qa',
        estimatedEffort: 4,
        dependencies: ['sub_2'],
        assignableRoles: ['qa_worker'],
        acceptanceCriteria: 'Tests cover the acceptance criteria and fail without the fix',
        verifyCommand: 'desktop:test',
      },
      {
        description: `Validate and verify the deliverable`,
        type: 'qa',
        estimatedEffort: 3,
        dependencies: ['sub_3'],
        assignableRoles: ['qa_worker'],
        acceptanceCriteria: 'All checks green and deliverable reviewed against criteria',
        verifyCommand: 'desktop:lint',
      },
    ];

    return {
      reasoning: `Task broken into research → implementation → testing → validation phases`,
      breakdown,
    };
  }
}
