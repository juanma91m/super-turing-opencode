import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { CONTEXT7_TOOLS, CONTEXT7_URL, checkContext7 } from '../context7-policy.mjs';
import { prepareWorkshop } from '../workshop-profile.mjs';
import { check } from '../workshop-guard/guard.mjs';
import { upgradeOwned } from '../owned-upgrade.mjs';

function root(t) {
  const directory = fs.mkdtempSync('/tmp/opencode/context7-unit-');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('upgrade adds exactly Context7 and preserves app, CLI preferences and all previous rules', t => {
  const directory = root(t);
  const previous = prepareWorkshop(directory, { mock: 'http://127.0.0.1:1234/v1' });
  fs.writeFileSync(previous.editable, 'User-owned edit\n');
  const cliFile = path.join(previous.config, 'opencode/cli.json');
  const cli = JSON.parse(fs.readFileSync(cliFile, 'utf8'));
  cli.keybinds['agent.list'] = 'f8';
  fs.writeFileSync(cliFile, JSON.stringify(cli));
  const current = prepareWorkshop(directory, { mock: 'http://127.0.0.1:1234/v1', context7: true });
  assert.equal(fs.readFileSync(current.editable, 'utf8'), 'User-owned edit\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(cliFile, 'utf8')), cli);
  assert.deepEqual(current.document.permissions.slice(0, -2), previous.document.permissions);
  assert.deepEqual(current.document.policies.slice(0, -3), previous.document.policies);
  assert.deepEqual(Object.keys(current.document.mcp.servers), ['context7']);
  const server = current.document.mcp.servers.context7;
  assert.equal(server.url, CONTEXT7_URL);
  assert.equal(server.codemode, false);
  assert.equal(server.oauth, false);
  assert.equal(server.headers, undefined);
  assert(fs.existsSync(path.join(current.config, 'opencode/opencode.json.pre-context7.bak')));
  assert.equal(prepareWorkshop(directory, { mock: 'http://127.0.0.1:1234/v1', context7: true }).editable, current.editable);
});

test('managed upgrade validates all assets before writing and refuses unknown edits or symlinks', t => {
  const directory = root(t), a = path.join(directory, 'a'), b = path.join(directory, 'b');
  fs.writeFileSync(a, 'known'); fs.writeFileSync(b, 'user changed');
  assert.throws(() => upgradeOwned([{ file: a, desired: 'new', previous: 'known', backup: true }, { file: b, desired: 'new', previous: 'known', backup: true }]), /refusing upgrade/);
  assert.equal(fs.readFileSync(a, 'utf8'), 'known');
  assert(!fs.existsSync(a + '.pre-context7.bak'));
  fs.unlinkSync(b); fs.symlinkSync(a, b);
  assert.throws(() => upgradeOwned([{ file: b, desired: 'new', previous: 'known' }]), /Symlink/);
});

test('unsafe CLI settings abort before upgrading managed configuration', t => {
  const directory = root(t);
  const p = prepareWorkshop(directory, { mock: 'http://127.0.0.1:1234/v1' });
  const config = path.join(p.config, 'opencode/opencode.json');
  const before = fs.readFileSync(config, 'utf8');
  fs.writeFileSync(path.join(p.config, 'opencode/cli.json'), JSON.stringify({ session: { permissions: 'autoaccept' } }));
  assert.throws(() => prepareWorkshop(directory, { mock: 'http://127.0.0.1:1234/v1', context7: true }), /automatic permission/);
  assert.equal(fs.readFileSync(config, 'utf8'), before);
  assert(!fs.existsSync(config + '.pre-context7.bak'));
});

test('Context7 access is opt-in, exact-name and restricted to public-query fields', () => {
  const options = { project: '/tmp/opencode', context7: true };
  const event = { tool: CONTEXT7_TOOLS[0], input: { libraryName: 'React', query: 'useEffect cleanup' } };
  assert.doesNotThrow(() => check(event, options, options.project));
  assert.throws(() => check(event, { ...options, context7: false }, options.project), /unavailable/);
  assert.throws(() => check({ ...event, tool: 'context7_unapproved-operation' }, options, options.project), /unavailable/);
  assert.throws(() => checkContext7(CONTEXT7_TOOLS[1], { libraryId: '/reactjs/react.dev', query: '<private>' }), /private-marked/);
  assert.throws(() => checkContext7(CONTEXT7_TOOLS[1], { libraryId: 'invalid', query: 'cleanup' }), /library ID/);
  assert.throws(() => checkContext7(CONTEXT7_TOOLS[0], { libraryName: 'React', query: 'x'.repeat(1501) }), /1500/);
});
