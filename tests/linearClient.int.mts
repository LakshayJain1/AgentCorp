/**
 * I2 + I3: the Linear client. Runs against a stateful FAKE Linear server with fault injection,
 * so retries, idempotency and error handling are exercised without the network or any LLM.
 * Run: npm run test:int
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { LinearClient, pickState } = await import('../src/lib/integrations/linear/client.ts');
const { LinearError, retryAfterMsFrom } = await import('../src/lib/integrations/linear/errors.ts');
const { deterministicUuid } = await import('../src/lib/integrations/linear/ids.ts');
import { makeFake, STATES } from './helpers/fakeLinear.mts';

function client(fake: ReturnType<typeof makeFake>, extra: Record<string, unknown> = {}) {
  const sleeps: number[] = [];
  const c = new LinearClient({
    token: 'tok-1', namespace: 'ws-1', fetchImpl: fake.fetch, random: () => 0.5,
    sleep: async (ms: number) => { sleeps.push(ms); }, ...extra,
  });
  return { c, sleeps };
}

// ── deterministic ids ───────────────────────────────────────────────────────

test('deterministicUuid: stable, valid UUID v4 shape, scoped by namespace and key', () => {
  const a = deterministicUuid('ws-1', 'task_1:created:0');
  assert.equal(a, deterministicUuid('ws-1', 'task_1:created:0'));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, deterministicUuid('ws-2', 'task_1:created:0'));
  assert.notEqual(a, deterministicUuid('ws-1', 'task_1:created:1'));
});

// ── idempotency (I3) ────────────────────────────────────────────────────────

test('connection dies AFTER Linear created the issue, then retry: exactly ONE issue', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'drop-after' }); // 1st attempt: created, but we never saw the answer
  const { c } = client(fake);
  const { issue } = await c.createIssue({ teamId: 'ENG', title: 'Fix login', idempotencyKey: 'task_1:create:0' });
  assert.equal(fake.issues.size, 1);
  assert.equal(issue.id, c.idFor('task_1:create:0'));
});

test('connection fails BEFORE Linear sees it, then retry: one issue, created on the retry', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'throw' });
  const { c, sleeps } = client(fake);
  const { replayed } = await c.createIssue({ teamId: 'ENG', title: 'Fix login', idempotencyKey: 'k1' });
  assert.equal(fake.issues.size, 1);
  assert.equal(replayed, false);
  assert.equal(sleeps.length, 1);
});

test('replaying the same event twice yields one issue and the same id', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  const first = await c.createIssue({ teamId: 'ENG', title: 'T', idempotencyKey: 'task_9:create:0' });
  const second = await c.createIssue({ teamId: 'ENG', title: 'T', idempotencyKey: 'task_9:create:0' });
  assert.equal(fake.issues.size, 1);
  assert.equal(second.issue.id, first.issue.id);
  assert.equal(second.replayed, true);
});

test('without a key every call is a new issue (keys are what make it safe)', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  await c.createIssue({ teamId: 'ENG', title: 'T' });
  await c.createIssue({ teamId: 'ENG', title: 'T' });
  assert.equal(fake.issues.size, 2);
});

test('replaying the same comment twice yields one comment', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  const { issue } = await c.createIssue({ teamId: 'ENG', title: 'T', idempotencyKey: 'i' });
  const a = await c.createComment({ issueId: issue.id, body: '**Mike (Engineer):** on it', idempotencyKey: 'task_1:assigned:0' });
  const b = await c.createComment({ issueId: issue.id, body: '**Mike (Engineer):** on it', idempotencyKey: 'task_1:assigned:0' });
  assert.equal(fake.comments.size, 1);
  assert.equal(a.id, b.id);
  assert.equal(b.replayed, true);
});

// ── retry rules (I3) ────────────────────────────────────────────────────────

test('429 with Retry-After is retried after that wait, then succeeds', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 429, headers: { 'retry-after': '2' } });
  const { c, sleeps } = client(fake);
  const teams = await c.listTeams();
  assert.equal(teams.length, 1);
  assert.deepEqual(sleeps, [2000]);
  assert.equal(fake.requests.length, 2);
});

test('rate limit reported as a GraphQL error (HTTP 400, RATELIMITED) is also retried', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 400, body: { errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATELIMITED' } }] } });
  const { c } = client(fake);
  await c.listTeams();
  assert.equal(fake.requests.length, 2);
});

test('5xx twice then success: exponential backoff with jitter, 3 requests', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 503 }, { type: 'http', status: 502 });
  const { c, sleeps } = client(fake); // random=0.5 -> factor 0.75; base 500
  await c.listTeams();
  assert.equal(fake.requests.length, 3);
  assert.deepEqual(sleeps, [375, 750]);
});

test('5xx forever: bounded at 3 attempts, then a typed server error', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 500 }, { type: 'http', status: 500 }, { type: 'http', status: 500 }, { type: 'http', status: 500 });
  const { c } = client(fake);
  await assert.rejects(c.listTeams(), (e: any) => e instanceof LinearError && e.kind === 'server');
  assert.equal(fake.requests.length, 3);
});

test('network down forever: bounded, typed network error', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'throw' }, { type: 'throw' }, { type: 'throw' }, { type: 'throw' });
  const { c } = client(fake);
  await assert.rejects(c.listTeams(), (e: any) => e instanceof LinearError && e.kind === 'network');
  assert.equal(fake.requests.length, 3);
});

test('a 400 validation error is NOT retried', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 400, body: { errors: [{ message: 'title is required', extensions: { type: 'invalid input' } }] } });
  const { c, sleeps } = client(fake);
  await assert.rejects(c.listTeams(), (e: any) => e.kind === 'validation' && /title is required/.test(e.message));
  assert.equal(fake.requests.length, 1);
  assert.equal(sleeps.length, 0);
});

test('401 is typed auth and not retried', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 401, body: { errors: [{ message: 'Authentication required', extensions: { type: 'authentication error' } }] } });
  const { c } = client(fake);
  await assert.rejects(c.listTeams(), (e: any) => e.kind === 'auth');
  assert.equal(fake.requests.length, 1);
});

test('401 then a refreshed token: retried once with the new token, and succeeds', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 401 });
  const { c } = client(fake, { onUnauthorized: async () => 'tok-2' });
  await c.listTeams();
  assert.deepEqual(fake.requests.map((r) => r.auth), ['Bearer tok-1', 'Bearer tok-2']);
});

test('401 twice (refresh did not help): gives up, no loop', async () => {
  const fake = makeFake();
  fake.faults.push({ type: 'http', status: 401 }, { type: 'http', status: 401 });
  const { c } = client(fake, { onUnauthorized: async () => 'tok-2' });
  await assert.rejects(c.listTeams(), (e: any) => e.kind === 'auth');
  assert.equal(fake.requests.length, 2);
});

test('retryAfterMsFrom: Retry-After seconds, and Linear reset epoch', () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });
  assert.equal(retryAfterMsFrom(h({ 'retry-after': '3' })), 3000);
  assert.equal(retryAfterMsFrom(h({ 'x-ratelimit-requests-reset': String(10_000 + 4000) }), 10_000), 4000);
  assert.equal(retryAfterMsFrom(h({})), undefined);
});

// ── operations (I2) ─────────────────────────────────────────────────────────

test('getIssue: by id and identifier; missing -> null (not an error)', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  const { issue } = await c.createIssue({ teamId: 'ENG', title: 'T' });
  assert.equal((await c.getIssue(issue.id))?.title, 'T');
  assert.equal((await c.getIssue('ENG-1'))?.id, issue.id);
  assert.equal(await c.getIssue('nope'), null);
});

test('updateIssueStatus: by name, by alias, and a no-op when already there', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  const { issue } = await c.createIssue({ teamId: 'ENG', title: 'T' });
  const a = await c.updateIssueStatus(issue.id, 'In Progress');
  assert.equal(a.changed, true);
  assert.equal(a.issue.state?.name, 'In Progress');
  const again = await c.updateIssueStatus(issue.id, 'in progress');
  assert.equal(again.changed, false);
  const done = await c.updateIssueStatus('ENG-1', 'done');
  assert.equal(done.issue.state?.name, 'Done');
  await assert.rejects(c.updateIssueStatus(issue.id, 'nonsense'), (e: any) => e.kind === 'validation' && /Available: Backlog/.test(e.message));
});

test('updateIssueStatus on a missing issue is a typed not_found', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  await assert.rejects(c.updateIssueStatus('ENG-404', 'done'), (e: any) => e.kind === 'not_found');
});

test('pickState: exact name wins, then type alias by lowest position', () => {
  assert.equal(pickState(STATES, 'Todo').id, 's-todo');
  assert.equal(pickState(STATES, 'review').id, 's-prog');
  assert.equal(pickState(STATES, 'Cancelled').id, 's-canc');
});

test('ensureLabel creates once and finds it afterwards; addLabel is idempotent', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  const l1 = await c.ensureLabel('team-1', 'agent:engineer');
  const l2 = await c.ensureLabel('team-1', 'Agent:Engineer'); // case-insensitive
  assert.equal(l1.id, l2.id);
  assert.equal(fake.labels.size, 1);
  const { issue } = await c.createIssue({ teamId: 'ENG', title: 'T' });
  await c.addLabel(issue.id, l1.id);
  await c.addLabel(issue.id, l1.id);
  assert.equal(fake.issues.get(issue.id)!.labelIds.length, 1);
});

test('resolveTeam: by key, name or id; unknown lists the choices; default is the first team', async () => {
  const fake = makeFake();
  const { c } = client(fake);
  assert.equal((await c.resolveTeam('eng')).id, 'team-1');
  assert.equal((await c.resolveTeam('Engineering')).key, 'ENG');
  assert.equal((await c.resolveTeam()).id, 'team-1');
  await assert.rejects(c.resolveTeam('ops'), (e: any) => e.kind === 'validation' && /Engineering \(ENG\)/.test(e.message));
});
