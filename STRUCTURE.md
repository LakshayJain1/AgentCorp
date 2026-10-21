# AgentCorp — Codebase Structure

Every file and folder in the repo, with a one-liner on what it does.

---

## Root

| File | What it does |
|---|---|
| `package.json` | NPM manifest — lists all dependencies, scripts (`dev`, `build`, `start`), and project metadata |
| `pnpm-lock.yaml` | Exact locked versions of every installed package (auto-generated, don't edit) |
| `pnpm-workspace.yaml` | Declares this as a pnpm workspace (covers both the Next.js app and the `desktop/` package) |
| `package-lock.json` | NPM fallback lockfile (exists alongside pnpm-lock; not the primary) |
| `tsconfig.json` | TypeScript compiler config — path aliases (`@/*` → `src/*`), strict mode, target |
| `tsconfig.tsbuildinfo` | TypeScript incremental build cache (auto-generated) |
| `next.config.ts` | Next.js config — custom webpack rules, image domains, env variable exposure |
| `next-env.d.ts` | Auto-generated Next.js type declarations (never edit) |
| `eslint.config.mjs` | ESLint rules — Next.js defaults + any project-specific overrides |
| `postcss.config.mjs` | PostCSS config — wires Tailwind CSS into the build pipeline |
| `.env` | Local environment variables (gitignored) — API keys, Auth0 credentials |
| `.env.local` | Local-only overrides (gitignored) — takes priority over `.env` |
| `.env.auth0.example` | Template showing every Auth0 env var needed — copy to `.env` to configure |
| `.gitignore` | Files and folders git should never track — node_modules, .env, .next, dist |
| `AGENTS.md` | Claude Code instructions: tells the AI assistant this is Next.js 16 with breaking changes |
| `CLAUDE.md` | Entrypoint that references `AGENTS.md` — loaded by Claude Code automatically |
| `ARCHITECTURE.md` | High-level system architecture doc — agent roles, data flow, orchestration |
| `README.md` | Public-facing project description and setup instructions |

---

## `src/` — Application Source

### `src/proxy.ts`
Next.js 16 proxy file (replaces `middleware.ts`). Runs on every request — mounts Auth0 session handling so `/auth/login`, `/auth/callback`, `/auth/logout` work automatically.

---

### `src/app/` — Next.js App Router Pages & API Routes

Every folder here maps to a URL. `page.tsx` = the page. `layout.tsx` = a wrapper. `_actions.ts` = server actions called from the client.

| File | URL / Purpose |
|---|---|
| `layout.tsx` | Root layout — wraps every page with `Auth0Provider`, global fonts, and CSS |
| `globals.css` | Global Tailwind base styles, custom CSS variables (colors, glass effects) |
| `favicon.ico` | Browser tab icon |
| `page.tsx` | Homepage (`/`) — marketing landing page |
| `workspace/page.tsx` | Main workspace UI (`/workspace`) — the three-panel agent dashboard |
| `workspace/_actions.ts` | Server actions for workspace — session checks, agent state bootstrapping |
| `onboard/page.tsx` | Onboarding wizard page (`/onboard`) — shown to new users before workspace |
| `onboard/layout.tsx` | Onboard layout — validates Auth0 session before rendering the wizard |
| `onboard/_actions.ts` | Server action `completeOnboarding` — validates auth and records completion |
| `desktop-redirect/page.tsx` | Desktop auth bridge (`/desktop-redirect`) — after browser login, hands token to Electron app via local HTTP or deep link |
| `desktop-redirect/_actions.ts` | Server action — reads Auth0 session and builds the `agentcorp://` deep-link payload |
| `download/page.tsx` | Download page (`/download`) — links to the Windows `.exe` installer |
| `sign-in/[[...sign-in]]/page.tsx` | Legacy Clerk-style sign-in bridge — maps `?redirect_url=` → `/auth/login?returnTo=` |
| `sign-up/[[...sign-up]]/page.tsx` | Legacy Clerk-style sign-up bridge — redirects to `/auth/login?screen_hint=signup` |
| `api/ai/route.ts` | `POST /api/ai` — proxies chat completions to OpenRouter (Claude/GPT models) |
| `api/gemini/route.ts` | `POST /api/gemini` — proxies requests to Google Gemini API |
| `api/sse/route.ts` | `GET /api/sse` — Server-Sent Events stream; pushes real-time orchestrator events to the browser |
| `api/tool/route.ts` | `POST /api/tool` — executes a named tool (GitHub, file ops, etc.) on behalf of an agent |
| `api/connectors/status/route.ts` | `GET /api/connectors/status` — returns which integrations are currently connected |
| `api/github/branch/route.ts` | `POST /api/github/branch` — creates a new branch on a GitHub repo |
| `api/github/checks/route.ts` | `GET /api/github/checks` — fetches CI check status for a branch |
| `api/github/file/route.ts` | `GET/POST /api/github/file` — reads or writes a file to a GitHub repo |
| `api/github/propose/route.ts` | `POST /api/github/propose` — creates a pull request from a branch |

---

### `src/components/` — React UI Components

All client-side UI. Every file is a standalone React component used inside the workspace.

| File | What it renders |
|---|---|
| `TopBar.tsx` | Top navigation bar — logo, global search (Cmd+K), user avatar, pause/resume button, efficiency ring |
| `LeftSidebar.tsx` | Left panel — agent roster cards, each showing role, status, mood, and current task |
| `CenterPanel.tsx` | Center panel — switches between the 2D office canvas, task queue, and deliverable viewer |
| `RightPanel.tsx` | Right panel — Overview tab (live stats, execution log, deliverables) and Integrations tab |
| `ConversationPanel.tsx` | Chat interface — send messages to individual agents or broadcast to all; shows conversation history |
| `ConnectorsTab.tsx` | Integrations UI inside RightPanel — toggle GitHub, Slack, Figma, etc.; shows connection state |
| `SetupWizard.tsx` | Multi-step onboarding wizard — company setup, agent configuration, Auth0 sign-in step |
| `ScrumMeeting.tsx` | Scrum standup modal — shows each agent's current status, blockers, and progress |
| `TaskQueue.tsx` | Task list UI — shows pending/in-progress/completed tasks with execution log per task |
| `TaskProgressTracker.tsx` | Progress bar and step tracker for a single task as it moves through the pipeline |
| `AgentInspector.tsx` | Detailed agent panel — shows selected agent's memory, performance metrics, and recent activity |
| `AgentVisualizer.tsx` | Network graph visualization of agent-to-agent communication and task handoffs |
| `AgentEcosystemIllustration.tsx` | Decorative SVG illustration of the agent ecosystem (used on landing/onboard pages) |
| `ActivityFeed.tsx` | Real-time feed of agent activities and game events in the workspace |
| `EventLog.tsx` | Scrollable log of system events (task created, agent assigned, deliverable ready) |
| `ExecutionLogViewer.tsx` | Standalone execution log component — displays tool calls with status indicators |
| `ProjectsFolder.tsx` | File-explorer-style view of all completed deliverable projects |
| `CompanyMetrics.tsx` | KPI dashboard tiles — total tasks, efficiency score, active agents, sprint velocity |
| `CredentialDialog.tsx` | Modal for entering API keys and credentials required by a task before it can run |

---

### `src/store/` — Global State

| File | What it does |
|---|---|
| `gameStore.ts` | Single Zustand store for the entire app — agents, tasks, deliverables, simulation state, events, connectors. Persisted to localStorage. The source of truth for everything in the UI. |

---

### `src/agents/` — Agent Definitions & Worker Logic

| File | What it does |
|---|---|
| `AgentTypes.ts` | All TypeScript interfaces and enums — `Agent`, `Task`, `SubTask`, `TaskExecutionLog`, `DeliverableProject`, roles, statuses, etc. |
| `BaseWorkerAgent.ts` | Abstract base class all worker agents extend — defines `execute()`, `generateDeliverable()`, and tool-calling scaffolding |
| `DeveloperAgent.ts` | Engineer agent — generates code, components, APIs, and HTML pages based on task type detection |
| `ResearchAgent.ts` | Researcher agent — produces analysis reports, data summaries, and investigation docs |
| `QAAgent.ts` | QA agent — reviews deliverables, runs acceptance criteria checks, approves or rejects |
| `ValidatorAgent.ts` | Internal validator used by the orchestrator to verify deliverable quality before completion |
| `FinanceAgent.ts` | Finance agent — builds financial projections, P&L tables, budget docs, and runway analyses |
| `OpsAgent.ts` | Ops agent — writes SOPs, runbooks, onboarding plans, and OKR frameworks |
| `SalesAgent.ts` | Sales agent — creates pitch decks, pricing strategies, outreach sequences, and ICP docs |

---

### `src/ai/` — AI Service Layer

| File | What it does |
|---|---|
| `AIService.ts` | Central AI client — wraps OpenRouter and Gemini APIs; handles `askTaskAgent()` (agent chat) and `generateDeliverable()` (content generation) with retry and fallback logic |
| `AgentPersonalities.ts` | Loads and parses `public/config/agent-personalities.md` at runtime — maps each role to its system prompt, stage prompts, and communication style |
| `IntentClassifier.ts` | Classifies user chat messages — determines if input is a task request, a question, a command, or generic conversation so the system routes it correctly |

---

### `src/orchestrator/` — Task Orchestration Engine

| File | What it does |
|---|---|
| `CentralOrchestrator.ts` | Main orchestration brain — receives tasks, selects workers, calls `generateDeliverable`, stores results, and emits log events; drives the full task lifecycle |
| `PlannerAgent.ts` | Breaks a high-level task into subtasks, estimates complexity, and sequences the work plan |
| `TaskQueue.ts` | In-memory priority queue — holds queued subtasks, manages worker availability, and dispatches work |
| `LoopOrchestrator.ts` | Runs the autonomous multi-step agent loop — re-invokes agents iteratively until a task is complete or a stop condition is met |
| `LoopTypes.ts` | TypeScript types for the loop orchestrator — `LoopStep`, `LoopState`, termination conditions |

---

### `src/systems/` — Simulation & Event Systems

| File | What it does |
|---|---|
| `TaskSystem.ts` | Pipeline runner — processes tasks through pending → prioritized → assigned states; CEO and PM agent calls happen here |
| `ConversationSystem.ts` | Routes inter-agent messages and user → agent chat; manages conversation history per agent |
| `EventSystem.ts` | Creates, queues, and dispatches game events (task updates, agent state changes) to the store and SSE stream |
| `TaskDiscovery.ts` | Auto-discovers and surfaces task ideas based on company context and agent availability |

---

### `src/runtime/` — Agent Runtime Environment

| File | What it does |
|---|---|
| `ToolRegistry.ts` | Registry of all tools agents can call (GitHub, file read/write, search, etc.) — maps tool names to their implementations |
| `AgentMemory.ts` | Per-agent short-term memory — stores recent context, observations, and shared team memory entries |
| `AgentCommunication.ts` | Message bus for agent-to-agent communication — handles direct messages, broadcasts, and @mentions |

---

### `src/connectors/` — External Service Integrations

| File | What it does |
|---|---|
| `ConnectorTypes.ts` | TypeScript interfaces for all integration connectors — `GitHubConnector`, `SlackConnector`, etc. |
| `GitHubClient.ts` | GitHub API client — authenticated requests for file read/write, branch creation, PRs |
| `GitHubChecks.ts` | Polls GitHub Actions CI status for a branch and surfaces pass/fail to the orchestrator |
| `KeyVault.ts` | Credential store — reads user-provided API keys from the game store and resolves them per connector |

---

### `src/execution/` — Tool Execution Layer

| File | What it does |
|---|---|
| `ToolExecutor.ts` | Executes a named tool call with given parameters — validates inputs, calls the implementation, handles errors |
| `ExecutionLogStream.ts` | In-memory stream of tool execution events — buffered and emitted to the SSE endpoint |
| `Sandbox.ts` | Execution sandbox wrapper — isolates tool calls and enforces timeouts and output size limits |

---

### `src/memory/` — Long-Term Memory

| File | What it does |
|---|---|
| `MemoryStore.ts` | Persistent agent memory store — saves observations, decisions, and outcomes across sessions |
| `VectorMemory.ts` | Simple vector-similarity memory lookup — finds relevant past memories by keyword proximity for context injection |

---

### `src/hr/` — HR & Performance System

| File | What it does |
|---|---|
| `HRSystem.ts` | Tracks agent performance scores — records task completions, calculates efficiency ratings, triggers HR evaluations |
| `PerformanceMetrics.ts` | Defines and computes the performance metric formulas (velocity, reliability, collaboration score) |
| `PromotionManager.ts` | Evaluates agents for role upgrades or efficiency bonuses based on accumulated performance data |
| `ComplianceDocumentation.md` | Internal HR policy doc — outlines agent evaluation criteria and escalation procedures |

---

### `src/config/` — Runtime Configuration

| File | What it does |
|---|---|
| `ConfigLoader.ts` | Loads and parses the markdown config files from `public/config/` at runtime — agent personalities, game config, deliverable templates |
| `preload.ts` | Pre-loads config at app startup so the first render has personality and game data available immediately |

---

### `src/lib/` — Shared Library Utilities

| File | What it does |
|---|---|
| `auth0.ts` | Creates and exports the singleton `Auth0Client` instance used by all server-side auth calls (`getSession`, `getAccessToken`) |

---

### `src/game/` — 2D Office Simulation (PixiJS)

| File | What it does |
|---|---|
| `GameCanvas.tsx` | React component that mounts the PixiJS canvas into the DOM and bootstraps the game loop |
| `pixi/OfficeRenderer.ts` | Draws the office background — floor tiles, wall, windows, furniture placed from the sprite sheet |
| `pixi/AgentEntity.ts` | Represents one agent sprite on the canvas — handles walking animation, direction, desk sitting, and status bubble |
| `pixi/AgentManager.ts` | Manages all `AgentEntity` instances — syncs game store agent state to their canvas positions and animations |
| `pixi/SimulationLoop.ts` | Runs the PixiJS ticker — advances agent walking, triggers random movement, syncs with simulation pause state |
| `pixi/PixiOfficeLayout.ts` | Defines desk positions, walkable zones, and room boundaries for agent pathfinding |
| `pixi/PixiGameConfig.ts` | Static constants for the Pixi renderer — canvas size, tile size, sprite sheet frame dimensions |
| `pixi/UIOverlay.ts` | Draws HUD elements on the canvas — agent name tags, task bubbles, and status indicators above sprites |

---

### `src/websocket/`

| File | What it does |
|---|---|
| `LiveServer.ts` | WebSocket server helper — used for real-time event push from orchestrator to browser (now mostly superseded by SSE) |

---

## `desktop/` — Electron Desktop App

| File | What it does |
|---|---|
| `main.js` | Electron main process — creates the BrowserWindow, handles Auth0 PKCE sign-in flow, runs the local HTTP auth server (port 51432), processes deep links (`agentcorp://`), and manages IPC |
| `preload.js` | Electron preload script — exposes a safe `window.electronAPI` bridge to the renderer (auth info, IPC calls) |
| `index.html` | Fallback HTML shown when the Next.js server is unreachable in dev mode |
| `README.md` | Desktop-specific setup and build instructions |
| `dist/` | Compiled Electron installers (`.exe`, `.blockmap`, unpacked app) — output of `electron-builder` |

---

## `public/` — Static Assets

| Path | What it is |
|---|---|
| `public/config/agent-personalities.md` | Editable personality definitions for all 9 agents — loaded at runtime, no rebuild needed |
| `public/config/game-config.md` | Game simulation parameters — tick rate, agent speeds, task generation frequency |
| `public/config/deliverable-templates.md` | Output format templates for each deliverable type (code, report, spec) |
| `public/config/intent-patterns.md` | Regex/keyword patterns used by the intent classifier to categorize user input |
| `public/sprites/ComputerSheet.png` | Sprite sheet of 10 computer monitor frames — used for animated desk computers in the office |
| `public/sprites/floor_tile.png` | Single repeating floor tile (blue brick) used to tile the office floor |
| `public/sprites/wall_top.png` | Top wall strip sprite for the office background |
| `public/sprites/pixeloffice/PixelOffice.png` | Small reference image of the full office scene |
| `public/sprites/pixeloffice/LargePixelOffice.png` | Large hi-res reference of the full pixel office — the artistic target for the canvas |
| `public/sprites/pixeloffice/PixelOfficeAssets.png` | Sprite sheet of individual office furniture — desks, chairs, couches, plants, vending machines |
| `public/sprites/agents/*.png` | Large portrait sprites per agent role (ceo, engineer, hr, pm, qa, researcher) — used in UI cards |
| `public/sprites/agents/walk/*.png` | Walk-pose variants of each agent portrait |
| `public/sprites/agents/ceo/*.png` | Multi-directional walk strips and talk/point animations for the CEO agent |
| `public/downloads/AgentCorp-Setup-2.0.0.exe` | Windows installer served from the `/download` page |

---

## File Extensions Quick Reference

| Extension | What it means in this project |
|---|---|
| `.tsx` | React component with TypeScript — UI files, pages, anything that returns JSX |
| `.ts` | TypeScript module — business logic, stores, services, types; no JSX |
| `.md` | Markdown — config files loaded at runtime, documentation, HR docs |
| `.css` | CSS — only `globals.css` exists; everything else uses Tailwind utility classes inline |
| `.mjs` | ES Module JavaScript — config files that need ESM syntax (`eslint.config.mjs`, `postcss.config.mjs`) |
| `.json` | JSON — `package.json`, `tsconfig.json`, lockfiles |
| `.yaml` / `.yml` | YAML — `pnpm-workspace.yaml`, `pnpm-lock.yaml`, Electron builder config |
| `.ico` | Browser favicon |
| `.png` | Sprite sheets and agent portrait images used by the game canvas |
| `.exe` | Windows Electron installer (in `public/downloads/` and `desktop/dist/`) |
