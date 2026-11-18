/**
 * I4: the Linear lifecycle mirror, against the REAL game store and run-event stream with a fake
 * transport (no network, no LLM). Run: npm run test:store
 */
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { useGameStore } = await import('../src/store/gameStore.ts');
const { useApprovalStore } = await import('../src/engine/approvals.ts');
const { publishRunEvent, useRunStore } = await import('../src/engine/runEvents.ts');
const { startLinearMirror, MirrorHttpError } = await import('../src/engine/LinearMirror.ts');
const { planForEvent, parseCreated, issueDraft } = await import('../src/engine/linearMirrorPlan.ts');
const { AI_UNAVAILABLE_MESSAGE } = await import('../src/ai/aiMessages.ts');

type Call = { tool: string; params: Record<string, string> };
let calls: Call[] = [];
/** Errors to throw for the next calls to a tool, in order. */
let failures: Record<string, Error[]> = {};

const exec = async (tool: string, params: Record<string, string>): Promise<string> => {
  calls.push({ tool, params });
  const queue = failures[tool];
  if (queue?.length) throw queue.shift()!;
  if (tool === 'linear_create_issue') return `created AGE-8 "${params.title}" [Backlog] https://linear.app/x/issue/AGE-8/t`;
  return 'ok';
};
const mirrors: Array<{ stop(): void }> = [];
const fastMirror = () => {
  const m = startLinearMirror({ exec, sleep: async () => {}, retryDelaysMs: [1, 1] });
  mirrors.push(m);
  return m;
};
// A failing assertion must not leave a mirror subscribed (it would keep writing into later tests).
afterEach(() => { for (const m of mirrors.splice(0)) m.stop(); });

const agent = (role: string) => useGameStore.getState().agents.find((a) => a.role === role)!;
const task = (id: string) => useGameStore.getState().tasks.find((t) => t.id === id)!;
const names = () => calls.map((c) => c.tool);

function newTask(title = 'Write a Python script'): string {
  useGameStore.getState().addTaskWithTitle(title, undefined, 'write a short python script that reverses a string');
  const t = useGameStore.getState().tasks;
  return t[t.length - 1].id;
}
function emit(taskId: string, kind: string, extra: Record<string, unknown> = {}) {
  return publishRunEvent({ taskId, kind, message: kind, ...extra } as Parameters<typeof publishRunEvent>[0]);
}
/** The events a real direct run produces, in order. */
function happyRun(taskId: string, opts: { verdict?: 'passed' | 'needs_attention' } = {}) {
  const mike = agent('engineer').id;
  emit(taskId, 'run.started', { agentId: mike, status: 'running', data: { title: 'Write a Python script' } });
  emit(taskId, 'tool.result', { agentId: agent('ceo').id, message: 'Prioritized task', detail: 'Priority: low', status: 'success', data: { tool: 'ceo:prioritize' } });
  emit(taskId, 'tool.result', { agentId: agent('pm').id, message: 'Assigned to Mike', status: 'success', data: { tool: 'pm:assign' } });
  emit(taskId, 'step.started', { agentId: mike, message: 'Started "Write a Python script"', status: 'running', data: { tool: 'generateDeliverable' } });
  emit(taskId, 'validation.result', { agentId: mike, message: 'QA: all acceptance criteria met', detail: 'PASS  works', status: 'success' });
  emit(taskId, 'step.finished', { agentId: mike, message: 'Completed "Write a Python script"', status: 'success', data: { tool: 'generateDeliverable' } });
  emit(taskId, 'summary.delta', { agentId: mike, message: 'I wrote the script.', data: { replace: true } });
  emit(taskId, 'run.finished', { agentId: mike, status: 'success', message: 'Finished', data: { verdict: opts.verdict ?? 'passed' } });
}

beforeEach(() => {
  const gs = useGameStore.getState();
  if (gs.agents.length === 0) gs.initAgents();
  useGameStore.setState({ tasks: [] });
  useRunStore.getState().clear();
  gs.syncOAuthConnections([{ provider: 'linear' }]);
  gs.setLinearMirror(true);
  gs.setLinearAutopilot(true); // approvals have their own tests at the bottom
  useApprovalStore.setState({ pending: [], always: new Set() });
  calls = [];
  failures = {};
});

// ── the lifecycle ───────────────────────────────────────────────────────────

