import 'server-only';

import type { ProviderId } from './providers/types';
import { LinearClient, type LinearIssue } from './linear/client';
import { LinearError, describeLinearError } from './linear/errors';

/**
 * Server-side tool gateway. Each tool runs with the caller's decrypted token
 * and returns plain text; token material never crosses this boundary.
 */

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

/** Per-call context. `workspaceId` scopes deterministic ids so idempotent writes stay stable across token refreshes. */
export interface ToolContext {
  workspaceId?: string;
}

export interface ServerTool {
  name: string;
  provider: ProviderId;
  description: string;
  /** Same shape as AgentTypes.ToolDefinition.parameters. A value containing "optional" marks the param optional. */
  parameters: Record<string, string>;
  run(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string>;
}

function assertParams(args: Record<string, string>, ...keys: string[]): void {
  const missing = keys.filter((k) => !args[k]?.trim());
  if (missing.length > 0) {
    throw new ToolInputError(`missing required parameter(s): ${missing.join(', ')}`);
  }
}

async function slackPostMessage(token: string, args: Record<string, string>): Promise<string> {
  assertParams(args, 'channel', 'text');
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: args.channel, text: args.text }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string; ts?: string; channel?: string }
    | null;
  if (!res.ok || !json?.ok) {
    throw new Error(`Slack rejected the message (${json?.error ?? res.status})`);
  }
  return `posted to ${json.channel ?? args.channel} (ts=${json.ts ?? 'unknown'})`;
}

// ── Linear ──────────────────────────────────────────────────────────────────
// All Linear tools go through LinearClient: typed errors, bounded retries on 429/5xx/network,
// and idempotent writes when an `idempotencyKey` is given (see src/lib/integrations/linear).

function linearClient(token: string, ctx?: ToolContext): LinearClient {
  return new LinearClient({ token, namespace: ctx?.workspaceId });
}

/** Linear failures become readable tool errors: bad input -> 400, everything else -> 502. Never contains the token. */
async function linearCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof LinearError) {
      const message = describeLinearError(err);
      throw err.kind === 'validation' ? new ToolInputError(message) : new Error(message);
    }
    throw err;
  }
}

function describeIssue(i: LinearIssue): string {
  const bits = [`${i.identifier} "${i.title}"`, i.state ? `[${i.state.name}]` : '', i.url];
  if (i.labels.length) bits.push(`labels: ${i.labels.map((l) => l.name).join(', ')}`);
  if (i.assignee) bits.push(`assignee: ${i.assignee.name}`);
  return bits.filter(Boolean).join(' ');
}

async function linearListTeams(token: string, _args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  const teams = await linearCall(() => linearClient(token, ctx).listTeams());
  if (teams.length === 0) return 'No Linear teams found.';
  return teams.map((t) => `${t.name} — id: ${t.id} (key: ${t.key})`).join('\n');
}

async function linearListWorkflowStates(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  return linearCall(async () => {
    const c = linearClient(token, ctx);
    const team = await c.resolveTeam(args.teamId);
    const states = await c.listWorkflowStates(team.id);
    return `${team.name} (${team.key}) workflow states:\n` + states.map((s) => `- ${s.name} (${s.type})`).join('\n');
  });
}

async function linearCreateIssue(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  assertParams(args, 'title');
  return linearCall(async () => {
    const c = linearClient(token, ctx);
    const team = await c.resolveTeam(args.teamId); // id, key, name, or the first team when omitted
    const names = (args.labels ?? '').split(',').map((n) => n.trim()).filter(Boolean);
    const labelIds: string[] = [];
    const skipped: string[] = [];
    for (const name of names) {
      try {
        labelIds.push((await c.ensureLabel(team.id, name)).id);
      } catch (err) {
        // Existing labels are used; creating new ones needs a permission the connected app may not have.
        // A missing label must not stop the issue itself, so skip it and say so.
        if (err instanceof LinearError && err.kind === 'validation') skipped.push(name);
        else throw err;
      }
    }
    const { issue, replayed } = await c.createIssue({
      teamId: team.id,
      title: args.title,
      description: args.description?.trim() || undefined,
      labelIds,
      idempotencyKey: args.idempotencyKey?.trim() || undefined,
    });
    const note = skipped.length
      ? ` (labels skipped: ${skipped.join(', ')}. They don't exist and this app isn't allowed to create labels in the team; create them in Linear first.)`
      : '';
    return `${replayed ? 'already existed' : 'created'} ${describeIssue(issue)}${note}`;
  });
}

