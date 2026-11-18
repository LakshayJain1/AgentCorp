/**
 * I5: approvals/autopilot for the Linear mirror and Linear -> app polling, against the REAL game store with a
 * fake transport (no network, no LLM). Run: npm run test:store
 */
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { useGameStore } = await import('../src/store/gameStore.ts');
const { useApprovalStore } = await import('../src/engine/approvals.ts');
const { publishRunEvent, useRunStore } = await import('../src/engine/runEvents.ts');
const { startLinearMirror } = await import('../src/engine/LinearMirror.ts');
const { startLinearPoller, parseIssueOutput, isAgentComment } = await import('../src/engine/LinearPoller.ts');

type Call = { tool: string; params: Record<string, string> };
let calls: Call[] = [];
const exec = async (tool: string, params: Record<string, string>): Promise<string> => {
  calls.push({ tool, params });
  if (tool === 'linear_create_issue') return `created AGE-8 "${params.title}" [Backlog] https://linear.app/x/issue/AGE-8/t`;
  return 'ok';
};
const stoppers: Array<{ stop(): void }> = [];
const fastMirror = () => {
  const m = startLinearMirror({ exec, sleep: async () => {}, retryDelaysMs: [1, 1] });
  stoppers.push(m);
  return m;
};
afterEach(() => { for (const m of stoppers.splice(0)) m.stop(); });

const agent = (role: string) => useGameStore.getState().agents.find((a) => a.role === role)!;
const task = (id: string) => useGameStore.getState().tasks.find((t) => t.id === id)!;
const names = () => calls.map((c) => c.tool);
const tick = () => new Promise<void>((r) => setTimeout(r, 5));
const pending = () => useApprovalStore.getState().pending;
const chat = () => JSON.stringify(useGameStore.getState().agents.map((a) => a.conversations));

function newTask(title = 'Write a Python script'): string {
  useGameStore.getState().addTaskWithTitle(title, undefined, 'write a short python script that reverses a string');
  const t = useGameStore.getState().tasks;
  return t[t.length - 1].id;
}
function emit(taskId: string, kind: string, extra: Record<string, unknown> = {}) {
  return publishRunEvent({ taskId, kind, message: kind, ...extra } as Parameters<typeof publishRunEvent>[0]);
}
function shortRun(taskId: string) {
  const mike = agent('engineer').id;
  emit(taskId, 'run.started', { agentId: mike, status: 'running', data: { title: 'Write a Python script' } });
  emit(taskId, 'step.started', { agentId: mike, message: 'Started', status: 'running', data: { tool: 'generateDeliverable' } });
  emit(taskId, 'step.finished', { agentId: mike, message: 'Completed "x"', status: 'success', data: { tool: 'generateDeliverable' } });
  emit(taskId, 'run.finished', { agentId: mike, status: 'success', message: 'Finished', data: { verdict: 'passed' } });
}

beforeEach(() => {
  const gs = useGameStore.getState();
  if (gs.agents.length === 0) gs.initAgents();
  useGameStore.setState({ tasks: [] });
  useRunStore.getState().clear();
  useApprovalStore.setState({ pending: [], always: new Set() });
  gs.syncOAuthConnections([{ provider: 'linear' }]);
  gs.setLinearMirror(true);
  gs.setLinearAutopilot(false);
  calls = [];
});

test('autopilot off: nothing is written until the operator approves, then the whole trail goes out', async () => {
  const mirror = fastMirror();
  const id = newTask();
  shortRun(id);
  await tick();
  assert.equal(pending().length, 1, 'one prompt per task, not one per event');
  assert.match(pending()[0].title, /wants to track/);
  assert.equal(calls.length, 0, 'no write before the answer');

  useApprovalStore.getState().decide(pending()[0].id, 'allow_once');
  await mirror.idle();
  assert.equal(names()[0], 'linear_create_issue');
  assert.ok(names().includes('linear_comment_on_issue'));
  assert.equal(task(id).linear?.syncState, 'synced');
  assert.equal(useGameStore.getState().linearMirror.autopilot, false, 'allow once does not turn autopilot on');
});

test('deny: no Linear writes, task marked skipped, no second prompt, PM says so', async () => {
  const mirror = fastMirror();
  const id = newTask();
  shortRun(id);
  await tick();
  useApprovalStore.getState().decide(pending()[0].id, 'deny');
  await mirror.idle();
  assert.equal(calls.length, 0);
  assert.equal(task(id).linear?.syncState, 'skipped');
  assert.equal(pending().length, 0, 'later events of the same task do not ask again');
  assert.ok(chat().includes('Not tracking'));
});

