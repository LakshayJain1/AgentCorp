# AgentCorp Architecture

## Overview

AgentCorp is a **multi-agent autonomous operating system** where AI agents collaborate to perform real software engineering work on a codebase. It combines a Phaser 2D office simulation (visual layer) with a Next.js runtime (execution layer) and state management via Zustand.

The premise: AI agents (CEO, PM, Researcher, Engineer, QA, HR) work together to discover, plan, and execute real tasks — scanning for codebase issues, generating components, writing reports, running validations, and writing results to the actual file system.

The project has evolved through two architectural phases:
- **Old system**: `TaskSystem` handles task management flow (pending → prioritized → assigned) via CEO/PM AI prompts
- **New system**: `CentralOrchestrator` + `PlannerAgent` + `TaskQueue` + Worker Agents handle subtask breakdown, dispatch, execution, and validation

Both systems currently run in parallel with overlapping responsibilities.

---

## Directory Structure

```
agentcorp/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── tool/route.ts         # File I/O + command execution API (server-side)
│   │   │   ├── ai/route.ts           # AI proxy (OpenRouter → Gemini fallback)
│   │   │   ├── gemini/route.ts       # Direct Gemini endpoint
│   │   │   └── sse/route.ts          # Server-Sent Events for live execution streaming
│   │   ├── page.tsx                  # Main page: GameCanvas + RightPanel layout
│   │   ├── layout.tsx                # Root layout with dark theme
│   │   ├── globals.css               # Tailwind CSS + dark theme vars
│   │   └── favicon.ico
│   │
│   ├── components/                   # React UI panels (15 files)
│   │   ├── TopBar.tsx                # Title bar + pause/speed controls
│   │   ├── RightPanel.tsx            # Sidebar container orchestrating all panels
│   │   ├── TaskQueue.tsx             # Task list with status, priority, assignee
│   │   ├── AgentInspector.tsx        # Agent detail: work status, performance, memory, activity
│   │   ├── ConversationPanel.tsx     # Inter-agent chat messages
│   │   ├── ExecutionLogViewer.tsx    # Terminal-style tool execution logs
│   │   ├── ActivityFeed.tsx          # Live agent activity stream
│   │   ├── EventLog.tsx              # System event log
│   │   ├── CompanyMetrics.tsx        # Efficiency, morale, task completed counters
│   │   ├── AgentVisualizer.tsx       # Agent state/FSM visualization
│   │   ├── CredentialDialog.tsx      # Modal for external credential requests
│   │   ├── EasterEgg.tsx             # Hidden interactive feature
│   │   ├── ScrumMeeting.tsx          # Daily scrum meeting UI
│   │   ├── TaskProgressTracker.tsx   # Per-task subtask progress visualization
│   │   └── ThemeToggle.tsx           # Light/dark mode toggle
│   │
│   ├── agents/                       # Agent class hierarchy
│   │   ├── AgentTypes.ts             # All TypeScript interfaces (Agent, Task, Activity, etc.)
│   │   ├── BaseWorkerAgent.ts        # Abstract base class for worker agents with step execution
│   │   ├── DeveloperAgent.ts         # Code/doc/analysis subtask execution (extends BaseWorkerAgent)
│   │   ├── QAAgent.ts               # QA validation subtask execution (extends BaseWorkerAgent)
│   │   ├── ResearchAgent.ts         # Research subtask execution (extends BaseWorkerAgent)
│   │   └── ValidatorAgent.ts        # Standalone validator: tsc + lint + content checks with retry logic
│   │
│   ├── runtime/                      # Core execution engines
│   │   ├── AgentRuntime.ts           # Tick-based agent work loop (engineer 10-step pipeline)
│   │   ├── SimpleRuntime.ts          # AI-prompt → code-block extraction → write → tsc verify
│   │   ├── ToolRegistry.ts           # 7 registered tools (read/write/search/execute/ask AI)
│   │   ├── AgentMemory.ts            # Per-agent + shared memory (localStorage-backed)
│   │   └── AgentCommunication.ts     # Inter-agent send/reply/broadcast
│   │
│   ├── orchestrator/                 # Central orchestration system
│   │   ├── CentralOrchestrator.ts    # 6-phase tick: processTasks → plan → dispatch → worker tick → validate → complete
│   │   ├── PlannerAgent.ts           # AI-powered task breakdown into subtasks (max 5 per task)
│   │   └── TaskQueue.ts              # Priority queue with dependency resolution + retry support
│   │
│   ├── systems/                      # Game logic systems
│   │   ├── TaskSystem.ts             # Task state machine: processTasks() + maybeCreateNewTask()
│   │   ├── TaskDiscovery.ts          # Scans for reportable issues (tsc errors, file count) → analysis tasks
│   │   ├── TaskReviewSystem.ts       # PM-led task review → SimpleRuntime execution flow
│   │   ├── ConversationSystem.ts     # Ambient inter-agent conversation generation (AI + mock fallback)
│   │   └── EventSystem.ts            # Ambient office chatter + background noise
│   │
│   ├── hr/                           # Human resources / performance
│   │   ├── HRSystem.ts               # PerformanceTracker: task metrics, seniority, team eval
│   │   ├── PerformanceMetrics.ts     # Score computation, seniority/promotion level algorithms
│   │   ├── PromotionManager.ts       # Promotion evaluation with thresholds per level
│   │   └── ComplianceDocumentation.md
│   │
│   ├── ai/                           # AI service layer
│   │   ├── AIService.ts              # AI request queue + mock fallback + 20 deliverable templates
│   │   └── AgentPersonalities.ts     # 6 role definitions + system prompts + stage prompts
│   │
│   ├── execution/                    # Execution infrastructure
│   │   ├── ExecutionLogStream.ts     # Real-time event streaming with client subscriptions
│   │   └── Sandbox.ts                # Path/command validation (Docker not implemented)
│   │
│   ├── memory/                       # Long-term memory
│   │   ├── MemoryStore.ts            # Per-agent + shared memory with persistence (localStorage)
│   │   └── VectorMemory.ts           # Vector database (keyword-based similarity, not true vectors)
│   │
│   ├── websocket/
│   │   └── LiveServer.ts             # SSE client management, event buffering, broadcast
│   │
│   ├── ui/                           # (empty — reserved)
│   │
│   ├── store/
│   │   └── gameStore.ts              # Zustand store: agents, tasks, events, simulation state
│   │
│   └── game/
│       ├── GameScene.ts              # Phaser scene: office rendering, game loop, movement AI
│       └── GameCanvas.tsx            # React wrapper mounting the Phaser canvas
│
├── deliverables/                     # Agent-written output files
├── AGENTS.md                         # Instructions for AI coding assistants
└── ARCHITECTURE.md                   # This file
```