test('one task -> one issue, then the whole lifecycle in order, each comment by the right agent', async () => {
  const m = fastMirror();
  const id = newTask();
  happyRun(id);
  await m.idle();

  assert.equal(calls.filter((c) => c.tool === 'linear_create_issue').length, 1);
  assert.equal(names()[0], 'linear_create_issue');
  assert.equal(calls[0].params.idempotencyKey, `${id}:created`);
  assert.match(calls[0].params.description, /write a short python script/);
  assert.match(calls[0].params.description, new RegExp(id));

  const comments = calls.filter((c) => c.tool === 'linear_comment_on_issue');
  assert.deepEqual(comments.map((c) => c.params.author), [
    'Alex (CEO)', 'Sam (PM)', 'Mike (Engineer)', 'Tina (QA)', 'Mike (Engineer)', 'Mike (Engineer)',
  ]);
  assert.match(comments[1].params.body, /Assigned to Mike/);
  assert.match(comments[3].params.body, /QA: all acceptance criteria met/);
  assert.match(comments[5].params.body, /I wrote the script\./);

  // status trail: Todo (assigned) -> In Progress (started) -> Done (finished, passed)
  assert.deepEqual(calls.filter((c) => c.tool === 'linear_update_issue_status').map((c) => c.params.status), ['Todo', 'In Progress', 'Done']);
  assert.ok(calls.some((c) => c.tool === 'linear_add_label' && c.params.label === 'agent:engineer'));

  // every write is addressed to the created issue and has a unique idempotency key
  for (const c of calls.slice(1)) assert.equal(c.params.issueId, 'AGE-8');
  const keys = calls.filter((c) => c.params.idempotencyKey).map((c) => c.params.idempotencyKey);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of keys) assert.ok(k.startsWith(id));

  assert.equal(task(id).linear?.identifier, 'AGE-8');
  assert.equal(task(id).linear?.syncState, 'synced');
  assert.match(JSON.stringify(agent('pm').conversations), /Tracking .* in Linear as AGE-8/);
  m.stop();
});

test('finished but needs attention: stays In Progress (no Done) and says so', async () => {
  const m = fastMirror();
  const id = newTask();
  happyRun(id, { verdict: 'needs_attention' });
  // the orchestrator records the verdict on the run when it finishes
  await m.idle();
  const statuses = calls.filter((c) => c.tool === 'linear_update_issue_status').map((c) => c.params.status);
  assert.ok(!statuses.includes('Done'));
  assert.match(calls.filter((c) => c.tool === 'linear_comment_on_issue').at(-1)!.params.body, /^⚠️ Needs attention/);
  m.stop();
});

test('failed run: a failure comment and NO Done; stopped by the operator: Canceled', async () => {
  const m = fastMirror();
  const a = newTask('fails');
  emit(a, 'run.started', { agentId: agent('engineer').id, data: { title: 'fails' } });
  emit(a, 'run.failed', { agentId: agent('engineer').id, status: 'error', message: 'Failed: AI is unavailable right now', detail: 'Error: AI is unavailable' });
  const b = newTask('stopped');
  emit(b, 'run.started', { agentId: agent('engineer').id, data: { title: 'stopped' } });
  emit(b, 'run.failed', { agentId: agent('engineer').id, status: 'error', message: 'Stopped by you', data: { stopped: true } });
  await m.idle();

  assert.ok(calls.some((c) => /❌ Failed: AI is unavailable/.test(c.params.body ?? '')));
  assert.ok(!calls.some((c) => c.tool === 'linear_update_issue_status' && c.params.status === 'Done'));
  assert.ok(calls.some((c) => c.tool === 'linear_update_issue_status' && c.params.status === 'Canceled'));
  m.stop();
});

