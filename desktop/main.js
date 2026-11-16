const { app, BrowserWindow, ipcMain: rawIpcMain, shell, session, Menu, dialog, safeStorage, powerSaveBlocker, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { fileURLToPath } = require('url');
const { execFile } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';
// Allow override via env at runtime: AGENTCORP_WEB_URL="https://<your-app>.vercel.app"
// Default is the live deployment (update here when the production URL changes).
const WEB_URL = (process.env.AGENTCORP_WEB_URL || '').replace(/\/+$/, '')
  || (isDev ? 'http://localhost:3000' : 'https://agent-corp.vercel.app');
const DEEP_LINK_SCHEME = 'agentcorp';

let mainWindow = null;

// ─── Debug log ──────────────────────────────────────────────────────
// Startup diagnostics: %APPDATA%/AgentCorp/agentcorp-debug.log on Windows.
let logFile = null;
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => {
    try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
  }).join(' ')}`;
  try {
    if (!logFile) logFile = path.join(app.getPath('userData'), 'agentcorp-debug.log');
    fs.appendFileSync(logFile, line + '\n');
  } catch { /* logging must never crash startup */ }
  console.log('[AgentCorp]', ...args);
}

// ─── Trust helpers (bugs #1, #2, #11) ────────────────────────────────
const WEB_ORIGIN = (() => { try { return new URL(WEB_URL).origin; } catch { return ''; } })();

// Exact-origin match. Never use substring checks on URLs.
function isWebUrl(u) {
  try { return new URL(u).origin === WEB_ORIGIN; } catch { return false; }
}
// Pages allowed inside the privileged window: our web app only (sign-in is
// the in-app email-code form, so no identity-provider pages are ever needed).
// Everything else is opened in the system browser.
function isTrustedNavigation(u) {
  try {
    const o = new URL(u).origin;
    return o === WEB_ORIGIN;
  } catch { return false; }
}
// Clerk (our sign-in provider) runs in development mode on the hosted site, where a new
// browser is bounced once through its handshake endpoint on `<instance>.clerk.accounts.dev`
// and straight back. Without this exception the shell refuses the first hop and the sign-in
// button just reloads the launcher. The exception is deliberately narrow: HTTPS, a Clerk dev
// host, and exactly the handshake path. Any hop after it (e.g. a hostile redirect_url) still
// has to pass the normal allowlist.
function isClerkHandshake(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'https:'
      && p.port === ''
      && !p.username && !p.password
      && /^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(p.hostname)
      && p.pathname === '/v1/client/handshake';
  } catch { return false; }
}
function isLocalPage(u) {
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'file:') return false;
    const p = path.resolve(fileURLToPath(parsed));
    return p === path.join(__dirname, 'signin.html') || p === path.join(__dirname, 'index.html');
  } catch { return false; }
}
function openExternalSafe(u) {
  try {
    const parsed = new URL(u);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) shell.openExternal(u);
  } catch { /* ignore */ }
}
// Redirect targets arriving from deep links must be same-origin paths.
function safeRedirectPath(r) {
  const fallback = '/workspace';
  if (typeof r !== 'string' || !r.startsWith('/') || r.startsWith('//') || r.includes('\\')) return fallback;
  try {
    const u = new URL(r, WEB_ORIGIN);
    return u.origin === WEB_ORIGIN ? u.pathname + u.search : fallback;
  } catch { return fallback; }
}

// IPC is only honoured from the top frame of a trusted page. `webOnly`
// channels (fs/exec/keys/workspace) are never served to the local launcher.
const ipcMain = {
  handle(channel, fn, { webOnly = true } = {}) {
    rawIpcMain.handle(channel, (event, ...args) => {
      const frame = event.senderFrame;
      const url = frame && frame.url;
      const isTop = !!frame && !!event.sender && frame === event.sender.mainFrame;
      const ok = isTop && (isWebUrl(url) || (!webOnly && isLocalPage(url)));
      if (!ok) {
        log('IPC denied:', channel, 'from', url);
        throw new Error('denied: untrusted sender');
      }
      return fn(event, ...args);
    });
  },
};

// Env passed to child processes: never leak tokens / keys to repo scripts.
function safeEnv() {
  const out = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/(KEY|TOKEN|SECRET|PASSWORD|AUTH0|CLERK|CREDENTIAL)/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

// A deep link can arrive before the window exists (cold start via protocol on
// Windows/Linux passes the URL in process.argv; on macOS via open-url). Stash
// it and process once the window is ready.
let pendingDeepLink = null;

function handleDeepLinkArgv(argv) {
  if (!Array.isArray(argv)) return;
  const url = argv.find((arg) => typeof arg === 'string' && arg.startsWith(`${DEEP_LINK_SCHEME}://`));
  if (!url) return;
  if (app.isReady() && mainWindow && !mainWindow.isDestroyed()) handleDeepLink(url);
  else pendingDeepLink = url;
}

