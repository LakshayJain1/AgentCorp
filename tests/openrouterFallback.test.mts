/**
 * OpenRouter model fallback: a rate-limited free model must fall through to the next one.
 * No network, no LLM. Run: npm run test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModels, postWithFallback, DEFAULT_OPENROUTER_MODEL } from '../src/lib/ai/openrouterFallback.ts';

test('resolveModels: explicit wins, then the env list (trimmed), then the paid default', () => {
  assert.deepEqual(resolveModels('x/y', 'a:free,b:free'), ['x/y']);
  assert.deepEqual(resolveModels(undefined, ' a:free , b:free ,, '), ['a:free', 'b:free']);
  assert.deepEqual(resolveModels(undefined, undefined), [DEFAULT_OPENROUTER_MODEL]);
  assert.deepEqual(resolveModels('', ''), [DEFAULT_OPENROUTER_MODEL]);
});

const seq = (statuses: number[]) => {
  const seen: string[] = [];
  const f = (async (_u: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)).model);
    const status = statuses[seen.length - 1] ?? 200;
    return new Response(JSON.stringify({ n: seen.length }), { status });
  }) as unknown as typeof fetch;
  return { f, seen };
};
const call = (f: typeof fetch, models: string[]) => postWithFallback(f, 'u', {}, { messages: [] }, models);

test('first model answers: no fallback', async () => {
  const { f, seen } = seq([200]);
  const r = await call(f, ['a', 'b']);
  assert.equal(r.model, 'a');
  assert.deepEqual(seen, ['a']);
  assert.equal(r.skipped.length, 0);
});

test('429 (rate limited) falls through to the next model; the skipped one is reported', async () => {
  const { f, seen } = seq([429, 200]);
  const r = await call(f, ['a', 'b', 'c']);
  assert.equal(r.model, 'b');
  assert.equal(r.response.ok, true);
  assert.deepEqual(seen, ['a', 'b']);
  assert.deepEqual(r.skipped, [{ model: 'a', status: 429 }]);
});

test('402 (no credit) and 5xx also fall through, all the way to the last model', async () => {
  const { f, seen } = seq([402, 503, 200]);
  const r = await call(f, ['paid', 'flaky', 'free']);
  assert.equal(r.model, 'free');
  assert.deepEqual(seen, ['paid', 'flaky', 'free']);
});

test('every model failing returns the LAST response (so the caller can report it)', async () => {
  const { f } = seq([429, 429, 503]);
  const r = await call(f, ['a', 'b', 'c']);
  assert.equal(r.model, 'c');
  assert.equal(r.response.status, 503);
  assert.equal(r.skipped.length, 2);
});

test('400 / 401 are NOT retried on another model (a different model cannot fix them)', async () => {
  for (const status of [400, 401, 404]) {
    const { f, seen } = seq([status, 200]);
    const r = await call(f, ['a', 'b']);
    assert.equal(r.response.status, status);
    assert.deepEqual(seen, ['a']);
  }
});

test('a single model never loops', async () => {
  const { f, seen } = seq([429, 200]);
  const r = await call(f, ['only']);
  assert.equal(r.response.status, 429);
  assert.deepEqual(seen, ['only']);
});
