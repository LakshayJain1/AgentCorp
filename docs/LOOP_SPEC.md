# Loop Orchestrator Spec (DEFINE)

## Objective
Refactor `CentralOrchestrator.tick()` into a deterministic `DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP` loop engine with per-phase exit criteria and budgets.

## Scope (user-confirmed)
- **Refactor existing** — modify `src/orchestrator/CentralOrchestrator.ts` + collaborators, not a parallel engine.
- **Headless only** — no new React UI/panel; runnable without `GameScene`/Phaser; injectable store adapter so `tick()` still works from `GameScene.update()` but tests can drive it headless.
- **localStorage/DB persistence** — loop/tracker state via existing `src/memory/MemoryStore.ts` + `src/runtime/AgentMemory.ts` (localStorage-backed) pattern; no new DB table.

## Boundaries / Non-goals
- No LangChain/LangGraph; keep `/api/ai` (OpenRouter → Gemini) + `AIService` queue.
- No UI changes; no new routes.
- Reuse `PlannerAgent` (≤5 subtasks), `TaskQueue`, `Developer/QA/ResearchAgent`, `ValidatorAgent` (retry ≤3), `HRSystem`.
- Keep task cap (8), processing locks, 1s AI rate limit.

## Deterministic exit criteria (per phase)
- DEFINE: `docs/LOOP_SPEC.md` exists + user confirms scope (this file).
- PLAN: task list with acceptance criteria + order, user approves.
- BUILD: every slice implemented; same-slice fail ×2 → stop/escalate.
- VERIFY: `npx tsc --noEmit` + `npm run build` pass headless; fail ×2 cycles → escalate.
- REVIEW: no blocking findings (tsc/eslint, no secrets, no UI coupling in orchestrator).
- SHIP: committed, working tree clean, delivery report.

## Current-state mining (agent roles + existing QA-reject loop)
- Entry: `GameScene.update()` → `centralOrchestrator.tick()` (`src/game/GameScene.ts`, `src/orchestrator/CentralOrchestrator.ts:106`).
- Phases today: `processTasks()` → `planner.processPendingTasks()` → `taskQueue.dispatchReadyJobs()` → `worker.tick()` → `validator.processQueuedValidations()` → `processCompletedItems()` + HR.

### Roles (src/agents/AgentTypes.ts, AgentPersonalities.ts, TaskSystem.ts)
- CEO (`ceo`): `pending → prioritized` via `askTaskAgent(..., 'pending')`, writes `aiContext.ceoDecision` + shared memory.
- PM (`pm`): `prioritized → assigned`, picks random non-ceo/pm/qa/hr worker, writes `aiContext.pmAssignment`, `sendMessage` to worker.
- Engineer (`engineer`/`developer` via DeveloperAgent): single-step `generateDeliverable()` → code/doc/analysis via `ask_agent`.
- Researcher (`researcher`/`research_worker` via ResearchAgent): report with summary/methodology/findings.
- QA (`qa`/`qa_worker` via QAAgent): reviews deliverable → `QA_PASS`/`QA_FAIL` + reasoning. Also used inside Validator's `ask_agent(agentRole:'qa')` → `VALID`/`INVALID`.
- HR (`hr`): `performanceTracker.evaluateTeam()` (~0.5%/tick), promotions via PromotionManager.
- FSM (`AGENT_FSM_TRANSITIONS`): `idle→thinking→coding→debugging/reviewing→completed`, `blocked→thinking/idle`. `BaseWorkerAgent.tick()` drives `thinking→completed/blocked` (len>10 = completed).

### Existing QA-reject retry loop (the mechanism to formalize, not replace)
```
worker.tick() → subtask completed → onSubtaskComplete() → validator.enqueueValidation()
  → ValidatorAgent.runValidation(): length≥50 (+20) + AI VALID (+30), score≥60 = pass
  → CentralOrchestrator.processCompletedItems() [%10 ticks]:
      pass → subtask completed
      fail + retryCount<3 → TaskQueue.reEnqueue(priority 5) → dispatch → worker.tick() again
      fail + retryCount≥3 → subtask failed → parent partial
```
- Planner default `mockPlan`: research → implement → test(qa) → validate(qa) with `dependencies sub_1..3`, max 5 subtasks.
- `TaskQueue`: priority sort, `inProgress` set, `areDependenciesMet`, `findWorker(preferredRole→any available, online, not cooldown/busy)`.
- Budgets already present: retry ≤3, planner slice ≤2 tasks/tick, task cap 8, AI 1s rate limit, processing locks.

### Gaps vs Loop-Orchestrator target
- No formal DEFINE/PLAN approval, REVIEW gate, or SHIP step — QA loop is BUILD↔VERIFY only.
- Validator is length+AI only (no tsc/lint/test output despite `ValidationResult` fields).
- No headless seam: phases import `useGameStore.getState()` directly; can't drive without Phaser/React.
- Loop state lives in Zustand only, not in `MemoryStore`/localStorage as requested.

### Refactor direction (preserves QA loop)
New `LoopOrchestrator` engine wraps the proven BUILD↔VERIFY retry loop as inner loop, adds outer DEFINE→PLAN→…→REVIEW→SHIP with deterministic exit checks + 2-retry/2-cycle budgets, headless-injectable store/memory adapters, persistence via `MemoryStore` (localStorage).
