import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, relative, sep, dirname } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

const WORKSPACE = process.env.PROJECT_ROOT || process.cwd();

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { tool, params } = await req.json();
    const timestamp = new Date().toISOString().slice(11, 19);
    if (tool === 'write_file') {
      console.log(`[API:tool] ${timestamp} write_file path=${params.path} content=${(params.content || '').length}chars`);
    } else if (tool === 'execute_command') {
      console.log(`[API:tool] ${timestamp} execute_command: ${(params.command || '').slice(0, 80)}`);
    } else if (tool === 'ask_agent') {
      // Don't log full AI prompts — too verbose
    } else {
      console.log(`[API:tool] ${timestamp} ${tool} ${JSON.stringify(params).slice(0, 120)}`);
    }

    switch (tool) {
      case 'read_file': {
        const resolved = join(WORKSPACE, params.path);
        if (!resolved.startsWith(WORKSPACE)) {
          return NextResponse.json({ success: false, output: 'Path traversal denied' });
        }
        try {
          const content = await readFile(resolved, 'utf-8');
          return NextResponse.json({ success: true, output: content });
        } catch {
          // File doesn't exist yet — return empty, not error
          return NextResponse.json({ success: true, output: '' });
        }
      }

      case 'write_file': {
        const resolved = join(WORKSPACE, params.path);
        if (!resolved.startsWith(WORKSPACE)) {
          return NextResponse.json({ success: false, output: 'Path traversal denied' });
        }
        const content = params.content || '';
        if (content.trim().length === 0) {
          return NextResponse.json({ success: false, output: 'Refusing to write empty file' });
        }
        if (content.length < 50) {
          return NextResponse.json({ success: false, output: `Content too short (${content.length} chars), likely AI error` });
        }
        await mkdir(dirname(resolved), { recursive: true });
        await writeFile(resolved, content, 'utf-8');
        return NextResponse.json({ success: true, output: `Written ${content.length} bytes to ${params.path}` });
      }

      case 'search_files': {
        function walk(dir: string, depth = 0): string[] {
          if (depth > 3) return [];
          const results: string[] = [];
          try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
              if (e.name.startsWith('.') || e.name === 'node_modules') continue;
              const full = join(dir, e.name);
              if (e.isDirectory()) {
                results.push(...walk(full, depth + 1));
              } else {
                results.push(full.replace(WORKSPACE + '/', ''));
              }
            }
          } catch { /* skip */ }
          return results;
        }
        const pattern = params.pattern || '';
        const allFiles = walk(WORKSPACE);
        const filtered = pattern
          ? allFiles.filter((f) => f.toLowerCase().includes(pattern.toLowerCase()))
          : allFiles;
        return NextResponse.json({
          success: true,
          output: filtered.slice(0, 100).join('\n'),
        });
      }

      case 'read_directory': {
        const resolved = join(WORKSPACE, params.path || '.');
        if (!resolved.startsWith(WORKSPACE)) {
          return NextResponse.json({ success: false, output: 'Path traversal denied' });
        }
        const entries = await readdir(resolved, { withFileTypes: true });
        const listing = entries.map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
        return NextResponse.json({ success: true, output: listing });
      }

      case 'execute_command': {
        const safeCommands = ['ls', 'cat', 'head', 'tail', 'wc', 'node', 'npm', 'npx', 'tsc', 'pwd', 'echo', 'grep', 'find', 'diff', 'stat', 'du', 'df', 'ps', 'top'];
        const cmd = params.command || '';
        const cmdName = cmd.split(/\s+/)[0];
        if (!safeCommands.some((s) => cmd.startsWith(s))) {
          return NextResponse.json({ success: false, output: `Command '${cmdName}' not in allowed list: ${safeCommands.join(', ')}` });
        }
        const output = execSync(cmd, {
          cwd: params.workdir ? join(WORKSPACE, params.workdir) : WORKSPACE,
          encoding: 'utf-8',
          timeout: 10000,
          maxBuffer: 1024 * 1024,
          shell: '/bin/sh',
        });
        return NextResponse.json({ success: true, output: output.slice(0, 10000) });
      }

      case 'search_codebase': {
        const pattern = params.pattern || '';
        const include = params.include || '';
        const isContentSearch = pattern.length > 0;

        function walk(dir: string, depth = 0): string[] {
          if (depth > 4) return [];
          const results: string[] = [];
          try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
              if (e.name.startsWith('.') || e.name === 'node_modules') continue;
              const full = join(dir, e.name);
              if (e.isDirectory()) {
                results.push(...walk(full, depth + 1));
              } else {
                const relPath = relative(WORKSPACE, full);
                if (!relPath.startsWith('..')) {
                  results.push(relPath);
                }
              }
            }
          } catch { /* skip */ }
          return results;
        }

        const allFiles = walk(WORKSPACE);
        let filtered = include
          ? allFiles.filter((f) => f.endsWith(include))
          : allFiles;

        if (isContentSearch) {
          const regex = new RegExp(pattern, 'i');
          const matched: string[] = [];
          for (const f of filtered.slice(0, 100)) {
            try {
              const content = readFileSync(join(WORKSPACE, f), 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  matched.push(`${f}:${i + 1}: ${lines[i].trim().slice(0, 100)}`);
                }
              }
              if (matched.length > 50) break;
            } catch { /* skip unreadable */ }
          }
          return NextResponse.json({ success: true, output: matched.slice(0, 50).join('\n') });
        }

        return NextResponse.json({ success: true, output: filtered.slice(0, 50).join('\n') });
      }

      default:
        return NextResponse.json({ success: false, output: `Unknown tool: ${tool}` });
    }
    const duration = Date.now() - startTime;
    console.log(`[API:tool] ${tool} done in ${duration}ms`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[API:tool] ERROR: ${message}`);
    return NextResponse.json({ success: false, output: `Error: ${message}` });
  }
}
