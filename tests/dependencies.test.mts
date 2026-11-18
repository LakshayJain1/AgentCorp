/**
 * I0: planner dependency refs must never crash the task queue.
 * No model, no network. Run: npm run test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDependencyRef,
  normalizeDependencies,
  resolveDependencyRef,
  sanitizePlannedDependencies,
} from '../src/orchestrator/dependencies.ts';

test('numbers (what the LLM actually returns) become sub_<n>', () => {
  assert.equal(normalizeDependencyRef(0), 'sub_0');
  assert.equal(normalizeDependencyRef(3), 'sub_3');
});

test('numeric strings and sub_<n> and ids are handled', () => {
  assert.equal(normalizeDependencyRef('2'), 'sub_2');
  assert.equal(normalizeDependencyRef(' sub_1 '), 'sub_1');
  assert.equal(normalizeDependencyRef('sub_task9_0_1700000000'), 'sub_task9_0_1700000000');
});

test('objects are unwrapped; junk becomes null instead of throwing', () => {
  assert.equal(normalizeDependencyRef({ id: 'sub_a_0_1' }), 'sub_a_0_1');
  assert.equal(normalizeDependencyRef({ index: 1 }), 'sub_1');
  for (const bad of [null, undefined, '', '   ', -1, 1.5, NaN, {}, [], true]) {
    assert.equal(normalizeDependencyRef(bad), null, `input: ${String(bad)}`);
  }
});

test('normalizeDependencies: non-arrays -> [], dedupes, drops junk', () => {
  assert.deepEqual(normalizeDependencies(undefined), []);
  assert.deepEqual(normalizeDependencies('sub_0'), []);
  assert.deepEqual(normalizeDependencies([0, '0', 'sub_0', null, 1, {}]), ['sub_0', 'sub_1']);
});

test('the original crash input: every shape can be resolved with no throw', () => {
  const subs = [{ id: 'sub_t_0_1' }, { id: 'sub_t_1_1' }, { id: 'sub_t_2_1' }];
  const shapes: unknown[] = [[0], ['1'], [{ id: 'sub_t_2_1' }], [null], [0, 2]];
  for (const raw of shapes) {
    for (const ref of normalizeDependencies(raw)) {
      assert.doesNotThrow(() => resolveDependencyRef(subs, ref));
    }
  }
  assert.equal(resolveDependencyRef(subs, 'sub_1')?.id, 'sub_t_1_1');
  assert.equal(resolveDependencyRef(subs, 'sub_t_2_1')?.id, 'sub_t_2_1');
  assert.equal(resolveDependencyRef(subs, 'sub_9'), undefined);
  assert.equal(resolveDependencyRef(subs, 'nope'), undefined);
});

test('sanitizePlannedDependencies drops self and out-of-range refs', () => {
  // subtask at index 1 of 3
  assert.deepEqual(sanitizePlannedDependencies([0, 1, 2, 7], 1, 3), ['sub_0', 'sub_2']);
  assert.deepEqual(sanitizePlannedDependencies(undefined, 0, 3), []);
  // real ids pass through; the queue resolves them later
  assert.deepEqual(sanitizePlannedDependencies(['sub_t_0_1'], 1, 3), ['sub_t_0_1']);
});
