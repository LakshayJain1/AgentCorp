import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitTeamBrief, briefTopic } from '../src/orchestrator/teamBrief.ts';

const NAMES = ['Alex', 'Sam', 'Jill', 'Mike', 'Tina', 'Riley', 'Jordan', 'Morgan', 'Casey'];

const BRIEF =
  'Business idea: a weekly meal kit for college students in India (Rs 800/week). Work this through as a team: ' +
  'Sam scopes the MVP and launch plan, Jill researches the market and competitors, Riley outlines the first 3 hires and ops, ' +
  'Jordan drafts pricing and the go-to-market pitch, and Alex ties it all into one go/no-go recommendation.';

test('splits a brief into one part per named teammate, synthesis last', () => {
  const b = splitTeamBrief(BRIEF, NAMES);
  assert.ok(b);
  assert.deepEqual(b.parts.map((p) => p.agentName), ['Sam', 'Jill', 'Riley', 'Jordan', 'Alex']);
  assert.equal(b.parts.at(-1)?.synthesis, true);
  assert.equal(b.parts.filter((p) => p.synthesis).length, 1);
  assert.match(b.parts[1].text, /^researches the market and competitors$/);
  assert.match(b.parts[3].text, /pricing and the go-to-market pitch$/);
  assert.match(b.context, /^Business idea: a weekly meal kit/);
  assert.doesNotMatch(b.context, /Sam/);
});

test('moves the synthesis part to the end even if named first', () => {
  const b = splitTeamBrief('Plan a launch. Alex gives the final go/no-go recommendation, Sam scopes the MVP in detail.', NAMES);
  assert.ok(b);
  assert.deepEqual(b.parts.map((p) => p.agentName), ['Sam', 'Alex']);
});

test('leaves ordinary requests alone', () => {
  assert.equal(splitTeamBrief('Write a landing page for our meal kit', NAMES), null);
  assert.equal(splitTeamBrief('Ask Sam to scope the MVP for the new feature', NAMES), null);
  assert.equal(splitTeamBrief('Sam and Jill should look at this', NAMES), null);
});

test('does not match names inside other words or lowercase', () => {
  assert.equal(splitTeamBrief('a sampling of samples and a casey-less plan', NAMES), null);
});

test('briefTopic takes the first sentence without the label', () => {
  assert.equal(briefTopic('Business idea: a weekly meal kit for students. Work as a team'), 'a weekly meal kit for students.');
});
