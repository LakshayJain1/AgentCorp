// Node module-resolution hook so the REAL engine source (TypeScript, "@/" aliases,
// extensionless imports) loads unchanged under plain Node. Used only by the bench.
//
// Three modules are swapped for headless stand-ins because they reach into the
// browser app (game store, fetch to /api/ai, connector registry). Everything else
// in the loop (prompting, parsing, budgets, tools, loop detection) is the shipped code.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTS = ['.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];
// Set LOADER_NO_STUBS=1 to load the real modules (used by tests that exercise the real game store).
const STUBS = process.env.LOADER_NO_STUBS ? new Map() : new Map([
  ['src/engine/runBridge.ts', 'bench/stubs/runBridge.ts'],
  ['src/engine/model.ts', 'bench/stubs/model.ts'],
  ['src/runtime/ToolRegistry.ts', 'bench/stubs/ToolRegistry.ts'],
]);

function tryResolve(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXTS) if (existsSync(base + e)) return base + e;
  return null;
}

export async function resolve(specifier, context, next) {
  // `server-only` throws outside Next's server bundle; real-module tests treat it as an empty module.
  if (specifier === 'server-only' && process.env.LOADER_NO_STUBS) {
    return { url: 'data:text/javascript,export{}', shortCircuit: true };
  }
  let base = null;
  if (specifier.startsWith('@/')) base = path.join(root, 'src', specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    let hit = tryResolve(base);
    if (hit) {
      const rel = path.relative(root, hit).split(path.sep).join('/');
      if (STUBS.has(rel)) hit = path.join(root, STUBS.get(rel));
      return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}

// Transpile TypeScript with the repo's own compiler instead of Node's type stripping:
// the app source relies on bundler behaviour (type-only imports written without
// `import type`, parameter properties) that strip-only mode rejects.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)(path.join(root, 'node_modules', 'typescript'));

export async function load(url, context, next) {
  if (url.startsWith('file:') && /\.(m?ts|tsx)$/.test(url) && !url.includes('/node_modules/')) {
    const source = readFileSync(fileURLToPath(url), 'utf8');
    const out = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true, esModuleInterop: true },
    });
    return { format: 'module', source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
