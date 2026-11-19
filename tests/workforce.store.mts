/**
 * Onboarding spawns, hire/fire and company morale, against the REAL game store.
 * No model, no network. Run: npm run test:store
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { useGameStore } = await import('../src/store/gameStore.ts');
const store = () => useGameStore.getState();
const engineers = () => store().agents.filter((a) => a.role === 'engineer');
const online = (role: string) => store().agents.filter((a) => a.role === role && a.online);

beforeEach(() => {
  store().initializePersonalizedOffice('E2E Co', 'Test product', 4, {} as never);
});

test('onboarding with 4 developers seats exactly 4 engineers and one of each business role', () => {
  assert.equal(engineers().length, 4);
  for (const role of ['ceo', 'pm', 'qa', 'hr', 'researcher', 'sales', 'finance', 'ops']) {
    assert.equal(store().agents.filter((a) => a.role === role).length, 1, role);
  }
  assert.equal(store().developersCount, 4);
});

test('onboarding with 1 developer adds no extra engineers', () => {
  store().initializePersonalizedOffice('Solo', 'x', 1, {} as never);
  assert.equal(engineers().length, 1);
});

test('re-running onboarding does not duplicate agents', () => {
  const before = store().agents.length;
  store().initializePersonalizedOffice('E2E Co', 'Test product', 4, {} as never);
  assert.equal(store().agents.length, before);
});

test('fireAgent takes the agent offline, clears its work and keeps the record', () => {
  const qa = online('qa')[0];
  store().fireAgent(qa.id);
  const after = store().agents.find((a) => a.id === qa.id)!;
  assert.equal(after.online, false);
  assert.equal(after.workStatus, 'idle');
  assert.equal(after.currentTaskId, null);
  assert.ok(store().events.some((e) => e.message.includes(`${qa.name} has left the team`)));
});

test('hireAgent adds a new agent with an unused name from the role pool', () => {
  const before = store().agents.length;
  store().hireAgent('qa');
  assert.equal(store().agents.length, before + 1);
  const names = store().agents.filter((a) => a.role === 'qa').map((a) => a.name);
  assert.equal(new Set(names).size, names.length, 'names are unique');
  store().hireAgent('qa');
  const names2 = store().agents.filter((a) => a.role === 'qa').map((a) => a.name);
  assert.equal(new Set(names2).size, names2.length, 'still unique after the pool runs out');
});

test('hire then fire then hire again keeps the fired agent as an offline record', () => {
  store().hireAgent('engineer');
  const hired = engineers().at(-1)!;
  store().fireAgent(hired.id);
  store().hireAgent('engineer');
  assert.equal(store().agents.find((a) => a.id === hired.id)!.online, false);
  assert.equal(engineers().filter((a) => a.online).length, 5);
});

test('company morale rises 2 on a completed task and falls 3 on a failed one, clamped to 0..100', () => {
  const { completeTask, failTask } = store();
  const mk = (title: string) => {
    const before = new Set(store().tasks.map((t) => t.id));
    store().addTaskWithTitle(title);
    return store().tasks.find((t) => !before.has(t.id))!.id;
  };
  const m0 = store().simulation.morale;
  completeTask(mk('a'));
  assert.equal(store().simulation.morale, Math.min(100, m0 + 2));
  const m1 = store().simulation.morale;
  failTask(mk('b'));
  assert.equal(store().simulation.morale, Math.max(0, m1 - 3));
  for (let i = 0; i < 40; i++) failTask(mk(`f${i}`));
  assert.equal(store().simulation.morale, 0);
  for (let i = 0; i < 60; i++) completeTask(mk(`c${i}`));
  assert.equal(store().simulation.morale, 100);
});

test('completing or failing an unknown task changes nothing', () => {
  const before = JSON.stringify(store().simulation);
  store().completeTask('nope');
  store().failTask('nope');
  assert.equal(JSON.stringify(store().simulation), before);
});