// Cold-start check: only stash here — processed in whenReady.
handleDeepLinkArgv(process.argv);

// ─── Sign-in ─────────────────────────────────────────────────────────
// Sign-in is the web app's own email-code form (Clerk), shown right inside this
// window — no system browser, no cookie hand-off. Clerk stores the session in
// this window's normal cookie jar, so it persists across launches.
async function startBrowserSignin() {
  loadWorkspace('/onboard');
}

const SESSION_COOKIE_RE = /^__session(__\d{1,2})?$/;

async function hasWebSession() {
  try {
    const all = await session.defaultSession.cookies.get({ url: WEB_ORIGIN });
    return all.some((c) => SESSION_COOKIE_RE.test(c.name));
  } catch { return false; }
}

// ─── Encrypted persistent storage (bug #9) ──────────────────────────
// Secrets are encrypted with the OS keystore (DPAPI / Keychain / libsecret).
// Legacy plaintext files are still readable and get upgraded on next write.
function readSecure(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (raw && raw.__enc === 1 && typeof raw.data === 'string') {
      if (!safeStorage.isEncryptionAvailable()) return null;
      return JSON.parse(safeStorage.decryptString(Buffer.from(raw.data, 'base64')));
    }
    return raw; // legacy plaintext
  } catch { return null; }
}

function writeSecure(file, obj) {
  const json = JSON.stringify(obj);
  if (!safeStorage.isEncryptionAvailable()) {
    log('safeStorage unavailable — refusing to persist secret in plaintext');
    return false;
  }
  const data = safeStorage.encryptString(json).toString('base64');
  fs.writeFileSync(file, JSON.stringify({ __enc: 1, data }), { mode: 0o600 });
  return true;
}

// ─── Persistent auth storage ────────────────────────────────────────
const authPath = path.join(app.getPath('userData'), 'auth.json');

function loadAuth() { return readSecure(authPath); }
function saveAuth(data) { return writeSecure(authPath, data); }
function clearAuth() { try { fs.unlinkSync(authPath); } catch { /* ignore */ } }

// ─── Deep link handling ─────────────────────────────────────────────
// Anything can launch agentcorp:// links (web pages, other apps), so both
// flows are bound to state we generated (bug #6) and redirect targets are
// restricted to same-origin paths (bug #1).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function handleDeepLink(url) {
  if (!url || typeof url !== 'string' || !url.startsWith(`${DEEP_LINK_SCHEME}://`)) return false;

  let parsed;
  try { parsed = new URL(url); } catch { return false; }

  // No deep-link actions are supported: sign-in happens inside this window.
  return false;
}

function loadWorkspace(redirect) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(`${WEB_ORIGIN}${safeRedirectPath(redirect)}`);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

// Single-instance + deep-link wiring is registered at module level so no
// protocol launch is ever missed, even before ready.
if (process.platform === 'win32' || process.platform === 'linux') {
  const gotLock = app.requestSingleInstanceLock();
  log('single-instance lock acquired=', gotLock);
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, commandLine) => {
      if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
      handleDeepLinkArgv(commandLine);
      if (pendingDeepLink && mainWindow && !mainWindow.isDestroyed()) {
        const url = pendingDeepLink;
        pendingDeepLink = null;
        handleDeepLink(url);
      }
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
      }
    });
  }
}

// macOS: protocol URLs arrive via open-url after app is ready.
app.on('open-url', (event, url) => {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) handleDeepLink(url);
  else pendingDeepLink = url;
});

function loadErrorPage(targetUrl, errorDescription) {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeUrl = esc(targetUrl || WEB_URL);
  const safeErr = esc(errorDescription || 'The page could not be loaded.');
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>AgentCorp — Connection Error</title></head>
    <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#FAFBFD;color:#1c1c1e;">
      <div style="text-align:center;max-width:420px;padding:24px;">
        <div style="font-size:40px;margin-bottom:12px;">🔌</div>
        <h2 style="margin:0 0 8px;">Could not reach the AgentCorp web app</h2>
        <p style="font-size:13px;color:#666;margin:0 0 6px;">Tried to load:<br><code>${safeUrl}</code></p>
        <p style="font-size:13px;color:#666;">${safeErr}</p>
        <p style="font-size:12px;color:#999;">If you just deployed, wait a minute and retry. In development, make sure <code>next dev</code> is running on port 3000.</p>
        <button onclick="location.href='${esc(WEB_URL)}/workspace'" style="margin-top:12px;padding:10px 24px;border-radius:999px;border:none;background:#0A84FF;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Retry</button>
      </div>
    </body></html>`)}`;
}

