import { detectExecutorEnv } from '@/execution/ToolExecutor';
import { toolRegistry } from '@/runtime/ToolRegistry';
import { requestApproval } from './approvals';
import { getDesktopCaps, type DesktopFeature } from './desktopCaps';

/**
 * Typed tools for the agent loop (C0a/C1).
 *
 * Every tool declares:
 *  - tier: 'web'     — safe anywhere (network reads, approved connector actions)
 *          'desktop' — needs the desktop shell (touches the user's folder / runs commands)
 *  - risk: what the action can do, which decides how it is gated
 *
 * The loop is only ever offered tools its environment can actually run, so on
 * the hosted site the model never sees (and can never ask for) a file-write tool.
 */

export type ToolTier = 'web' | 'desktop';
export type ToolRisk = 'read' | 'write' | 'exec' | 'external';

export interface ToolParam {
  description: string;
  required?: boolean;
}

export interface AgentToolResult {
  ok: boolean;
  output: string;
  error?: string;
}

export interface ToolContext {
  taskId: string;
  agentId?: string;
  signal?: AbortSignal;
  /** Called after a successful write so the run can report which files changed. */
  recordWrite?: (path: string) => void;
}

export interface AgentTool {
  name: string;
  description: string;
  tier: ToolTier;
  risk: ToolRisk;
  params: Record<string, ToolParam>;
  /** Desktop shell feature this tool needs; hidden if the installed shell lacks it. */
  requires?: DesktopFeature;
  run(args: Record<string, string>, ctx: ToolContext): Promise<AgentToolResult>;
}

const MAX_OUTPUT = 20_000;
const MAX_CONTENT = 300_000;

const clip = (s: string, n = MAX_OUTPUT): string =>
  s.length > n ? `${s.slice(0, n)}\n…[truncated ${s.length - n} chars]` : s;

function badPath(p: string): string | null {
  if (!p || p.length > 300 || p.includes('\0')) return 'invalid path';
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.split(/[\\/]/).includes('..')) return 'path must be relative to the workspace folder (no absolute paths or "..")';
  return null;
}

/** Split a command line into args, honouring simple "double" and 'single' quotes. */
export function splitArgs(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (cur || has) { out.push(cur); cur = ''; has = false; }
    } else {
      cur += ch;
    }
  }
  if (cur || has) out.push(cur);
  return out;
}

function api() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

const fail = (error: string): AgentToolResult => ({ ok: false, output: '', error });

// ─── desktop tools ───────────────────────────────────────────────────
const listFiles: AgentTool = {
  name: 'list_files',
  description: 'List the files and folders in a directory of the workspace (skips node_modules, .git, build output).',
  tier: 'desktop', risk: 'read', requires: 'fs-list',
  params: { dir: { description: 'Directory relative to the workspace root. Default "."' } },
  async run({ dir }) {
    const d = dir || '.';
    if (d !== '.' && badPath(d)) return fail(badPath(d)!);
    const r = await api()?.fs.list?.(d);
    if (!r) return fail('file listing is not available');
    return r.ok ? { ok: true, output: (r.entries ?? []).join('\n') || '(empty directory)' } : fail(r.error ?? 'list failed');
  },
};

const readFile: AgentTool = {
  name: 'read_file',
  description: 'Read a text file from the workspace.',
  tier: 'desktop', risk: 'read', requires: 'fs',
  params: { path: { description: 'File path relative to the workspace root', required: true } },
  async run({ path }) {
    const bad = badPath(path);
    if (bad) return fail(bad);
    const r = await api()?.fs.read(path);
    if (!r) return fail('file access is not available');
    return r.ok ? { ok: true, output: clip(r.content ?? '') } : fail(r.error ?? 'read failed');
  },
};

