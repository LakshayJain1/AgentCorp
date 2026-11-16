// Starts the Next dev server and the Electron shell together, on any OS/shell.
//
//   npm run desktop:dev            -> next dev + Electron (waits for the server)
//   npm run dev --prefix desktop   -> Electron only (server already running)
//
// Replaces `concurrently "next dev" ...` and `NODE_ENV=development electron .`,
// which only work in POSIX shells and need an extra dependency.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopDir = path.join(root, 'desktop');
const electronOnly = process.argv.includes('--electron-only');
const isWin = process.platform === 'win32';
const URL_TO_WAIT_FOR = 'http://localhost:3000/';

const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    try {
      // On Windows the dev server is started through a shell, so kill the whole tree.
      if (isWin) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGTERM');
    } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(code), 400);
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve((res.statusCode ?? 500) < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (stopping) return false;
    if (await ping(URL_TO_WAIT_FOR)) return true;
    await new Promise((r) => setTimeout(r, 750));
  }
  return false;
}

function resolveElectron() {
  try {
    const req = createRequire(path.join(desktopDir, 'package.json'));
    return req('electron'); // the electron executable path
  } catch {
    console.error('\n[desktop-dev] Electron is not installed. Run:  npm run desktop:install\n');
    process.exit(1);
  }
}

function startElectron() {
  const electronPath = resolveElectron();
  const child = spawn(electronPath, ['.'], {
    cwd: desktopDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });
  children.push(child);
  child.on('exit', (code) => stopAll(code ?? 0));
  child.on('error', (err) => { console.error('[desktop-dev] could not start Electron:', err.message); stopAll(1); });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

if (electronOnly) {
  startElectron();
} else {
  if (await ping(URL_TO_WAIT_FOR)) {
    console.log('[desktop-dev] a dev server is already running on :3000, reusing it');
  } else {
    const next = spawn('npx next dev', { cwd: root, stdio: 'inherit', shell: true });
    children.push(next);
    next.on('exit', (code) => { if (!stopping) { console.error(`[desktop-dev] next dev exited (${code})`); stopAll(code ?? 1); } });
    console.log('[desktop-dev] starting the Next dev server…');
  }
  if (await waitForServer()) {
    console.log('[desktop-dev] server is up, launching the desktop app');
    startElectron();
  } else if (!stopping) {
    console.error('[desktop-dev] the dev server did not respond within 2 minutes');
    stopAll(1);
  }
}