// ─── Window creation ────────────────────────────────────────────────
function toggleDevTools() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDevToolsOpened()) mainWindow.webContents.closeDevTools();
  else mainWindow.webContents.openDevTools({ mode: 'bottom' });
}

function createMainWindow() {
  Menu.setApplicationMenu(null);

  const titleBarStyle = process.platform === 'darwin' ? 'hiddenInset' : 'hidden';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'AgentCorp',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle,
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, // bug #11 — preload only needs contextBridge/ipcRenderer
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Agent runs live in the renderer; Chromium must not throttle its timers
      // when the window is hidden or minimised (C0c).
      backgroundThrottling: false,
    },
    show: true,
    backgroundColor: '#FAFBFD',
  });

  // Spoof a standard Chrome UA — removes the Electron identifier that Google
  // uses to detect embedded WebViews and block OAuth flows.
  const chromeVersion = process.versions.chrome || '120.0.0.0';
  mainWindow.webContents.setUserAgent(
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  );

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getURL() : '(gone)';
    log('did-finish-load:', url);
  });

  // ── Navigation allowlist (bug #2) ────────────────────────────────────
  // The window carries the privileged preload bridge, so it may only ever
  // show our web origin or local launcher files.
  // Anything else is sent to the user's real browser. Exact-origin matching
  // only — substring checks are bypassable (evil.com/?x=our-host).
  const showLauncher = (why) => {
    log(why);
    setImmediate(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadFile(path.join(__dirname, 'signin.html')); });
  };
  const guardNavigation = (event, url, isRedirect) => {
    let parsed;
    try { parsed = new URL(url); } catch { event.preventDefault(); return; }
    if (isTrustedNavigation(url) || isLocalPage(url) || isClerkHandshake(url)) return;
    event.preventDefault();
    // Log where it was headed (host + path only: query strings can carry tokens).
    const where = `${parsed.origin}${parsed.pathname}`;
    if (isRedirect) { showLauncher(`blocked untrusted redirect to ${where} — showing launcher`); return; }
    log(`blocked navigation to untrusted URL ${where}`);
    openExternalSafe(url);
  };
  mainWindow.webContents.on('will-navigate', (e, url) => guardNavigation(e, url, false));
  mainWindow.webContents.on('will-redirect', (e, url) => guardNavigation(e, url, true));

  // New windows are never created with our preload: trusted URLs load in the
  // main window, everything else opens in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedNavigation(url)) {
      setImmediate(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(url); });
    } else {
      openExternalSafe(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  // DevTools only in development (bug #11), or when explicitly enabled.
  const devtoolsAllowed = isDev || process.env.AGENTCORP_DEVTOOLS === '1';
  if (devtoolsAllowed) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) toggleDevTools();
    });
  }

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('RENDERER CRASHED:', JSON.stringify(details));
  });

  // C0c: closing the window mid-run must not silently kill the run.
  mainWindow.on('close', (event) => {
    if (forceQuit || activeRunCount === 0) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Keep running in the background', 'Quit and stop the run', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'AgentCorp',
      message: 'An agent run is still in progress',
      detail: 'Hide the window and let it finish, or quit now and lose the run in progress.',
    });
    if (choice === 0) { ensureTray(); mainWindow.hide(); }
    else if (choice === 1) { forceQuit = true; app.quit(); }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Never leave the user staring at a blank white window.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (isMainFrame === false || errorCode === -3) return; // subframe failure or aborted navigation
    log('did-fail-load:', errorCode, errorDescription, validatedURL);
    mainWindow.loadURL(loadErrorPage(validatedURL, errorDescription));
  });

  const signinHtml = path.join(__dirname, 'signin.html');

  // Only go straight to the workspace if this window actually holds a web
  // session cookie; otherwise show the launcher (never a login redirect loop).
  hasWebSession().then((ok) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (ok) {
      log('startup: web session found, loading workspace');
      mainWindow.loadURL(`${WEB_ORIGIN}/workspace`);
    } else {
      log('startup: no web session, showing sign-in launcher');
      mainWindow.loadFile(signinHtml);
    }
  });

  return mainWindow;
}

// ─── IPC handlers ───────────────────────────────────────────────────
// Auth channels are reachable from the local launcher; everything else is
// restricted to the web app origin (see ipcMain.handle above).
const LOCAL_OK = { webOnly: false };

ipcMain.handle('auth:get-token', () => {
  const auth = loadAuth();
  return auth?.accessToken || auth?.token || null;
});

ipcMain.handle('auth:is-authenticated', () => {
  const auth = loadAuth();
  if (!auth) return false;
  if (auth.expiresAt) return Date.now() < auth.expiresAt;
  return !!(auth.accessToken || auth.token);
}, LOCAL_OK);

