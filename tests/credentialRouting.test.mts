/**
 * I1b: integrations go to the Integrations tab, real secrets keep the paste prompt.
 * No model, no network. Run: npm run test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { providerForKey, routeCredentialKeys } from '../src/ai/credentialRouting.ts';

const k = (key: string) => ({ key, label: key, reason: '' });

test('providerForKey maps legacy and new keys to Integrations-tab providers', () => {
  assert.equal(providerForKey('github_token'), 'github');
  assert.equal(providerForKey('vercel_token'), 'vercel');
  assert.equal(providerForKey('slack_webhook'), 'slack');
  assert.equal(providerForKey('linear_connection'), 'linear');
  assert.equal(providerForKey('notion_connection'), 'notion');
});

test('providerForKey: anything else is a real secret', () => {
  for (const key of ['database_url', 'stripe_api_key', 'cloud_credentials', 'ai_api_key', 'api_credentials', 'container_registry']) {
    assert.equal(providerForKey(key), null, key);
  }
});

test('disconnected integration -> Integrations tab, no paste prompt', () => {
  const r = routeCredentialKeys([k('vercel_token')], []);
  assert.deepEqual(r.integrations, ['vercel']);
  assert.deepEqual(r.secrets, []);
});

test('connected integration is dropped entirely', () => {
  const r = routeCredentialKeys([k('github_token')], ['github']);
  assert.deepEqual(r, { integrations: [], secrets: [] });
});

test('the live case: Linear + generic "login" match -> only Linear, generic noise dropped', () => {
  const r = routeCredentialKeys([k('linear_connection'), k('api_credentials')], []);
  assert.deepEqual(r.integrations, ['linear']);
  assert.deepEqual(r.secrets, []);
});

test('generic key alone is still a paste prompt', () => {
  const r = routeCredentialKeys([k('api_credentials')], []);
  assert.deepEqual(r.integrations, []);
  assert.deepEqual(r.secrets.map((s) => s.key), ['api_credentials']);
});

test('mixed: integration goes to the tab, real secrets are kept (deduped)', () => {
  const r = routeCredentialKeys([k('vercel_token'), k('database_url'), k('database_url'), k('api_credentials')], []);
  assert.deepEqual(r.integrations, ['vercel']);
  assert.deepEqual(r.secrets.map((s) => s.key), ['database_url']);
});

test('several providers are deduped and ordered', () => {
  const r = routeCredentialKeys([k('github_token'), k('vercel_token'), k('github_token')], ['slack']);
  assert.deepEqual(r.integrations, ['github', 'vercel']);
});
