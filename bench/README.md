# Benchmark (H1) and regression report (H2)

A developer tool. It is not part of the app and is not shipped in the installer.
It answers one question: **did this change make the agents better or worse?**

It runs the **shipped** agent loop (`src/engine/AgentLoop.ts`) and the **shipped** tool
definitions (`src/engine/tools.ts`) against 14 fixed tasks with a real model. Each task has a
mechanical pass/fail check (tests pass, a file holds the right value, the summary cites the right
URL, a secret is not leaked). Nothing here asks a model to grade a model.

## Commands

```bash
npm run bench:selftest          # no model, no cost: proves the checks themselves are sound
npm run bench -- --list         # list tasks
npm run bench                   # all tasks, 1 attempt each
npm run bench -- --repeat 3     # 3 attempts per task (use this for anything you will act on)
npm run bench -- --task dev-slugify,dev-rename
npm run bench -- --role research
npm run bench -- --model google/gemini-2.0-flash-001
npm run bench:report            # compare the newest run with the one before it (H2)
npm run bench:report -- --write --fail-on-regression
```

Needs `OPENROUTER_API_KEY` (or `GEMINI_API_KEY`) in `.env` / `.env.local`. Default model is
`openai/gpt-4o-mini`, the same default the app's `/api/ai` route uses. Override with `--model`
or `BENCH_MODEL`. A full `--repeat 3` run is roughly 40 attempts and a few hundred thousand tokens.

## What is real and what is simulated

| Real (shipped code) | Simulated (bench only) |
|---|---|
| Agent loop: prompt, JSON action parsing, budgets, loop detection, checkpoints | The model call goes straight to OpenRouter/Gemini instead of through `/api/ai` (that route needs a signed-in browser) |
| Tool definitions, argument validation, path rules (`tools.ts`) | The desktop shell: a temp folder plus a fake `window.electronAPI` with the same confinement rules as `desktop/main.js` |
| Run-event stream (`runEvents.ts`) | `run_check test` / `npm test` run `node --test`, not vitest, so no install step is needed |
| | `web_fetch` can only reach a local fixture server, so research tasks are repeatable and never touch the real internet |
| | `web_search` answers from a per-task fixture (`search` in `tasks.mts`), or reports "not set up" when a task has none |

Not covered yet: the desktop shell's own IPC handlers (`desktop/main.js`), approval dialogs,
`ask_user`, connector tools (Slack/Linear), the orchestrator/planner path, and criteria generation / QA.

## Reading results

* Results go to `bench/results/<time>_<model>.json`. **Commit one before each release** so the next
  report has something to compare against.
* Models are noisy. With 1 attempt per task a single flip can be luck. The report warns about this;
  compare `--repeat 3` runs against `--repeat 3` runs.
* A report across different models mostly measures the models.

## Adding a task

1. Add it to `tasks.mts`: the goal must state everything the check relies on; hidden tests may only
   probe behaviour the goal describes.
2. Add a reference solution to `references.mts`.
3. Run `npm run bench:selftest`. It must reject an untouched workspace and accept the reference.

## How it loads TypeScript

`bench/loader.mjs` is a Node resolution/transpile hook: it resolves `@/…` imports and extensionless
paths, transpiles with the repo's own TypeScript, and swaps three browser-bound modules
(`runBridge`, `model`, `ToolRegistry`) for the headless stand-ins in `bench/stubs/`.
`bench/` is excluded from the app's `tsconfig.json`, so it does not affect `next build`.
