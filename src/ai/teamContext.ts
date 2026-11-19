/**
 * Live facts about the office, handed to agents in chat so they answer from what is actually going on
 * instead of guessing. Pure: takes plain state, returns plain strings (no store, no model).
 *
 * The block is deliberately small (a few hundred tokens) and says plainly what is NOT tracked, so an
 * agent asked for a number we don't have ("survey score", "revenue") says so rather than inventing one.
 */

interface AgentLike {
  name: string;
  role: string;
  online?: boolean;
  workStatus?: string;
  currentTaskId?: string | null;
}
interface TaskLike {
  id: string;
  title: string;
  status: string;
}
export interface TeamState {
  companyName?: string;
  companyProduct?: string;
  agents: AgentLike[];
  tasks: TaskLike[];
  simulation?: { morale?: number; efficiency?: number; totalTasksCompleted?: number; totalTasksFailed?: number };
}

const ACTIVE = new Set(['pending', 'prioritized', 'assigned', 'in_progress', 'review', 'awaiting_credentials']);
const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function buildTeamContext(state: TeamState): Record<string, string> {
  const agents = state.agents ?? [];
  const tasks = state.tasks ?? [];
  const onlineAgents = agents.filter((a) => a.online !== false);
  const offline = agents.filter((a) => a.online === false);

  const roles = new Map<string, string[]>();
  for (const a of onlineAgents) roles.set(a.role, [...(roles.get(a.role) ?? []), a.name]);
  const roster = [...roles.entries()].map(([role, names]) => `${role}: ${names.join(', ')}`).join('; ');

  const busy = onlineAgents.filter((a) => a.workStatus && a.workStatus !== 'idle');
  const active = tasks.filter((t) => ACTIVE.has(t.status));
  const done = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;

  const out: Record<string, string> = {
    'Company': [state.companyName, state.companyProduct].filter(Boolean).join(' — ') || 'AgentCorp workspace',
    'Team right now': `${onlineAgents.length} agents on the team (${roster || 'none'})${offline.length ? `; ${offline.length} former (${offline.map((a) => a.name).join(', ')})` : ''}`,
    'Working now': busy.length ? busy.map((a) => a.name).join(', ') : 'nobody, everyone is idle',
    'Tasks': `${active.length} open, ${done} completed, ${failed} failed${active.length ? `. Open: ${active.slice(0, 5).map((t) => `"${short(t.title)}" (${t.status})`).join('; ')}${active.length > 5 ? `; +${active.length - 5} more` : ''}` : ''}`,
  };

  const sim = state.simulation;
  if (sim && (typeof sim.morale === 'number' || typeof sim.efficiency === 'number')) {
    const parts: string[] = [];
    if (typeof sim.morale === 'number') parts.push(`team morale ${Math.round(sim.morale)}/100`);
    if (typeof sim.efficiency === 'number') parts.push(`efficiency ${Math.round(sim.efficiency)}%`);
    out['Simulation gauges'] = parts.join(', ');
  }

  out['Not tracked'] = 'surveys, revenue, customers, budgets and any figure not listed above. If asked for one of these, say you do not have it; never make a number up.';
  return out;
}
