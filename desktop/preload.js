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

  // Platform
  platform: process.platform,
});

// Marker read by the web app's detectExecutorEnv() to enable desktop capabilities.
contextBridge.exposeInMainWorld('agentcorpDesktop', {
  available: true,
});