async function linearGetIssue(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  assertParams(args, 'issueId');
  return linearCall(async () => {
    const issue = await linearClient(token, ctx).getIssue(args.issueId.trim());
    if (!issue) throw new LinearError('not_found', `issue ${args.issueId}`);
    const lines = [describeIssue(issue)];
    if (issue.description) lines.push(`description: ${issue.description.slice(0, 500)}`);
    for (const cm of issue.comments.slice(-5)) lines.push(`comment: ${cm.body.slice(0, 200)}`);
    return lines.join('\n');
  });
}

async function linearUpdateIssueStatus(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  assertParams(args, 'issueId', 'status');
  return linearCall(async () => {
    const { issue, changed } = await linearClient(token, ctx).updateIssueStatus(args.issueId.trim(), args.status);
    return `${changed ? 'moved' : 'already in'} ${issue.state?.name ?? args.status}: ${describeIssue(issue)}`;
  });
}

async function linearCommentOnIssue(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  assertParams(args, 'issueId', 'body');
  return linearCall(async () => {
    const c = linearClient(token, ctx);
    const issue = await c.getIssue(args.issueId.trim());
    if (!issue) throw new LinearError('not_found', `issue ${args.issueId}`);
    // One Linear app posts for everyone, so the agent's name goes in the comment itself.
    const author = args.author?.trim();
    const body = author ? `**${author}:** ${args.body}` : args.body;
    const r = await c.createComment({ issueId: issue.id, body, idempotencyKey: args.idempotencyKey?.trim() || undefined });
    return `${r.replayed ? 'comment already existed on' : 'commented on'} ${issue.identifier}${r.url ? ` ${r.url}` : ''}`;
  });
}

async function linearAddLabel(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  assertParams(args, 'issueId', 'label');
  return linearCall(async () => {
    const c = linearClient(token, ctx);
    const issue = await c.getIssue(args.issueId.trim());
    if (!issue) throw new LinearError('not_found', `issue ${args.issueId}`);
    if (!issue.team) throw new LinearError('validation', 'issue has no team to attach a label to');
    const label = await c.ensureLabel(issue.team.id, args.label.trim());
    await c.addLabel(issue.id, label.id);
    return `labelled ${issue.identifier} with "${label.name}"`;
  });
}

async function linearAssignIssue(token: string, args: Record<string, string>, ctx?: ToolContext): Promise<string> {
  assertParams(args, 'issueId', 'assigneeId');
  return linearCall(async () => {
    const issue = await linearClient(token, ctx).assignIssue(args.issueId.trim(), args.assigneeId.trim());
    return `assigned ${describeIssue(issue)}`;
  });
}

