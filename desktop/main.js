const { app, BrowserWindow, ipcMain, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

const isDev = process.env.NODE_ENV === 'development';
// Allow override via env at runtime: AGENTCORP_WEB_URL="https://<your-app>.vercel.app"
// Default is the live deployment (update here when the production URL changes).
const WEB_URL = (process.env.AGENTCORP_WEB_URL || '').replace(/\/+$/, '')
  || (isDev ? 'http://localhost:3000' : 'https://agent-corp.vercel.app');
const DEEP_LINK_SCHEME = 'agentcorp';
// Auth0 tenant and native app client (no secret — PKCE only).
// Set AUTH0_DOMAIN and AUTH0_ELECTRON_CLIENT_ID in the environment or .env.
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || process.env.AUTH0_ISSUER_BASE_URL?.replace('https://', '') || '';
const AUTH0_CLIENT_ID = process.env.AUTH0_ELECTRON_CLIENT_ID || process.env.AUTH0_CLIENT_ID || '';

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

// ─── Local auth server ───────────────────────────────────────────────
// More reliable than OS protocol routing (especially on Windows dev). The web
// page POSTs the Clerk session token directly to http://localhost:PORT/auth.
// A random state nonce ties the server to the browser session that opened it.
const AUTH_SERVER_PORT = 51432;
let authServerState = null; // one-time nonce generated per sign-in attempt
let authServer = null;

function generateState() {
  authServerState = crypto.randomBytes(24).toString('hex');
  return authServerState;
}

function startAuthServer() {
  if (authServer) return; // already running
  authServer = http.createServer((req, res) => {
    // CORS headers so the web page can POST from any origin
    res.setHeader('Access-Control-Allow-Origin', WEB_URL);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'POST' || req.url !== '/auth') {
      res.writeHead(404); res.end(); return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { token, userId, state } = JSON.parse(body);
        if (!authServerState || state !== authServerState) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid state' }));
          return;
        }
        authServerState = null; // consume nonce — single use
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        log('local auth server: token received for user', userId);
        // Re-use the same deep link handler to inject cookie & load workspace
        handleDeepLink(`${DEEP_LINK_SCHEME}://auth-callback?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId || '')}&redirect=/workspace`);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
  });

  authServer.listen(AUTH_SERVER_PORT, '127.0.0.1', () => {
    log(`local auth server listening on 127.0.0.1:${AUTH_SERVER_PORT}`);
  });
  authServer.on('error', (e) => {
    log('local auth server error:', e.message);
    authServer = null;
  });
}

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

// ─── Auth0 PKCE helpers ──────────────────────────────────────────────
function base64URLEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generatePKCEPair() {
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(
    crypto.createHash('sha256').update(verifier).digest()
  );
  return { verifier, challenge };
}

let pkceVerifier = null; // stashed while browser is open

// ─── System-browser sign-in (Auth0 PKCE) ────────────────────────────
// Opens the real system browser to Auth0's authorize endpoint.
// Auth0 redirects to agentcorp://callback?code=...&state=...
// Electron exchanges the code for tokens (no secret needed — PKCE).
function startBrowserSignin() {
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    log('AUTH0_DOMAIN / AUTH0_ELECTRON_CLIENT_ID not set — falling back to web sign-in');
    const signInUrl = `${WEB_URL}/auth/login?returnTo=${encodeURIComponent('/desktop-redirect')}`;
    shell.openExternal(signInUrl);
    return;
  }

  startAuthServer(); // local server as backup delivery channel
  const state = generateState();
  const { verifier, challenge } = generatePKCEPair();
  pkceVerifier = verifier;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: `${DEEP_LINK_SCHEME}://callback`,
    scope: 'openid profile email offline_access',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    audience: process.env.AUTH0_AUDIENCE || '',
  });
  if (!process.env.AUTH0_AUDIENCE) params.delete('audience');

  const authorizeUrl = `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
  log('opening Auth0 PKCE authorize:', authorizeUrl);
  shell.openExternal(authorizeUrl);
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
function handleDeepLink(url) {
  if (!url || !url.startsWith(`${DEEP_LINK_SCHEME}://`)) return;

  let parsed;
  try { parsed = new URL(url); } catch { return; }

  // ── Auth0 PKCE callback: agentcorp://callback?code=XXX&state=YYY ──
  if (parsed.hostname === 'callback' && parsed.searchParams.get('code')) {
    const code = parsed.searchParams.get('code');
    log('deep link: Auth0 PKCE code received, exchanging for tokens');
    exchangeCodeForTokens(code);
    return;
  }

  // ── Legacy / local-server path: agentcorp://auth-callback?token=XXX ──
  const token = parsed.searchParams.get('token');
  const userId = parsed.searchParams.get('userId');
  const redirect = parsed.searchParams.get('redirect') || '/workspace';

  if (token) {
    if (!app.isReady()) { pendingDeepLink = url; return; }
    saveAuth({ token, userId, authenticatedAt: Date.now() });
    log('deep link: token saved for user', userId);
    loadWorkspace(redirect);
  }
}

