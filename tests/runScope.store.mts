/** Run history is stored per user. No browser needed. Run: npm run test:store */
import test from 'node:test';
import assert from 'node:assert/strict';

const { runDbName, setRunStorageScope, loadCheckpoint } = await import('../src/engine/runPersistence.ts');
const { useRunStore } = await import('../src/engine/runEvents.ts');

test('each signed-in user gets a separate database name', () => {
  assert.notEqual(runDbName('user_a'), runDbName('user_b'));
  assert.equal(runDbName('user_a'), runDbName('user_a'));
  assert.ok(runDbName('user_a').endsWith('user_a'));
});

test('without a scope nothing is read from storage', async () => {
  setRunStorageScope(null);
  assert.equal(await loadCheckpoint('any-task'), null);
});

test('switching user empties the in-memory runs so the previous user\'s history cannot carry over', () => {
  setRunStorageScope('user_a');
  useRunStore.getState().hydrate(
    [{ runId: 'r1', taskId: 't1', status: 'success', startedAt: 1 } as never],
    [],
  );
  assert.equal(useRunStore.getState().order.length, 1);
  setRunStorageScope('user_b');
  assert.equal(useRunStore.getState().order.length, 0);
});

test('setting the same scope again keeps the current runs', () => {
  setRunStorageScope('user_c');
  useRunStore.getState().hydrate([{ runId: 'r2', taskId: 't2', status: 'success', startedAt: 1 } as never], []);
  setRunStorageScope('user_c');
  assert.equal(useRunStore.getState().order.length, 1);
});
