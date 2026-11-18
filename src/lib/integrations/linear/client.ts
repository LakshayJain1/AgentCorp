import { LinearError, kindForGraphQLErrors, kindForStatus, retryAfterMsFrom } from './errors';
import { deterministicUuid } from './ids';

/**
 * Minimal typed Linear GraphQL client.
 *
 * - Every failure becomes a `LinearError` with a kind; only rate limits, 5xx and dropped connections
 *   are retried (bounded attempts, exponential backoff with jitter, `Retry-After` honoured).
 * - Writes take an optional idempotency key. It is turned into a deterministic UUID sent as Linear's
 *   own `id`, so a retry or replay can never create a second object: if Linear says the id exists,
 *   the existing object is returned instead.
 *
 * No `server-only` import so it can be unit-tested with a fake fetch; only server modules use it.
 */

const ENDPOINT = 'https://api.linear.app/graphql';

export interface LinearClientOptions {
  token: string;
  /** Stable per workspace; scopes the deterministic ids. */
  namespace?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Upper bound on how long we will honour a Retry-After. */
  maxRetryAfterMs?: number;
  timeoutMs?: number;
  /** Called once on a 401; return a fresh token to retry with, or null to give up. */
  onUnauthorized?: () => Promise<string | null>;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  state: { id: string; name: string; type: string } | null;
  team: { id: string; key: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  labels: { id: string; name: string }[];
  comments: { id: string; body: string; createdAt: string }[];
}

export interface LinearTeam { id: string; name: string; key: string }
export interface LinearState { id: string; name: string; type: string; position: number }

const ISSUE_FIELDS = `
  id identifier title description url
  state { id name type }
  team { id key name }
  assignee { id name }
  labels { nodes { id name } }
  comments(first: 10) { nodes { id body createdAt } }
`;

interface RawIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  url: string;
  state?: LinearIssue['state'];
  team?: LinearIssue['team'];
  assignee?: LinearIssue['assignee'];
  labels?: { nodes?: { id: string; name: string }[] };
  comments?: { nodes?: { id: string; body: string; createdAt: string }[] };
}

function toIssue(raw: RawIssue): LinearIssue {
  return {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title,
    description: raw.description ?? null,
    url: raw.url,
    state: raw.state ?? null,
    team: raw.team ?? null,
    assignee: raw.assignee ?? null,
    labels: raw.labels?.nodes ?? [],
    comments: raw.comments?.nodes ?? [],
  };
}

/** Words an agent (or a person) might use -> Linear's workflow state types. */
const STATE_ALIASES: Record<string, string> = {
  backlog: 'backlog',
  todo: 'unstarted',
  'to do': 'unstarted',
  unstarted: 'unstarted',
  'in progress': 'started',
  started: 'started',
  doing: 'started',
  'in review': 'started',
  review: 'started',
  qa: 'started',
  done: 'completed',
  complete: 'completed',
  completed: 'completed',
  canceled: 'canceled',
  cancelled: 'canceled',
};

/** Pick a workflow state by exact name, else by type alias (lowest position of that type). */
export function pickState(states: LinearState[], wanted: string): LinearState {
  const w = wanted.trim().toLowerCase();
  const byName = states.find((s) => s.name.toLowerCase() === w);
  if (byName) return byName;
  const type = STATE_ALIASES[w];
  if (type) {
    const ofType = states.filter((s) => s.type === type).sort((a, b) => a.position - b.position);
    if (ofType.length > 0) return ofType[0];
  }
  throw new LinearError(
    'validation',
    `no workflow state matches "${wanted}". Available: ${states.map((s) => s.name).join(', ')}`,
  );
}

export class LinearClient {
  private token: string;
  private readonly ns: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxRetryAfterMs: number;
  private readonly timeoutMs: number;
  private readonly onUnauthorized?: () => Promise<string | null>;

  constructor(opts: LinearClientOptions) {
    this.token = opts.token;
    this.ns = opts.namespace ?? 'default';
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = opts.random ?? Math.random;
    this.maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.maxDelayMs = opts.maxDelayMs ?? 8000;
    this.maxRetryAfterMs = opts.maxRetryAfterMs ?? 15000;
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.onUnauthorized = opts.onUnauthorized;
  }

  /** The id a write with this key will use. Exposed so callers can store or compare it. */
  idFor(idempotencyKey: string): string {
    return deterministicUuid(this.ns, idempotencyKey);
  }

  // ── transport ────────────────────────────────────────────────────────────

