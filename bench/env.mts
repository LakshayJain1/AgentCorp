/**
 * The benchmark's stand-in for the desktop shell: a temp workspace folder plus a
 * fake `window.electronAPI` with the same shapes and the same confinement rules
 * as desktop/main.js (relative paths only, nothing outside the workspace), and a
 * tiny local web server so research tasks never depend on the live internet.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export interface Workspace {
  dir: string; // workspace root (what the agent sees as ".")
  parent: string; // one level up: used to plant files the agent must NOT reach
  read(rel: string): string | null;
  exists(rel: string): boolean;
  sha(rel: string): string | null;
  write(rel: string, content: string): void;
  /** Run `node --test <files>` in the workspace (default: everything). */
  nodeTest(files?: string[]): { ok: boolean; output: string };
  cleanup(): void;
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

export function createWorkspace(files: Record<string, string>): Workspace {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcorp-bench-'));
  const dir = path.join(parent, 'ws');
  fs.mkdirSync(dir, { recursive: true });
  const put = (rel: string, content: string) => {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  };
  for (const [rel, content] of Object.entries(files)) put(rel, content);
  return {
    dir,
    parent,
    read: (rel) => {
      try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { return null; }
    },
    exists: (rel) => fs.existsSync(path.join(dir, rel)),
    sha: (rel) => {
      try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex'); } catch { return null; }
    },
    write: put,
    nodeTest: (list) => {
      const r = spawnSync(process.execPath, ['--test', ...(list ?? [])], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 60_000,
        env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' } as unknown as NodeJS.ProcessEnv,
      });
      return { ok: r.status === 0, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
    },
    cleanup: () => {
      try { fs.rmSync(parent, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}

/** Same rule as resolveWorkspacePath in desktop/main.js, minus symlink handling (the bench creates none). */
function confined(ws: Workspace, rel: unknown): string | null {
  if (typeof rel !== 'string') return null;
  const abs = path.resolve(ws.dir, rel || '.');
  const back = path.relative(ws.dir, abs);
  return back === '' || (!back.startsWith('..') && !path.isAbsolute(back)) ? abs : null;
}

const DENIED = 'denied: outside workspace or no workspace set';

function walk(dir: string, out: string[], base: string): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out, base);
    else out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
}

export function installElectronApi(ws: Workspace): void {
  const test = () => {
    const r = ws.nodeTest();
    return { success: r.ok, output: r.output.slice(-6000), error: r.ok ? undefined : 'tests failed' };
  };
  const api = {
    runChecks: async (_id: string, check: string) => {
      if (check === 'test') return { ...test(), check };
      return { success: false, check, output: '', error: `no ${check} configuration in this workspace` };
    },
    fs: {
      read: async (rel: string) => {
        const abs = confined(ws, rel);
        if (!abs) return { ok: false, error: DENIED };
        try { return { ok: true, content: fs.readFileSync(abs, 'utf8') }; } catch (e) { return { ok: false, error: String(e) }; }
      },
      write: async (rel: string, content: string) => {
        const abs = confined(ws, rel);
        if (!abs) return { ok: false, error: DENIED };
        try {
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, content, 'utf8');
          return { ok: true };
        } catch (e) { return { ok: false, error: String(e) }; }
      },
      list: async (rel: string) => {
        const abs = confined(ws, rel || '.');
        if (!abs) return { ok: false, error: DENIED };
        try {
          const entries = fs.readdirSync(abs, { withFileTypes: true })
            .filter((e) => !SKIP.has(e.name))
            .slice(0, 300)
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
          return { ok: true, entries };
        } catch (e) { return { ok: false, error: String(e) }; }
      },
      search: async (pattern: string, rel: string) => {
        const abs = confined(ws, rel || '.');
        if (!abs) return { ok: false, error: DENIED };
        let re: RegExp;
        try { re = new RegExp(pattern); } catch { return { ok: false, error: 'invalid pattern' }; }
        const files: string[] = [];
        walk(abs, files, ws.dir);
        const out: string[] = [];
        for (const f of files) {
          let text: string;
          try { text = fs.readFileSync(path.join(ws.dir, f), 'utf8'); } catch { continue; }
          text.split(/\r?\n/).forEach((line, i) => {
            if (out.length < 50 && re.test(line)) out.push(`${f}:${i + 1}:${line}`);
          });
        }
        return { ok: true, output: out.join('\n').slice(0, 8000) };
      },
    },
    exec: {
      // Mirrors the tier-1 allowlist: tests run, everything else is refused (no approval UI in a headless run).
      run: async (cmd: string, args: string[]) => {
        const line = [cmd, ...args].join(' ');
        if (/^(npm test|npm run test|npx vitest run|npx vitest)$/.test(line)) {
          const r = test();
          return r.success ? { ok: true, output: r.output } : { ok: false, output: r.output, error: 'command failed' };
        }
        return { ok: false, error: `denied: '${cmd}' with these arguments is not allowed` };
      },
    },
  };
  (globalThis as unknown as { window: unknown }).window = { electronAPI: api };
}

// ─── fixture web server ───────────────────────────────────────────────
export interface FixturePage { status?: number; type?: string; body: string }
export interface Fixture { base: string; close(): Promise<void> }

export async function startFixtureServer(pages: Record<string, FixturePage>): Promise<Fixture> {
  const server = http.createServer((req, res) => {
    const p = (req.url ?? '/').split('?')[0];
    const page = pages[p];
    if (!page) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    res.writeHead(page.status ?? 200, { 'Content-Type': page.type ?? 'text/html; charset=utf-8' });
    res.end(page.body);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) };
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * The real web_fetch tool posts to the app's /api/tools/web-fetch route (which
 * deliberately refuses localhost). In the bench that route is replaced by this
 * handler, which only reaches the fixture server, so runs are repeatable and
 * can't wander onto the real internet.
 */
export function installWebFetch(
  getBase: () => string | null,
  getSearch: (query: string) => { title: string; url: string; snippet: string }[] | null = () => null,
): void {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (u === '/api/tools/web-search') {
      const { query } = JSON.parse(String(init?.body ?? '{}')) as { query?: string };
      const results = query ? getSearch(query) : null;
      return results
        ? Response.json({ success: true, provider: 'fixture', query, results })
        : Response.json({ success: false, code: 'not_configured', error: 'Web search is not set up on this server.' }, { status: 503 });
    }
    if (u !== '/api/tools/web-fetch') return realFetch(input as RequestInfo, init);
    const { url } = JSON.parse(String(init?.body ?? '{}')) as { url?: string };
    const base = getBase();
    if (!url || !base || !url.startsWith(base)) {
      return Response.json({ success: false, error: 'blocked: only the benchmark fixture pages are reachable in this run' });
    }
    const r = await realFetch(url);
    const text = htmlToText(await r.text());
    return Response.json(r.ok ? { success: true, url, status: r.status, text } : { success: false, status: r.status, error: `fetch failed (${r.status})` });
  }) as typeof fetch;
}
