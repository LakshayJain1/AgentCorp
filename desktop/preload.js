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

  // BYOK: the user's own AI key. It is stored and used only in the main process; there is
  // deliberately no call that returns it. `run` sends one request straight to the provider.
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    save: (input) => ipcRenderer.invoke('ai:save', input),
    setModel: (model) => ipcRenderer.invoke('ai:set-model', model),
    clear: () => ipcRenderer.invoke('ai:clear'),
    test: () => ipcRenderer.invoke('ai:test'),
    // run({prompt, system?, temperature?, maxTokens?, stream?}, onDelta?) -> { cancel(), result: Promise<{ok, content?, error?}> }
    run: (req, onDelta) => {
      const id = 'ai_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      const handler = (_e, msg) => { if (msg && msg.id === id && typeof msg.delta === 'string' && onDelta) onDelta(msg.delta); };
      ipcRenderer.on('ai:event', handler);
      const result = ipcRenderer.invoke('ai:run', { ...req, id })
        .catch((e) => ({ ok: false, error: String((e && e.message) || e) }))
        .finally(() => ipcRenderer.removeListener('ai:event', handler));
      return { cancel: () => { ipcRenderer.invoke('ai:cancel', id).catch(() => {}); }, result };
    },
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