test('the planner-pipeline events (subtasks, validator, retry) become comments', async () => {
  const m = fastMirror();
  const id = newTask();
  emit(id, 'run.started', { agentId: agent('researcher').id });
  emit(id, 'step.finished', { agentId: agent('researcher').id, subtaskId: 's1', message: 'Subtask "Research the topic" completed', status: 'success' });
  emit(id, 'validation.result', { agentId: agent('qa').id, message: 'Validation failed (score 50)', status: 'error' });
  emit(id, 'retry', { agentId: agent('engineer').id, message: 'Retry #1: "Implement the solution"' });
  await m.idle();
  const bodies = calls.filter((c) => c.tool === 'linear_comment_on_issue').map((c) => `${c.params.author}|${c.params.body}`);
  assert.match(bodies[0], /^Jill \(Researcher\)\|Subtask "Research the topic" completed/);
  assert.match(bodies[1], /^Tina \(QA\)\|⚠️ Validation failed \(score 50\)/);
  assert.match(bodies[2], /^Mike \(Engineer\)\|🔁 Retry #1/);
  m.stop();
});

// ── safety gates ────────────────────────────────────────────────────────────

test('switched OFF (the default): nothing is written, ever', async () => {
  useGameStore.getState().setLinearMirror(false);
  const m = fastMirror();
  const id = newTask();
  happyRun(id);
  await m.idle();
  assert.equal(calls.length, 0);
  assert.equal(task(id).linear, undefined);
  m.stop();
});

test('Linear not connected: nothing is written', async () => {
  useGameStore.getState().syncOAuthConnections([]);
  const m = fastMirror();
  const id = newTask();
  happyRun(id);
  await m.idle();
  assert.equal(calls.length, 0);
  m.stop();
});

test('tasks created BEFORE the switch was turned on are never touched', async () => {
  useGameStore.getState().setLinearMirror(false);
  const old = newTask('old task');
  await new Promise((r) => setTimeout(r, 5));
  useGameStore.getState().setLinearMirror(true);
  const m = fastMirror();
  happyRun(old);
  await m.idle();
  assert.equal(calls.length, 0);
  m.stop();
});

test('history that exists when the mirror starts is not replayed', async () => {
  const id = newTask();
  happyRun(id); // all of this happened before the mirror started
  const m = fastMirror();
  await m.idle();
  assert.equal(calls.length, 0);
  m.stop();
});

// ── failure handling and retries ────────────────────────────────────────────

test('a transient failure is retried and the comment lands once', async () => {
  failures.linear_comment_on_issue = [new MirrorHttpError('Linear had a temporary problem', 503)];
  const m = fastMirror();
  const id = newTask();
  emit(id, 'run.started', { agentId: agent('engineer').id });
  emit(id, 'retry', { agentId: agent('engineer').id, message: 'Retry #1' });
  await m.idle();
  const sends = calls.filter((c) => c.tool === 'linear_comment_on_issue');
  assert.equal(sends.length, 2); // 503, then the retry
  assert.equal(sends[0].params.idempotencyKey, sends[1].params.idempotencyKey);
  assert.equal(task(id).linear?.syncState, 'synced');
  assert.ok(task(id).linear?.doneKeys.includes(sends[0].params.idempotencyKey));
  m.stop();
});

test('a validation error (400) is NOT retried, is recorded, and later writes still go out', async () => {
  failures.linear_comment_on_issue = [new MirrorHttpError('Linear rejected the request (bad body)', 400)];
  const m = fastMirror();
  const id = newTask();
  emit(id, 'run.started', { agentId: agent('engineer').id });
  emit(id, 'retry', { agentId: agent('engineer').id, message: 'Retry #1' });
  emit(id, 'retry', { agentId: agent('engineer').id, message: 'Retry #2' });
  await m.idle();
  assert.equal(calls.filter((c) => c.tool === 'linear_comment_on_issue').length, 2); // 1 failed (no retry) + 1 ok
  assert.equal(task(id).linear?.syncState, 'failed');
  assert.match(task(id).linear?.lastError ?? '', /bad body/);
  m.stop();
});

test('issue creation fails: writes are kept, nothing is lost, and the next event creates the issue then flushes in order', async () => {
  // 3 attempts per event, and two events happen before the service recovers
  failures.linear_create_issue = Array.from({ length: 6 }, () => new MirrorHttpError('down', 503));
  const m = fastMirror();
  const id = newTask();
  emit(id, 'run.started', { agentId: agent('engineer').id });
  emit(id, 'retry', { agentId: agent('engineer').id, message: 'first thing' });
  await m.idle();
  assert.equal(task(id).linear?.syncState, 'failed');
  assert.equal(calls.filter((c) => c.tool === 'linear_comment_on_issue').length, 0);

  emit(id, 'retry', { agentId: agent('engineer').id, message: 'second thing' });
  await m.idle();
  assert.equal(task(id).linear?.identifier, 'AGE-8');
  const bodies = calls.filter((c) => c.tool === 'linear_comment_on_issue').map((c) => c.params.body);
  assert.deepEqual(bodies.map((b) => b.replace('🔁 ', '')), ['first thing', 'second thing']); // order kept
  // every create attempt used the same idempotency key, so the eventual success cannot duplicate anything
  const creates = calls.filter((c) => c.tool === 'linear_create_issue');
  assert.equal(creates.length, 7);
  assert.equal(new Set(creates.map((c) => c.params.idempotencyKey)).size, 1);
  m.stop();
});

test('an op already recorded as done is not sent again (reload / second tab)', async () => {
  const m = fastMirror();
  const id = newTask();
  happyRun(id);
  await m.idle();
  const before = calls.length;
  emit(id, 'run.finished', { agentId: agent('engineer').id, status: 'success', message: 'Finished', data: { verdict: 'passed' } }); // same logical event again
  await m.idle();
  assert.equal(calls.length, before);
  m.stop();
});

test('two tasks at once each get their own issue and their own ordered trail', async () => {
  const m = fastMirror();
  const a = newTask('A');
  const b = newTask('B');
  emit(a, 'run.started', { agentId: agent('engineer').id });
  emit(b, 'run.started', { agentId: agent('engineer').id });
  emit(a, 'retry', { agentId: agent('engineer').id, message: 'a1' });
  emit(b, 'retry', { agentId: agent('engineer').id, message: 'b1' });
  await m.idle();
  assert.equal(calls.filter((c) => c.tool === 'linear_create_issue').length, 2);
  assert.ok(task(a).linear?.identifier && task(b).linear?.identifier);
  m.stop();
});

// ── pure pieces ─────────────────────────────────────────────────────────────

test('planForEvent: same event -> same keys; repeated QA events get distinct keys', () => {
  const ctx = (seq: number) => ({
    taskId: 't1', authorOf: () => 'Mike (Engineer)', qaAuthor: 'Tina (QA)', pmAuthor: 'Sam (PM)', ceoAuthor: 'Alex (CEO)',
    roleOfName: () => 'engineer', seq,
  });
  const ev = { id: 'e', runId: 't1', taskId: 't1', kind: 'validation.result', message: 'QA: 1 of 4 criteria not met', status: 'error', timestamp: 0 } as any;
  assert.deepEqual(planForEvent(ev, ctx(0)), planForEvent(ev, ctx(0)));
  assert.notEqual((planForEvent(ev, ctx(0))[0] as any).key, (planForEvent(ev, ctx(1))[0] as any).key);
  assert.equal(planForEvent({ ...ev, kind: 'step.progress' }, ctx(0)).length, 0);
});

test('parseCreated / issueDraft', () => {
  assert.deepEqual(parseCreated('created AGE-12 "x" [Backlog] https://linear.app/a/issue/AGE-12/x (labels skipped: a.)'), { identifier: 'AGE-12', url: 'https://linear.app/a/issue/AGE-12/x' });
  assert.equal(parseCreated('nothing here'), null);
  assert.match(issueDraft({ id: 'task_1', title: 'T', description: 'do the thing' }).description, /do the thing[\s\S]*task `task_1`/);
});

test('AI-failure placeholders never reach a ticket (live finding: "Prioritized this task. The AI service is unavailable...")', async () => {
  const m = fastMirror();
  const id = newTask();
  const NOTICE = AI_UNAVAILABLE_MESSAGE; // the real placeholder, not a copy of it
  emit(id, 'run.started', { agentId: agent('engineer').id });
  emit(id, 'tool.result', { agentId: agent('ceo').id, message: 'Prioritized task', detail: NOTICE, status: 'success', data: { tool: 'ceo:prioritize' } });
  emit(id, 'tool.result', { agentId: agent('pm').id, message: 'Assigned to Mike', detail: NOTICE, status: 'success', data: { tool: 'pm:assign' } });
  await m.idle();
  const bodies = calls.filter((c) => c.tool === 'linear_comment_on_issue').map((c) => c.params.body);
  assert.deepEqual(bodies, ['Prioritized this task.', 'Assigned to Mike.']);
  for (const b of bodies) assert.ok(!/AI service is unavailable/.test(b));
  m.stop();
});
