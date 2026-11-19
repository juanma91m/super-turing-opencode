import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { configSummary, files, references } from '../inventory.mjs';

test('config metadata never serializes config/credential values or interpolates files', () => {
  const result = configSummary({
    model: 'PRIVATE_VALUE', provider: { openai: { options: { apiKey: 'PRIVATE_VALUE' } } },
    plugin: [['PRIVATE_VALUE', { key: 'PRIVATE_VALUE' }]],
    mcp: { fixture: { type: 'remote', url: 'PRIVATE_VALUE', headers: { Authorization: '{file:/do-not-read}' } } },
  });
  assert(!JSON.stringify(result).includes('PRIVATE_VALUE'));
  assert(!JSON.stringify(result).includes('do-not-read'));
  assert.deepEqual(result.providers, ['openai']);
  assert.deepEqual(result.mcp, [{ name: 'fixture', type: 'remote', disabled: false }]);
});

test('references return category and line only, never line contents', () => {
  const result = references('private words delegate\n@opencode-ai/plugin secret\ntodowrite\nlsp\ntui.json');
  assert.deepEqual(result, { background: [1], v1Plugin: [2], lsp: [4], todo: [3], v1ClientConfig: [5] });
  assert(!JSON.stringify(result).includes('secret'));
});

test('inventory skips dotenv, dependency trees and symlink targets', t => {
  const root = fs.mkdtempSync('/tmp/opencode/stack-v2-inventory-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'skills/fixture'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills/fixture/node_modules'));
  fs.writeFileSync(path.join(root, 'skills/fixture/.env'), 'delegate SECRET');
  fs.writeFileSync(path.join(root, '.env.private.md'), 'delegate SECRET');
  fs.writeFileSync(path.join(root, 'skills/fixture/auth.json'), 'delegate SECRET');
  fs.writeFileSync(path.join(root, 'skills/fixture/node_modules/ignore.md'), 'delegate SECRET');
  fs.writeFileSync(path.join(root, 'skills/fixture/SKILL.md'), '# Fixture\ntodowrite');
  fs.symlinkSync('/does-not-exist', path.join(root, 'skills/linked'));
  const result = files(root);
  assert.equal(result.length, 3);
  assert.equal(result.find(entry => entry.path === 'skills/fixture/auth.json').references, undefined);
  assert.equal(result.find(entry => entry.path === 'skills/linked').kind, 'symlink');
  assert(!JSON.stringify(result).includes('SECRET'));
  assert(!JSON.stringify(result).includes('.env'));
});
