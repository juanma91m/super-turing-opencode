import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const addon = new URL('../../../../super-turing-opencode-ticketing/v2/', import.meta.url);
const available = fs.existsSync(new URL('oauth-compat.mjs', addon));
const { rovoServer } = available ? await import(new URL('config.mjs', addon)) : {};
const { rovoDiscoveryServer } = available ? await import(new URL('oauth-compat.mjs', addon)) : {};
const { applyRovoCompatibility, applyRovoIdentity, applyRovoDiscovery, readRovoDiscovery, discoveryFile } = available ? await import('../rovo-oauth-compat.mjs') : {};

async function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/rovo-discovery-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = path.join(root, 'config');
  fs.mkdirSync(path.join(config, 'opencode'), { recursive: true });
  const document = { mcp: { servers: { 'atlassian-rovo': rovoServer() } }, permissions: [{ action: 'atlassian-rovo_*', resource: '*', effect: 'deny' }], policies: [{ action: 'tool.use', resource: 'atlassian-rovo_getJiraIssue:*', effect: 'allow' }], agents: { planner: { system: 'Keep all role guards' } } };
  fs.writeFileSync(path.join(config, 'opencode/opencode.json'), JSON.stringify(document, null, 2) + '\n');
  return applyRovoCompatibility({ root, config, document }, { checkPort: async () => {} });
}

test('scope discovery removes only the explicit override without hardcoding new scopes or parameters', { skip: !available }, () => {
  const before = rovoServer(), original = structuredClone(before);
  const next = rovoDiscoveryServer(before);
  assert(!Object.hasOwn(next.oauth, 'scope'));
  next.oauth.scope = before.oauth.scope;
  assert.deepEqual(next, before); assert.deepEqual(before, original);
  assert.deepEqual(rovoDiscoveryServer(rovoDiscoveryServer(before)), rovoDiscoveryServer(before));
});

test('discovery upgrade preserves identity history, DCR, roles and auth fixtures with separate backup', { skip: !available }, async t => {
  const p = await applyRovoIdentity(await fixture(t), { checkPort: async () => {} });
  const original = structuredClone(p.document), marker = fs.readFileSync(path.join(p.root, '.ticketing-oauth-identity.json'));
  const dummy = path.join(p.root, 'auth.example'); fs.writeFileSync(dummy, 'Not a real credential');
  const result = await applyRovoDiscovery(p, { checkPort: async () => {} });
  const expected = structuredClone(original); delete expected.mcp.servers['atlassian-rovo'].oauth.scope;
  assert.deepEqual(result.document, expected); assert.deepEqual(p.document, original);
  assert.equal(result.oauthDiscoveryChanged, true);
  assert.equal(readRovoDiscovery(p.root).mode, 'resource-metadata');
  assert.equal(fs.readFileSync(path.join(p.config, 'opencode/opencode.json.pre-rovo-discovery.bak'), 'utf8'), JSON.stringify(original, null, 2) + '\n');
  assert(fs.readFileSync(path.join(p.root, '.ticketing-oauth-identity.json')).equals(marker));
  assert.equal(fs.readFileSync(dummy, 'utf8'), 'Not a real credential');
  assert.equal((await applyRovoDiscovery(result, { checkPort: async () => assert.fail('No-op must not probe listeners') })).oauthDiscoveryChanged, false);
  await assert.rejects(applyRovoIdentity(result), /Discovery is active/);
});

test('discovery rejects config drift or occupied callback before marker and backup changes', { skip: !available }, async t => {
  const p = await fixture(t), file = path.join(p.config, 'opencode/opencode.json'), before = fs.readFileSync(file);
  await assert.rejects(applyRovoDiscovery(p, { checkPort: async () => { throw new Error('occupied fixture'); } }), /occupied/);
  assert(fs.readFileSync(file).equals(before)); assert(!fs.existsSync(discoveryFile(p.root)));
  fs.appendFileSync(file, ' ');
  await assert.rejects(applyRovoDiscovery(p, { checkPort: async () => {} }), /refusing upgrade/);
  assert(!fs.existsSync(discoveryFile(p.root))); assert(!fs.existsSync(file + '.pre-rovo-discovery.bak'));
});

test('discovery action requires client-close confirmation before reading a profile', { skip: !available }, () => {
  const result = spawnSync(process.execPath, [new URL('../ticketing.mjs', import.meta.url).pathname, 'oauth-discovery'], { env: { HOME: '/tmp/opencode/not-a-real-profile', PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});

test('invalid discovery markers fail without dumping data', { skip: !available }, async t => {
  const p = await fixture(t);
  for (const body of ['FIXTURE_VALUE_NOT_FOR_LOGS', JSON.stringify({ unexpected: 'FIXTURE_VALUE_NOT_FOR_LOGS' })]) {
    fs.writeFileSync(discoveryFile(p.root), body);
    assert.throws(() => readRovoDiscovery(p.root), error => error.message.includes('values suppressed') && !error.message.includes('FIXTURE_VALUE_NOT_FOR_LOGS'));
  }
});
