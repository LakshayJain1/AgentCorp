# AgentCorp: Autonomy Roadmap (revised tickets)

**Constraint:** everything stays free to run. No hosted sandbox, no server-side job runner.
**Strategy:** one agent loop that runs **client-side**, with two tool tiers.

| Tier | Where | Tools | Lifetime of a run |
|---|---|---|---|
| **Web** | Vercel-hosted site in a browser | connectors, web fetch, text reasoning, downloadable deliverables. **No write/exec tools.** | while the tab is open |
| **Desktop** | Electron app (loads the hosted site, adds IPC) | everything in Web **plus** `fs` (read/write/search in a user-picked folder) and allowlisted `exec` (tsc / eslint / vitest / npm scripts) | while the app is open |

LLM tokens: web tier uses the shared server key with a tight step budget. Desktop tier prefers the user's own key (BYOK, already built).

Sizes: S ≤ 0.5 day, M ≈ 1-3 days, L ≈ 3-7 days. "Needs" = hard dependency.

---

## Findings that shaped this list (verified in code)

1. **The whole engine is driven by the renderer.**
   - `SimulationLoop.ts:68-74` calls `centralOrchestrator.tick()` from the Pixi ticker (requestAnimationFrame).
   - `PixiGameConfig.ts:70-72` calls `store.initAgents()` and `centralOrchestrator.initWorkers()` *inside* `PixiGame.initialize`, **after** `app.init({preference:'webgl'})`.
   - If WebGL init throws, `GameCanvas.tsx:22-25` only shows an error box. Agents are never initialized, workers never registered, and no tick ever runs. **This is the most likely cause of "works for some, not for others"** (not yet reproduced on a machine without WebGL).
   - rAF is paused in background tabs, so agent work also stalls when the user switches tabs.
2. **Three overlapping progress sources**, none of which the chat uses:
   `StreamEvent` (`orchestrator.emit`, types `log|status|subtask|validation|review|error`), `ExecutionStreamChunk` (`ExecutionLogStream`), and `TaskExecutionLog` (`task.executionLogs` in the store, the only one `ExecutionLogViewer` reads, capped at 100 entries).
3. **Chat is plain bubbles.** `CenterPanel.tsx:66-91` builds messages from `agent.conversations` + `userMessages`; rendering is at `CenterPanel.tsx:343-398`. Agent messages are a single text bubble.
4. **Desktop already has the local sandbox**: workspace folder picker, `fs:read/write/search`, allowlisted `exec:run` and `checks:run`, BYOK key store, `detectExecutorEnv()` in `ToolExecutor.ts`.
5. **Two workspace concepts**: `checks:run` uses `userData/workspaces/<id>` (must be "cloned"); `fs:*` uses the user-picked `workspaceRoot`. An agent could edit one folder and check another.
6. `VectorMemory` is keyword matching in `localStorage` and nothing imports it.

---

# Epic A: Reliability and honesty (ship first)

### A0 · Decouple the engine from the renderer  `M`  (new, highest priority)
**Why:** Finding 1. Rendering failure or a background tab must not stop agents.
**Scope**
- New `src/engine/EngineRuntime.ts` (name flexible) that owns: `store.initAgents()`, `centralOrchestrator.initWorkers()`, the orchestrator tick loop, and `updateAgentMoods()`.
- Tick driven by a timer, not rAF. Preserve current cadence: `max(1, floor(30 / speed))` frames at ~60fps, so roughly 500ms at speed 1. Respect `simulation.paused` / `speed`.
- Start it from the app shell (where the workspace mounts), not from `GameCanvas`.
- `SimulationLoop` keeps only visual work (`agentManager.update`, `syncFromStore`, overlay).
- **Audit `SimulationLoop.syncAgentsToStore` / `syncSimulationMetrics`** (`SimulationLoop.ts:99+`): it copies entity-derived state into the store. Any store state that only exists because the renderer ran must be computed in the engine instead.
- Background-tab behavior: timers throttle to ~1/s in hidden tabs. Acceptable for web (document it). For desktop set `backgroundThrottling: false` (verify current `webPreferences` in `desktop/main.js`).
**Acceptance**
- With WebGL disabled (`--disable-gpu` or Chrome flag), a chat request still creates a ticket, runs a worker and returns a result.
- Switching to another tab for 60s does not lose the run; it finishes (slower) or resumes on return.
- No duplicate ticking when the office view mounts/unmounts. `initWorkers()` runs exactly once per session. Test by toggling office tab 10 times.
- Existing office visuals unchanged when WebGL works.

### A1 · Office WebGL fallback  `S`  (needs A0)
**Scope:** in `GameCanvas.tsx`, replace the red error box with a friendly static view (agent roster with status chips, or a simple CSS office) plus one line: "Hardware acceleration seems off. The office is a visual only; your team still works." Add a "Retry" button that re-runs `pixiGame.initialize`. Also try `preference: 'webgl'` then fall back to the Canvas renderer if Pixi v8 supports it in this version (**check `node_modules/pixi.js` docs; AGENTS.md warns versions differ**).
**Acceptance:** forced init failure renders the fallback, chat stays fully functional, no console crash loop.