---

## The Game Loop (What Drives Everything)

The entire system runs inside Phaser's `GameScene.update()` — a per-frame callback. Each frame, these subsystems fire at different intervals:

```
GameScene.update()  [every frame ~16ms at 60fps]
│
├─ [EVERY FRAME]      updateMovement(agent, dt)     # Walk agents toward targets
│                     updateEnergy(agent, dt)        # Drain/recharge energy
│                     drawAgent(agent)               # Pixel-art character rendering
│                     updateBubble(agent)             # Speech bubble (5s timeout)
│
├─ [EVERY ~10 FRAMES] generateAmbientChatter()       # Random office background sounds
│
├─ [EVERY ~20 FRAMES] maybeStartConversation()       # Random agent-to-agent chat
│                     updateAgentMoods()             # energy-based mood: tired/focused/happy
│
├─ [EVERY ~30 FRAMES] centralOrchestrator.tick()     # 6-phase orchestration pipeline
│                     (rate-adjusted by sim speed)   # manages processing lock
│
└─ [EVERY 6 FRAMES]   syncAgents()                   # Batch-sync agent state to
                                                        # Zustand (10fps throttle)
```

**Key constraint**: The game loop is the single source of truth for timing. React UI reads from Zustand (throttled to 10fps). The Phaser scene reads agent state directly (60fps) but only syncs to the store every 6 frames to prevent React thrashing.

### Orchestrator Tick (6 Phases)

