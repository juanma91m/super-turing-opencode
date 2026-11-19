import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { preparePilot, pilotConfig } from '../pilot-profile.mjs';
import { assertFixture, rejectAttachments, register, validateRead } from '../pilot-guard/guard.mjs';
import { callbackAvailable, interactiveEnv } from '../pilot.mjs';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/v2-pilot-test-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return preparePilot(path.join(root, 'pilot'));
}

test('pilot has exactly one provider and read-only exact file permissions', t => {
  const p = fixture(t);
  const config = p.document;
  assert.equal(config.default_agent, 'v2-pilot');
  assert.equal(config.agents['v2-pilot'].model, 'openai/gpt-6.1-sol#high');
  assert(config.policies.some(rule => rule.action === 'mcp.use' && rule.effect === 'deny'));
  assert(config.permissions.filter(rule => rule.effect === 'allow').every(rule => rule.action === 'read'));
  assert.equal(config.plugins.length, 2);
  assert(!JSON.stringify(config).includes('super-turing-opencode-background'));
});

test('fixture integrity and exact path enforced; no aliases or symlinks', t => {
  const p = fixture(t);
  const options = p.document.plugins[1].options;
  assertFixture(options, p.project);
  validateRead({ tool: 'read', input: { path: 'fixture-readme.txt' } }, options, p.project);
  for (const filePath of ['./fixture-readme.txt', '../fixture-readme.txt', '/unrelated', 'directory']) {
    assert.throws(() => validateRead({ tool: 'read', input: { filePath } }, options, p.project), /only fixture/);
  }
  assert.throws(() => validateRead({ tool: 'shell', input: { command: 'true' } }, options, p.project), /only the fixture/);
  fs.chmodSync(p.fixture, 0o600);
  fs.writeFileSync(p.fixture, 'changed');
  assert.throws(() => assertFixture(options, p.project), /changed/);
  fs.unlinkSync(p.fixture);
  fs.symlinkSync('/does-not-exist', p.fixture);
  assert.throws(() => assertFixture(options, p.project));
});

test('unexpected locations keep rejection hooks instead of failing plugin setup', async t => {
  const p = fixture(t);
  const hooks = new Map();
  const domain = name => ({ async hook(type, fn) { hooks.set(`${name}.${type}`, fn); } });
  const tool = domain('tool');
  tool.transform = async fn => fn({ update(name, update) { update({ options: {} }); } });
  const ctx = {
    options: p.document.plugins[1].options, location: { directory: path.dirname(p.project) },
    session: domain('session'), shell: domain('shell'), tool,
    skill: { async transform(fn) { fn({ list: () => [], remove() {} }); } },
  };
  await register(ctx);
  assert.throws(() => hooks.get('session.prompt')({ prompt: { text: 'hello' } }), /unexpected location/);
  assert.throws(() => hooks.get('tool.execute.before')({ tool: 'read', input: { path: 'fixture-readme.txt' } }), /unexpected location/);
  assert.throws(() => hooks.get('shell.create.before')({}), /shell disabled/);
});

test('existing pilot is idempotent and refuses modified config, deleted fixture and autoaccept', t => {
  const p = fixture(t);
  assert.equal(preparePilot(p.root).fixture, p.fixture);
  fs.writeFileSync(path.join(p.config, 'opencode/cli.json'), JSON.stringify({ session: { permissions: 'autoaccept' } }));
  assert.throws(() => preparePilot(p.root), /automatic permission/);
  fs.writeFileSync(path.join(p.config, 'opencode/cli.json'), JSON.stringify({ session: { permissions: 'prompt' } }));
  const configFile = path.join(p.config, 'opencode/opencode.json');
  const original = fs.readFileSync(configFile, 'utf8');
  fs.writeFileSync(configFile, '{}');
  assert.throws(() => preparePilot(p.root), /refusing overwrite/);
  fs.writeFileSync(configFile, original);
  fs.unlinkSync(p.fixture);
  assert.throws(() => preparePilot(p.root), /refusing regeneration/);
});

test('OAuth preflight refuses occupied callback without stopping its owner', async () => {
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(callbackAvailable(listener.address().port), /no está disponible/);
    assert(listener.listening);
  } finally { await new Promise(resolve => listener.close(resolve)); }
});

test('interactive environment allows desktop transport but not credentials', t => {
  const p = fixture(t);
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic';
  t.after(() => previous === undefined ? delete process.env.OPENAI_API_KEY : process.env.OPENAI_API_KEY = previous);
  const env = interactiveEnv(p);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.OPENCODE_DB, path.join(p.data, 'opencode/opencode.db'));
});

test('login/chat refuse non-interactive calls before attempting authentication', () => {
  const script = fileURLToPath(new URL('../pilot.mjs', import.meta.url));
  for (const action of ['login', 'chat']) {
    const result = spawnSync(process.execPath, [script, action], { encoding: 'utf8', timeout: 5000, env: { PATH: path.dirname(process.execPath), HOME: '/tmp/opencode', LANG: 'C.UTF-8' } });
    assert.equal(result.status, 1);
    assert(result.stderr.includes('terminal interactiva'));
  }
});

test('attachments, agents and selected skills rejected before resolution', () => {
  for (const key of ['files', 'agents', 'skills']) assert.throws(() => rejectAttachments({ prompt: { [key]: [{}] } }), /disabled/);
  assert.doesNotThrow(() => rejectAttachments({ prompt: { text: 'ordinary chat' } }));
});

test('mock config refuses non-loopback endpoints and does not include real provider', t => {
  const p = fixture(t);
  const digest = createHash('sha256').update(fs.readFileSync(p.fixture)).digest('hex');
  assert.throws(() => pilotConfig(p, digest, 'https://external.invalid/v1'));
  const config = pilotConfig(p, digest, 'http://127.0.0.1:1234/v1');
  assert.equal(config.agents['v2-pilot'].model, 'pilot-mock/mock');
  assert.equal(config.providers['pilot-mock'].settings.baseURL, 'http://127.0.0.1:1234/v1');
});
