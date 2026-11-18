/**
 * I1: the `action` intent must not run for integrations that are not connected.
 * No model, no network. Run: npm run test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { providersMentioned, guardAction } from '../src/ai/actionGuard.ts';

test('providersMentioned finds named integrations', () => {
  assert.deepEqual(providersMentioned('deploy my app to Vercel'), ['vercel']);
  assert.deepEqual(providersMentioned('create a Linear ticket to fix login'), ['linear']);
  assert.deepEqual(providersMentioned('post to slack and open a GitHub issue'), ['slack', 'github']);
  assert.deepEqual(providersMentioned('how is the team doing?'), []);
  assert.deepEqual(providersMentioned('this is a linear regression model'), ['linear']); // known limitation, see roadmap I1 note
});

test('the live bug: "deploy my app to Vercel" with Vercel disconnected is downgraded', () => {
  const g = guardAction('deploy my app to Vercel', ['github', 'notion']);
  assert.equal(g.downgrade, true);
  assert.deepEqual(g.missing, ['vercel']);
});

test('Linear named but not connected is downgraded', () => {
  assert.equal(guardAction('create a Linear ticket to fix the login bug', []).downgrade, true);
});

test('a connected integration lets the action run', () => {
  const g = guardAction('create a Linear ticket to fix the login bug', ['linear']);
  assert.equal(g.downgrade, false);
  assert.deepEqual(g.missing, []);
});

test('mixed: one named integration connected is enough to run', () => {
  const g = guardAction('post to slack and create a linear issue', ['slack']);
  assert.equal(g.downgrade, false);
  assert.deepEqual(g.missing, ['linear']);
});

test('no integration named: runs only if something is connected', () => {
  assert.equal(guardAction('search my pages for onboarding', []).downgrade, true);
  assert.equal(guardAction('search my pages for onboarding', ['notion']).downgrade, false);
});