const writeFile: AgentTool = {
  name: 'write_file',
  description: 'Create or overwrite a file in the workspace with the full new content. Parent folders are created.',
  tier: 'desktop', risk: 'write', requires: 'fs',
  params: {
    path: { description: 'File path relative to the workspace root', required: true },
    content: { description: 'The complete file content', required: true },
  },
  async run({ path, content }, ctx) {
    const bad = badPath(path);
    if (bad) return fail(bad);
    if (content.length > MAX_CONTENT) return fail(`content too large (${content.length} chars, max ${MAX_CONTENT})`);
    const r = await api()?.fs.write(path, content);
    if (!r) return fail('file access is not available');
    if (!r.ok) return fail(r.error ?? 'write failed');
    ctx.recordWrite?.(path);
    return { ok: true, output: `wrote ${path} (${content.length} chars)` };
  },
};

const searchFiles: AgentTool = {
  name: 'search_files',
  description: 'Search the workspace with a regex (ripgrep). Returns matching lines with file and line number.',
  tier: 'desktop', risk: 'read', requires: 'fs',
  params: {
    pattern: { description: 'Regular expression to search for', required: true },
    dir: { description: 'Directory to search, relative to the workspace root. Default "."' },
  },
  async run({ pattern, dir }) {
    if (dir && dir !== '.' && badPath(dir)) return fail(badPath(dir)!);
    const r = await api()?.fs.search(pattern, dir || '.');
    if (!r) return fail('file access is not available');
    return r.ok ? { ok: true, output: r.output ? clip(r.output) : '(no matches)' } : fail(r.error ?? 'search failed');
  },
};

const runCheck: AgentTool = {
  name: 'run_check',
  description: 'Run a project check in the workspace and return its output. typecheck = tsc --noEmit, lint = eslint, test = vitest run.',
  tier: 'desktop', risk: 'exec', requires: 'checks',
  params: { check: { description: 'One of: typecheck, lint, test', required: true } },
  async run({ check }) {
    if (!['typecheck', 'lint', 'test'].includes(check)) return fail('check must be typecheck, lint or test');
    const r = await api()?.runChecks?.('workspace', check);
    if (!r) return fail('checks are not available');
    const out = clip(r.output ?? '', 6000);
    return r.success
      ? { ok: true, output: out ? `${check} PASSED\n${out}` : `${check} PASSED` }
      : { ok: false, output: out, error: `${check} FAILED${r.error ? ` (${r.error})` : ''}` };
  },
};

const runCommand: AgentTool = {
  name: 'run_command',
  description:
    'Run a command in the workspace. Allowed without asking: npx tsc/eslint/vitest, npm test, npm run lint|test|typecheck|check|build. ' +
    'Other commands (npm install, git status/diff/add/commit, other npm scripts) show the user an approval dialog first. Anything else is refused.',
  tier: 'desktop', risk: 'exec', requires: 'exec',
  params: {
    cmd: { description: 'Executable: npx, npm or git', required: true },
    args: { description: 'Arguments as one string, e.g. "run build" or "commit -m \\"add slugify\\""' },
  },
  async run({ cmd, args }) {
    const list = splitArgs(args ?? '');
    const a = api();
    if (!a) return fail('commands are not available');
    let r = await a.exec.run(cmd, list);
    if (!r.ok && /^denied/.test(r.error ?? '') && a.exec.runApproved) {
      r = await a.exec.runApproved(cmd, list);
    }
    const out = clip(r.output ?? '', 6000);
    return r.ok ? { ok: true, output: out || '(no output)' } : { ok: false, output: out, error: r.error ?? 'command failed' };
  },
};

// ─── tools available on every tier ───────────────────────────────────
const webFetch: AgentTool = {
  name: 'web_fetch',
  description: 'Fetch a public web page and return its text. Public http(s) URLs only; private/internal addresses are blocked.',
  tier: 'web', risk: 'read',
  params: { url: { description: 'Full http(s) URL', required: true } },
  async run({ url }, ctx) {
    try {
      const res = await fetch('/api/tools/web-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: ctx.signal,
      });
      const data = (await res.json().catch(() => null)) as { success?: boolean; text?: string; error?: string; status?: number; url?: string } | null;
      if (!data) return fail(`fetch failed (${res.status})`);
      if (!data.success) return fail(data.error ?? `fetch failed (${data.status ?? res.status})`);
      return { ok: true, output: `URL: ${data.url}\n\n${data.text ?? ''}` };
    } catch (e) {
      return fail(String(e));
    }
  },
};