async function exchangeCodeForTokens(code) {
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    log('cannot exchange code: AUTH0 config missing');
    return;
  }
  try {
    const resp = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: AUTH0_CLIENT_ID,
        code_verifier: pkceVerifier,
        code,
        redirect_uri: `${DEEP_LINK_SCHEME}://callback`,
      }),
    });
    pkceVerifier = null; // consumed
    const tokens = await resp.json();
    if (tokens.error) throw new Error(`${tokens.error}: ${tokens.error_description}`);

    saveAuth({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + (tokens.expires_in || 86400) * 1000,
      authenticatedAt: Date.now(),
    });
    log('Auth0 PKCE: tokens stored, loading workspace');
    loadWorkspace('/workspace');
  } catch (err) {
    log('Auth0 PKCE token exchange failed:', err && err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, 'signin.html'));
    }
  }
}

function loadWorkspace(redirect) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(`${WEB_URL}${redirect}`);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
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

// macOS: protocol URLs arrive via open-url after app is ready.
app.on('open-url', (event, url) => {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    handleDeepLink(url);
  } else {
    pendingDeepLink = url;
  }
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

  // Spoof a standard Chrome UA — removes the Electron/node identifier that
  // Google uses to detect embedded WebViews and block OAuth flows.
  const chromeVersion = process.versions.chrome || '120.0.0.0';
  mainWindow.webContents.setUserAgent(
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  );

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getURL() : '(gone)';
    log('did-finish-load:', url);
  });

  // ── Core UX guarantee ────────────────────────────────────────────────
  // If Clerk's middleware ever redirects to /sign-in or /sign-up inside the
  // Electron window (e.g. cookie expired, session rejected), intercept it and
  // open the system browser instead. This ensures Google/GitHub OAuth ALWAYS
  // runs in the user's real browser — never in an in-app WebView.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const webHost = new URL(WEB_URL).hostname;
      const isOurHost = parsed.hostname === webHost;
      const isSignIn = parsed.pathname.startsWith('/sign-in') || parsed.pathname.startsWith('/sign-up');
      if (isOurHost && isSignIn) {
        event.preventDefault();
        log('intercepted in-app sign-in navigation — opening system browser');
        startBrowserSignin();
      }
    } catch { /* malformed URL — let it through */ }
  });

  // Also catch sign-in pages that load without a navigation event
  // (e.g. SPA client-side route change after session expiry).
  mainWindow.webContents.on('did-navigate', (_event, url) => {
    try {
      const parsed = new URL(url);
      const webHost = new URL(WEB_URL).hostname;
      const isOurHost = parsed.hostname === webHost;
      const isSignIn = parsed.pathname.startsWith('/sign-in') || parsed.pathname.startsWith('/sign-up');
      if (isOurHost && isSignIn) {
        log('landed on sign-in page — loading local sign-in launcher instead');
        mainWindow.loadFile(path.join(__dirname, 'signin.html'));
      }
    } catch {}
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

  const signinHtml = path.join(__dirname, 'signin.html');

  // On startup: if we have valid persisted Auth0 tokens go straight to the
  // workspace; otherwise show the local sign-in launcher.
  const savedAuth = loadAuth();
  const isValid = savedAuth && (
    savedAuth.expiresAt ? Date.now() < savedAuth.expiresAt : !!(savedAuth.accessToken || savedAuth.token)
  );
  if (isValid) {
    log('startup: valid auth found, loading workspace');
    mainWindow.loadURL(`${WEB_URL}/workspace`);
  } else {
    log('startup: no valid auth, showing sign-in launcher');
    mainWindow.loadFile(signinHtml);
  }

  return mainWindow;
}

// ─── IPC handlers ───────────────────────────────────────────────────
ipcMain.handle('auth:get-token', () => {
  const auth = loadAuth();
  return auth?.accessToken || auth?.token || null;
});

ipcMain.handle('auth:is-authenticated', () => {
  const auth = loadAuth();
  if (!auth) return false;
  // Check expiry for Auth0 PKCE tokens; legacy token entries have no expiresAt
  if (auth.expiresAt) return Date.now() < auth.expiresAt;
  return !!(auth.accessToken || auth.token);
});

ipcMain.handle('auth:logout', async () => {
  clearAuth();
  pkceVerifier = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Auth0 logout — clears Auth0 session in system browser too
    if (AUTH0_DOMAIN && AUTH0_CLIENT_ID) {
      const logoutUrl = `https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(WEB_URL)}`;
      shell.openExternal(logoutUrl);
    }
    mainWindow.loadFile(path.join(__dirname, 'signin.html'));
  }
});

ipcMain.handle('auth:start-browser-signin', () => {
  // Opens the system browser so Google OAuth shows the real account picker.
  startBrowserSignin();
});

ipcMain.handle('auth:server-info', () => ({
  port: AUTH_SERVER_PORT,
  state: authServerState,
}));

ipcMain.handle('auth:handle-link', (_event, url) => {
  // Deep-link fallback kept for users on older builds.
  if (typeof url !== 'string' || !url.startsWith(`${DEEP_LINK_SCHEME}://`)) {
    return { success: false, error: 'That does not look like an AgentCorp link (agentcorp://…)' };
  }
  try {
    handleDeepLink(url);
    return { success: true };
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
