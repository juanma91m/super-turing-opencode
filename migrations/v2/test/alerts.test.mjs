import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { prepareApprovalFixture, PROBE_TEXT } from '../alerts-fixture.mjs';
import { prepareWorkshop, validateClientPlugins } from '../workshop-profile.mjs';
import { interactiveEnv } from '../pilot.mjs';
import { evaluate } from '../../../v2/plugins/controlled-permissions/policy.mjs';

test('approval probe is synthetic, pilot-local, immutable and triggers ask through existing policy', t => {
  const directory = fs.mkdtempSync('/tmp/opencode/alerts-fixture-');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const p = prepareWorkshop(directory, { mock: 'http://127.0.0.1:1/v1' });
  const probe = prepareApprovalFixture(directory);
  assert(probe.path.startsWith(p.project + path.sep));
  assert.equal(fs.readFileSync(probe.path, 'utf8'), PROBE_TEXT);
  assert.deepEqual(prepareApprovalFixture(directory), probe);
  const event = { effect: 'allow', action: 'read', resources: [probe.relativePath] };
  evaluate(event); assert.equal(event.effect, 'ask');
  fs.chmodSync(probe.path, 0o600); fs.writeFileSync(probe.path, 'changed');
  assert.throws(() => prepareApprovalFixture(directory), /refusing overwrite/);
  fs.unlinkSync(probe.path); fs.symlinkSync('/unrelated', probe.path);
  assert.throws(() => prepareApprovalFixture(directory), /Symlink/);
});

test('interactive terminal identity metadata is allowlisted, not arbitrary overrides', t => {
  const previous = process.env.VTE_VERSION;
  process.env.VTE_VERSION = 'synthetic-terminal-version';
  t.after(() => previous === undefined ? delete process.env.VTE_VERSION : process.env.VTE_VERSION = previous);
  const p = { home: '/tmp/opencode/home', config: '/tmp/opencode/config', data: '/tmp/opencode/data', state: '/tmp/opencode/state', cache: '/tmp/opencode/cache', tmp: '/tmp/opencode/tmp' };
  const env = interactiveEnv(p);
  assert.equal(env.VTE_VERSION, 'synthetic-terminal-version');
  assert.equal(env.OPENTUI_NOTIFICATION_PROTOCOL, undefined);
  assert.equal(interactiveEnv({ ...p, notificationProtocol: 'osc777' }).OPENTUI_NOTIFICATION_PROTOCOL, 'osc777');
  assert.throws(() => interactiveEnv({ ...p, notificationProtocol: 'unreviewed-value' }), /Unsupported/);
  assert.equal(env.OPENAI_API_KEY, undefined);
});

test('only the approved desktop addon can coexist with disabled native emitter', t => {
  const directory = fs.mkdtempSync('/tmp/opencode/approved-tui-');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cli = { attention: { notifications: false, sound: false }, plugins: ['-opencode.notifications', { package: directory, options: { directory: '/synthetic', when: 'always' } }] };
  assert.equal(validateClientPlugins(cli, '/synthetic', directory), 'libnotify');
  assert.throws(() => validateClientPlugins(cli, '/synthetic'), /Unexpected/);
  assert.throws(() => validateClientPlugins({ ...cli, attention: { notifications: true, sound: false } }, '/synthetic', directory), /Duplicate/);
  assert.throws(() => validateClientPlugins({ ...cli, plugins: [...cli.plugins, 'unknown'] }, '/synthetic', directory), /Unexpected/);
  assert.throws(() => validateClientPlugins(cli, '/unrelated', directory), /options/);
});
