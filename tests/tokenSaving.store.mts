/** Rule-based routing, classification memo and criteria cache. No model, no network. Run: npm run test:store */
import test from 'node:test';
import assert from 'node:assert/strict';
import { confidentClassification, normalizeClassification, rememberClassification, classifyTask, clearRememberedClassifications } from '../src/ai/TaskClassifier.ts';
import { ruleIntent } from '../src/ai/IntentClassifier.ts';

test('confidentClassification: exactly one signal decides, ambiguity goes to the model', () => {
  assert.equal(confidentClassification('Write an investor pitch deck')?.deliverableType, 'pitch');
  assert.equal(confidentClassification('Build a landing page for the app')?.deliverableLang, 'html');
  assert.equal(confidentClassification('Quarterly budget forecast')?.agentRole, 'finance');
  assert.equal(confidentClassification('Python script to forecast revenue'), null); // python + forecast
  assert.equal(confidentClassification('Do the thing'), null);
});

test('normalizeClassification rejects unknown roles and types', () => {
  assert.equal(normalizeClassification({ agentRole: 'wizard', deliverableType: 'code' }), null);
  assert.deepEqual(normalizeClassification({ agentRole: 'sales', deliverableType: 'pitch', deliverableLang: 'markdown' }), { agentRole: 'sales', deliverableType: 'pitch', deliverableLang: 'markdown' });
});

test('classifyTask uses the intent step\'s remembered answer without a model call', async () => {
  clearRememberedClassifications();
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('no network in tests'); }) as typeof fetch;
  try {
    rememberClassification('Refine Onboarding Copy', { agentRole: 'ops', deliverableType: 'doc', deliverableLang: 'markdown' });
    const out = await classifyTask('  refine   onboarding copy ');
    assert.equal(out.agentRole, 'ops');
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('ruleIntent: greetings are chat, short build requests are tasks, the rest is left to the model', () => {
  assert.equal(ruleIntent('hi')?.type, 'chat');
  assert.equal(ruleIntent('Thanks!')?.type, 'chat');
  assert.equal(ruleIntent('Build a pricing page for our app')?.type, 'task');
  assert.equal(ruleIntent('Build a Slack bot'), null);          // names an integration
  assert.equal(ruleIntent('How is the team doing?'), null);     // question
  assert.equal(ruleIntent('Can you build a login page?'), null); // not a bare imperative
  assert.equal(ruleIntent('create a Linear ticket for this'), null);
});