```
centralOrchestrator.tick()
│
├─ Phase 1: processTasks()          # pending→prioritized→assigned (CEO/PM via TaskSystem)
├─ Phase 2: planner.processPending() # assigned→plan subtasks (PlannerAgent, max 5 subtasks)
├─ Phase 3: taskQueue.dispatch()    # assign ready subtasks to available workers
├─ Phase 4: worker.tick() × N       # each busy worker executes its subtask steps
├─ Phase 5: validator.process()     # validate completed subtasks (tsc + lint + content)
└─ Phase 6: processCompleted()      # pass/fail subtasks, retry up to 3x, HR eval
```

---

## Task Lifecycle (From Creation to Completion)

### 1. Task Creation

`maybeCreateNewTask()` runs via TaskSystem and has two paths:

**Path A — Real codebase discovery (preferred):**
```
taskDiscovery.scanProject()
  ├─ npx tsc --noEmit → count errors → "Analyze N TypeScript errors" task
  └─ ls src/**/*.ts → count files → "Generate health report" task
```
Only creates **analysis/report** tasks — agents cannot fix discovered issues.

**Path B — AI-generated fallback (when < 8 active tasks):**
```
aiService.generateTaskIdea() → random from 20-item list of analysis/QA/review/documentation tasks
```

### 2. Task State Machine

```
                   CEO (AI)            PM (AI)             Planner Agent          Worker Agents
┌──────────┐    ────────────→  ┌──────────────┐  ──────────→  ┌──────────┐  ───────→  ┌──────────────┐
│  pending  │                  │ prioritized  │              │ assigned  │            │  in_progress  │
└──────────┘                   └──────────────┘              └──────────┘             └──────┬───────┘
                                                                                            │
                                                                               ┌────────────┴────────────┐
                                                                               │                       │
                                                                          ┌────▼─────┐          ┌──────▼──────┐
                                                                          │ completed│          │   failed     │
                                                                          └──────────┘          └──────┬───────┘
                                                                                                       │
                                                                                               HR evaluates team
                                                                                               (retry ≤ 3x)
```

- **pending → prioritized**: CEO calls AI, stores decision in shared memory
- **prioritized → assigned**: PM picks random worker, calls AI, sends message
- **assigned → in_progress**: PlannerAgent breaks task into ≤5 subtasks → TaskQueue dispatches to workers
- **in_progress → completed/failed**: Worker executes steps, Validator runs tsc+lint checks

### 3. Task Execution (Worker Agents)

Each worker type has its own step pipeline:

**DeveloperAgent** (code/doc/analysis subtasks):
1. `search_codebase` → 2. `read_directory` → 3. `ask_agent` (plan file path) → 4. `read_file` (check exist) → 5. `ask_agent` (generate content) → 6. `write_file` → 7. `execute_command` (tsc verify) → 8. `ask_agent` (summarize)

**ResearchAgent** (research subtasks):
1. `search_codebase` → 2. `read_directory` → 3. `ask_agent` (generate report) → 4. `write_file` → 5. `ask_agent` (summarize)

**QAAgent** (qa subtasks):
1. `execute_command` (tsc) → 2. `execute_command` (lint) → 3. `ask_agent` (evaluate → QA_PASS/QA_FAIL)

---

## Agent Roles & Responsibilities

| Role | Management Flow | Execution Flow |
|------|----------------|----------------|
| **CEO** | If task `pending`: AI-prioritizes, transitions to `prioritized` | Not involved in execution |
| **PM** | If task `prioritized` & unassigned: picks random worker, assigns via AI | Not involved in execution |
| **Engineer** | Not involved in management | If assigned as `developer`: runs DeveloperAgent pipeline on subtask |
| **Researcher** | Not involved in management | If assigned as `research_worker`: runs ResearchAgent pipeline on subtask |
| **QA** | Not involved in management | If assigned as `qa_worker`: runs QAAgent pipeline on subtask |
| **HR** | Every ~200 ticks: `evaluateTeam()` — scores agents, fires alerts | Tracks performance metrics, promotions via PromotionManager |

All agents have autonomous movement AI (`pickNextGoal()`): go to coffee if energy < 40, visit meeting room (15% chance), wander near workstation, or visit random office locations.

---

## Two Competing Execution Paths

The project has **two parallel execution systems** that both operate on the same tasks:

