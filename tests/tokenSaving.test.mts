/** Groq adapter helpers and history trimming. No model, no network. Run: npm run test:unit */
import test from 'node:test';
import assert from 'node:assert/strict';
import { groqModels, groqExtras, firstCap, boostedCap, retryDelayMs, MAX_REPLY_TOKENS, DEFAULT_GROQ_SMALL, DEFAULT_GROQ_LARGE } from '../src/lib/ai/groq.ts';
import { trimHistory } from '../src/ai/history.ts';

test('groqModels: small may borrow large, large never falls back to small', () => {
  assert.deepEqual(groqModels('small', {}), [DEFAULT_GROQ_SMALL, DEFAULT_GROQ_LARGE]);
  assert.deepEqual(groqModels('large', {}), [DEFAULT_GROQ_LARGE]);
  assert.deepEqual(groqModels(undefined, {}), [DEFAULT_GROQ_LARGE]);
});

test('groqModels: env overrides, comma lists, no duplicates', () => {
  const env = { GROQ_MODEL_SMALL: 'a, b', GROQ_MODEL_LARGE: 'b,c' };
  assert.deepEqual(groqModels('small', env), ['a', 'b', 'c']);
  assert.deepEqual(groqModels('large', env), ['b', 'c']);
});

test('groqExtras only for gpt-oss models', () => {
  assert.deepEqual(groqExtras(['openai/gpt-oss-20b']), { reasoning_effort: 'low' });
  assert.deepEqual(groqExtras(['openai/gpt-oss-20b', 'llama-3.3-70b-versatile']), {});
});

test('firstCap clamps; boostedCap grows but stays under the ceiling', () => {
  assert.equal(firstCap(undefined), 4096);
  assert.equal(firstCap(100000), 4096);
  assert.equal(firstCap(60), 60);
  assert.equal(firstCap(1), 16);
  assert.equal(boostedCap(60), 316);
  assert.equal(boostedCap(2000), 4000);
  assert.equal(boostedCap(4096), MAX_REPLY_TOKENS);
});

test('retryDelayMs honours short retry-after only', () => {
  const h = (v: string | null) => ({ get: () => v });
  assert.equal(retryDelayMs(h('2')), 2000);
  assert.equal(retryDelayMs(h('30')), null);
  assert.equal(retryDelayMs(h(null)), null);
  assert.equal(retryDelayMs(h('abc')), null);
});

test('trimHistory keeps the newest turns and shortens long ones', () => {
  const hist = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 ? 'agent' : 'user') as 'user' | 'agent', text: `m${i} ${'x'.repeat(500)}` }));
  const out = trimHistory(hist, { maxMessages: 3, maxChars: 50 });
  assert.equal(out.length, 3);
  assert.ok(out[2].text.startsWith('m9 '));
  assert.ok(out.every((m) => m.text.length <= 51 && m.text.endsWith('…')));
  assert.deepEqual(trimHistory(undefined), []);
  assert.deepEqual(trimHistory([{ role: 'user', text: '   ' }]), []);
  assert.equal(trimHistory([{ role: 'user', text: 'short' }])[0].text, 'short');
});