ipcMain.handle('auth:logout', async () => {
  clearAuth();
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { await session.defaultSession.clearStorageData(); } catch { /* ignore */ }
    mainWindow.loadFile(path.join(__dirname, 'signin.html'));
  }
}, LOCAL_OK);

ipcMain.handle('auth:start-browser-signin', () => {
  // Loads the in-app email-code sign-in inside this window.
  return startBrowserSignin();
}, LOCAL_OK);

ipcMain.handle('auth:open-browser', (_event, url) => {
  openExternalSafe(url);
}, LOCAL_OK);

// ipcVersion lets the hosted web app (which updates instantly) tell when this
// installed shell is too old for a tool, instead of failing mid-run (C0d).
//   1 = fs read/write/search, allowlisted exec, BYOK keys
//   2 = + fs:list, exec:run-approved (native approval), runs:set-active, checks on the picked folder
//   3 = + direct BYOK calls from the main process (ai:*); the old apikey:get is gone
const IPC_VERSION = 3;
const IPC_FEATURES = ['fs', 'fs-list', 'exec', 'exec-approved', 'checks', 'runs', 'ai'];

ipcMain.handle('app:get-info', () => ({
  platform: process.platform,
  version: app.getVersion(),
  isDev,
  webUrl: WEB_URL,
  ipcVersion: IPC_VERSION,
  features: IPC_FEATURES,
}), LOCAL_OK);

// ─── Allowlisted command runner (bugs #3, #4) ───────────────────────
// Deny by default. Only fixed tools (tsc / eslint / vitest via `npx
// --no-install`, and `npm test` / `npm run <script>`) run, with strictly
// validated arguments. No node, no -e/--require/--pre style flags, no
// absolute or parent-relative paths. Args are charset-restricted so running
// through a shell (needed for npx.cmd on Windows) cannot be injected.
const SAFE_ARG = /^[A-Za-z0-9_.\/=,:@+-]+$/;
const BLOCKED_FLAG = /^-{1,2}(e|eval|print|r|require|import|loader|pre|pre-glob|config|c|inspect.*|experimental.*|node-options|prefix|cache|userconfig|globalconfig|registry|script-shell|ignore-scripts=false)(=|$)/i;
const NPX_TOOLS = new Set(['tsc', 'eslint', 'vitest']);
const NPM_SCRIPTS = new Set(['lint', 'test', 'typecheck', 'check', 'build']);

function argsAreSafe(args) {
  if (!Array.isArray(args) || args.length > 24) return false;
  return args.every((a) => {
    if (typeof a !== 'string' || a.length === 0 || a.length > 200 || !SAFE_ARG.test(a)) return false;
    if (BLOCKED_FLAG.test(a)) return false;
    const value = a.includes('=') ? a.slice(a.indexOf('=') + 1) : a;
    if (value.split('/').includes('..')) return false;
    if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
    return true;
  });
}

function resolveAllowedCommand(cmd, args) {
  args = Array.isArray(args) ? args : [];
  if (!argsAreSafe(args)) return null;
  let tool = cmd;
  let rest = args;
  if (cmd === 'npx') { tool = args[0]; rest = args.slice(1); }
  if (NPX_TOOLS.has(tool)) {
    return { file: 'npx', args: ['--no-install', tool, ...rest] };
  }
  if (cmd === 'npm') {
    if (args.length === 1 && args[0] === 'test') return { file: 'npm', args: ['test'] };
    if (args.length === 2 && args[0] === 'run' && NPM_SCRIPTS.has(args[1])) return { file: 'npm', args };
  }
  return null;
}

function runAllowed(spec, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: `timeout after ${timeoutMs / 1000}s` }), timeoutMs + 5000);
    // shell:true only on Windows, where npx/npm are .cmd shims that Node will
    // not spawn directly; arguments are already charset-validated above.
    execFile(spec.file, spec.args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 512,
      env: safeEnv(),
      windowsHide: true,
      // npm/npx are .cmd shims on Windows and need a shell; git does not, and a
      // shell would split commit messages on spaces.
      shell: spec.shell !== undefined ? spec.shell : process.platform === 'win32',
    }, (err, stdout, stderr) => {
      clearTimeout(timer);
      const out = `${stdout || ''}${stderr || ''}`.slice(-4000);
      if (err) return resolve({ ok: false, output: out, error: `exit ${err.code ?? '?'}` });
      resolve({ ok: true, output: out.slice(-2000) });
    });
  });
}

// ─── P3b: local checks runner (desktop only) ─────────────────────────
const ALLOWED_CHECKS = {
  typecheck: { cmd: 'npx', args: ['tsc', '--noEmit'] },
  lint: { cmd: 'npx', args: ['eslint', '--ext', '.ts', 'src'] },
  test: { cmd: 'npx', args: ['vitest', 'run'] },
};