### System A — AgentRuntime (src/runtime/AgentRuntime.ts)
- Runs via `agentRuntime.tick()` called from GameScene (every ~120 frames)
- Operates on `assigned` tasks directly: AI generates a 10-step plan → executes → marks complete/failed
- Only runs for `engineer` and `researcher` agents
- Tends to **conflict** with System B since both try to claim `assigned` tasks

### System B — CentralOrchestrator (src/orchestrator/CentralOrchestrator.ts)
- Runs via `centralOrchestrator.tick()` called from GameScene (every ~30 frames)
- Calls `processTasks()` (management flow) → PlannerAgent → TaskQueue → Worker Agents → Validator
- Worker agents use `BaseWorkerAgent` subclasses (DeveloperAgent, QAAgent, ResearchAgent)
- Has its own subtask lifecycle independent of the main task status

### SimpleRuntime (src/runtime/SimpleRuntime.ts)
- A third path used by `TaskReviewSystem.ts`
- AI prompt → extract code blocks → write files → tsc verify
- Called when "Review" button is clicked or when PM-led review triggers it
- Only targets `engineer` role agent

### Why This Exists
Transitional architecture. The old TaskSystem does management (CEO/PM delegation). The CentralOrchestrator handles subtask planning/dispatch/execution. The AgentRuntime handles direct engineer execution. Eventually they should be unified.

---

## Data Flow Architecture

```
                     ┌──────────────────────────────────────────┐
                     │           GameScene.update()             │
                     │            (Phaser loop)                  │
                     └──┬──────────┬──────────┬─────────────────┘
                        │          │          │
                ~30fr  │  ~120fr  │  ~6fr   │
                        │          │          │
              ┌─────────▼──┐ ┌─────▼──────┐ ┌─▼──────────────┐
              │centralOrch │ │agentRuntime│ │ syncAgents()   │
              │.tick()     │ │.tick()     │ │ to Zustand     │
              └──────┬─────┘ └─────┬──────┘ └────────────────┘
                     │             │
                     └──────┬──────┘
                            │
              ┌─────────────▼───────────────────┐
              │       Zustand Store (gameStore)   │
              │  agents[] tasks[] events[] mem[]  │
              └──┬───────────────────────┬───────┘
                 │                       │
        ┌────────▼────────┐    ┌─────────▼─────────┐
        │   AIService     │    │   ToolRegistry     │
        │  (queue, 1s     │    │  (7 tools →        │
        │   rate limit)   │    │   /api/tool)       │
        └────────┬────────┘    └─────────┬──────────┘
                 │                       │
        ┌────────▼────────┐    ┌─────────▼─────────┐
        │  /api/ai        │    │  /api/tool         │
        │  OpenRouter     │    │  fs ops + exec     │
        │  / Gemini       │    │  (whitelisted cmds)│
        └─────────────────┘    └───────────────────┘

React UI  ← reads from Zustand via useGameStore hook (reactive, 10fps throttle)
Phaser    ← reads from Zustand via getState() (non-reactive snapshots, 60fps)
Live SSE  ← ExecutionLogStream + LiveServer → /api/sse → client EventSource
```

---

## Performance Constraints

- **React thrashing**: Agents synced to store every frame × 6 agents = 360+ Zustand updates/sec → browser crash. Fixed with 10fps batched sync (every 6 frames).
- **AI rate limiting**: 1s minimum interval between AI requests via AIService queue
- **Array bounding**: Activities (20), conversations (20), execution logs (100), events (50), execution chunks (200), memory entries (100/agent, 500 vectors) — all bounded
- **Processing locks**: `processTasks`/`maybeCreateNewTask` have `processing` boolean; `CentralOrchestrator` has `processing` lock; `ValidatorAgent` has `processing` lock
- **Agent busy lock**: `AgentRuntime` tracks `busyAgents` Set; `BaseWorkerAgent` has `currentSubtask` null check
- **Task cap**: max 8 active tasks at once

---

## Known Issues / Pain Points

1. **Two competing execution systems** — AgentRuntime and CentralOrchestrator both try to claim `assigned` tasks, creating duplicate writes and conflicting state transitions.

