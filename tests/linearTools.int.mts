/**
 * I2: the Linear TOOLS the agents call (create, get, status, comment, label, assign), end to end
 * through tools.ts against the fake Linear server. No network, no LLM. Run: npm run test:int
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFake } from './helpers/fakeLinear.mts';

const { getServerTool, listServerTools, listServerToolsAsOpenAI, ToolInputError } = await import('../src/lib/integrations/tools.ts');

const TOKEN = 'lin_secret_token_123';
const CTX = { workspaceId: 'ws-1' };
const realFetch = globalThis.fetch;

function withFake() {
  const fake = makeFake();
  globalThis.fetch = fake.fetch;
  return fake;
}
test.afterEach(() => { globalThis.fetch = realFetch; });

const run = (name: string, args: Record<string, string>, ctx = CTX) => getServerTool(name)!.run(TOKEN, args, ctx);

test('the Linear tool set is registered, each with a provider and a description', () => {
  const names = listServerTools().filter((t) => t.provider === 'linear').map((t) => t.name).sort();
  assert.deepEqual(names, [
    'linear_add_label', 'linear_assign_issue', 'linear_comment_on_issue', 'linear_create_issue',
    'linear_get_issue', 'linear_list_teams', 'linear_list_workflow_states', 'linear_update_issue_status',
  ]);
  for (const t of listServerTools()) assert.ok(t.description.length > 10, t.name);
});

test('model-facing schema: optional params are NOT required (the model must not invent them)', () => {
  const byName = Object.fromEntries(listServerToolsAsOpenAI().map((t) => [t.function.name, t.function.parameters as any]));
  assert.deepEqual(byName.linear_create_issue.required, ['title']);
  assert.ok(Object.keys(byName.linear_create_issue.properties).includes('idempotencyKey'));
  assert.deepEqual(byName.linear_comment_on_issue.required, ['issueId', 'body']);
  assert.deepEqual(byName.linear_list_teams.required, []);
  assert.deepEqual(byName.linear_update_issue_status.required, ['issueId', 'status']);
});

test('create_issue with labels + idempotencyKey: retry-safe, labels created once', async () => {
  const fake = withFake();
  const a = await run('linear_create_issue', { title: 'Fix login bug', labels: 'agent:engineer, bug', idempotencyKey: 'task_1:create:0' });
  const b = await run('linear_create_issue', { title: 'Fix login bug', labels: 'agent:engineer, bug', idempotencyKey: 'task_1:create:0' });
  assert.match(a, /^created ENG-1 "Fix login bug"/);
  assert.match(a, /labels: agent:engineer, bug/);
  assert.match(b, /^already existed ENG-1/);
  assert.equal(fake.issues.size, 1);
  assert.equal(fake.labels.size, 2);
});

test('the same key in a different workspace is a different issue', async () => {
  const fake = withFake();
  await run('linear_create_issue', { title: 'T', idempotencyKey: 'k' }, { workspaceId: 'ws-A' });
  await run('linear_create_issue', { title: 'T', idempotencyKey: 'k' }, { workspaceId: 'ws-B' });
  assert.equal(fake.issues.size, 2);
});

test('comment_on_issue prefixes the agent, and a repeat with the same key adds nothing', async () => {
  const fake = withFake();
  await run('linear_create_issue', { title: 'T' });
  const a = await run('linear_comment_on_issue', { issueId: 'ENG-1', body: 'Starting work.', author: 'Mike (Engineer)', idempotencyKey: 'task_1:started:0' });
  const b = await run('linear_comment_on_issue', { issueId: 'ENG-1', body: 'Starting work.', author: 'Mike (Engineer)', idempotencyKey: 'task_1:started:0' });
  assert.match(a, /^commented on ENG-1/);
  assert.match(b, /^comment already existed on ENG-1/);
  assert.equal(fake.comments.size, 1);
  assert.equal([...fake.comments.values()][0].body, '**Mike (Engineer):** Starting work.');
});

test('update_issue_status moves it, then reports it is already there', async () => {
  withFake();
  await run('linear_create_issue', { title: 'T' });
  assert.match(await run('linear_update_issue_status', { issueId: 'ENG-1', status: 'In Progress' }), /^moved In Progress: ENG-1/);
  assert.match(await run('linear_update_issue_status', { issueId: 'ENG-1', status: 'in progress' }), /^already in In Progress/);
});

test('get_issue shows state, labels and the latest comments', async () => {
  withFake();
  await run('linear_create_issue', { title: 'Ship it', labels: 'qa' });
  await run('linear_comment_on_issue', { issueId: 'ENG-1', body: 'looks good', author: 'Tina (QA)' });
  const out = await run('linear_get_issue', { issueId: 'ENG-1' });
  assert.match(out, /ENG-1 "Ship it" \[Backlog\]/);
  assert.match(out, /labels: qa/);
  assert.match(out, /comment: \*\*Tina \(QA\):\*\* looks good/);
});

test('add_label and assign_issue', async () => {
  const fake = withFake();
  await run('linear_create_issue', { title: 'T' });
  assert.match(await run('linear_add_label', { issueId: 'ENG-1', label: 'agent:qa' }), /labelled ENG-1 with "agent:qa"/);
  assert.equal([...fake.issues.values()][0].labelIds.length, 1);
  assert.match(await run('linear_assign_issue', { issueId: 'ENG-1', assigneeId: 'user-1' }), /assignee: Someone/);
});

test('list_workflow_states and list_teams', async () => {
  withFake();
  assert.match(await run('linear_list_teams', {}), /Engineering — id: team-1 \(key: ENG\)/);
  const states = await run('linear_list_workflow_states', {});
  assert.match(states, /- In Progress \(started\)/);
});

test('errors: bad input -> ToolInputError; unknown issue and auth failures are readable and never leak the token', async () => {
  const fake = withFake();
  await run('linear_create_issue', { title: 'T' });
  await assert.rejects(run('linear_update_issue_status', { issueId: 'ENG-1', status: 'nonsense' }), (e: any) => e instanceof ToolInputError && /Available:/.test(e.message));
  await assert.rejects(run('linear_get_issue', { issueId: 'ENG-404' }), (e: any) => /could not find/i.test(e.message) && !e.message.includes(TOKEN));
  await assert.rejects(run('linear_create_issue', {}), (e: any) => e instanceof ToolInputError && /missing required/.test(e.message));
  fake.faults.push({ type: 'http', status: 401, body: { errors: [{ message: 'Authentication required', extensions: { type: 'authentication error' } }] } });
  await assert.rejects(run('linear_list_teams', {}), (e: any) => /Reconnect Linear/.test(e.message) && !e.message.includes(TOKEN));
});

test('live finding: the app may not be allowed to create labels. Issue is still created; the label is skipped with a note', async () => {
  const fake = withFake();
  fake.options.denyLabelCreate = true;
  const out = await run('linear_create_issue', { title: 'Fix login', labels: 'agent:engineer', idempotencyKey: 'k' });
  assert.match(out, /^created ENG-1 "Fix login"/);
  assert.match(out, /labels skipped: agent:engineer/);
  assert.equal(fake.issues.size, 1);
  assert.equal([...fake.issues.values()][0].labelIds.length, 0);
});

test('an EXISTING label is used even when creating labels is not allowed', async () => {
  const fake = withFake();
  await run('linear_add_label', { issueId: (await run('linear_create_issue', { title: 'seed' })).match(/ENG-\d+/)![0], label: 'agent:qa' }); // creates the label while allowed
  fake.options.denyLabelCreate = true;
  const out = await run('linear_create_issue', { title: 'Needs QA', labels: 'agent:qa' });
  assert.match(out, /labels: agent:qa/);
  assert.doesNotMatch(out, /skipped/);
});

test('add_label when creating is forbidden and the label does not exist: a clear error (explicit request, not silently ignored)', async () => {
  const fake = withFake();
  await run('linear_create_issue', { title: 'T' });
  fake.options.denyLabelCreate = true;
  await assert.rejects(run('linear_add_label', { issueId: 'ENG-1', label: 'nope' }), (e: any) => /not allowed to create labels/.test(e.message));
});
