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
function handleDeepLink(url) {
  if (!url || !url.startsWith(`${DEEP_LINK_SCHEME}://`)) return;

  const parsed = new URL(url);
  const token = parsed.searchParams.get('token');
  const userId = parsed.searchParams.get('userId');
  const redirect = parsed.searchParams.get('redirect') || '/workspace';

  if (token) {
    saveAuth({ token, userId, authenticatedAt: Date.now() });

    // Inject the verified Clerk session JWT as the __session cookie so the
    // embedded web app arrives genuinely authenticated.
    if (mainWindow && !mainWindow.isDestroyed()) {
      const cookieUrl = WEB_URL;
      session.defaultSession.cookies.set({
        name: '__session',
        value: token,
        domain: new URL(cookieUrl).hostname,
        path: '/',
        httpOnly: true,
        secure: !isDev,
        sameSite: 'lax',
      }).then(() => {
        mainWindow.loadURL(`${WEB_URL}${redirect}`);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      });
    }
  }
}

// Protocol registration happens in whenReady (required on Windows).
// Handle deep link on Windows/Linux (macOS handled via open-url event)
if (process.platform === 'win32' || process.platform === 'linux') {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, commandLine) => {
      const url = commandLine.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`));
      if (url) handleDeepLink(url);
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

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

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'AgentCorp',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#FAFBFD',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Never leave the user staring at a blank white window: surface load
  // failures with a retry screen instead.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    console.error('[AgentCorp] did-fail-load:', errorCode, errorDescription, validatedURL);
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

  // Check if user is already authenticated
  const auth = loadAuth();
  if (auth && auth.token) {
    // Set session cookie and load workspace
    const cookieUrl = WEB_URL;
    session.defaultSession.cookies.set({
      name: '__session',
      value: auth.token,
      domain: new URL(cookieUrl).hostname,
      path: '/',
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax',
    }).then(() => {
      mainWindow.loadURL(`${WEB_URL}/workspace`);
    });
  } else {
    // Not authenticated — show the local launcher screen. Auth happens in
    // the system browser; the app receives the session via deep link.
    mainWindow.loadFile(path.join(__dirname, 'signin.html'));
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

// ─── App lifecycle ──────────────────────────────────────────────────
// Register protocol once the app is ready (required on Windows)
app.whenReady().then(() => {
  try {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  } catch (err) {
    console.error('[AgentCorp] protocol registration failed:', err);
  }
  createMainWindow();

  // macOS: handle deep link when app is already running
  app.on('open-url', (_event, url) => {
    handleDeepLink(url);
  });
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

// Handle deep link from protocol handler (Windows/Linux)
app.on('open-url', (_event, url) => {
  handleDeepLink(url);
});
