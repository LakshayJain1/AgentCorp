# AgentCorp Revamp — From Simulation to Real Autonomous Software Engineer

## 1. Goal (user-centric SaaS, not a personal project)
AgentCorp is a **multi-user product**: each end user signs in (Clerk), connects **their own** repos and cloud, brings **their own** AI keys (BYOK), and gets an autonomous engineering team (the office sim) working on **their** codebase.
Keep the company-architecture simulation (Phaser office, roles, FSM, HR, chatter) as a **read-only view per user/workspace**, and replace the mock work core with a **real tool + verify loop** scoped to that user's connected repo.

## 2. Where we are (evidence)
- `src/runtime/ToolRegistry.ts`: 1 tool (`ask_agent` → `fetch('/api/ai')`). No fs/search/exec tools.
- `src/app/api/tool/route.ts`: explicitly disabled — `{ success: false, 'no direct filesystem access' }`.
- `src/agents/ValidatorAgent.ts`: length ≥50 (+20) + AI `VALID` keyword (+30), `score >= 60`. `typeCheckOutput/lintOutput/testOutput` always `''`.
- `src/execution/Sandbox.ts`: stub. `TaskDiscovery.ts`: stub. `VectorMemory.ts`: keyword overlap, no embeddings.
- `CentralOrchestrator.tick()` drives everything from `GameScene.update()`; `LoopOrchestrator` (new) adds outer budgets but still wraps text generation.

## 3. Target architecture

```
Per-user workspace: Clerk identity → Connectors (GitHub repo + Vercel project + BYOK keys)
Phaser office (view only, per workspace) ──reads──▶ Zustand snapshots (10fps, unchanged)
Headless LoopOrchestrator (per workspace) ──drives──▶ Planner → TaskQueue → Workers → Validator → HR
Workers ──call──▶ ToolRegistry ──routes──▶ ToolExecutor adapter (scoped to the USER's connected repo)
                                            ├─ DesktopExecutor (Electron, full Node): user's local clone — fs read/write/patch, rg, child_process (tsc/eslint/vitest/git/docker)
                                            └─ VercelExecutor (web, safe): user's GitHub repo via GitHub App API (read/blob, create branch, commit, open PR) + per-user job runner for checks; never touches our own repo fs
Validator ──runs──▶ real checks against the USER's repo: tsc --noEmit, eslint, vitest → fills ValidationResult → pass/fail (AI review advisory only)
Connectors ──per user──▶ GitHub App (repo-scoped), Vercel integration (their project), key vault (per-user encrypted BYOK)
Memory ──per user/workspace──▶ persistent store (Postgres + pgvector, row-scoped by userId/workspaceId) with real embeddings; localStorage stays as cache
```

### Why the adapter (Vercel vs Desktop) — in user-centric terms
- **Web app (our Vercel deployment) never edits its own filesystem.** When user U asks "fix auth bug in my repo R", file/exec tools act on **U's connected GitHub repo R** via the GitHub API (OAuth App, repo-scoped token), and checks run in a **per-user job runner** (their linked repo's CI or our job worker cloning R to ephemeral `/tmp`), not on our deployment's disk. Vercel's read-only fs / no-shell limits therefore don't block web users — they just force the GitHub-API path.
- **Desktop app (user's Mac/Win/Linux): full local tools.** Operates on the user's local clone of R with full Node (`fs`, `child_process`, git worktrees, Docker). Fastest path for large repos.
- **Design rule:** `ToolRegistry` exposes capability names (`read_file`, `patch_file`, `run_tests`, …). Each resolves through a `ToolExecutor` scoped to `(userId, workspaceId, repo)`. Same agent code either way; UI shows per-connector capability matrix ("GitHub connected ✓ / Vercel project linked ✓ / keys present ✓") so users see what's enabled.

### Multi-tenant rules (new)
- Every tool call carries `(userId, workspaceId)`; allowlist = user's connected repo(s) only; cross-user access impossible by construction.
- Secrets are per-user (encrypted vault / Clerk metadata), never shared, never logged; audit log is per workspace.
- Quotas per user (AI calls, exec minutes, PRs/day) to prevent one workspace starving others.

## 4. Phased plan (L4)
- **P0 — Seams (done):** `ToolExecutor` interface + `VercelExecutor` + capability matrix helper. `tsc` + `build` green.
- **P1 — Per-user connectors:** Clerk-gated `ConnectorsTab` → GitHub App OAuth (repo-scoped) + Vercel project link + BYOK key vault (per-user encrypted). Tool calls scoped to `(userId, workspaceId, repo)`.
- **P2 — executors:** Desktop full executor (Electron IPC, allowlist `<user-workspace>/**`, audit); web GitHub-API executor (read/blob, branch, commit, PR) + per-user job runner for checks.
- **P3 — Real validator:** `tsc --noEmit`, `eslint`, `vitest` against the user's repo/worktree; fill `ValidationResult`; pass = green checks.
- **P4 — Isolation + dispatch + memory:** per-task branch/worktree per user; subtask `acceptanceCriteria` + `verifyCommand`; skill-based assignment; Postgres+pgvector memory row-scoped by user.
- **P5 — Router + hardening:** model router, prompt cache, secret redaction, per-user quotas + audit.

## 5. Credentials / access needed (two tiers: platform vs end user)
**A. From you as platform owner (to build/ship the product):**
1. **AI keys for dev (until BYOK vault lands):** `OPENROUTER_API_KEY` and/or `GEMINI_API_KEY` in `.env.local` + Vercel env dashboard. Without these, dev runs on mock templates.
2. **GitHub App credentials (needed at P1):** App ID + private key + OAuth client ID/secret so *end users* can connect their own repos (we never ask for your PAT — users authorize their own repos).
3. **Database (needed at P4):** Postgres URL (Neon/Supabase) + `pgvector` for per-user memory; confirm provider or accept SQLite-local for desktop-only dev.
4. **Vercel project access:** env vars + function logs for the web deployment.
5. **Nothing blocking P0–P1 scaffolding:** proceeding without new secrets.

**B. From each end user at runtime (self-serve, not from you):**
1. Sign in (Clerk) → connect GitHub repo(s) via OAuth (repo-scoped) → link Vercel project (optional, for preview deploys of *their* app) → paste their own AI key (BYOK, stored encrypted per user).
2. Until they connect, agents run in degraded/demo mode on their workspace with clear "connect GitHub to enable writes" messaging.

## 6. Success criteria
- P0: `ToolExecutor` seam merged, `tsc` + `build` green. ✅ (done, `37a4ef6`)
- P1: user can connect a repo + key vault entry; tool calls scoped to `(userId, workspaceId, repo)` with cross-user denial test.
- Full: agent fixes a real seeded bug in a *user-connected test repo* (failing test → green PR + test log) on both web (GitHub-API path) and desktop (local path).
