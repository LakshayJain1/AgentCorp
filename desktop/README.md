# AgentCorp Desktop

Native desktop app for AgentCorp — install and run your AI workspace locally.

## Quick Start

```bash
# From the project root
npm run desktop:install   # Install Electron dependencies
npm run desktop:dev       # Run in dev mode (web + desktop)
```

## Build

```bash
# Build for your current platform
npm run desktop:build

# Build for specific platforms
npm run desktop:build:mac    # macOS (.dmg + .zip)
npm run desktop:build:win    # Windows (.exe installer + portable)
```

## How It Works

1. **Install** — User installs the desktop app (Mac/Windows)
2. **Launch** — App opens and loads the AgentCorp onboard page
3. **Onboard** — User signs up/in via Clerk on the web
4. **Redirect** — After onboarding, web app redirects to `agentcorp://` deep link
5. **Workspace** — Desktop app catches the deep link, stores auth, loads workspace

The desktop app is a native wrapper around the web app — same features, same UI.

## Architecture

```
desktop/
├── main.js          # Electron main process (window, deep links, auth)
├── preload.js       # Secure IPC bridge (contextIsolation)
├── index.html       # Splash screen while web app loads
├── assets/          # App icons (icon.icns, icon.ico, icon.png)
├── package.json     # Electron + electron-builder config
└── dist/            # Build output (gitignored)
```

## Deep Link Flow

```
agentcorp://auth-callback?token=<userId>&userId=<userId>&redirect=/workspace
```

The web app's `/desktop-redirect` route generates this URL after onboarding completes. The desktop app intercepts it, stores the auth token, and loads the workspace.

## Notes

- Auth tokens are stored locally in `userData/auth.json`
- The app uses `session.defaultSession.cookies` to sync auth with the web view
- External links open in the system browser
- Single instance lock prevents multiple app windows
