/** A stateful FAKE Linear GraphQL server with fault injection, shared by the integration tests. */
export type Fault =
  | { type: 'http'; status: number; body?: unknown; headers?: Record<string, string> }
  | { type: 'throw' } // connection fails BEFORE Linear processes anything
  | { type: 'drop-after' }; // Linear processes the write, then the connection dies (outcome unknown)

export const STATES = [
  { id: 's-backlog', name: 'Backlog', type: 'backlog', position: 0 },
  { id: 's-todo', name: 'Todo', type: 'unstarted', position: 1 },
  { id: 's-prog', name: 'In Progress', type: 'started', position: 2 },
  { id: 's-done', name: 'Done', type: 'completed', position: 3 },
  { id: 's-canc', name: 'Canceled', type: 'canceled', position: 4 },
];
export const TEAM = { id: 'team-1', name: 'Engineering', key: 'ENG' };

export function makeFake() {
  const issues = new Map<string, Record<string, any>>();
  const comments = new Map<string, Record<string, any>>();
  const labels = new Map<string, { id: string; name: string; teamId: string }>();
  const requests: { query: string; variables: any; auth: string }[] = [];
  const faults: Fault[] = [];
  /** Linear apps can lack permission to create labels (seen live). */
  const options = { denyLabelCreate: false };
  let seq = 0;

  const ok = (data: unknown) => ({ data });
  const err = (message: string, type: string) => ({ errors: [{ message, extensions: { type } }] });
  const issueView = (i: any) => ({
    ...i,
    labels: { nodes: i.labelIds.map((id: string) => ({ id, name: labels.get(id)?.name ?? id })) },
    comments: { nodes: [...comments.values()].filter((c) => c.issueId === i.id).map((c) => ({ id: c.id, body: c.body, createdAt: 'now' })) },
  });

  function handle(q: string, v: any): unknown {
    if (/issueCreate\(/.test(q)) {
      const id = v.input.id ?? `auto-${++seq}`;
      if (issues.has(id)) return err('duplicate key value violates unique constraint', 'invalid input');
      const n = issues.size + 1;
      const issue = {
        id, identifier: `ENG-${n}`, title: v.input.title, description: v.input.description ?? null,
        url: `https://linear.app/x/issue/ENG-${n}`, state: STATES[0], team: TEAM, assignee: null,
        labelIds: v.input.labelIds ?? [], stateId: STATES[0].id,
      };
      issues.set(id, issue);
      return ok({ issueCreate: { success: true, issue: issueView(issue) } });
    }
    if (/issueUpdate\(/.test(q)) {
      const issue = [...issues.values()].find((i) => i.id === v.id);
      if (!issue) return err('Entity not found: Issue', 'Entity not found');
      if (v.input.stateId) { issue.state = STATES.find((s) => s.id === v.input.stateId); }
      if (v.input.assigneeId) issue.assignee = { id: v.input.assigneeId, name: 'Someone' };
      return ok({ issueUpdate: { success: true, issue: issueView(issue) } });
    }
    if (/issue\(id: \$id\)/.test(q)) {
      const issue = [...issues.values()].find((i) => i.id === v.id || i.identifier === v.id);
      return issue ? ok({ issue: issueView(issue) }) : err('Entity not found: Issue', 'Entity not found');
    }
    if (/commentCreate\(/.test(q)) {
      const id = v.input.id ?? `c-${++seq}`;
      if (comments.has(id)) return err('duplicate key value violates unique constraint', 'invalid input');
      comments.set(id, { id, issueId: v.input.issueId, body: v.input.body });
      return ok({ commentCreate: { success: true, comment: { id, url: `https://linear.app/c/${id}` } } });
    }
    if (/comment\(id:/.test(q)) {
      const c = comments.get(v.id);
      return c ? ok({ comment: { id: c.id, url: `https://linear.app/c/${c.id}` } }) : err('Entity not found: Comment', 'Entity not found');
    }
    if (/\{ teams \{/.test(q)) return ok({ teams: { nodes: [TEAM] } });
    if (/team\(id:/.test(q)) return ok({ team: { states: { nodes: STATES } } });
    if (/issueLabels\(/.test(q)) {
      const hit = [...labels.values()].find((l) => l.teamId === v.teamId && l.name.toLowerCase() === String(v.name).toLowerCase());
      return ok({ issueLabels: { nodes: hit ? [{ id: hit.id, name: hit.name }] : [] } });
    }
    if (/issueLabelCreate\(/.test(q)) {
      if (options.denyLabelCreate) return err('You are not allowed to create labels in this team.', 'forbidden');
      if (labels.has(v.input.id)) return err('duplicate key value violates unique constraint', 'invalid input');
      labels.set(v.input.id, { id: v.input.id, name: v.input.name, teamId: v.input.teamId });
      return ok({ issueLabelCreate: { success: true, issueLabel: { id: v.input.id, name: v.input.name } } });
    }
    if (/issueAddLabel\(/.test(q)) {
      const issue = issues.get(v.id);
      if (!issue) return err('Entity not found: Issue', 'Entity not found');
      if (!issue.labelIds.includes(v.labelId)) issue.labelIds.push(v.labelId);
      return ok({ issueAddLabel: { success: true } });
    }
    throw new Error(`fake Linear: unhandled query ${q.slice(0, 80)}`);
  }

  const fakeFetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const headers = init.headers as Record<string, string>;
    requests.push({ query: body.query, variables: body.variables, auth: headers.Authorization });
    const fault = faults.shift();
    if (fault?.type === 'throw') throw new TypeError('fetch failed');
    if (fault?.type === 'http') {
      return new Response(JSON.stringify(fault.body ?? { errors: [{ message: 'boom' }] }), { status: fault.status, headers: fault.headers });
    }
    const result = handle(body.query, body.variables);
    if (fault?.type === 'drop-after') throw new TypeError('socket hang up');
    return new Response(JSON.stringify(result), { status: 200 });
  }) as unknown as typeof fetch;

  return { fetch: fakeFetch, issues, comments, labels, requests, faults, options };
}