// C0b: checks run in the SAME folder the agent edits through fs:* — the one the
// user picked in the native dialog — never in a separate per-workspace clone.
// `workspaceId` is accepted for backwards compatibility with older web builds
// and ignored.
ipcMain.handle('checks:run', async (_event, payload) => {
  const { check } = payload || {};
  const def = Object.prototype.hasOwnProperty.call(ALLOWED_CHECKS, check) ? ALLOWED_CHECKS[check] : null;
  if (!def) return { success: false, error: 'denied: unknown check' };
  const cwd = resolveWorkspacePath('.');
  if (!cwd) return { success: false, error: 'denied: no workspace folder chosen' };
  const spec = resolveAllowedCommand(def.cmd, def.args);
  if (!spec) return { success: false, error: 'denied: command not allowed' };
  const r = await runAllowed(spec, cwd, 115000);
  if (r.ok) return { success: true, check, output: r.output };
  return { success: false, check, output: r.output, error: r.error };
});

ipcMain.handle('checks:list', () => Object.keys(ALLOWED_CHECKS));

// ─── BYOK: the user's own AI key ────────────────────────────────────
// The key is encrypted with the OS keystore and only ever used HERE, in the main
// process: requests go straight from this machine to the provider. It is never
// sent to the hosted site or any AgentCorp server, and no IPC returns it to the
// page (the page is served by the website, so it must not be able to read it).
// Provider, model and endpoint are saved together with the key, so a page can't
// re-point a stored key at another host without knowing the key.
const aiProviders = require('./ai-providers');
const aiConfigPath = path.join(app.getPath('userData'), 'ai-config.json');
const aiRuns = new Map(); // run id -> AbortController
const MAX_AI_RUNS = 8;

function loadAiConfig() {
  const c = readSecure(aiConfigPath);
  if (!c || typeof c !== 'object') return null;
  const v = aiProviders.validateConfig(c);
  return v.ok ? v.cfg : null;
}

function aiStatus() {
  const cfg = loadAiConfig();
  return {
    configured: !!cfg,
    provider: cfg ? cfg.provider : null,
    model: cfg ? cfg.model : null,
    baseUrl: cfg && cfg.provider === 'custom' ? cfg.baseUrl : null,
    keyHint: cfg ? aiProviders.keyHint(cfg.key) : '',
    providers: aiProviders.publicProviders(),
  };
}

const AI_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

ipcMain.handle('ai:status', () => aiStatus());

ipcMain.handle('ai:save', (_event, input) => {
  const v = aiProviders.validateConfig(input);
  if (!v.ok) return { ok: false, error: v.error };
  if (!writeSecure(aiConfigPath, v.cfg)) return { ok: false, error: 'Could not store the key securely on this computer (OS keystore unavailable).' };
  log('ai: saved config for provider', v.cfg.provider);
  return { ok: true, status: aiStatus() };
});

ipcMain.handle('ai:set-model', (_event, model) => {
  const cfg = loadAiConfig();
  const m = aiProviders.cleanModel(model);
  if (!cfg) return { ok: false, error: 'no key saved yet' };
  if (!m) return { ok: false, error: 'invalid model name' };
  if (!writeSecure(aiConfigPath, { ...cfg, model: m })) return { ok: false, error: 'could not save' };
  return { ok: true, status: aiStatus() };
});

ipcMain.handle('ai:clear', () => {
  try { fs.rmSync(aiConfigPath, { force: true }); } catch { /* already gone */ }
  log('ai: key removed');
  return { ok: true, status: aiStatus() };
});

ipcMain.handle('ai:test', async () => {
  const cfg = loadAiConfig();
  if (!cfg) return { ok: false, error: 'no key saved yet' };
  const started = Date.now();
  const r = await aiProviders.complete(cfg, { prompt: 'Reply with the single word: ok', temperature: 0, maxTokens: 8 });
  log('ai: test', cfg.provider, r.ok ? 'ok' : `failed ${r.status || ''}`);
  return { ok: r.ok, error: r.error, ms: Date.now() - started, model: cfg.model };
});

// One request. With stream:true, text arrives as 'ai:event' messages to the calling window.
ipcMain.handle('ai:run', async (event, req) => {
  const cfg = loadAiConfig();
  if (!cfg) return { ok: false, error: 'No AI key saved. Add one in Integrations.' };
  const id = req && req.id;
  if (typeof id !== 'string' || !AI_ID_RE.test(id)) return { ok: false, error: 'invalid request id' };
  if (aiRuns.size >= MAX_AI_RUNS) return { ok: false, error: 'too many AI requests at once' };
  const ac = new AbortController();
  aiRuns.set(id, ac);
  try {
    if (req.stream === true) {
      const sender = event.sender;
      const r = await aiProviders.stream(cfg, req, (delta) => {
        if (!sender.isDestroyed()) sender.send('ai:event', { id, delta });
      }, { signal: ac.signal });
      return { ok: r.ok, error: r.error, content: r.ok ? undefined : r.content };
    }
    const r = await aiProviders.complete(cfg, req, { signal: ac.signal });
    if (!r.ok) log('ai: request failed', cfg.provider, r.status || '');
    return r;
  } finally {
    aiRuns.delete(id);
  }
});

