const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';
const WEB_URL = isDev
  ? 'http://localhost:3000'
  : 'https://agentcorp.vercel.app';
const DEEP_LINK_SCHEME = 'agentcorp';

let mainWindow = null;
let authWindow = null;

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

    // Inject session cookie into the webview so the web app stays logged in
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
      });
    }

    // Close the auth browser if it's still open
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close();
      authWindow = null;
    }
  }
}

// Register protocol before app is ready
app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);

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

// ─── Window creation ────────────────────────────────────────────────
function createMainWindow() {
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
    backgroundColor: '#ffffff',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
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
    // Not authenticated — show onboarding page
    mainWindow.loadURL(`${WEB_URL}/onboard`);
  }

  return mainWindow;
}

function createAuthWindow(authUrl) {
  authWindow = new BrowserWindow({
    width: 600,
    height: 750,
    parent: mainWindow,
    modal: true,
    title: 'Sign In to AgentCorp',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  authWindow.once('ready-to-show', () => {
    authWindow.show();
  });

  authWindow.on('closed', () => {
    authWindow = null;
  });

  authWindow.loadURL(authUrl);
  return authWindow;
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
    mainWindow.loadURL(`${WEB_URL}/onboard`);
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

// ─── App lifecycle ──────────────────────────────────────────────────
app.whenReady().then(() => {
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