test('"always allow" turns autopilot on, so the next task is mirrored without a prompt', async () => {
  const mirror = fastMirror();
  const first = newTask('First task');
  shortRun(first);
  await tick();
  useApprovalStore.getState().decide(pending()[0].id, 'allow_always');
  await mirror.idle();
  assert.equal(useGameStore.getState().linearMirror.autopilot, true);

  calls = [];
  const second = newTask('Second task');
  shortRun(second);
  await mirror.idle();
  assert.equal(pending().length, 0);
  assert.equal(names()[0], 'linear_create_issue');
});

test('autopilot on: no prompt at all', async () => {
  useGameStore.getState().setLinearAutopilot(true);
  const mirror = fastMirror();
  shortRun(newTask());
  await mirror.idle();
  assert.equal(pending().length, 0);
  assert.equal(names()[0], 'linear_create_issue');
});

test('an already tracked task is not asked about again (e.g. after a reload)', async () => {
  const mirror = fastMirror();
  const id = newTask();
  useGameStore.getState().updateTask(id, { linear: { identifier: 'AGE-3', url: '', syncState: 'synced', doneKeys: [`${id}:created`] } });
  shortRun(id);
  await mirror.idle();
  assert.equal(pending().length, 0);
  assert.ok(names().includes('linear_comment_on_issue'));
});

// ── Linear -> app polling ─────────────────────────────────────────────────────

const issueText = (status: string, comments: string[]) =>
  [`AGE-8 "Write a Python script" [${status}] https://linear.app/x/issue/AGE-8/t`, 'description: do it', ...comments.map((c) => `comment: ${c}`)].join('\n');

function trackedTask(extra: Record<string, unknown> = {}): string {
  const id = newTask();
  useGameStore.getState().updateTask(id, { linear: { identifier: 'AGE-8', url: '', syncState: 'synced', doneKeys: [], ...extra } });
  return id;
}

test('parseIssueOutput reads the status and multi-line comments; agent comments are recognised', () => {
  const p = parseIssueOutput(issueText('In Progress', ['**Tina (QA):** ok\n\n```\nPASS x\n```', 'looks good to me']))!;
  assert.equal(p.identifier, 'AGE-8');
  assert.equal(p.status, 'In Progress');
  assert.equal(p.comments.length, 2);
  assert.equal(isAgentComment(p.comments[0]), true);
  assert.equal(isAgentComment(p.comments[1]), false);
  assert.equal(parseIssueOutput('garbage'), null);
});

test('poll: the first look is a baseline, then a human status change and comment are announced once', async () => {
  const id = trackedTask();
  let text = issueText('In Progress', ['**Mike (Engineer):** Starting work on this.', 'an old human note']);
  const poller = startLinearPoller({ exec: async () => text, intervalMs: 1e9 });
  stoppers.push(poller);
  let r = await poller.pollOnce();
  assert.deepEqual(r[0].announced, [], 'existing history is recorded, not announced');
  assert.equal(task(id).linear?.remoteStatus, 'In Progress');

  text = issueText('Done', ['**Mike (Engineer):** Starting work on this.', 'an old human note', 'Please also add tests']);
  r = await poller.pollOnce();
  assert.equal(r[0].announced.length, 2);
  assert.ok(r[0].announced[0].includes('moved to Done'));
  assert.ok(r[0].announced[1].includes('Please also add tests'));
  assert.ok(chat().includes('Please also add tests'));

  r = await poller.pollOnce();
  assert.deepEqual(r[0].announced, [], 'the same change is not announced twice');
});

test('poll: a status the app wrote itself is never reported back as a human change', async () => {
  const id = trackedTask({ remoteStatus: 'Backlog', remoteSeen: [], lastWrittenStatus: 'In Progress' });
  const poller = startLinearPoller({ exec: async () => issueText('In Progress', []), intervalMs: 1e9 });
  stoppers.push(poller);
  const r = await poller.pollOnce();
  assert.deepEqual(r[0].announced, []);
  assert.equal(task(id).linear?.remoteStatus, 'In Progress');
});

test('poll: skipped and untracked tasks are not read, a failed read is survivable, not connected = no reads', async () => {
  trackedTask({ syncState: 'skipped' });
  newTask('untracked');
  let reads = 0;
  const poller = startLinearPoller({ exec: async () => { reads++; return issueText('Todo', []); }, intervalMs: 1e9 });
  stoppers.push(poller);
  await poller.pollOnce();
  assert.equal(reads, 0);

  trackedTask();
  const failing = startLinearPoller({ exec: async () => { throw new Error('offline'); }, intervalMs: 1e9 });
  stoppers.push(failing);
  assert.deepEqual(await failing.pollOnce(), []);

  useGameStore.setState((s) => ({ connectors: { ...s.connectors, linear: { ...s.connectors.linear, connected: false } } }));
  reads = 0;
  await poller.pollOnce();
  assert.equal(reads, 0);
});