ipcMain.handle('ai:cancel', (_event, id) => {
  const ac = typeof id === 'string' ? aiRuns.get(id) : null;
  if (ac) ac.abort();
  return { ok: true };
});

// ─── Desktop file executor (sandboxed to workspace) ─────────────────
// Agents on the desktop can read, write, and search files — but only within a
// workspace folder the USER picked via a native dialog (bug #8). Paths are
// canonicalised with realpath so symlinks cannot escape the root (bug #7).
let workspaceRoot = null; // canonical (realpath) absolute path
const workspaceRootFile = path.join(app.getPath('userData'), 'workspace-root.json');

// Remember the folder the user picked across restarts. The stored path is
// re-validated (must still exist and be a directory) before it is trusted.
function restoreWorkspaceRoot() {
  try {
    const { root } = JSON.parse(fs.readFileSync(workspaceRootFile, 'utf-8'));
    if (typeof root !== 'string') return;
    const real = fs.realpathSync(root);
    if (fs.statSync(real).isDirectory()) workspaceRoot = real;
  } catch { /* none saved or no longer valid */ }
}
restoreWorkspaceRoot();

ipcMain.handle('workspace:set-root', async () => {
  // The renderer cannot choose the directory; the user must pick it.
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'no window' };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose the folder AgentCorp agents may read and write',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, error: 'cancelled' };
  try {
    workspaceRoot = fs.realpathSync(res.filePaths[0]);
  } catch (e) {
    return { ok: false, error: 'directory does not exist' };
  }
  try { fs.writeFileSync(workspaceRootFile, JSON.stringify({ root: workspaceRoot })); } catch { /* non-fatal */ }
  log('workspace root set:', workspaceRoot);
  return { ok: true, root: workspaceRoot };
});

ipcMain.handle('workspace:get-root', () => workspaceRoot);

ipcMain.handle('workspace:clear-root', () => {
  workspaceRoot = null;
  try { fs.unlinkSync(workspaceRootFile); } catch { /* ignore */ }
  return { ok: true };
});

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Resolve `rel` inside the workspace, following symlinks on the deepest
// existing ancestor so a link pointing outside the root is rejected.
function resolveWorkspacePath(rel) {
  if (!workspaceRoot || typeof rel !== 'string' || rel.includes('\0')) return null;
  const abs = path.resolve(workspaceRoot, rel);
  if (!isInside(workspaceRoot, abs)) return null;
  let probe = abs;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return null;
    probe = parent;
  }
  let real;
  try { real = fs.realpathSync(probe); } catch { return null; }
  if (!isInside(workspaceRoot, real)) return null;
  return abs;
}

const MAX_READ_BYTES = 5 * 1024 * 1024;
const MAX_WRITE_BYTES = 5 * 1024 * 1024;

ipcMain.handle('fs:read', (_event, relPath) => {
  const abs = resolveWorkspacePath(relPath);
  if (!abs) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  try {
    if (fs.statSync(abs).size > MAX_READ_BYTES) return { ok: false, error: 'file too large' };
    return { ok: true, content: fs.readFileSync(abs, 'utf-8') };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('fs:write', (_event, relPath, content) => {
  const abs = resolveWorkspacePath(relPath);
  if (!abs) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_WRITE_BYTES) {
    return { ok: false, error: 'content must be a string under 5MB' };
  }
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    // Re-check after mkdir in case a new directory component is a link.
    if (!resolveWorkspacePath(relPath)) return { ok: false, error: 'denied: outside workspace' };
    fs.writeFileSync(abs, content, 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('fs:search', (_event, pattern, relDir) => {
  if (typeof pattern !== 'string' || !pattern || pattern.length > 500 || pattern.includes('\0')) {
    return Promise.resolve({ ok: false, error: 'invalid pattern' });
  }
  const abs = resolveWorkspacePath(relDir || '.');
  if (!abs) return Promise.resolve({ ok: false, error: 'denied: outside workspace or no workspace set' });
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'search timeout' }), 15000);
    // `--no-config` ignores RIPGREP_CONFIG_PATH; `-e` makes the pattern an
    // explicit value (a leading "-" can never be parsed as a flag such as
    // --pre, which would execute commands); `--` ends options before the path.
    execFile('rg',
      ['--no-config', '--line-number', '--no-heading', '-m', '50', '-e', pattern, '--', abs],
      { maxBuffer: 512 * 1024, env: safeEnv(), windowsHide: true },
      (err, stdout, stderr) => {
        clearTimeout(timer);
        // rg exits 1 when no matches — that's not an error
        if (err && err.code !== 1 && !stdout) {
          return resolve({ ok: false, error: String(stderr || err).slice(0, 500) });
        }
        resolve({ ok: true, output: (stdout || '').slice(0, 8000) });
      });
  });
});