async function vercelListDeployments(token: string, args: Record<string, string>): Promise<string> {
  const projectId = args.projectId?.trim();
  const limit = args.limit?.trim() || '5';
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const url = `https://api.vercel.com/v6/deployments${query}&limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as
    | { deployments?: Array<{ name?: string; url?: string; state?: string; createdAt?: number }> }
    | null;
  if (!res.ok) {
    throw new Error(`Vercel rejected the request (${res.status})`);
  }
  const list = json?.deployments ?? [];
  if (list.length === 0) return 'No deployments found.';
  return list
    .map(
      (d, i) =>
        `${i + 1}. ${d.name ?? 'unknown'} — ${d.url ?? 'no url'} [${d.state ?? 'unknown'}] ${d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}`,
    )
    .join('\n');
}

async function vercelGetUser(token: string): Promise<string> {
  const res = await fetch('https://api.vercel.com/v2/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as
    | { user?: { username?: string; email?: string; name?: string } }
    | null;
  if (!res.ok) {
    throw new Error(`Vercel rejected the request (${res.status})`);
  }
  const u = json?.user;
  return `Vercel user: ${u?.username ?? u?.email ?? 'unknown'} (${u?.name ?? 'no name'})`;
}

async function notionSearchPages(token: string, args: Record<string, string>): Promise<string> {
  assertParams(args, 'query');
  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ query: args.query, page_size: 10 }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as
    | { results?: Array<{ id?: string; object?: string; url?: string; properties?: Record<string, { title?: Array<{ plain_text?: string }> }> }>; message?: string }
    | null;
  if (!res.ok) throw new Error(`Notion search failed (${json?.message ?? res.status})`);
  const results = json?.results ?? [];
  if (results.length === 0) return 'No pages found matching that query.';
  return results.map((r) => {
    const titleProp = r.properties ? Object.values(r.properties).find((p) => p.title) : null;
    const title = titleProp?.title?.[0]?.plain_text ?? r.id ?? 'Untitled';
    return `• ${title} [${r.object}] — ${r.url}`;
  }).join('\n');
}

async function notionCreatePage(token: string, args: Record<string, string>): Promise<string> {
  assertParams(args, 'title');
  // parent must be a page_id or database_id passed as parentId
  const parentId = args.parentId?.trim();
  const parent = parentId
    ? { type: 'page_id', page_id: parentId }
    : null;
  if (!parent) throw new ToolInputError('parentId is required — pass the ID of a parent page or database.');

  const body: Record<string, unknown> = {
    parent,
    properties: {
      title: { title: [{ type: 'text', text: { content: args.title } }] },
    },
  };
  if (args.content) {
    body.children = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: args.content } }] },
      },
    ];
  }
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { id?: string; url?: string; message?: string } | null;
  if (!res.ok) throw new Error(`Notion create page failed (${json?.message ?? res.status})`);
  return `created page ${json?.url ?? json?.id ?? ''}`.trim();
}

async function notionAppendBlock(token: string, args: Record<string, string>): Promise<string> {
  assertParams(args, 'pageId', 'content');
  const res = await fetch(`https://api.notion.com/v1/blocks/${args.pageId}/children`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: args.content } }] },
        },
      ],
    }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { message?: string } | null;
  if (!res.ok) throw new Error(`Notion append block failed (${json?.message ?? res.status})`);
  return `appended content to page ${args.pageId}`;
}

