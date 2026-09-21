# LOOP Tracker

Goal: Implement a Loop Orchestrator (DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP) for AgentCorp
Success criteria: New orchestrator module exists, wired into runtime, with deterministic exit criteria + budgets per phase; `npm run build` passes
Level: L3 (feature/module; DEFINE included because request is vague)
Plan approval: approved
Budget per loop: 2 retries per slice / 2 build-verify cycles max, then escalate

## Phase Status
- DEFINE: done
- PLAN:   done
- BUILD:  done
- VERIFY: done
- REVIEW: done
- SHIP:   done

## Notes
- DEFINE: docs/LOOP_SPEC.md + roles/FSM/QA-reject loop studied; scope=refactor, headless, MemoryStore/localStorage
- PLAN: approved — wrap BUILD↔VERIFY inner loop in outer phased engine
- BUILD: LoopTypes.ts + LoopOrchestrator.ts added; CentralOrchestrator wired via injected storeAccessor, outer budget governs reEnqueue
- VERIFY: npx tsc --noEmit pass; npm run build pass (11 routes, pre-existing lockfile JSON warnings only)
- REVIEW: eslint 0 errors on 3 touched files; no secrets/UI-coupling in orchestrator; removed unused WorkerRole import
- SHIP: committing
