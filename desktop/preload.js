const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth (browser-based: sign in on the web, session returns via deep link)
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  isAuthenticated: () => ipcRenderer.invoke('auth:is-authenticated'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  openBrowser: (url) => ipcRenderer.invoke('auth:open-browser', url),
  startBrowserSignin: () => ipcRenderer.invoke('auth:start-browser-signin'),
  handleLink: (url) => ipcRenderer.invoke('auth:handle-link', url),

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
    setRoot: (dir) => ipcRenderer.invoke('workspace:set-root', dir),
    getRoot: () => ipcRenderer.invoke('workspace:get-root'),
  },

  // Desktop file executor — sandboxed to the workspace root
  fs: {
    read: (relPath) => ipcRenderer.invoke('fs:read', relPath),
    write: (relPath, content) => ipcRenderer.invoke('fs:write', relPath, content),
    search: (pattern, relDir) => ipcRenderer.invoke('fs:search', pattern, relDir),
  },

  // Desktop exec — allowlisted commands only (tsc, npx, node, npm)
  exec: {
    run: (cmd, args, relCwd) => ipcRenderer.invoke('exec:run', { cmd, args, relCwd }),
  },

  // Platform
  platform: process.platform,
});

// Marker read by the web app's detectExecutorEnv() to enable desktop capabilities.
contextBridge.exposeInMainWorld('agentcorpDesktop', {
  available: true,
});
