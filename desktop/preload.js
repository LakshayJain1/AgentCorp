const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth (email-code sign-in runs inside the app window)
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  isAuthenticated: () => ipcRenderer.invoke('auth:is-authenticated'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  openBrowser: (url) => ipcRenderer.invoke('auth:open-browser', url),
  startBrowserSignin: () => ipcRenderer.invoke('auth:start-browser-signin'),

  // App info
  getInfo: () => ipcRenderer.invoke('app:get-info'),

  // P3b: local checks (desktop runner)
  listChecks: () => ipcRenderer.invoke('checks:list'),
  runChecks: (workspaceId, check) => ipcRenderer.invoke('checks:run', { workspaceId, check }),

  // BYOK: user-supplied API keys stored locally, never sent to Vercel
  apiKey: {
    get: (provider) => ipcRenderer.invoke('apikey:get', provider),
    set: (provider, value) => ipcRenderer.invoke('apikey:set', provider, value),
    listProviders: () => ipcRenderer.invoke('apikey:list-providers'),
  },

  // Workspace: set the local directory agents can read/write
  workspace: {
    // Opens a native folder picker; the page cannot choose the path itself.
    setRoot: () => ipcRenderer.invoke('workspace:set-root'),
    getRoot: () => ipcRenderer.invoke('workspace:get-root'),
    clearRoot: () => ipcRenderer.invoke('workspace:clear-root'),
  },

  // Desktop file executor — sandboxed to the workspace root
  fs: {
    read: (relPath) => ipcRenderer.invoke('fs:read', relPath),
    write: (relPath, content) => ipcRenderer.invoke('fs:write', relPath, content),
    search: (pattern, relDir) => ipcRenderer.invoke('fs:search', pattern, relDir),
    list: (relDir) => ipcRenderer.invoke('fs:list', relDir),
  },

  // Desktop exec — allowlisted tools only (tsc/eslint/vitest via npx, npm test/run <script>)
  exec: {
    run: (cmd, args, relCwd) => ipcRenderer.invoke('exec:run', { cmd, args, relCwd }),
    // Tier 2 (npm install, git add/commit, other npm scripts): the main process
    // shows a native approval dialog; this page cannot approve for itself.
    runApproved: (cmd, args, relCwd) => ipcRenderer.invoke('exec:run-approved', { cmd, args, relCwd }),
  },

  // Tells the shell how many agent runs are active (keeps the machine awake and
  // offers to hide to the tray instead of closing).
  runs: {
    setActive: (count) => ipcRenderer.invoke('runs:set-active', count),
  },

  // Platform
  platform: process.platform,
});

// Marker read by the web app's detectExecutorEnv() to enable desktop capabilities.
contextBridge.exposeInMainWorld('agentcorpDesktop', {
  available: true,
});
