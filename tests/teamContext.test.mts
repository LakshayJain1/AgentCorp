/** Live team context given to agents in chat. No model, no network. Run: npm run test:unit */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeamContext } from '../src/ai/teamContext.ts';

const agents = [
  { name: 'Alex', role: 'ceo', online: true, workStatus: 'idle' },
  { name: 'Riley', role: 'hr', online: true, workStatus: 'idle' },
  { name: 'Mike', role: 'engineer', online: true, workStatus: 'working' },
  { name: 'Dave', role: 'engineer', online: true, workStatus: 'idle' },
  { name: 'Quinn', role: 'qa', online: false, workStatus: 'idle' },
];

test('counts only online agents and lists former ones separately', () => {
  const c = buildTeamContext({ agents, tasks: [] });
  assert.match(c['Team right now'], /^4 agents on the team/);
  assert.match(c['Team right now'], /engineer: Mike, Dave/);
  assert.match(c['Team right now'], /1 former \(Quinn\)/);
});

test('reports who is working and the task counts', () => {
  const c = buildTeamContext({
    agents,
    tasks: [
      { id: '1', title: 'Build landing page', status: 'in_progress' },
      { id: '2', title: 'Write docs', status: 'completed' },
      { id: '3', title: 'Broken thing', status: 'failed' },
    ],
  });
  assert.equal(c['Working now'], 'Mike');
  assert.match(c['Tasks'], /^1 open, 1 completed, 1 failed/);
  assert.match(c['Tasks'], /"Build landing page" \(in_progress\)/);
});

test('says nobody is working when everyone is idle, and caps the open task list', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: `Task ${i}`, status: 'pending' }));
  const c = buildTeamContext({ agents: agents.map((a) => ({ ...a, workStatus: 'idle' })), tasks: many });
  assert.match(c['Working now'], /nobody/);
  assert.match(c['Tasks'], /\+3 more/);
});

test('includes real gauges only when present, and always states what is not tracked', () => {
  assert.equal(buildTeamContext({ agents, tasks: [] })['Simulation gauges'], undefined);
  const c = buildTeamContext({ agents, tasks: [], simulation: { morale: 74.6, efficiency: 88 } });
  assert.equal(c['Simulation gauges'], 'team morale 75/100, efficiency 88%');
  assert.match(c['Not tracked'], /surveys/);
  assert.match(c['Not tracked'], /never make a number up/);
});

test('is small enough to ride along on every chat call', () => {
  const c = buildTeamContext({ agents, tasks: [], simulation: { morale: 75, efficiency: 90 } });
  const chars = Object.entries(c).reduce((n, [k, v]) => n + k.length + v.length, 0);
  assert.ok(chars < 900, `context is ${chars} chars`);
});
