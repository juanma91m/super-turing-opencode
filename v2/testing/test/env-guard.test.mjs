import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, protectedPath, protectedShellReference, register } from '../../../v2/plugins/env-guard/guard.mjs';

test('protect dotenv paths; exempt only the exact example filename', () => {
  for (const file of ['.env', '/fixture/.env.prod', '.env.example.backup', '.envrc', 'C:\\fixture\\.env', '/fixture/.env/.env.example']) {
    assert(protectedPath(file), file);
  }
  for (const file of ['.env.example', '/fixture/.env.example', 'src/environment.ts', 'src/not.env']) assert(!protectedPath(file), file);
});

test('shell guard blocks direct sensitive references without recording command values', () => {
  for (const command of ['cat .env', 'cat ".env.prod"', 'cat .env.example.backup', 'cat /fixture/.envrc', 'cat .env.example/private']) {
    assert(protectedShellReference(command), command);
    assert.throws(() => check({ tool: 'shell', input: { command } }), /secret-safe/);
  }
  assert(!protectedShellReference('cat /fixture/.env.example'));
  assert(!protectedShellReference('git status --short'));
});

test('nested edits, file lists and patch move destinations are guarded', () => {
  for (const input of [
    { filePath: '.env.prod' }, { operations: [{ path: '.env.prod' }] },
    { files: ['safe.txt', '.env.prod'] },
    { patchText: '*** Update File: safe.txt\n*** Move to: .env.prod\n' },
    { diff: '--- a/safe.txt\n+++ b/.env.prod\n' },
  ]) assert.throws(() => check({ tool: 'edit', input }), /secret-safe/);
  assert.doesNotThrow(() => check({ tool: 'read', input: { filePath: '.env.example' } }));
});

test('uses the public V2 hook and denies access independently of caller role', async () => {
  let hook;
  await register({ tool: { async hook(name, callback) { assert.equal(name, 'execute.before'); hook = callback; } } });
  for (const agent of ['planner', 'master-dev', 'reviewer']) {
    assert.throws(() => hook({ tool: 'read', agent, input: { filePath: '.env.prod' } }), /secret-safe/);
  }
});
