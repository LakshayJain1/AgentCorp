import 'server-only';

import type { ProviderId } from './providers/types';

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

export interface ServerTool {
  name: string;
  provider: ProviderId;
  description: string;
  /** Same shape as AgentTypes.ToolDefinition.parameters. */
  parameters: Record<string, string>;
  run(token: string, args: Record<string, string>): Promise<string>;
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

async function linearListTeams(token: string): Promise<string> {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ teams { nodes { id name key } } }` }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as
    | { data?: { teams?: { nodes?: { id: string; name: string; key: string }[] } }; errors?: { message?: string }[] }
    | null;
  if (!res.ok || json?.errors?.length) {
    throw new Error(`Linear team fetch failed (${json?.errors?.[0]?.message ?? res.status})`);
  }
  const teams = json?.data?.teams?.nodes ?? [];
  if (teams.length === 0) return 'No Linear teams found.';
  return teams.map((t) => `${t.name} — id: ${t.id} (key: ${t.key})`).join('\n');
}

async function linearCreateIssue(token: string, args: Record<string, string>): Promise<string> {
  assertParams(args, 'title');
  // If teamId not provided, auto-pick the first team
  let teamId = args.teamId?.trim();
  if (!teamId) {
    const teamsText = await linearListTeams(token);
    const match = teamsText.match(/id:\s*([a-f0-9-]{36})/i);
    if (!match) throw new ToolInputError('No Linear teams found — connect a workspace first.');
    teamId = match[1];
  }
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }`,
      variables: {
        input: {
          teamId,
          title: args.title,
          ...(args.description ? { description: args.description } : {}),
        },
      },
    }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as
    | {
        data?: { issueCreate?: { success?: boolean; issue?: { identifier?: string; url?: string } } };
        errors?: { message?: string }[];
      }
    | null;
  if (!res.ok || json?.errors?.length) {
    throw new Error(`Linear rejected the issue (${json?.errors?.[0]?.message ?? res.status})`);
  }
  const issue = json?.data?.issueCreate?.issue;
  if (!json?.data?.issueCreate?.success || !issue) {
    throw new Error('Linear did not create the issue');
  }
  return `created ${issue.identifier ?? 'issue'} ${issue.url ?? ''}`.trim();
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
    description: 'List all Linear teams in the connected workspace, returning each team name and id.',
    parameters: {},
    run: linearListTeams,
  },
  {
    name: 'linear_create_issue',
    provider: 'linear',
    description: 'Create a Linear issue. Call linear_list_teams first if you do not know the teamId — or omit teamId to auto-pick the first team.',
    parameters: { title: 'string', description: 'string (optional)', teamId: 'string (optional — auto-picked if omitted)' },
    run: linearCreateIssue,
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
        required: Object.keys(t.parameters),
      },
    },
  }));
}
