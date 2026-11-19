import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectDefaults, maintenanceDefaults } from '../defaults.mjs';

test('defaults report keeps public selections but never copies provider secrets/endpoints/agent prompts', () => {
  const report = inspectDefaults({ model: 'openai/gpt-6.1-sol', small_model: 'fixture/small', default_agent: 'master-dev', snapshot: false,
    provider: { local: { npm: '@ai-sdk/openai-compatible', options: { baseURL: 'http://127.0.0.1:12345/v1', apiKey: 'PRIVATE_SENTINEL' }, models: { 'small-model': { name: 'PRIVATE_SENTINEL' } } }, remote: { options: { baseURL: 'https://PRIVATE_SENTINEL.example/api' } } },
    disabled_providers: ['local'], agent: { title: { model: 'fixture/title', variant: 'low', prompt: 'PRIVATE_SENTINEL' } } }, { OPENCODE_CONFIG_CONTENT: 'PRIVATE_SENTINEL' });
  assert.equal(report.mainModel, 'openai/gpt-6.1-sol'); assert.equal(report.providers[0].endpoint, 'loopback'); assert(report.providers[0].disabled);
  assert(report.auxiliary.title.hasOtherOverrides); assert.equal(report.auxiliary.title.model, 'fixture/title');
  assert.deepEqual(report.inheritedOverrideNames, ['OPENCODE_CONFIG_CONTENT']); assert(!JSON.stringify(report).includes('PRIVATE_SENTINEL'));
  assert(!JSON.stringify(report).includes('12345')); assert.equal(report.writesPerformed, 0);
});
test('unset and variable/unreviewed values are not silently translated into defaults', () => {
  const report = inspectDefaults({ small_model: '{file:PRIVATE_SENTINEL}', model: '{env:PRIVATE_SENTINEL}', default_agent: '<private>PRIVATE_SENTINEL</private>' });
  assert.equal(report.mainModel, 'configured-unreviewed'); assert.equal(report.smallModel, 'configured-unreviewed');
  assert.equal(report.snapshots, 'unset'); assert.equal(report.compaction.auto, 'unset'); assert(!JSON.stringify(report).includes('PRIVATE_SENTINEL'));
});
test('only reviewed explicit maintenance models map to native model#variant, not small_model or provider settings', () => {
  const source = { model: 'openai/gpt-6.1-sol', small_model: 'openai/gpt-6.1-sol', default_agent: 'master-dev', agent: Object.fromEntries(['title', 'summary', 'compaction'].map(id => [id, { model: 'openai/gpt-6.1-sol', variant: id === 'title' ? 'low' : 'medium' }])) };
  const report = inspectDefaults(source), translated = maintenanceDefaults(report);
  assert.deepEqual(translated.title, { model: 'openai/gpt-6.1-sol#low' }); assert.deepEqual(translated.compaction, { model: 'openai/gpt-6.1-sol#medium' });
  assert.throws(() => maintenanceDefaults({ ...report, smallModel: 'other/model' }));
  assert.throws(() => maintenanceDefaults({ ...report, disabledProviders: ['openai'] }));
  assert.throws(() => maintenanceDefaults({ ...report, providers: [{ id: 'local', disabled: false }] }));
  assert.throws(() => maintenanceDefaults({ ...report, auxiliary: { ...report.auxiliary, title: { ...report.auxiliary.title, hasOtherOverrides: true } } }));
});
