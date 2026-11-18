/**
 * I1b: a task blocked on an Integrations-tab provider resumes by itself once the server reports
 * it connected, with nothing pasted. Runs against the REAL game store. No model, no network.
 * Run: npm run test:store
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { useGameStore, setIntegrationResumeHandler } = await import('../src/store/gameStore.ts');

const REQUEST = 'create a Linear ticket to fix the login bug';
let resumed: Array<{ id: string; description: string }> = [];

function newTask(title = 'Create a Linear Ticket'): string {
  useGameStore.getState().addTaskWithTitle(title, undefined, REQUEST);
  const tasks = useGameStore.getState().tasks;
  return tasks[tasks.length - 1].id;
}
const task = (id: string) => useGameStore.getState().tasks.find((t) => t.id === id)!;
const conn = (...providers: string[]) => providers.map((provider) => ({ provider }));

beforeEach(() => {
  useGameStore.setState({ tasks: [], integrationPrompt: null, credentialRequest: null, rightPanelTab: 'overview' });
  if (useGameStore.getState().agents.length === 0) useGameStore.getState().initAgents();
  resumed = [];
  setIntegrationResumeHandler((t) => resumed.push({ id: t.id, description: t.description }));
});

test('blocked on Linear: task waits, the Connect prompt shows, and NO paste prompt is raised', () => {
  const id = newTask();
  useGameStore.getState().requestIntegrations(id, ['linear']);
  const s = useGameStore.getState();
  assert.equal(task(id).status, 'awaiting_credentials');
  assert.deepEqual(task(id).awaitingIntegrations, ['linear']);
  assert.deepEqual(s.integrationPrompt, { taskId: id, taskTitle: 'Create a Linear Ticket', providers: ['linear'] });
  assert.equal(s.credentialRequest, null);
});

test('stays waiting while it is not connected (nothing, or a different provider)', () => {
  const id = newTask();
  useGameStore.getState().requestIntegrations(id, ['linear']);
  useGameStore.getState().syncOAuthConnections([]);
  useGameStore.getState().syncOAuthConnections(conn('github'));
  assert.equal(task(id).status, 'awaiting_credentials');
  assert.equal(resumed.length, 0);
});

test('resumes by itself when Linear is connected: original request re-submitted once, prompt cleared', () => {
  const id = newTask();
  useGameStore.getState().requestIntegrations(id, ['linear']);
  useGameStore.getState().syncOAuthConnections(conn('linear'));
  assert.deepEqual(resumed, [{ id, description: REQUEST }]);
  assert.equal(useGameStore.getState().integrationPrompt, null);
  assert.equal(task(id).status, 'completed');
  assert.equal(task(id).awaitingIntegrations, undefined);
  // a second sync must not resume it again
  useGameStore.getState().syncOAuthConnections(conn('linear'));
  assert.equal(resumed.length, 1);
});

test('needs several providers: waits until ALL are connected', () => {
  const id = newTask('Build and deploy');
  useGameStore.getState().requestIntegrations(id, ['github', 'vercel']);
  useGameStore.getState().syncOAuthConnections(conn('github'));
  assert.equal(resumed.length, 0);
  assert.equal(task(id).status, 'awaiting_credentials');
  useGameStore.getState().syncOAuthConnections(conn('github', 'vercel'));
  assert.equal(resumed.length, 1);
});

test('"Open Integrations": prompt closes, Integrations tab opens, task keeps waiting', () => {
  const id = newTask();
  useGameStore.getState().requestIntegrations(id, ['linear']);
  useGameStore.getState().deferIntegrationPrompt();
  const s = useGameStore.getState();
  assert.equal(s.integrationPrompt, null);
  assert.equal(s.rightPanelTab, 'integrations');
  assert.equal(task(id).status, 'awaiting_credentials');
  // and it still resumes later
  useGameStore.getState().syncOAuthConnections(conn('linear'));
  assert.equal(resumed.length, 1);
});

test('"Cancel task": task fails, prompt closes, and connecting later does NOT resume it', () => {
  const id = newTask();
  useGameStore.getState().requestIntegrations(id, ['linear']);
  useGameStore.getState().cancelIntegrationTask();
  assert.equal(task(id).status, 'failed');
  assert.equal(useGameStore.getState().integrationPrompt, null);
  useGameStore.getState().syncOAuthConnections(conn('linear'));
  assert.equal(resumed.length, 0);
});

test('integration + a real secret: after connecting, the secret is asked (pasted), then nothing auto-resumes early', () => {
  const id = newTask('Deploy with a database');
  const secret = { key: 'database_url', label: 'Database Connection String', reason: 'needs a DB' };
  useGameStore.getState().requestIntegrations(id, ['vercel'], [secret]);
  useGameStore.getState().syncOAuthConnections(conn('vercel'));
  const s = useGameStore.getState();
  assert.equal(resumed.length, 0, 'must not resume before the secret is provided');
  assert.equal(s.credentialRequest?.credentialKey, 'database_url');
  assert.equal(s.credentialRequest?.status, 'pending');
  assert.equal(task(id).status, 'awaiting_credentials');
});

test('several real secrets are asked one at a time (no overwriting)', () => {
  const id = newTask('Needs two secrets');
  const a = { key: 'database_url', label: 'DB', reason: 'a' };
  const b = { key: 'stripe_api_key', label: 'Stripe', reason: 'b' };
  useGameStore.getState().updateTask(id, { pendingSecrets: [b] });
  useGameStore.getState().requestCredential(id, a.reason, a.key, a.label);
  assert.equal(useGameStore.getState().credentialRequest?.credentialKey, 'database_url');
  useGameStore.getState().provideCredential('database_url', 'postgres://x');
  assert.equal(useGameStore.getState().credentialRequest?.credentialKey, 'stripe_api_key');
  assert.equal(useGameStore.getState().credentialRequest?.status, 'pending');
  useGameStore.getState().provideCredential('stripe_api_key', 'sk_test_x');
  assert.equal(task(id).status, 'in_progress');
});