const TOOLS: ServerTool[] = [
  {
    name: 'slack_post_message',
    provider: 'slack',
    description: 'Post a message to a Slack channel as the connected bot.',
    parameters: { channel: 'string (channel id, e.g. C01234567)', text: 'string' },
    run: slackPostMessage,
  },
  {
    name: 'linear_list_teams',
    provider: 'linear',
    description: 'List all Linear teams in the connected workspace, returning each team name, id and key.',
    parameters: {},
    run: linearListTeams,
  },
  {
    name: 'linear_list_workflow_states',
    provider: 'linear',
    description: 'List the workflow states (e.g. Todo, In Progress, Done) of a Linear team.',
    parameters: { teamId: 'string (optional: team id, key or name; defaults to the first team)' },
    run: linearListWorkflowStates,
  },
  {
    name: 'linear_create_issue',
    provider: 'linear',
    description:
      'Create a Linear issue. Omit teamId to use the first team. Pass `labels` as comma-separated names (created if missing). ' +
      'Pass the same idempotencyKey to retry safely: a repeat returns the existing issue instead of creating a duplicate.',
    parameters: {
      title: 'string',
      description: 'string (optional)',
      teamId: 'string (optional: team id, key or name)',
      labels: 'string (optional: comma-separated label names)',
      idempotencyKey: 'string (optional: makes the create safe to retry)',
    },
    run: linearCreateIssue,
  },
  {
    name: 'linear_get_issue',
    provider: 'linear',
    description: 'Read a Linear issue (state, labels, assignee, latest comments) by id or identifier like ENG-12.',
    parameters: { issueId: 'string (id or identifier such as ENG-12)' },
    run: linearGetIssue,
  },
  {
    name: 'linear_update_issue_status',
    provider: 'linear',
    description: 'Move a Linear issue to a workflow state by name ("In Progress", "Done") or common word (todo, review, done, canceled).',
    parameters: { issueId: 'string (id or identifier such as ENG-12)', status: 'string' },
    run: linearUpdateIssueStatus,
  },
  {
    name: 'linear_comment_on_issue',
    provider: 'linear',
    description:
      'Comment on a Linear issue. Pass `author` (e.g. "Mike (Engineer)") so the comment shows which agent wrote it. ' +
      'Pass the same idempotencyKey to retry safely without a duplicate comment.',
    parameters: {
      issueId: 'string (id or identifier such as ENG-12)',
      body: 'string (markdown)',
      author: 'string (optional: agent name shown at the start of the comment)',
      idempotencyKey: 'string (optional: makes the comment safe to retry)',
    },
    run: linearCommentOnIssue,
  },
  {
    name: 'linear_add_label',
    provider: 'linear',
    description: 'Add a label (by name, created in the issue\'s team if missing) to a Linear issue.',
    parameters: { issueId: 'string (id or identifier such as ENG-12)', label: 'string' },
    run: linearAddLabel,
  },
  {
    name: 'linear_assign_issue',
    provider: 'linear',
    description: 'Assign a Linear issue to a workspace member by their Linear user id.',
    parameters: { issueId: 'string (id or identifier such as ENG-12)', assigneeId: 'string (Linear user id)' },
    run: linearAssignIssue,
  },
  {
    name: 'vercel_list_deployments',
    provider: 'vercel',
    description: 'List recent deployments, optionally filtered by project ID.',
    parameters: { projectId: 'string (optional)', limit: 'string (optional, default 5)' },
    run: vercelListDeployments,
  },
  {
    name: 'vercel_get_user',
    provider: 'vercel',
    description: 'Return the authenticated Vercel account username and email.',
    parameters: {},
    run: vercelGetUser,
  },
  {
    name: 'notion_search_pages',
    provider: 'notion',
    description: 'Search for pages and databases in the connected Notion workspace.',
    parameters: { query: 'string' },
    run: notionSearchPages,
  },
  {
    name: 'notion_create_page',
    provider: 'notion',
    description: 'Create a new Notion page inside a parent page or database. Call notion_search_pages first to find the parentId if needed.',
    parameters: {
      title: 'string',
      parentId: 'string (ID of the parent page or database)',
      content: 'string (optional — initial paragraph text)',
    },
    run: notionCreatePage,
  },
  {
    name: 'notion_append_block',
    provider: 'notion',
    description: 'Append a paragraph block to an existing Notion page.',
    parameters: { pageId: 'string', content: 'string' },
    run: notionAppendBlock,
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function getServerTool(name: string): ServerTool | null {
  return BY_NAME.get(name) ?? null;
}

export function listServerTools(): ServerTool[] {
  return TOOLS;
}

/**
 * Expose the server tool catalogue as OpenAI-compatible function declarations.
 * The schema is derived from `parameters` (a map of name → human-readable type
 * string), so adding a tool here is enough to expose it to the model.
 */
export function listServerToolsAsOpenAI(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(Object.keys(t.parameters).map((k) => [k, { type: 'string' }])),
        required: Object.entries(t.parameters).filter(([, d]) => !/optional/i.test(d)).map(([k]) => k),
      },
    },
  }));
}
