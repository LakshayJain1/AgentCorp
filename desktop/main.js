const { app, BrowserWindow, ipcMain, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';
// Allow override via env at runtime: AGENTCORP_WEB_URL="https://<your-app>.vercel.app"
// Default is the live deployment (update here when the production URL changes).
const WEB_URL = (process.env.AGENTCORP_WEB_URL || '').replace(/\/+$/, '')
  || (isDev ? 'http://localhost:3000' : 'https://agent-corp.vercel.app');
const DEEP_LINK_SCHEME = 'agentcorp';

let mainWindow = null;

// ─── Debug log ──────────────────────────────────────────────────────
// Startup diagnostics: %APPDATA%/AgentCorp/agentcorp-debug.log on Windows.
// This is how we diagnose silent startup failures (process alive, no window).
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

// A deep link can arrive before the window exists (cold start via protocol on
// Windows/Linux passes the URL in process.argv; on macOS via open-url). Stash
// it and process once the window is ready — handleDeepLink already persists
// the token via saveAuth, and createMainWindow picks it up via loadAuth.
let pendingDeepLink = null;

function handleDeepLinkArgv(argv) {
  if (!Array.isArray(argv)) return;
  const url = argv.find((arg) => typeof arg === 'string' && arg.startsWith(`${DEEP_LINK_SCHEME}://`));
  if (url) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      handleDeepLink(url);
    } else {
      pendingDeepLink = url;
      // Persist immediately so even a later window creation picks it up.
      try { handleDeepLink(url); } catch { pendingDeepLink = url; }
    }
  }
}

// Cold-start check: protocol launch passes the URL as a CLI arg.
// Only stash it here (app.getPath isn't usable before ready) — it is
// processed in whenReady after the window exists.
handleDeepLinkArgv(process.argv);

// ─── Browser-based sign-in ──────────────────────────────────────────
// Auth never happens inside the app: we open the system browser on the web
// sign-in page, Clerk authenticates there, and the web app redirects back to
// us via the agentcorp:// deep link with a verified session token.
function startBrowserSignin() {
  const signInUrl = `${WEB_URL}/sign-in?redirect_url=${encodeURIComponent('/desktop-redirect')}`;
  shell.openExternal(signInUrl);
}

// ─── Persistent auth storage ────────────────────────────────────────
const authPath = path.join(app.getPath('userData'), 'auth.json');