ipcMain.handle('exec:run', async (_event, payload) => {
  const { cmd, args, relCwd } = payload || {};
  const cwd = resolveWorkspacePath(relCwd || '.');
  if (!cwd) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  const spec = typeof cmd === 'string' ? resolveAllowedCommand(cmd, args) : null;
  if (!spec) return { ok: false, error: `denied: '${String(cmd).slice(0, 40)}' with these arguments is not allowed` };
  return runAllowed(spec, cwd, 115000);
});

// ─── fs:list — directory listing inside the workspace (agents need to see structure) ─
const LIST_SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', 'coverage', '.vercel']);
ipcMain.handle('fs:list', (_event, relDir) => {
  const abs = resolveWorkspacePath(relDir || '.');
  if (!abs) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  try {
    const entries = fs.readdirSync(abs, { withFileTypes: true })
      .filter((e) => !LIST_SKIP.has(e.name))
      .slice(0, 300)
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return { ok: true, entries };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ─── Tier-2 commands (C0e) ──────────────────────────────────────────
// Tier 1 (resolveAllowedCommand above) runs without asking: type-checks, lint,
// tests, fixed npm scripts. Tier 2 can change the machine or the repo
// (installing packages, git add/commit, other npm scripts), so it ONLY runs
// after a NATIVE dialog the user clicks — the web page cannot approve its own
// request. Deny stays the default: anything not matched here is refused.
// Never allowed: node -e, shell metacharacters, absolute paths, "..", git
// config/push/reset/clean/checkout, arbitrary executables.
const GIT_SUBCOMMANDS = new Set(['status', 'diff', 'log', 'add', 'commit']);
const GIT_SAFE_FLAGS = new Set(['--stat', '--name-only', '--name-status', '--oneline', '--cached', '--staged', '--short', '-s', '-b', '--porcelain', '-n', '-m', '-A', '--all']);
const NPM_INSTALL_FLAGS = new Set(['--save-dev', '-D', '--save-exact', '-E', '--no-audit', '--no-fund', '--legacy-peer-deps']);
const COMMIT_MSG = /^[A-Za-z0-9 _.,:()'\/#@+!?-]{1,200}$/; // no ; | & $ ` < > \ or quotes: stays inert even if a shell is ever involved
const NPM_RUN_NAME = /^[A-Za-z0-9:_-]{1,40}$/;
const approvedKeys = new Set(); // session-only "allow this kind for this folder"

function safePathArg(a) {
  return typeof a === 'string' && SAFE_ARG.test(a) && !a.split('/').includes('..') && !a.startsWith('/') && !/^[A-Za-z]:/.test(a);
}

function resolveTier2Command(cmd, args) {
  args = Array.isArray(args) ? args : [];
  if (args.length === 0 || args.length > 24) return null;
  const win = process.platform === 'win32';

  if (cmd === 'git') {
    const sub = args[0];
    if (!GIT_SUBCOMMANDS.has(sub)) return null;
    const rest = args.slice(1);
    let expectMsg = false;
    for (const a of rest) {
      if (typeof a !== 'string' || a.length === 0 || a.length > 200 || a.includes('\0')) return null;
      if (expectMsg) { if (!COMMIT_MSG.test(a)) return null; expectMsg = false; continue; }
      if (a.startsWith('-')) {
        if (!GIT_SAFE_FLAGS.has(a)) return null;
        if (a === '-m') { if (sub !== 'commit') return null; expectMsg = true; }
        continue;
      }
      if (!safePathArg(a)) return null;
    }
    if (expectMsg) return null;
    if (sub === 'commit' && !rest.includes('-m')) return null; // never open an editor
    return { file: 'git', args: [sub, ...rest], label: ['git', ...args].join(' '), key: `git:${sub}`, shell: false, timeout: 60000 };
  }

  if (cmd === 'npm') {
    const sub = args[0];
    if (sub === 'install' || sub === 'i' || sub === 'ci') {
      const rest = args.slice(1);
      for (const a of rest) {
        if (typeof a !== 'string' || a.length > 100 || !SAFE_ARG.test(a)) return null;
        if (a.startsWith('-')) { if (!NPM_INSTALL_FLAGS.has(a)) return null; continue; }
        // package spec only: name, name@range, @scope/name — never URLs, git specs or paths
        if (a.includes(':') || a.split('/').includes('..')) return null;
        if (a.includes('/') && !a.startsWith('@')) return null;
      }
      // Lifecycle scripts of arbitrary packages are the main install-time attack
      // surface, so they are always disabled here.
      return { file: 'npm', args: [sub, '--ignore-scripts', ...rest], label: ['npm', ...args].join(' '), key: 'npm:install', shell: win, timeout: 300000 };
    }
    if (sub === 'run' && args.length === 2 && NPM_RUN_NAME.test(args[1]) && !NPM_SCRIPTS.has(args[1])) {
      return { file: 'npm', args: ['run', args[1]], label: `npm run ${args[1]}`, key: `npm:run:${args[1]}`, shell: win, timeout: 115000 };
    }
  }
  return null;
}

async function approveTier2(spec, cwd) {
  const memo = `${workspaceRoot}::${spec.key}`;
  if (approvedKeys.has(memo)) return true;
  const opts = {
    type: 'question',
    buttons: ['Allow once', 'Allow this kind of command in this folder', 'Deny'],
    defaultId: 2,
    cancelId: 2,
    noLink: true,
    title: 'AgentCorp: approve command',
    message: 'An agent wants to run a command on your computer',
    detail: `${spec.label}\n\nFolder: ${cwd}${spec.args.includes('--ignore-scripts') ? '\n\nPackage install scripts are disabled for safety.' : ''}`,
  };
  const { response } = (mainWindow && !mainWindow.isDestroyed())
    ? await dialog.showMessageBox(mainWindow, opts)
    : await dialog.showMessageBox(opts);
  if (response === 1) { approvedKeys.add(memo); return true; }
  return response === 0;
}

ipcMain.handle('exec:run-approved', async (_event, payload) => {
  const { cmd, args, relCwd } = payload || {};
  const cwd = resolveWorkspacePath(relCwd || '.');
  if (!cwd) return { ok: false, denied: true, error: 'denied: outside workspace or no workspace set' };
  const spec = typeof cmd === 'string' ? resolveTier2Command(cmd, args) : null;
  if (!spec) return { ok: false, denied: true, error: `denied: '${String(cmd).slice(0, 40)}' with these arguments is not allowed` };
  if (!(await approveTier2(spec, cwd))) return { ok: false, denied: true, error: 'denied: the user declined this command' };
  return runAllowed(spec, cwd, spec.timeout);
});

// ─── Keep-alive while agents are working (C0c) ──────────────────────
// Runs live in the renderer, so the window must stay alive and the machine
// awake while one is active: block system suspend, and offer to hide to the
// tray instead of closing.
let activeRunCount = 0;
let powerBlockerId = null;
let forceQuit = false;
let tray = null;

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
}

function ensureTray() {
  if (tray) return;
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 16, height: 16 });
    tray = new Tray(img);
    tray.setToolTip('AgentCorp: a run is in progress');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show AgentCorp', click: showMainWindow },
      { label: 'Quit', click: () => { forceQuit = true; app.quit(); } },
    ]));
    tray.on('click', showMainWindow);
  } catch (e) {
    log('tray failed:', e && e.message);
  }
}