### A2 · Optional / lazy office  `S`  (needs A0)
**Scope:** the office is currently always mounted but hidden (`CenterPanel.tsx:530-531`). After A0, mount `GameCanvas` only when `centerView === 'office'`, destroy on leave. Default to chat. Remember last view per user (localStorage, wrapped in try/catch).
**Acceptance:** opening the app on chat creates no WebGL context; switching to Office creates one; switching away releases it (check with `chrome://gpu` / context count).

### A3 · Honest naming for memory  `S`
**Scope:** rename `src/memory/VectorMemory.ts` to `KeywordMemory.ts` (and the `MemoryVector` type if it's only used here), or delete it if truly unused (re-verify imports). Remove any "vector/RAG" wording from UI, landing copy and README.
**Acceptance:** `grep -ri "vector memory\|rag"` over `src` and copy returns nothing misleading; build passes.

---

# Epic B: Inline execution in chat

### B1 · Unified run-event schema  `M`
**Why:** Finding 2. One source of truth for "what is the team doing".
**Scope**
- New `RunEvent` union in `AgentTypes.ts`: `run.started`, `step.started`, `step.progress`, `tool.call`, `tool.result`, `validation.result`, `retry`, `blocked`, `summary.delta`, `run.finished`, `run.failed`. Every event carries `runId`, `taskId`, `subtaskId?`, `agentId`, `timestamp`, and a stable `id`.
- One `RunEventBus` (client-side, in-memory + mirrored into the store keyed by `taskId`). Adapt the existing emitters to publish into it: `CentralOrchestrator.emit`, `ExecutionLogStream.push`, and the places that write `task.executionLogs`. Keep the old APIs working during migration.
**Acceptance:** a single task produces an ordered event list that contains the triage, assignment, each subtask start/finish, each validation score and each retry. Unit test with a fake run (vitest is already allowed by the desktop runner).

### B2 · Inline "steps" block in chat  `M`  (needs B1)
**Scope:** in `CenterPanel.tsx` (message list at L343-398) render, for each task, a collapsible block attached to the agent's message thread: live step list with status icons (running / done / retried / failed), agent name + role icon (`RoleIcon`), elapsed time, and expandable tool output. Collapsed by default once the run finishes; shows a one-line summary ("4 steps, 1 retry, 38s"). Must render correctly with `@mention` direct tasks and `action` intents (`executeActionDirect`).
**Acceptance:** sending "build a pricing page" shows steps appearing live under the PM/dev reply without opening the right panel; failed step shows the error and the retry that followed; works on mobile width.

### B3 · Streamed final summary  `M`  (needs B1)
**Scope:** stream the agent's final answer token-by-token into the chat bubble. Add a streaming variant to the AI route (SSE / `ReadableStream`) and a `summary.delta` consumer. Non-streaming providers (mock mode, `AIService` without key) must still work by emitting a single delta. Each stream is one short request, so Vercel duration limits are not a concern.
**Acceptance:** text appears progressively; stopping mid-stream doesn't corrupt state; mock mode still shows the full message.

### B4 · Demote the right-hand log  `S`  (needs B2)
**Scope:** `ExecutionLogViewer.tsx` reads `RunEvent`s instead of `task.executionLogs`, removes the 100-entry and 180px caps in favor of a filterable (by task / agent / status) detail view. Chat is the primary surface.
**Acceptance:** same events visible in both places, no duplicate-entry bugs, scrolling performance fine at 1,000 events.

---

# Epic C: Agent runtime (client-side loop, two tiers)

### C0a · Capability tiers on tools  `S`
**Scope:** extend `ToolExecutor.ts` / `ToolRegistry.ts` so each tool declares `tier: 'web' | 'desktop'`. The loop asks the registry for "tools available in this environment" using `detectExecutorEnv()`.
**Acceptance:** on web, `write_file` / `run_check` are absent from the model's tool list; on desktop they're present. Test both with a mocked `window.agentcorpDesktop`.

### C0b · Unify the two workspaces  `M`  *(do before C4)*
**Why:** Finding 5. Verify first: read `main.js` `exec:run` (starts ~L637) and every caller (`ValidatorAgent.ts:51`, `TaskDiscovery.ts:13`, `ToolExecutor.ts`).
**Scope:** `checks:run`, `exec:run` and `fs:*` all use the same `workspaceRoot`. Remove or deprecate the `userData/workspaces/<id>` path. Keep the user-picks-the-folder rule. The renderer must not be able to choose the path.
**Acceptance:** write a failing file via `fs:write`, run `typecheck` via `checks:run`, see the error from that same file.

### C0c · Keep-alive on desktop  `S`
**Scope:** `powerSaveBlocker.start('prevent-app-suspension')` while a run is active; `webPreferences.backgroundThrottling = false`; closing the window with a run active offers "keep running in tray / quit".
**Acceptance:** start a long task, lock the screen for 5 minutes, the run completes.

### C0d · IPC version handshake  `S`
**Why:** the desktop app loads the hosted site, so web code updates instantly but the preload bridge only changes with an installer.
**Scope:** `app:get-info` returns `ipcVersion`; web checks it against the version the current build needs per tool. If too old: hide the tool, show "Update the desktop app to enable X" with a link to the download page.
**Acceptance:** with a stubbed old `ipcVersion`, the app doesn't crash and explains what's missing.

### C0e · Approval-gated commands  `M`
**Scope:** keep the current deny-by-default allowlist as tier 1 (auto-allowed). Add tier 2 (needs user approval in-app): `npm install`, `git status/diff/add/commit`, and arbitrary `npm run <script>` outside the current list. Approval dialog shows the exact command, cwd and "allow once / allow for this workspace". Never allow `node -e`, shell metacharacters, absolute paths or `..`. Reuse `argsAreSafe` / `BLOCKED_FLAG`.
**Acceptance:** `npm install` triggers a prompt; denying returns a clear tool error to the agent; `rm -rf` or a piped command is rejected even if "always allow" was chosen for something else.

### C1 · Typed tool interface  `M`
**Scope:** define `Tool<I,O>` with JSON-schema input, `tier`, `risk: 'read'|'write'|'exec'|'external'`, and a uniform result `{ok, output, error}`. Wrap existing capabilities: `read_file`, `write_file`, `search_files`, `run_check`, `run_command`, `web_fetch`, connector actions (the existing tool gateway used by `executeActionDirect`), and a terminal `finish(summary)`.
**Acceptance:** each tool has a unit test with valid, invalid and denied input; every call emits `tool.call` / `tool.result` events (B1).

### C2 · Agent loop runner  `L`  (needs C1, B1)
**Scope:** generic loop in the renderer: build prompt (role persona from `AGENT_PERSONALITIES`, task, acceptance criteria, tool list) → model returns a tool call or `finish` → execute → append result → repeat. Each iteration is one short stateless request via the existing AI route (or BYOK key on desktop).
- Budgets: max steps (default 12 web / 30 desktop), max tokens, wall-clock timeout.
- Loop detection: same tool + same args failing 3 times, or no new information for N steps, then stop and escalate.
- Context management: keep a running summary and truncate old tool outputs.
- Emits `RunEvent`s throughout. Cancellable.
**Acceptance:** a fake-model test script drives: success path, tool error then recovery, budget exhaustion, loop detection, cancel. Real-model smoke test on both tiers.

### C4 · Developer agent on the loop (desktop)  `M`  (needs C2, C0b, C0a)
**Scope:** `DeveloperAgent` uses the loop with `read/write/search/run_check`. On web it falls back to "produce the code as a downloadable deliverable" (current behavior, via the loop minus write tools).
**Acceptance:** task "add a `slugify` util with tests" in a sample repo: the agent creates files in the chosen folder, runs vitest, fixes a deliberately injected failure, and finishes with passing checks.

### C5 · Ground-truth verification  `M`  (needs C4)
**Scope:** after a code task, run `typecheck` / `lint` / `test` through `checks:run`, feed failures back into the agent's loop (not just into the validator), and record results as `validation.result` events. First audit what `ValidatorAgent.ts` already does with `electronAPI.exec` so this extends it rather than duplicating it.
**Acceptance:** a task isn't marked complete while checks fail, unless the budget is exhausted, in which case it is marked "needs attention" with the failing output attached.

### C6 · Acceptance criteria at triage  `M`
**Scope:** `PlannerAgent` / triage writes 2 to 5 checkable criteria per ticket (store them on the `Task`). Display in the ticket and pass to the worker and to QA.
**Acceptance:** every new task has criteria; criteria are testable statements, not vibes; user can edit them before the run starts (optional toggle).

### C7 · QA as independent verifier  `M`  (needs C5, C6)
**Scope:** `QAAgent` re-runs the checks itself and evaluates each criterion with evidence (tool output, file diff). The LLM judge only scores criteria that cannot be checked mechanically. Replaces the "length + AI score ≥ 60" gate in `ValidatorAgent`.
**Acceptance:** a deliverable with a failing test is rejected even if the text looks good; a correct deliverable passes with a per-criterion report shown in chat (B2).

### D1 · Local run persistence (replaces the server-side D epic)  `M`  (needs B1)
**Scope:** persist runs and events in IndexedDB (fallback: memory only if blocked). On reload or app restart, show interrupted runs as "Interrupted. Resume or discard". Resume restarts the loop from the last completed step using the saved summary and event log.
**Acceptance:** kill the app mid-run, reopen, resume completes the task without redoing finished steps; storage is capped and old runs are pruned.

---

# Epic E: Agentic orchestration

### E1 · Orchestrator as an agent  `L`  (needs C2)
**Scope:** PM/orchestrator runs on the loop with tools `create_task`, `assign(agent, task)`, `message_agent`, `read_status`, `ask_user`, `finish`. The fixed `handleUserRequest` switch (`CentralOrchestrator.ts:90-324`) becomes a thin fallback, kept behind a flag for comparison.
**Acceptance:** same 10 sample requests handled by both paths (H1); orchestrator path routes at least as well.

### E2 · Dynamic replanning  `M`  (needs E1)
**Scope:** replace `TaskQueue.reEnqueue` retries and the `MAX_VALIDATION_RETRIES` constant with orchestrator decisions: retry same agent, reassign, split the task, or escalate to the user.
**Acceptance:** after two failed attempts the orchestrator changes strategy instead of repeating.

### E3 · Human-in-the-loop blocking state  `M`
**Scope:** `ask_user` and approval prompts (C0e, F2) put the run in a `blocked` state surfaced in chat with answer buttons; run resumes on reply. Works across D1 resume.
**Acceptance:** run pauses without consuming budget, resumes correctly after an app restart.

### E4 · Migrate remaining roles  `L`  (needs C2)
**Scope:** Research, Ops, Sales, Finance workers onto the loop with their web-tier tools (web fetch, connectors). Do one role at a time.
**Acceptance:** each role has at least one passing benchmark task (H1).

---

# Epic F: Guardrails

### F1 · Budgets and cost visibility  `M`  (build with C2)
**Scope:** per-run and per-day step/token budgets; show "steps used / remaining" in the steps block; stop cleanly with a "budget reached" summary. On web, tighter defaults because of the shared key.
**Acceptance:** budget exhaustion ends the run with `run.failed(reason: budget)` and a partial summary; limits are configurable on desktop.

### F2 · Approval gates for outward actions  `M`
**Scope:** tools with `risk: 'external'` (send email, post, deploy, delete connector data) require user approval each time unless the user has opted in per connector.
**Acceptance:** an email send never happens without a visible approval; denial is handled gracefully by the agent.

### F3 · Remaining hardening  `S`
**Scope:** only the gaps. Already done: workspace realpath confinement, size caps, arg allowlist, OS-keystore keys, IPC origin restriction. To add: cap total files written per run, show a diff or file list of changes at the end of a desktop run, one-click "revert this run" (git stash or file backups before write).
**Acceptance:** after a run, the user can see exactly which files changed and undo them.

---

# Epic G: Memory (after the loop is solid)

### G1 · Scratchpad and context compaction  `M`  (needs C2)
Per-run notes file/store the agent can read and write; summarize old steps when context grows.

### G2 · Real retrieval  `L`  *(only if the free constraint allows)*
Options that stay free: desktop-local index of the workspace folder (embeddings via a free API or a local model, stored on disk), or ripgrep-based retrieval (already available through `fs:search`) as a no-embedding v1. A hosted pgvector store only if you already run a free-tier Postgres. **Decide before building.**

### G3 · Retrieval tool  `S`  (needs G2, C1)
`retrieve(query)` tool for the loop.

---

# Epic H: Evals

### H1 · Benchmark suite  `M`  (start alongside C2)
10 to 20 fixed tasks across roles, each with a mechanical pass/fail check (tests pass, file exists with required content, answer contains cited URL, etc.). A runner that works headlessly (the orchestrator already has a `storeAccessor` headless seam) and prints a table.
### H2 · Regression report  `S`  (needs H1)
Run before each release; store results as JSON in the repo so changes in pass-rate and average steps are visible.

---

# Epic I: Linear lifecycle (first integration-driven autonomy, human in the loop)

**Goal:** when Linear is connected, a task's whole lifecycle is mirrored there. PM creates the issue, each agent comments as work progresses, QA reviews, status follows the internal ticket. Internal tickets stay the source of truth; Linear is a synced mirror. Writes are proposals the user approves unless autopilot is on for that connector.

**Constraint found in code:** Linear OAuth uses `actor=app` (`providers/linear.ts:107`), so every write is posted by one app identity. Agent identity is shown as a comment prefix (`**Mike (Engineer):** ...`) and labels, not as separate Linear users.

**Testing policy:** manual testing through claude-in-chrome against a free Linear test workspace. No bulk or automated LLM runs (they exhausted the previous OpenRouter key). Unit tests mock the Linear GraphQL layer and use no LLM.

**Order:** I0, then I1, then I2 and I3 together, then I4, I5, I6.

### I0 · Fix `depRef.match is not a function` in the task queue  `S`  (do first)
**Status: DONE (2026-11-17).** Root cause: `PlannerAgent` asks the LLM for 0-based dependency *indices*, so it returns numbers (`[0]`); they were stored unvalidated and `TaskQueue.resolveDependency` called `.match` on a number. Fix: new `src/orchestrator/dependencies.ts` (normalize numbers / numeric strings / `sub_n` / objects to canonical strings; resolver; planner-time sanitizer that drops self and out-of-range refs), used by `PlannerAgent` and `TaskQueue` (re-normalizes at read time for persisted state; unresolvable refs are ignored with a one-time warning instead of blocking forever; per-job try/catch in `dispatchReadyJobs`). Tests: `npm run test:unit` (6 passing, no LLM). `tests/` added to the tsconfig exclude like `bench/`. Verified live in claude-in-chrome on a multi-subtask run (researcher, engineer, QA with a validation retry): zero tick errors over ~40s.
**Why:** seen live: after a delegated task completed, `[Engine] orchestrator tick failed: TypeError: depRef.match is not a function` fired about once per second (`TaskQueue.ts:105`, via `resolveDependency` from `areDependenciesMet`). A throwing tick blocks dispatch of queued jobs.
**Scope**
- Find where `subtask.dependencies` gets non-string entries (LLM-generated plan output: numbers or objects). Normalize at the source when subtasks are created (coerce to string ids, drop invalid).
- Defensive guard in `resolveDependency`: `typeof depRef !== 'string'` must not throw; treat as unresolved and log once, not every tick.
- Wrap the tick body so one bad job cannot stop the others (per-job try/catch).
**Acceptance:** reproduce first (delegate a multi-subtask task via `@Alex`), then no tick errors in the console for 60s after completion; queued jobs still dispatch; unit test with numeric, object, null and `sub_<n>` dependency refs.

### I1 · Intent routing and AI-failure honesty  `S`  (needs I0)
**Status: DONE (2026-11-17).**
- **Root cause of the misrouting was bigger than the LLM:** the persisted `connectors` flags in the game store were stale (GitHub and Vercel showed `connected: true` while the server had `connections: []`) and only re-sync when the Integrations tab is opened. `classifyIntent` now asks `/api/integrations` (server = source of truth, 10s cache, 4s timeout, repairs the store via `syncOAuthConnections`, falls back to the last answer then the local flags).
- New `src/ai/actionGuard.ts`: an `action` is downgraded to `needs_credentials` when none of the integrations it names is connected (or nothing is connected and none is named). Missing providers are put first in the credential request ("Linear connection" instead of a generic "API Credentials" that matched the word "login").
- AI failures: with a key configured, a provider failure now shows "AI service is unavailable" in chat (`AI_UNAVAILABLE_MESSAGE`) and `generateDeliverable` throws `AIUnavailableError` so the run fails honestly with `run.failed` instead of delivering a template. Canned replies remain only when no key is configured and `NODE_ENV !== 'production'`. A provider drop during the QA retry keeps the first attempt.
- Gemini fallback model: `gemini-2.0-flash` (404) -> `gemini-flash-latest` alias, override with `GEMINI_MODEL`. Verified against the live model list.
- Classifier calls now cap `maxTokens` (400 / 150): they reserved 4096 output tokens for a tiny JSON answer, which is what 402'd a low-balance key.
- Tests: `tests/actionGuard.test.mts` (6) plus I0's (6) = 12 passing via `npm run test:unit`. `npm run build` passes. Verified live in claude-in-chrome: Vercel and Linear messages with nothing connected raise credential requests; with both AI keys invalidated, "Hii" shows the unavailable message and a task fails with "Failed: AI is unavailable right now" and no deliverable is created.
- **Follow-ups found (not done):** (a) the credential modal asks the user to *paste a token* even for OAuth integrations; it should send them to the Integrations tab (new ticket I1b); (b) onboarding (`SetupWizard` / `initializePersonalizedOffice`) writes `connected: true` flags with no OAuth behind them, fix at the source; (c) `providersMentioned("this is a linear regression model")` matches "linear" (word list is intentionally simple; revisit if it bites); (d) 2 pre-existing `no-explicit-any` lint errors in `getConnectedProviders`; (e) the current OpenRouter key is nearly out of credit.
**Why:** "deploy my app to Vercel" was classified `action` although Vercel was not connected; Casey only said so in chat and no credential prompt was raised. Separately, AI provider failures (402, dead Gemini model) silently fall back to canned mock replies, which hid the real problem.
**Scope**
- After classification, if type is `action` and no connected provider matches the request, downgrade to `needs_credentials` (reuse `detectRequiredKeys`).
- `/api/ai`: return a real error status or an explicit `error` field when all providers fail; client shows "AI unavailable" instead of mock text. Keep mocks only when the key is intentionally absent in dev.
- Replace the dead fallback model `gemini-2.0-flash` (`api/ai/route.ts:11`) with a currently available one (verify the model id against Google's docs before changing).
**Acceptance:** with Vercel disconnected, "deploy my app to Vercel" raises the credential request; with the OpenRouter key blanked, the UI shows an AI-unavailable message, not a Q2-objectives reply.

### I1b · Integration-aware credential requests  `M`  (done before I2)
**Status: DONE except one manual check (see below), 2026-11-17.**
**Rule:** a missing provider that exists in the Integrations tab (GitHub, Slack, Linear, Vercel, Notion) is never asked for as a pasted token. The user is sent to that tab and the task resumes by itself once the server reports it connected. Anything else (database, cloud, Stripe, ...) keeps the paste prompt.
- `src/ai/credentialRouting.ts` (pure): `routeCredentialKeys(keys, connected)` -> `{integrations, secrets}`; connected providers are dropped; generic catch-alls (`api_credentials`, `mcp_credentials`) are dropped when a specific provider is known (this removed the stray "API Credentials" that the word "login" used to trigger).
- Store (`gameStore.ts`): `integrationPrompt`, `rightPanelTab` (moved out of `RightPanel` local state so the prompt can open the tab), `requestIntegrations`, `deferIntegrationPrompt` ("Open Integrations"), `cancelIntegrationTask`, `resumeIntegrationTasks`. `syncOAuthConnections` now ends by resuming every task whose awaited providers are all connected. Task gained `awaitingIntegrations` and `pendingSecrets`.
- Resume = re-submit the task's original request via `handleUserRequest` (registered with `setIntegrationResumeHandler`), so it is classified again with the integration connected (an `action` can now really run). The classifier's 10s connection cache is invalidated first. The placeholder task is marked completed.
- Secrets are now asked one at a time (`pendingSecrets`); before, several requests overwrote the single prompt slot.
- UI: `CredentialDialog` shows "Connect X to continue" with Cancel task / Open Integrations for integration blocks; `RightPanel` syncs connections from the server on mount regardless of the open tab, so a task resumes after the OAuth redirect back to /workspace.
- Also fixed: the paste field was being auto-filled by the browser's password manager (a saved site password would have been submitted as the credential); it now has `autoComplete="new-password"` and password-manager ignore hints.
- Tests: `npm run test:unit` (20, incl. 8 router tests) and the new `npm run test:store` (8, against the REAL game store via `tests/register-real.mjs`, no LLM): waits while not connected, resumes exactly once when connected, needs-all-providers, Open Integrations, Cancel, integration + secret ordering, secrets one at a time. Live in claude-in-chrome: Vercel and Linear requests show the Connect prompt (no input field), Open Integrations switches the right panel, a Postgres/MongoDB request still shows the paste prompt, now empty.
- **Still to verify by hand (needs the user's own OAuth consent, which the agent must not grant):** with a request waiting on Linear, click Connect on Linear in the Integrations tab and confirm the waiting task resumes and runs as an action.
- **Follow-ups:** (a) tokens pasted into the secret prompt are stored in `task.aiContext`, which is persisted to localStorage (`partialize` keeps tasks); keep secrets out of persisted state; (b) after a pasted secret the task is set `in_progress`, but nothing in the tick loop picks up a no-subtask `in_progress` task, so "Provide & Resume" likely does not actually run the work (pre-existing, not verified); (c) one renderer freeze (tab unresponsive >60s) happened on the first send after these changes and did not reproduce on a fresh tab or in the node store tests; cause not found, keep an eye on it; (d) Vercel, Slack and Notion OAuth are not configured on this dev server (the Integrations panel lists the missing client ids), so only GitHub and Linear can be connected locally.

### I2 · Linear tool set  `M`
**Status: DONE (2026-11-17), verified live against the "Agent Corp Testing (AGE)" team.**
- New `src/lib/integrations/linear/` (`errors.ts`, `ids.ts`, `client.ts`): a typed GraphQL client. Failures map to `auth | rate_limited | not_found | validation | server | network`; messages never contain the token.
- Tools (all in `tools.ts`, built on the client): `linear_list_teams`, `linear_list_workflow_states`, `linear_create_issue` (optional `labels`, `teamId` as id/key/name, `idempotencyKey`), `linear_get_issue` (id or `AGE-7`), `linear_update_issue_status` (by name or word: todo / review / done / canceled), `linear_comment_on_issue` (`author` prefix, `idempotencyKey`), `linear_add_label`, `linear_assign_issue`. `PROVIDER_TOOLS` updated for the classifier prompt.
- Bugs fixed on the way: `listServerToolsAsOpenAI` marked every parameter required (the model had to invent optional values); `callOpenRouter` never recorded executed tool calls (`executed` stayed empty); `executeActionDirect` blamed "check your integrations" when the AI itself was down, and reserved 4096 tokens (now 1024).
- **Live finding:** the connected Linear app is NOT allowed to create labels in the team ("You are not allowed to create labels in this team"). Existing labels are used; a label that cannot be created is skipped with a note and the issue is still created. `linear_add_label` on a missing label returns a clear error. To get agent labels: create them once in Linear (e.g. `agent:engineer`, `agent:qa`) or have a workspace admin allow the app to create labels.
- Tests: `npm run test:int` (35, no LLM): client against a stateful fake Linear server, plus the tool layer end to end.
- Not done: assignment to the *agents* (they are not Linear users; `linear_assign_issue` only targets real members). Option for I4: Linear's `createAsUser` / `displayIconUrl` on create/comment (documented for `actor=app` tokens) would show each agent's name instead of a text prefix; not used yet, so the prefix is the identity for now.
**Scope:** extend `PROVIDER_TOOLS` and `src/lib/integrations/tools.ts` with `comment_on_issue`, `update_issue_status`, `get_issue`, `list_workflow_states`, `add_label`, `assign_issue` (to a real Linear member, optional), on top of the existing `create_issue` and `list_teams`. GraphQL error mapping (auth expired, not found, rate limited) into typed errors. Token refresh path exercised.
**Acceptance:** each tool works against the test workspace; errors return readable messages to the agent; unit tests with a mocked GraphQL layer cover success, not-found, rate-limit and 401-then-refresh.

### I3 · Idempotency and retry  `M`  (build with I2)
**Status: DONE (2026-11-17), idempotency proven against the real Linear API.**
- **Design:** Linear lets the client choose the object's `id` (`IssueCreateInput.id`, `CommentCreateInput.id`: "UUID v4; generated if none is provided"). An `idempotencyKey` (e.g. `task_12:status:in_progress`, helper `eventKey`) becomes a deterministic UUID v4 (`deterministicUuid(workspaceId, key)`), so every retry or replay targets the same object. Nothing has to be persisted before the call (the key re-derives the same id after a reload or on another device). If Linear says the id already exists, the client looks it up by that id and returns it as success (`replayed: true`).
- **Retry rules:** only 429 / 5xx / dropped connections, max 3 attempts, exponential backoff with jitter (500ms base, 8s cap), `Retry-After` or Linear's reset header honoured (capped at 15s), 15s per-attempt timeout. Validation, auth and not-found are never retried. One reactive token refresh on 401 is supported by the client (`onUnauthorized`) but not wired to the token service yet: proactive refresh (60s before expiry) already exists, and a 401 on a live token means revoked, which surfaces as "Reconnect Linear in the Integrations tab".
- **Live proof (real Linear, Agent Corp Testing team):** create twice with the same key returned AGE-7 both times ("created" then "already existed"); comment twice returned the same comment id with one comment on the issue; a status change twice reported "moved" then "already in". The test issue was moved to Canceled afterwards.
- Unit proof (fake server with fault injection): connection dropped AFTER Linear created the issue then retried = one issue; dropped BEFORE = one issue created on the retry; 429 retried after the stated wait; 5xx bounded at 3 attempts; 400 not retried; 401 with and without refresh; replayed comment = one comment.
- **For I4:** the issue id, url and `syncState` still need storing on the internal task; keys come from `eventKey(taskId, event, sequence)`.
- Minor follow-up: `not_found` currently comes back from `/api/tools/execute` as HTTP 502 (generic tool error); a 404 would be more accurate.
**Why:** retries and double-fired ticks can create duplicate issues or repeated comments.
**Scope**
- Store `linearIssueId`, `linearIssueUrl` and a per-task `syncState` on the internal task.
- Idempotency key per write, derived from `taskId + event + sequence` (for example `task_123:status:in_progress`), persisted before the call and checked before any retry.
- Create-issue dedupe: look up by stored id first; if missing, search by the key embedded in the issue description before creating.
- Retry with exponential backoff and jitter for 429 and 5xx only; never retry 4xx validation errors. Bounded attempts, then mark `syncState: failed` and surface it, do not loop.
**Acceptance:** killing the network mid-create and retrying yields exactly one issue; replaying the same event twice yields one comment; a 429 is retried and succeeds; a 400 is not retried.

### I4 · Lifecycle mirror  `M`  (needs I2, I3)
**Status: PASSED live (2026-11-18). Failure path (AGE-9) and success path with real agent responses (AGE-10, AGE-11) verified on the real Linear API. Unit/store/int tests green; run `npm run build` before committing.**
- **Live success result (2026-11-18, free OpenRouter model chain in `.env.local`):** "write a Python function fizzbuzz(n)..." produced AGE-11, which ended in Done with clean comments: Mike "Starting work", Mike "Completed ...", Tina (QA) "all acceptance criteria met" with a PASS line per criterion, Mike "I finished ...". No "AI service unavailable" text anywhere. Earlier AGE-10 (is_prime) also reached Done with Alex "Prioritized" and Sam "Assigned" comments.
- Fixes made on the way: AI-failure placeholder is filtered out of ticket text; `OPENROUTER_MODEL` accepts a comma-separated fallback chain (402/429/5xx fall through to the next model; `src/lib/ai/openrouterFallback.ts`). OpenRouter free tier is 50 model calls/day per account (resets 00:00 UTC; about 5-10 tasks/day), 1000/day after buying $10 credit.
- Known caveat: the "Prioritized"/"Assigned" comments come from `TaskSystem` events; a task that starts already assigned on the direct path (AGE-11) skips them. Cosmetic; revisit in I5.
- **Live result (2026-11-17, Agent Corp Testing team):** with the switch on and the AI out of credit, one chat task produced issue AGE-9 (description holds the request and the AgentCorp task id), moved to In Progress, with comments "Alex (CEO): Prioritized...", "Mike (Engineer): Starting work", and "Mike (Engineer): Failed: AI is unavailable...". It was NOT moved to Done. The task record held `syncState: synced` and the confirmed idempotency keys. Sam posted the Linear link in chat. AGE-9 was then moved to Canceled and the switch turned back off.
- `src/engine/linearMirrorPlan.ts` (pure): run event -> Linear writes with deterministic keys (`<taskId>:created`, `:assigned`, `:started`, `:qa:<n>`, `:retry:<n>`, `:finished`, `:status:<state>`...). `src/engine/LinearMirror.ts`: subscribes to the run-event stream, creates the issue on a task's first event, then writes in order per task. Mounted by `LinearMirrorBridge` in the workspace page. The orchestrator itself is untouched (it stays integration-agnostic).
- Mapping onto Linear's states (Backlog / Todo / In Progress / Done / Canceled; there is no "In Review"): created = Backlog; assigned = Todo (+ `agent:<role>` label if it exists); work starts = In Progress; QA verdicts, retries, subtask results = comments; finished and passed = Done; finished but needs attention = stays In Progress with a "Needs attention" comment; failed = failure comment only (no Done); stopped by the operator = Canceled. Comments are prefixed with the agent ("**Tina (QA):** ...") because the app posts as one identity.
- Safety: OFF by default. A checkbox "Mirror tasks to Linear" on the Linear card (Integrations tab) turns it on and records `enabledAt`; only tasks created after that are mirrored and old history is never replayed. Requires Linear to be connected (server truth). This is the interim consent gate until I5 adds per-write approvals.
- State on the task: `task.linear = { identifier, url, syncState: pending|synced|failed, lastError, doneKeys[] }`. A failed write is recorded and never blocks the agents' work; a write that was dropped keeps the task `failed` (visible) because it is not re-sent; a failed create is retried by the next event and the queued writes then flush in order. PM posts "Tracking ... in Linear as AGE-n <url>" in chat.
- Retries: transient app->server failures (5xx / 429 / offline) retried twice; server-side Linear retries are separate (I3). Replays and second tabs are harmless: keys are deterministic and `doneKeys` skips confirmed writes.
- Tests (`npm run test:store`, 15 new): full lifecycle order and authors, needs-attention, failed, stopped, pipeline subtasks/validator/retry, off by default, Linear not connected, old tasks untouched, history not replayed, transient retry, 400 not retried, create failure then recovery in order, already-done op skipped, two tasks at once, planner purity and key stability.
- **Needed from the operator:** (1) create these labels once in the Linear team (the app is not allowed to create labels): `agentcorp`, `agent:ceo`, `agent:pm`, `agent:engineer`, `agent:qa`, `agent:researcher`, `agent:ops`, `agent:sales`, `agent:finance`, `agent:hr` (the mirror works without them; labels are simply skipped); (2) AI credit on the OpenRouter key so a task can actually finish (without it a run fails and only the failure trail can be seen); (3) tick "Mirror tasks to Linear" and run one task to confirm the full trail.
**Scope:** map internal events to Linear writes: ticket created (create issue), assigned (comment + label for the agent role), in progress (status), engineer done (comment with deliverable summary), QA review (comment with criteria result), done or failed (status + final comment). One adapter module listens to the orchestrator and store events; the orchestrator itself stays integration-agnostic. Skips silently when Linear is not connected.
**Acceptance:** one chat task produces one Linear issue whose comments and status trail match the internal log in order, each comment prefixed with the agent name.

### I5 · Human-in-the-loop and autopilot  `M`  (needs I4; overlaps F2)
**Scope:** use `src/engine/approvals.ts`. Each outward Linear write shows a proposal ("Sam wants to create issue X"), with allow once, allow always, or deny. Per-connector autopilot setting in the Integrations tab. Denial is handled gracefully (task continues, mirror marked skipped). Linear to app changes (status or comments made by humans) come in by polling, not webhooks.
**Acceptance:** nothing is written to Linear without approval unless autopilot is on; denial does not break the task; a status changed in Linear shows up in the app after the next poll.
**Status: PASSED live (2026-11-18).**
- Approval is per task (asked before the first write, then the whole trail goes out), not per comment. Card appears above the chat input; Allow once / Always allow this / Deny. "Always allow" turns the Linear autopilot setting on (second checkbox on the Linear card, off by default). Deny marks the task `syncState: 'skipped'`, writes nothing, and the task finishes normally (verified live).
- Linear to app: `LinearPoller` reads each tracked issue every 30s (visible tab, Linear connected, tasks under 24h, at most 10 per pass). First look is a baseline. A human status change or human comment (not an agent "**Name (Role):**" comment) is announced once by the PM in chat. The app's own status writes are suppressed via `lastWrittenStatus`. Verified live on AGE-13: moved to In Progress plus comment "please add a docstring" each announced exactly once.
- Limits: poller sees only the last 5 comments (200 chars each) because that is what `linear_get_issue` returns; reads only, so no approval needed.
- Tests: `tests/linearApprovals.store.mts` (allow once, deny, always allow, autopilot on, already tracked, parse, baseline, own-write suppression, skipped/untracked/not connected/failed read).

### I6 · Verification and final checks  `S`  (needs I0 to I5)
**Scope:** claude-in-chrome walkthrough against the test workspace: create task, approve proposals, watch issue and comments appear, retry and denial paths, token-expired path. Then `npm run build`, lint, unit tests, and a `bench` regression check.
**Acceptance:** build passes, no console errors during the walkthrough, checklist recorded in this file.

### I7 · Linear webhooks  `M`  *(later, optional)*
Real-time Linear to app updates. Needs a public URL (deployed web app only; desktop keeps polling). Signature verification required.

**Effort estimate:** about 8 to 11 working days for I0 to I6; I7 adds 2 to 3.

---

## Milestones

| | Contents | Outcome |
|---|---|---|
| **M1** | A0, A1, A2, A3, B1-B4 | App works without WebGL and in background tabs; chat shows live steps and streamed answers; no misleading claims |
| **M2** | C0a-C0e, C1, C2, F1, H1, C4, C5 | One real autonomous Developer on desktop with build/test feedback, measured |
| **M3** | C6, C7, D1, E3 | Criteria-based QA, resumable runs, human-in-the-loop |
| **M4** | E1, E2, E4, F2, F3 | Orchestrator decides routing and replans; other roles on the loop |
| **M5** | G1-G3, H2 | Memory/retrieval, regression tracking |
| **M-Linear** | I0-I6 (I7 later) | Reliable queue, honest AI errors, Linear issue lifecycle mirrored with approvals and idempotent retries |

Suggested first branch: **A0** alone. It's the riskiest-to-miss, unblocks A1/A2, and independently fixes the "doesn't work for some people" reports.

## Risks / open questions

- **A0 may uncover more renderer-derived state** (see the `syncAgentsToStore` audit). Budget extra time.
- **Hidden-tab throttling** can't be fully removed on web. Say so in the UI ("keep this tab open") and rely on desktop for long runs.
- **Shared LLM key** will rate-limit if web users run loops. Keep web budgets small; push heavy use to BYOK/desktop.
- **Allowlist vs autonomy:** C0e is where you choose how much power desktop agents get. Default to least privilege.
- **Not yet verified:** how `ValidatorAgent` and `executeDirectTask` use `exec` today; `desktop/main.js` `webPreferences`; Pixi v8 Canvas fallback availability; whether anything else imports `VectorMemory`.