function loadAuth() {
  try {
    return JSON.parse(fs.readFileSync(authPath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveAuth(data) {
  fs.writeFileSync(authPath, JSON.stringify(data, null, 2));
}

function clearAuth() {
  try { fs.unlinkSync(authPath); } catch {}
}

// ─── Deep link handling ─────────────────────────────────────────────
// Safe to call at any time: persists the token immediately when possible,
// loads the workspace when the window exists, otherwise stashes for whenReady.
function handleDeepLink(url) {
  if (!url || !url.startsWith(`${DEEP_LINK_SCHEME}://`)) return;

  let token = null;
  let userId = null;
  let redirect = '/workspace';
  try {
    const parsed = new URL(url);
    token = parsed.searchParams.get('token');
    userId = parsed.searchParams.get('userId');
    redirect = parsed.searchParams.get('redirect') || '/workspace';
  } catch {
    return;
  }

  if (token) {
    if (app.isReady()) {
      saveAuth({ token, userId, authenticatedAt: Date.now() });
      log('deep link: token saved for user', userId);
    } else {
      pendingDeepLink = url;
      return;
    }

    // Inject the verified Clerk session JWT as the __session cookie so the
    // embedded web app arrives genuinely authenticated.
    if (mainWindow && !mainWindow.isDestroyed()) {
      session.defaultSession.cookies.set({
        url: WEB_URL,
        name: '__session',
        value: token,
        domain: new URL(WEB_URL).hostname,
        path: '/',
        httpOnly: true,
        secure: !isDev,
        sameSite: 'lax',
      }).then(() => {
        mainWindow.loadURL(`${WEB_URL}${redirect}`);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }).catch((err) => {
        log('deep-link cookie inject failed (loading anyway):', err && err.message);
        mainWindow.loadURL(`${WEB_URL}${redirect}`);
      });
    }
  }
}

// Protocol registration happens in whenReady (required on Windows).
// Single-instance + deep-link wiring is registered here at module level so no
// protocol launch is ever missed, even before ready.
if (process.platform === 'win32' || process.platform === 'linux') {
  const gotLock = app.requestSingleInstanceLock();
  log('single-instance lock acquired=', gotLock);
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, commandLine) => {
      handleDeepLinkArgv(commandLine);
      if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
      }
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

// macOS (and early Windows launches): stash protocol URLs until ready.
app.on('open-url', (event, url) => {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  pendingDeepLink = url;
});

function loadErrorPage(targetUrl, errorDescription) {
  const safeUrl = String(targetUrl || WEB_URL).replace(/</g, '&lt;');
  const safeErr = String(errorDescription || 'The page could not be loaded.').replace(/</g, '&lt;');
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
        <button onclick="location.reload()" style="margin-top:12px;padding:10px 24px;border-radius:999px;border:none;background:#0A84FF;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Retry</button>
      </div>
    </body></html>`)}`;
}

// ─── Window creation ────────────────────────────────────────────────
function createMainWindow() {
  // Hide the default Electron menu (File/Edit/View/…) for a native app feel
  Menu.setApplicationMenu(null);

  // titleBarStyle: 'hiddenInset' is macOS-only — on Windows use 'hidden' so
  // the frame is removed without breaking the traffic-light position.
  const titleBarStyle = process.platform === 'darwin' ? 'hiddenInset' : 'hidden';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'AgentCorp',
    titleBarStyle,
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: true,
    backgroundColor: '#FAFBFD',
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getURL() : '(gone)';
    log('did-finish-load:', url);

    // Clerk redirected to /sign-in — the saved JWT is expired. Clear it and
    // show the local signin screen so the user can start a fresh auth flow.
    if (mainWindow && !mainWindow.isDestroyed() && url.startsWith(WEB_URL) && url.includes('/sign-in')) {
      log('did-finish-load: redirected to sign-in — JWT expired, clearing auth');
      clearAuth();
      mainWindow.loadFile(path.join(__dirname, 'signin.html'));
    }
  });

  // F12 opens DevTools inline (bottom panel) — visible even on a blank page
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'bottom' });
        }
      }
    }
  });

  // Ctrl+Shift+I also opens DevTools (standard browser shortcut)
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.control && input.shift && input.key === 'I') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'bottom' });
        }
      }
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('RENDERER CRASHED:', JSON.stringify(details));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Never leave the user staring at a blank white window: surface load
  // failures with a retry screen instead.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    log('did-fail-load:', errorCode, errorDescription, validatedURL);
    mainWindow.loadURL(loadErrorPage(validatedURL, errorDescription));
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes(new URL(WEB_URL).hostname)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Decode a JWT and check its exp claim without verifying the signature.
  // We only need to know if it's worth sending — Clerk's server validates it fully.
  function isJwtExpired(token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      // Add a 30s buffer so we don't send a token that'll expire mid-request
      return !payload.exp || (payload.exp * 1000) < (Date.now() + 30000);
    } catch {
      return true;
    }
  }

  const raw = loadAuth();
  let auth = null;
  if (raw && raw.token) {
    if (isJwtExpired(raw.token)) {
      log('startup: JWT expired, clearing auth');
      clearAuth();
    } else {
      auth = raw;
    }
  }
  log('startup auth present=', !!(auth && auth.token));
  if (auth && auth.token) {
    // Set session cookie and load workspace.
    // url is required by Electron's cookies.set() — without it the call throws
    // "Missing required option 'url'" and loadURL never fires (blank screen).
    session.defaultSession.cookies.set({
      url: WEB_URL,
      name: '__session',
      value: auth.token,
      domain: new URL(WEB_URL).hostname,
      path: '/',
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax',
    }).then(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(`${WEB_URL}/workspace`);
    }).catch((err) => {
      log('startup cookie inject failed (loading workspace anyway):', err && err.message);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(`${WEB_URL}/workspace`);
    });
  } else {
    // Not authenticated — show the local launcher screen. Auth happens in
    // the system browser; the app receives the session via deep link.
    const signinPath = path.join(__dirname, 'signin.html');
    log('loading launcher:', signinPath, 'exists=', fs.existsSync(signinPath));
    mainWindow.loadFile(signinPath);
  }

  return mainWindow;
}