function destroyTray() {
  if (tray) { try { tray.destroy(); } catch { /* ignore */ } tray = null; }
}

ipcMain.handle('runs:set-active', (_event, count) => {
  const n = Number.isFinite(count) ? Math.max(0, Math.min(99, Math.floor(count))) : 0;
  activeRunCount = n;
  if (n > 0 && powerBlockerId === null) {
    powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  } else if (n === 0) {
    if (powerBlockerId !== null) { try { powerSaveBlocker.stop(powerBlockerId); } catch { /* ignore */ } powerBlockerId = null; }
    // Finished while hidden: bring the result back to the user.
    if (tray) { destroyTray(); showMainWindow(); }
  }
  return { ok: true };
});

app.on('before-quit', () => { forceQuit = true; });

// ─── App lifecycle ──────────────────────────────────────────────────
app.whenReady().then(() => {
  log('app ready, isDev=', isDev, 'WEB_URL=', WEB_URL);

  // Deny powerful permissions (camera, mic, geolocation, …) by default.
  const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'notifications']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  try {
    // On Windows dev mode, pass the script path so the OS routes the deep link
    // to this exact running instance via second-instance, not a fresh spawn.
    let ok;
    if (isDev && process.platform === 'win32') {
      ok = app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      ok = app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    }
    log('protocol registration result=', ok);
  } catch (err) {
    log('protocol registration failed:', err && err.message);
  }
  createMainWindow();

  if (pendingDeepLink) {
    const url = pendingDeepLink;
    pendingDeepLink = null;
    log('processing pending deep link');
    handleDeepLink(url);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
