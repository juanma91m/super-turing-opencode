import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { translateDormantProviders, validateDormantProviders, dormantSummary, COMPATIBLE_PACKAGE } from '../dormant-providers.mjs';
import { planGeneral } from '../profile.mjs';
import { effect } from '../policy.mjs';
import { dormantFixture } from './dormant-fixture.mjs';
test('closed translation preserves all explicit IDs/names/endpoint without inventing limits, capabilities, aliases or defaults', () => {
  const original = dormantFixture(), selected = translateDormantProviders(original);
  assert.deepEqual(selected.providers.ollama.models, original.provider.ollama.models); assert.equal(selected.providers.ollama.settings.baseURL, original.provider.ollama.options.baseURL);
  assert.equal(selected.providers.ollama.package, COMPATIBLE_PACKAGE); assert.deepEqual(selected.disabled, ['ollama']);
  selected.providers.ollama.models['synthetic-model-0:test'].name = 'Mutable result'; assert.equal(original.provider.ollama.models['synthetic-model-0:test'].name, 'Synthetic display 0');
  const summary = dormantSummary(translateDormantProviders(original)); assert.equal(summary.declaredModelCount, 7); assert.equal(summary.enabledByMigration, false);
  assert(!JSON.stringify(summary).includes('11434') && !JSON.stringify(summary).includes('Synthetic display'));
});
test('active/reserved providers, arbitrary packages, secrets, remote/interpolated routing and unreviewed fields fail closed', () => {
  const changes = [
    source => { source.disabled_providers = []; },
    source => { source.provider.ollama.npm = 'unreviewed-package'; },
    source => { source.provider.ollama.options.apiKey = 'PRIVATE_SENTINEL'; },
    source => { source.provider.ollama.options.headers = { Authorization: 'PRIVATE_SENTINEL' }; },
    source => { source.provider.ollama.options.baseURL = 'https://unreviewed.invalid/v1'; },
    source => { source.provider.ollama.options.baseURL = 'http://PRIVATE_SENTINEL@localhost/v1'; },
    source => { source.provider.ollama.options.baseURL = 'http://localhost/v1?token=PRIVATE_SENTINEL'; },
    source => { source.provider.ollama.options.baseURL = '{env:PRIVATE_SENTINEL}'; },
    source => { source.provider.ollama.models['synthetic-model-0:test'].limit = { context: 10000 }; },
    source => { source.provider.ollama.models['synthetic-model-0:test'].name = '<private>PRIVATE_SENTINEL</private>'; },
    source => { source.provider.ollama.env = ['PRIVATE_SENTINEL']; },
  ];
  for (const change of changes) { const value = dormantFixture(); change(value); assert.throws(() => translateDormantProviders(value), error => !error.message.includes('PRIVATE_SENTINEL')); }
  assert.throws(() => translateDormantProviders({ provider: { openai: dormantFixture().provider.ollama }, disabled_providers: ['openai'] }));
});
test('native constructor cannot revive or overwrite dormant definitions and mock assembly retains both provider maps', t => {
  const directory = fs.mkdtempSync('/tmp/opencode/dormant-plan-'); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = path.join(directory, 'project'); fs.mkdirSync(project);
  const dormantProviders = translateDormantProviders(dormantFixture()), options = { project, mock: 'http://127.0.0.1:1/v1', dormantProviders };
  const plan = planGeneral(path.join(directory, 'candidate'), options);
  assert.equal(Object.keys(plan.document.providers.ollama.models).length, 7); assert(plan.document.providers['workshop-mock']);
  assert.equal(effect(plan.document.policies, 'provider.use', 'ollama'), 'deny'); assert.equal(plan.document.default_agent, 'master-dev');
  assert.throws(() => validateDormantProviders({ ...dormantProviders, disabled: [] }));
  assert.throws(() => planGeneral(path.join(directory, 'candidate'), { ...options, contributions: [{ id: 'revive', apply(ctx) { ctx.document.policies.push({ action: 'provider.use', resource: 'ollama', effect: 'allow' }); } }] }), /cannot revive/);
  assert.throws(() => planGeneral(path.join(directory, 'candidate'), { ...options, contributions: [{ id: 'overwrite', apply(ctx) { ctx.document.providers.ollama.name = 'Changed'; } }] }), /cannot replace/);
  assert.throws(() => planGeneral(path.join(directory, 'candidate'), { ...options, contributions: [{ id: 'revive-discovery', apply(ctx) { ctx.document.plugins.push('opencode.provider.ollama'); } }] }), /cannot revive dormant/);
});
