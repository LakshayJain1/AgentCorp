# AgentCorp Revamp — From Simulation to Real Autonomous Software Engineer

## 1. Goal
Keep the company-architecture simulation (Phaser office, roles, FSM, HR, chatter) as a **read-only view**, and replace the mock work core with a **real tool + verify loop** so agents actually read, edit, test, and ship code.

## 2. Where we are (evidence)
- `src/runtime/ToolRegistry.ts`: 1 tool (`ask_agent` → `fetch('/api/ai')`). No fs/search/exec tools.
- `src/app/api/tool/route.ts`: explicitly disabled — `{ success: false, 'no direct filesystem access' }`.
- `src/agents/ValidatorAgent.ts`: length ≥50 (+20) + AI `VALID` keyword (+30), `score >= 60`. `typeCheckOutput/lintOutput/testOutput` always `''`.
- `src/execution/Sandbox.ts`: stub. `TaskDiscovery.ts`: stub. `VectorMemory.ts`: keyword overlap, no embeddings.
- `CentralOrchestrator.tick()` drives everything from `GameScene.update()`; `LoopOrchestrator` (new) adds outer budgets but still wraps text generation.

## 3. Target architecture

```
Phaser office (view only) ──reads──▶ Zustand snapshots (10fps, unchanged)
Headless LoopOrchestrator ──drives──▶ Planner → TaskQueue → Workers → Validator → HR
Workers ──call──▶ ToolRegistry ──routes──▶ ToolExecutor adapter
                                            ├─ DesktopExecutor (Electron, full Node): fs read/write/patch, rg search, child_process (tsc/eslint/vitest/git/docker)
                                            └─ VercelExecutor (web, safe): GitHub-API file ops OR patch-proposal mode (no direct fs)
Validator ──runs──▶ real checks: tsc --noEmit, eslint, vitest → fills ValidationResult → pass/fail (AI review advisory only)
Memory ──moves──▶ persistent store (SQLite/Postgres + pgvector) with real embeddings; localStorage stays as cache
```

### Why the adapter (Vercel vs Desktop)
- **Vercel serverless: direct fs tools CANNOT work.** Functions have a read-only filesystem except ephemeral `/tmp` (512 MB, wiped after invocation), 10–60 s timeouts, no `child_process`/shell/docker, no persistence across invocations. A `write_file`/`run_command` tool hitting the deployed site would fail or vanish on next request.
- **Electron desktop (Mac/Win/Linux): full tools CAN work.** Full Node.js runtime: `fs`, `child_process.spawn`, git worktrees, local model sidecars, Docker. This is where real autonomous engineering runs.
- **Design rule:** `ToolRegistry` exposes capability names (`read_file`, `patch_file`, `run_tests`, …). Each capability resolves through a `ToolExecutor` interface with two backends. Web builds ship `VercelExecutor` (safe/degraded); desktop builds ship `DesktopExecutor` (full). Same agent code, different capabilities. UI shows per-environment capability matrix so users see why "Run tests" is disabled on web.

## 4. Phased plan (L4)
- **P0 — Seams (no behavior change):** `ToolExecutor` interface + `VercelExecutor` (returns `disabled: vercel-readonly` errors) + registry capability advertisement + capability matrix in UI. `tsc` + `build` green.
- **P1 — Desktop full executor:** Electron IPC (`desktop/main.js` + `preload.js`) exposing `fs/read, fs/write, fs/patch, exec/run` with allowlist (`<workspace>/**`, deny `..`, `.env*`, `node_modules`), timeouts, audit log to `ExecutionLogStream`. Wire `ToolRegistry` → desktop channel when `window.agentcorpDesktop` present.
- **P2 — Real validator:** run `tsc --noEmit`, `eslint`, `vitest run` inside task worktree; fill `ValidationResult` fields; pass = exits 0 + tests green. Keep AI review as non-blocking note.
- **P3 — Worktrees + sandbox:** per-task `git worktree` (desktop) or GitHub-branch proposal (web); diff artifact as deliverable; rollback path recorded.
- **P4 — Planner/dispatch/memory:** subtask schema gains `acceptanceCriteria` + `verifyCommand`; PM assigns by skill/load not random; persistent memory + real embeddings.
- **P5 — Model router + hardening:** strong model for plan/review, cheap for workers; prompt cache; secret redaction; audit.

## 5. Credentials / access needed from you
1. **AI keys (required for anything real; else all mock):** `OPENROUTER_API_KEY` and/or `GEMINI_API_KEY` → set in `.env.local` (local) + Vercel env dashboard (deployed). Without these, P1–P5 still run but on template responses.
2. **GitHub token (needed at P3):** repo-scoped PAT with `contents:write, pull-requests:write` for branch/PR proposals from web executor. Not needed for P0–P2 local.
3. **Database (needed at P4):** Postgres URL (e.g. Neon/Supabase) + extension `pgvector`, or confirm SQLite-local acceptable for desktop-only memory.
4. **Vercel project access (needed to verify web behavior):** ability to set env vars + view function logs. Desktop builds need no credentials.
5. **Nothing else for P0:** no new tools, keys, or installs. Starting there now.

## 6. Success criteria
- P0: `ToolExecutor` seam merged, capability matrix visible, `tsc` + `build` green, web shows `disabled: vercel-readonly`, desktop shows `ready`.
- Full: agent fixes a real seeded bug (failing test → green) end-to-end on desktop with diff + test log as evidence.
