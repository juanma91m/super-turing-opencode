import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { environment, layout, parsePaths, prepare, VERSION } from '../staging.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync('/tmp/opencode/stack-v2-test-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, p: layout(path.join(dir, 'staging')) };
}

test('official version pinned; no inherited credentials or runtime overrides', t => {
  const { p } = fixture(t);
  const before = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic-secret';
  t.after(() => before === undefined ? delete process.env.OPENAI_API_KEY : process.env.OPENAI_API_KEY = before);
  const env = environment(p);
  assert.equal(VERSION, '2.2.7');
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.OPENCODE_CONFIG_CONTENT, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, '1');
  assert.equal(env.NPM_CONFIG_USERCONFIG, '/dev/null');
  for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'TMPDIR', 'OPENCODE_DB']) {
    assert(env[key].startsWith(p.root + path.sep));
  }
});

test('native debug paths is labeled text, including paths with spaces', () => {
  const names = ['home', 'data', 'cache', 'config', 'state', 'tmp', 'db'];
  const text = names.map(name => `${name.padEnd(10)} /tmp/opencode/with space/${name}`).join('\n');
  assert.equal(parsePaths(text).db, '/tmp/opencode/with space/db');
  assert.throws(() => parsePaths(text + '\ndb /foreign'), /Duplicate/);
  assert.throws(() => parsePaths('home /tmp/opencode'), /Missing/);
});

test('prepare is idempotent and never overwrites edited staging config', t => {
  const { p } = fixture(t);
  prepare(p);
  const config = path.join(p.config, 'opencode/opencode.json');
  fs.writeFileSync(config, '{"synthetic":"preserve"}\n');
  prepare(p);
  assert.equal(fs.readFileSync(config, 'utf8'), '{"synthetic":"preserve"}\n');
  assert.equal(fs.statSync(p.root).mode & 0o777, 0o700);
});

test('prepare refuses foreign roots and symlinked ancestors', t => {
  const { dir, p } = fixture(t);
  fs.mkdirSync(p.root);
  fs.writeFileSync(path.join(p.root, 'unrelated'), 'keep');
  assert.throws(() => prepare(p), /unowned/);
  const outside = path.join(dir, 'outside');
  fs.mkdirSync(outside);
  const linked = path.join(dir, 'linked');
  fs.symlinkSync(outside, linked);
  assert.throws(() => prepare(layout(path.join(linked, 'staging'))), /Symlink/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('initial config denies inferencing/tools and has no Background or patches', t => {
  const { p } = fixture(t);
  prepare(p);
  const text = fs.readFileSync(path.join(p.config, 'opencode/opencode.json'), 'utf8');
  const config = JSON.parse(text);
  assert.deepEqual(config.plugins, []);
  assert.deepEqual(config.mcp.servers, {});
  assert(config.policies.some(rule => rule.action === 'provider.use' && rule.resource === '*' && rule.effect === 'deny'));
  assert.deepEqual(config.permissions, [{ action: '*', resource: '*', effect: 'deny' }]);
  assert.equal(config.update, 'disable');
  assert(!/background|core.patch|delegate/i.test(text));
});