  private async once<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        cache: 'no-store',
        signal: ctrl.signal,
      });
      text = await res.text();
    } catch (err) {
      // The request may or may not have reached Linear: callers that need exactly-once use idempotency keys.
      throw new LinearError('network', err instanceof Error ? err.message : 'request failed');
    } finally {
      clearTimeout(timer);
    }

    let json: { data?: T; errors?: { message?: string; extensions?: { type?: string; code?: string; userPresentableMessage?: string } }[] } | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const errors = json?.errors ?? [];
    if (res.ok && errors.length === 0) {
      if (json && json.data !== undefined) return json.data;
      throw new LinearError('server', 'Linear returned an empty response', { status: res.status });
    }

    const statusKind = res.ok ? null : kindForStatus(res.status);
    const gqlKind = errors.length > 0 ? kindForGraphQLErrors(errors) : null;
    // A definite status (401, 429, 5xx) wins; a plain 400 defers to what the GraphQL error says.
    const kind = statusKind && statusKind !== 'validation' ? statusKind : (gqlKind ?? statusKind ?? 'validation');
    const message =
      errors[0]?.extensions?.userPresentableMessage ?? errors[0]?.message ?? `HTTP ${res.status}`;
    throw new LinearError(kind, message, {
      status: res.status,
      retryAfterMs: kind === 'rate_limited' ? retryAfterMsFrom(res.headers) : undefined,
    });
  }

  private delayFor(attempt: number, err: LinearError): number {
    if (err.retryAfterMs !== undefined) return Math.min(err.retryAfterMs, this.maxRetryAfterMs);
    const exp = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (attempt - 1));
    return Math.round(exp * (0.5 + this.random() * 0.5));
  }

  async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    let attempt = 0;
    let refreshed = false;
    for (;;) {
      attempt++;
      try {
        return await this.once<T>(query, variables);
      } catch (err) {
        const e = err instanceof LinearError ? err : new LinearError('network', String(err));
        if (e.kind === 'auth' && !refreshed && this.onUnauthorized) {
          refreshed = true;
          const fresh = await this.onUnauthorized().catch(() => null);
          if (fresh) {
            this.token = fresh;
            attempt--; // a token refresh is not a failed attempt
            continue;
          }
        }
        // Validation / auth / not-found are real answers: repeating them cannot help. Bounded otherwise.
        if (!e.retryable || attempt >= this.maxAttempts) throw e;
        await this.sleep(this.delayFor(attempt, e));
      }
    }
  }

  // ── reads ────────────────────────────────────────────────────────────────

  async listTeams(): Promise<LinearTeam[]> {
    const d = await this.request<{ teams: { nodes: LinearTeam[] } }>(`{ teams { nodes { id name key } } }`);
    return d.teams?.nodes ?? [];
  }

  /** Accepts a team id, key ("ENG") or name; returns the team, or throws a validation error listing the choices. */
  async resolveTeam(ref?: string): Promise<LinearTeam> {
    const teams = await this.listTeams();
    if (teams.length === 0) throw new LinearError('validation', 'no Linear teams found in this workspace');
    if (!ref?.trim()) return teams[0];
    const r = ref.trim().toLowerCase();
    const hit = teams.find((t) => t.id.toLowerCase() === r || t.key.toLowerCase() === r || t.name.toLowerCase() === r);
    if (!hit) {
      throw new LinearError('validation', `no team matches "${ref}". Teams: ${teams.map((t) => `${t.name} (${t.key})`).join(', ')}`);
    }
    return hit;
  }

  async listWorkflowStates(teamId: string): Promise<LinearState[]> {
    const d = await this.request<{ team: { states: { nodes: LinearState[] } } | null }>(
      `query($id: String!) { team(id: $id) { states { nodes { id name type position } } } }`,
      { id: teamId },
    );
    return d.team?.states?.nodes ?? [];
  }

  /** `idOrIdentifier` is a UUID or a key like "ENG-12". Returns null when it does not exist. */
  async getIssue(idOrIdentifier: string): Promise<LinearIssue | null> {
    try {
      const d = await this.request<{ issue: RawIssue | null }>(
        `query($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`,
        { id: idOrIdentifier },
      );
      return d.issue ? toIssue(d.issue) : null;
    } catch (err) {
      if (err instanceof LinearError && err.kind === 'not_found') return null;
      throw err;
    }
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async createIssue(a: {
    teamId: string;
    title: string;
    description?: string;
    labelIds?: string[];
    stateId?: string;
    assigneeId?: string;
    priority?: number;
    idempotencyKey?: string;
  }): Promise<{ issue: LinearIssue; replayed: boolean }> {
    const id = a.idempotencyKey ? this.idFor(a.idempotencyKey) : undefined;
    const input = {
      ...(id ? { id } : {}),
      teamId: a.teamId,
      title: a.title,
      ...(a.description ? { description: a.description } : {}),
      ...(a.labelIds?.length ? { labelIds: a.labelIds } : {}),
      ...(a.stateId ? { stateId: a.stateId } : {}),
      ...(a.assigneeId ? { assigneeId: a.assigneeId } : {}),
      ...(a.priority !== undefined ? { priority: a.priority } : {}),
    };
    try {
      const d = await this.request<{ issueCreate: { success: boolean; issue: RawIssue | null } }>(
        `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
        { input },
      );
      if (!d.issueCreate?.success || !d.issueCreate.issue) {
        throw new LinearError('validation', 'Linear did not create the issue');
      }
      return { issue: toIssue(d.issueCreate.issue), replayed: false };
    } catch (err) {
      // With a deterministic id, "it already exists" (an earlier attempt landed, or this is a replay) is success.
      if (id && err instanceof LinearError && err.kind !== 'auth') {
        const existing = await this.getIssue(id).catch(() => null);
        if (existing) return { issue: existing, replayed: true };
      }
      throw err;
    }
  }

  async createComment(a: {
    issueId: string;
    body: string;
    idempotencyKey?: string;
  }): Promise<{ id: string; url: string | null; replayed: boolean }> {
    const id = a.idempotencyKey ? this.idFor(a.idempotencyKey) : undefined;
    try {
      const d = await this.request<{ commentCreate: { success: boolean; comment: { id: string; url?: string | null } | null } }>(
        `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id url } } }`,
        { input: { ...(id ? { id } : {}), issueId: a.issueId, body: a.body } },
      );
      if (!d.commentCreate?.success || !d.commentCreate.comment) {
        throw new LinearError('validation', 'Linear did not create the comment');
      }
      return { id: d.commentCreate.comment.id, url: d.commentCreate.comment.url ?? null, replayed: false };
    } catch (err) {
      if (id && err instanceof LinearError && err.kind !== 'auth') {
        const existing = await this.request<{ comment: { id: string; url?: string | null } | null }>(
          `query($id: String!) { comment(id: $id) { id url } }`,
          { id },
        ).catch(() => null);
        if (existing?.comment) return { id: existing.comment.id, url: existing.comment.url ?? null, replayed: true };
      }
      throw err;
    }
  }

  /** Move an issue to a workflow state named like `status` ("In Progress", "done", ...). No-op when already there. */
  async updateIssueStatus(issueRef: string, status: string): Promise<{ issue: LinearIssue; changed: boolean }> {
    const issue = await this.getIssue(issueRef);
    if (!issue) throw new LinearError('not_found', `issue ${issueRef}`);
    if (!issue.team) throw new LinearError('validation', 'issue has no team, cannot resolve workflow states');
    const states = await this.listWorkflowStates(issue.team.id);
    const target = pickState(states, status);
    if (issue.state?.id === target.id) return { issue, changed: false };
    const d = await this.request<{ issueUpdate: { success: boolean; issue: RawIssue | null } }>(
      `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
      { id: issue.id, input: { stateId: target.id } },
    );
    if (!d.issueUpdate?.success || !d.issueUpdate.issue) throw new LinearError('validation', 'Linear did not update the issue');
    return { issue: toIssue(d.issueUpdate.issue), changed: true };
  }

  /** Find a label by name in the team, or create it (deterministic id, so racing creators converge). */
  async ensureLabel(teamId: string, name: string): Promise<{ id: string; name: string }> {
    const found = await this.request<{ issueLabels: { nodes: { id: string; name: string }[] } }>(
      `query($teamId: ID!, $name: String!) {
         issueLabels(first: 1, filter: { team: { id: { eq: $teamId } }, name: { eqIgnoreCase: $name } }) { nodes { id name } }
       }`,
      { teamId, name },
    );
    const hit = found.issueLabels?.nodes?.[0];
    if (hit) return hit;

    const id = this.idFor(`label:${teamId}:${name.toLowerCase()}`);
    try {
      const d = await this.request<{ issueLabelCreate: { success: boolean; issueLabel: { id: string; name: string } | null } }>(
        `mutation($input: IssueLabelCreateInput!) { issueLabelCreate(input: $input) { success issueLabel { id name } } }`,
        { input: { id, teamId, name } },
      );
      if (d.issueLabelCreate?.success && d.issueLabelCreate.issueLabel) return d.issueLabelCreate.issueLabel;
      throw new LinearError('validation', 'Linear did not create the label');
    } catch (err) {
      // Someone (or an earlier retry) created it with the same id: look it up again.
      if (err instanceof LinearError && err.kind !== 'auth') {
        const again = await this.request<{ issueLabels: { nodes: { id: string; name: string }[] } }>(
          `query($teamId: ID!, $name: String!) {
             issueLabels(first: 1, filter: { team: { id: { eq: $teamId } }, name: { eqIgnoreCase: $name } }) { nodes { id name } }
           }`,
          { teamId, name },
        ).catch(() => null);
        const hit2 = again?.issueLabels?.nodes?.[0];
        if (hit2) return hit2;
      }
      throw err;
    }
  }

  async addLabel(issueId: string, labelId: string): Promise<void> {
    const d = await this.request<{ issueAddLabel: { success: boolean } }>(
      `mutation($id: String!, $labelId: String!) { issueAddLabel(id: $id, labelId: $labelId) { success } }`,
      { id: issueId, labelId },
    );
    if (!d.issueAddLabel?.success) throw new LinearError('validation', 'Linear did not add the label');
  }

  async assignIssue(issueRef: string, assigneeId: string): Promise<LinearIssue> {
    const issue = await this.getIssue(issueRef);
    if (!issue) throw new LinearError('not_found', `issue ${issueRef}`);
    const d = await this.request<{ issueUpdate: { success: boolean; issue: RawIssue | null } }>(
      `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
      { id: issue.id, input: { assigneeId } },
    );
    if (!d.issueUpdate?.success || !d.issueUpdate.issue) throw new LinearError('validation', 'Linear did not assign the issue');
    return toIssue(d.issueUpdate.issue);
  }
}