/** Connector actions leave the sandbox, so each call needs the user's OK (or a standing "always allow"). */
function externalTool(name: string, description: string, params: Record<string, ToolParam>, summarize: (a: Record<string, string>) => string): AgentTool {
  return {
    name, description, tier: 'web', risk: 'external', params,
    async run(args, ctx) {
      const decision = await requestApproval({
        taskId: ctx.taskId,
        agentId: ctx.agentId,
        key: `external:${name}`,
        title: `Allow this agent to ${summarize(args)}?`,
        detail: JSON.stringify(args, null, 2),
        risk: 'external',
      }, ctx.signal);
      if (decision === 'deny') return fail('the user denied this action');
      const r = await toolRegistry.executeTool(name, args);
      return r.success ? { ok: true, output: r.output } : fail(r.error ?? `${name} failed`);
    },
  };
}

const slackPost = externalTool(
  'slack_post_message',
  'Post a message to a connected Slack channel. Requires the user to approve each use.',
  { channel: { description: 'Channel name or id', required: true }, text: { description: 'Message text', required: true } },
  (a) => `post to Slack ${a.channel ?? ''}`,
);

const linearCreate = externalTool(
  'linear_create_issue',
  'Create an issue in a connected Linear team. Requires the user to approve each use.',
  { teamId: { description: 'Linear team id', required: true }, title: { description: 'Issue title', required: true }, description: { description: 'Issue description' } },
  (a) => `create a Linear issue "${(a.title ?? '').slice(0, 60)}"`,
);

export const FINISH_TOOL_NAME = 'finish';
const finish: AgentTool = {
  name: FINISH_TOOL_NAME,
  description: 'Call this when the task is complete (or you cannot make further progress). Give a short, honest summary of what you did and anything left undone.',
  tier: 'web', risk: 'read',
  params: { summary: { description: 'What you did, which files/results matter, and anything unfinished', required: true } },
  async run({ summary }) {
    return { ok: true, output: summary };
  },
};

export const ALL_TOOLS: AgentTool[] = [
  listFiles, readFile, writeFile, searchFiles, runCheck, runCommand,
  webFetch, slackPost, linearCreate,
  finish,
];

/**
 * Tools this environment can run right now. On the hosted site only 'web'
 * tools are returned. On desktop the file/exec tools also require the folder
 * to be chosen and the installed shell to expose the matching feature.
 */
export async function resolveTools(): Promise<AgentTool[]> {
  const caps = await getDesktopCaps();
  const desktopReady = detectExecutorEnv() === 'desktop' && caps.isDesktop && !!caps.workspaceRoot;
  return ALL_TOOLS.filter((t) => {
    if (t.tier === 'web') return true;
    if (!desktopReady) return false;
    return !t.requires || caps.features.has(t.requires);
  });
}

export function describeTools(tools: AgentTool[]): string {
  return tools
    .map((t) => {
      const ps = Object.entries(t.params)
        .map(([k, p]) => `${k}${p.required ? '' : '?'}: ${p.description}`)
        .join('; ');
      return `- ${t.name}(${ps})\n    ${t.description}`;
    })
    .join('\n');
}

/** Coerce a model-provided args object to string params and validate required ones. */
export function normalizeArgs(tool: AgentTool, raw: unknown): { args: Record<string, string> } | { error: string } {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const args: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    if (!(k in tool.params)) continue; // ignore unknown keys rather than failing the step
    if (v === undefined || v === null) continue;
    args[k] = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  const missing = Object.entries(tool.params).filter(([k, p]) => p.required && !(k in args)).map(([k]) => k);
  if (missing.length > 0) return { error: `missing required argument(s): ${missing.join(', ')}` };
  return { args };
}
