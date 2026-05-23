import { DeliverableType } from '@/agents/AgentTypes';

export interface TaskProposal {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deliverableType: DeliverableType;
  deliverableLang?: string;
  source: 'todo' | 'discovery';
  contextFile?: string;
  contextSnippet?: string;
}

export class TaskDiscovery {
  private proposals: TaskProposal[] = [];

  async scanProject(): Promise<TaskProposal[]> {
    this.proposals = [];

    // Only scan for agent-friendly tasks — reports, analysis, documentation
    // Agents CANNOT modify source code (write locked to deliverables/)
    await this.scanForReportableIssues();

    return this.proposals;
  }

  private async scanForReportableIssues(): Promise<void> {
    // Scan for real codebase stats, but create ANALYSIS tasks (not fix tasks)
    const [tscResult, dirResult] = await Promise.all([
      this.execTool('execute_command', {
        command: 'npx tsc --noEmit 2>&1 | head -5',
        workdir: '',
      }),
      this.execTool('execute_command', {
        command: 'ls src/**/*.ts src/**/*.tsx 2>/dev/null | wc -l',
        workdir: '',
      }),
    ]);

    const tscErrors = tscResult.success ? tscResult.output.split('\n').filter(l => l.includes('error TS')).length : 0;
    const fileCount = dirResult.success ? parseInt(dirResult.output.trim() || '0') : 0;

    if (tscErrors > 0) {
      this.proposals.push({
        title: `Analyze and document ${tscErrors} TypeScript compilation errors in the project`,
        priority: 'high',
        deliverableType: 'analysis',
        source: 'discovery',
        contextSnippet: `Found ${tscErrors} TypeScript compilation errors`,
      });
    }

    if (fileCount > 0) {
      this.proposals.push({
        title: `Generate project health report across ${fileCount} source files`,
        priority: 'medium',
        deliverableType: 'report',
        source: 'discovery',
        contextSnippet: `Project contains ${fileCount} TypeScript/TSX source files`,
      });
    }

    this.proposals.push({
      title: 'Research best practices for reducing TypeScript compilation errors',
      priority: 'low',
      deliverableType: 'research',
      source: 'discovery',
    });
  }

  private async execTool(
    tool: string,
    params: Record<string, string>,
  ): Promise<{ success: boolean; output: string }> {
    try {
      const res = await fetch('/api/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, params }),
      });
      const data = await res.json();
      return { success: data.success, output: data.output || '' };
    } catch {
      return { success: false, output: '' };
    }
  }
}

export const taskDiscovery = new TaskDiscovery();
