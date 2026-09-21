const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  isAuthenticated: () => ipcRenderer.invoke('auth:is-authenticated'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  openBrowser: (url) => ipcRenderer.invoke('auth:open-browser', url),

  // App info
  getInfo: () => ipcRenderer.invoke('app:get-info'),

  // Platform
  platform: process.platform,
});