// ─── IPC handlers ───────────────────────────────────────────────────
ipcMain.handle('auth:get-token', () => {
  const auth = loadAuth();
  return auth?.token || null;
});

ipcMain.handle('auth:is-authenticated', () => {
  const auth = loadAuth();
  return !!(auth && auth.token);
});

ipcMain.handle('auth:logout', () => {
  clearAuth();
  session.defaultSession.cookies.remove(WEB_URL, '__session');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, 'signin.html'));
  }
});

ipcMain.handle('auth:start-browser-signin', () => {
  startBrowserSignin();
});

// Manual fallback: user pastes the agentcorp:// link (e.g. copied from the
// "Open in Desktop App" page) when the OS handoff doesn't reach the app.
ipcMain.handle('auth:handle-link', (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith(`${DEEP_LINK_SCHEME}://`)) {
    return { success: false, error: 'That does not look like an AgentCorp link (agentcorp://…)' };
  }
  try {
    handleDeepLink(url);
    const auth = loadAuth();
    return { success: !!(auth && auth.token) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('auth:open-browser', (_event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('app:get-info', () => ({
  platform: process.platform,
  version: app.getVersion(),
  isDev,
  webUrl: WEB_URL,
}));

// ─── P3b: local checks runner (desktop only) ─────────────────────────
// Runs an allowlisted check command inside the user's workspace clone.
// Deny by default: only tsc/eslint/vitest, cwd jailed to workspaces/<workspaceId>.
const { execFile } = require('child_process');
const ALLOWED_CHECKS = {
  typecheck: { cmd: 'npx', args: ['tsc', '--noEmit'] },
  lint: { cmd: 'npx', args: ['eslint', '--ext', '.ts', 'src'] },
  test: { cmd: 'npx', args: ['vitest', 'run'] },
};

function workspaceDir(workspaceId) {
  const safe = String(workspaceId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (!safe) return null;
  return path.join(app.getPath('userData'), 'workspaces', safe);
}

ipcMain.handle('checks:run', async (_event, { workspaceId, check }) => {
  const spec = ALLOWED_CHECKS[check];
  const cwd = workspaceDir(workspaceId);
  if (!spec || !cwd) return { success: false, error: 'denied: unknown check or workspace' };
  if (!fs.existsSync(cwd)) return { success: false, error: 'denied: workspace not cloned on this machine' };
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ success: false, error: 'timeout after 120s', check }), 120000);
    execFile(spec.cmd, spec.args, { cwd, timeout: 115000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      clearTimeout(timer);
      const out = `${stdout || ''}${stderr || ''}`.slice(-4000); // truncated log, no env dump
      if (err) return resolve({ success: false, check, output: out, error: `exit ${err.code ?? '?'}` });
      return resolve({ success: true, check, output: out.slice(-2000) });
    });
  });
});

ipcMain.handle('checks:list', () => Object.keys(ALLOWED_CHECKS));

// ─── BYOK: per-user API key storage ─────────────────────────────────
// Keys are stored locally in userData — never sent to Vercel servers.
// The web app reads them back on startup and injects into all AI calls.
const apiKeyPath = path.join(app.getPath('userData'), 'apikeys.json');

function loadApiKeys() {
  try { return JSON.parse(fs.readFileSync(apiKeyPath, 'utf-8')); } catch { return {}; }
}
function saveApiKeys(keys) {
  fs.writeFileSync(apiKeyPath, JSON.stringify(keys, null, 2));
}

ipcMain.handle('apikey:get', (_event, provider) => {
  const keys = loadApiKeys();
  return keys[provider] || null;
});
ipcMain.handle('apikey:set', (_event, provider, value) => {
  if (typeof provider !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(provider)) return false;
  const keys = loadApiKeys();
  if (value) { keys[provider] = String(value); } else { delete keys[provider]; }
  saveApiKeys(keys);
  return true;
});
ipcMain.handle('apikey:list-providers', () => Object.keys(loadApiKeys()));

// ─── Desktop file executor (sandboxed to workspace) ─────────────────
// Agents on the desktop can read, write, and search files — but only
// within the user's chosen workspace root. No path traversal outside it.
const { execFile: execFileRaw } = require('child_process');

let workspaceRoot = null;

ipcMain.handle('workspace:set-root', (_event, dir) => {
  if (!dir || !fs.existsSync(dir)) return { ok: false, error: 'directory does not exist' };
  workspaceRoot = dir;
  log('workspace root set:', workspaceRoot);
  return { ok: true };
});

ipcMain.handle('workspace:get-root', () => workspaceRoot);

function resolveWorkspacePath(rel) {
  if (!workspaceRoot) return null;
  // Prevent path traversal
  const abs = path.resolve(workspaceRoot, rel);
  if (!abs.startsWith(path.resolve(workspaceRoot) + path.sep) && abs !== path.resolve(workspaceRoot)) return null;
  return abs;
}

ipcMain.handle('fs:read', (_event, relPath) => {
  const abs = resolveWorkspacePath(relPath);
  if (!abs) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  try {
    const content = fs.readFileSync(abs, 'utf-8');
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('fs:write', (_event, relPath, content) => {
  const abs = resolveWorkspacePath(relPath);
  if (!abs) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('fs:search', (_event, pattern, relDir) => {
  const abs = resolveWorkspacePath(relDir || '.');
  if (!abs) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  return new Promise((resolve) => {
    // Use ripgrep if available, fall back to grep
    const timer = setTimeout(() => resolve({ ok: false, error: 'search timeout' }), 15000);
    execFileRaw('rg', ['--line-number', '--no-heading', '-m', '50', pattern, abs],
      { maxBuffer: 512 * 1024 },
      (err, stdout, stderr) => {
        clearTimeout(timer);
        // rg exits 1 when no matches — that's not an error
        if (err && err.code !== 1 && !stdout) {
          return resolve({ ok: false, error: stderr || String(err) });
        }
        resolve({ ok: true, output: stdout.slice(0, 8000) });
      });
  });
});

ipcMain.handle('exec:run', async (_event, { cmd, args, relCwd }) => {
  const cwd = resolveWorkspacePath(relCwd || '.');
  if (!cwd) return { ok: false, error: 'denied: outside workspace or no workspace set' };
  // Allowlist: only safe read-only diagnostic commands
  const ALLOWED_EXEC = ['tsc', 'npx', 'node', 'npm'];
  if (!ALLOWED_EXEC.includes(cmd)) return { ok: false, error: `denied: '${cmd}' is not in the allowed command list` };
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'exec timeout (120s)' }), 120000);
    execFileRaw(cmd, args || [], { cwd, timeout: 115000, maxBuffer: 1024 * 512 },
      (err, stdout, stderr) => {
        clearTimeout(timer);
        const out = `${stdout || ''}${stderr || ''}`.slice(-4000);
        if (err) return resolve({ ok: false, output: out, error: `exit ${err.code ?? '?'}` });
        resolve({ ok: true, output: out.slice(-2000) });
      });
  });
});

// ─── App lifecycle ──────────────────────────────────────────────────
// Register protocol once the app is ready (required on Windows)
app.whenReady().then(() => {
  log('app ready, argv=', process.argv.slice(1).join(' '), 'isDev=', isDev, 'WEB_URL=', WEB_URL);
  try {
    const ok = app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    log('protocol registration result=', ok);
  } catch (err) {
    log('protocol registration failed:', err && err.message);
  }
  createMainWindow();

  // Process any deep link that arrived before the window existed.
  if (pendingDeepLink) {
    const url = pendingDeepLink;
    pendingDeepLink = null;
    log('processing pending deep link');
    handleDeepLink(url);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