2. **AI hallucinates imports** — The AI content prompt explicitly lists available packages (next, react, lucide-react, tailwindcss, zustand, phaser) and forbids `@heroicons`/`react-redux`, but still generates broken imports. The write API rejects content < 50 chars as a guard.

3. **No file modification** — Agents can only create new files. No `edit_line` or `patch_file` tool. `write_file` is overwrite-only.

4. **Task completion is per-tick, not per-step** — The AgentRuntime regenerates the entire step plan every tick (~2 seconds). If a previous tick wrote a file and `tsc` passed, the next tick starts from scratch.

5. **No API key = all mock** — Without an API key, `aiService.askTaskAgent()` returns canned dialogue and `ask_agent` returns generic mock responses. The system still creates tasks and writes template deliverables.

6. **No real vector search** — `VectorMemory` uses keyword overlap, not actual embeddings.

7. **Jittery movement** — No dedicated idle/standing state; `pickNextGoal` re-fires every frame due to `updateEnergy` calling it when `distToTarget < 8 && state !== 'walking'`. Sprite flip uses `Math.cos` per frame causing rapid twitching.

8. **Overlapping conversations** — `maybeStartConversation()` runs every ~20 frames without per-agent locks, so the same agent can be picked for multiple simultaneous chats.

---

## Key File Reference

| File | Purpose |
|------|---------|
| `src/agents/AgentTypes.ts` | All TypeScript interfaces |
| `src/agents/BaseWorkerAgent.ts` | Abstract worker: step execution, stream events, busy lock |
| `src/agents/DeveloperAgent.ts` | Code/doc/analysis subtask steps |
| `src/agents/QAAgent.ts` | QA subtask: tsc + lint + AI evaluation |
| `src/agents/ResearchAgent.ts` | Research subtask: search + analyze + write report |
| `src/agents/ValidatorAgent.ts` | Queued validation with retry (≤3), scoring |
| `src/store/gameStore.ts` | Zustand state + all mutations |
| `src/game/GameScene.ts` | Phaser game loop + office rendering |
| `src/systems/TaskSystem.ts` | Task state machine + task creation |
| `src/systems/TaskDiscovery.ts` | Codebase scanning (tsc errors, file count) |
| `src/systems/TaskReviewSystem.ts` | PM-led review → SimpleRuntime execution |
| `src/systems/ConversationSystem.ts` | Agent-to-agent chat (AI + mock fallback) |
| `src/runtime/AgentRuntime.ts` | Tick-based engineer execution pipeline |
| `src/runtime/SimpleRuntime.ts` | AI → code blocks → write → tsc verify |
| `src/runtime/ToolRegistry.ts` | 7 tool definitions + API dispatch |
| `src/runtime/AgentMemory.ts` | localStorage-backed per-agent + shared memory |
| `src/runtime/AgentCommunication.ts` | Inter-agent send/reply/broadcast |
| `src/orchestrator/CentralOrchestrator.ts` | 6-phase orchestration tick |
| `src/orchestrator/PlannerAgent.ts` | AI subtask breakdown (≤5 subtasks) |
| `src/orchestrator/TaskQueue.ts` | Priority queue with dependency resolution |
| `src/hr/HRSystem.ts` | Performance tracking + team evaluation |
| `src/hr/PerformanceMetrics.ts` | Score/seniority/promotion algorithms |
| `src/hr/PromotionManager.ts` | Agent promotion thresholds |
| `src/memory/MemoryStore.ts` | Persistent per-agent + shared memory |
| `src/memory/VectorMemory.ts` | Keyword-similarity memory store |
| `src/execution/Sandbox.ts` | Path/command validation (not Docker) |
| `src/execution/ExecutionLogStream.ts` | Real-time streaming event bus |
| `src/websocket/LiveServer.ts` | SSE client management + broadcast |
| `src/ai/AIService.ts` | AI queue + mock fallback + 20 template deliverables |
| `src/ai/AgentPersonalities.ts` | 6 role definitions + system prompts |
| `src/app/api/tool/route.ts` | Server-side file/command execution API |
| `src/app/api/ai/route.ts` | Server-side AI proxy (OpenRouter → Gemini) |
| `src/app/api/gemini/route.ts` | Direct Gemini endpoint |
| `src/app/api/sse/route.ts` | Server-Sent Events endpoint |