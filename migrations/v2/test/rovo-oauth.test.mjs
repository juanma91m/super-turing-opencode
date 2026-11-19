import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const addon = new URL('../../../../super-turing-opencode-ticketing/v2/', import.meta.url);
const available = fs.existsSync(new URL('oauth-compat.mjs', addon));
const { rovoServer } = available ? await import(new URL('config.mjs', addon)) : {};
const { dcrLoopbackServer, rovoIdentityServer, ROVO_IDENTITY_SCOPES } = available ? await import(new URL('oauth-compat.mjs', addon)) : {};
const { applyRovoCompatibility, readRovoCompatibility, callbackPortAvailable, compatibilityFile, applyRovoIdentity, readRovoIdentity, identityFile } = available ? await import('../rovo-oauth-compat.mjs') : {};

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/rovo-config-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = path.join(root, 'config');
  fs.mkdirSync(path.join(config, 'opencode'), { recursive: true });
  const document = { mcp: { servers: { 'atlassian-rovo': rovoServer() } }, permissions: [{ action: 'atlassian-rovo_*', resource: '*', effect: 'deny' }], policies: [{ action: 'tool.use', resource: 'atlassian-rovo_getJiraIssue:*', effect: 'allow' }], agents: { planner: { system: 'Keep role guards' } } };
  fs.writeFileSync(path.join(config, 'opencode/opencode.json'), JSON.stringify(document, null, 2) + '\n');
  return { root, config, document };
}

test('DCR selection changes only the native callback, not endpoint, scopes or mode', { skip: !available }, () => {
  const before = rovoServer(), prior = structuredClone(before);
  const result = dcrLoopbackServer(before);
  assert.deepEqual(before, prior);
  assert.equal(result.oauth.redirect_uri, 'http://127.0.0.1:19876/callback');
  delete result.oauth.redirect_uri;
  assert.deepEqual(result, before);
  assert.throws(() => dcrLoopbackServer({ ...before, oauth: { ...before.oauth, client_id: 'operator-client' } }), /explicit/);
  assert.throws(() => dcrLoopbackServer({ ...before, oauth: { ...before.oauth, callback_port: 12345 } }), /callback port/);
  assert.throws(() => dcrLoopbackServer(before, 0), /port/);
});

test('known profile upgrade is minimal, backed up, idempotent and never touches credentials', { skip: !available }, async t => {
  const p = fixture(t), original = structuredClone(p.document);
  let probes = 0;
  const result = await applyRovoCompatibility(p, { checkPort: async () => { probes++; } });
  assert.equal(probes, 1);
  assert.deepEqual(p.document, original);
  assert.deepEqual(result.document.permissions, original.permissions);
  assert.deepEqual(result.document.policies, original.policies);
  assert.deepEqual(result.document.agents, original.agents);
  const file = path.join(p.config, 'opencode/opencode.json');
  assert.equal(fs.readFileSync(file + '.pre-rovo-oauth.bak', 'utf8'), JSON.stringify(original, null, 2) + '\n');
  assert.equal(readRovoCompatibility(p.root).mode, 'dcr-loopback');
  const again = await applyRovoCompatibility(result, { checkPort: async () => assert.fail('No-op must not acquire/cancel callbacks') });
  assert.equal(again.oauthCompatibility, 'already configured');
  assert.deepEqual(fs.readdirSync(p.root).sort(), ['.ticketing-oauth-compat.json', 'config']);
});

test('operator config drift refuses the patch and marker before any mutation', { skip: !available }, async t => {
  const p = fixture(t), file = path.join(p.config, 'opencode/opencode.json');
  fs.appendFileSync(file, ' ');
  const before = fs.readFileSync(file);
  await assert.rejects(applyRovoCompatibility(p, { checkPort: async () => {} }), /refusing upgrade/);
  assert(fs.readFileSync(file).equals(before));
  assert(!fs.existsSync(compatibilityFile(p.root)));
  assert(!fs.existsSync(file + '.pre-rovo-oauth.bak'));
});

test('a callback conflict leaves config and compatibility marker unchanged', { skip: !available }, async t => {
  const p = fixture(t), file = path.join(p.config, 'opencode/opencode.json'), before = fs.readFileSync(file);
  await assert.rejects(applyRovoCompatibility(p, { checkPort: async () => { throw new Error('occupied fixture port'); } }), /occupied/);
  assert(fs.readFileSync(file).equals(before));
  assert(!fs.existsSync(compatibilityFile(p.root)));
});

test('occupied callback port is reported without closing its owner', { skip: !available }, async t => {
  const owner = net.createServer();
  await new Promise(resolve => owner.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => owner.close(resolve)));
  await assert.rejects(callbackPortAvailable(owner.address().port), /ocupado|no disponible/);
  assert.equal(owner.listening, true);
});

test('OAuth compatibility action requires operator client-close acknowledgment before access', { skip: !available }, t => {
  const p = fixture(t);
  const result = spawnSync(process.execPath, [new URL('../ticketing.mjs', import.meta.url).pathname, 'oauth-compat'], {
    env: { HOME: path.join(p.root, 'uncreated-home'), PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert(result.stderr.includes('--client-closed'));
  assert(!fs.existsSync(path.join(p.root, 'uncreated-home')));
});

test('identity opt-in appends exactly the approved scopes without altering any other server field', { skip: !available }, () => {
  const before = dcrLoopbackServer(rovoServer());
  const original = structuredClone(before), next = rovoIdentityServer(before);
  assert.equal(next.oauth.scope, before.oauth.scope + ' read:account email');
  assert.deepEqual(before, original);
  const onlyScopes = structuredClone(next); onlyScopes.oauth.scope = before.oauth.scope;
  assert.deepEqual(onlyScopes, before);
  assert.deepEqual(rovoIdentityServer(next), next);
  const onePresent = structuredClone(before); onePresent.oauth.scope += ' read:account ';
  assert.equal(rovoIdentityServer(onePresent).oauth.scope, onePresent.oauth.scope + 'email');
  assert.throws(() => rovoIdentityServer({ ...before, oauth: { redirect_uri: before.oauth.redirect_uri } }), /Explicit existing/);
});

test('identity upgrade preserves DCR, policies, actors and auth fixtures, with separate backup and idempotence', { skip: !available }, async t => {
  const p = await applyRovoCompatibility(fixture(t), { checkPort: async () => {} });
  const original = structuredClone(p.document), beforeMarker = fs.readFileSync(compatibilityFile(p.root));
  const auth = path.join(p.root, 'auth-state.example');
  fs.writeFileSync(auth, 'Operator-owned dummy fixture; not a credential');
  const beforeAuth = fs.readFileSync(auth);
  let probes = 0;
  const result = await applyRovoIdentity(p, { checkPort: async () => { probes++; } });
  assert.equal(probes, 1); assert.equal(result.oauthIdentityChanged, true);
  const expected = structuredClone(original);
  expected.mcp.servers['atlassian-rovo'] = rovoIdentityServer(expected.mcp.servers['atlassian-rovo']);
  assert.deepEqual(result.document, expected);
  assert.deepEqual(p.document, original);
  assert.deepEqual(readRovoIdentity(p.root).scopes, [...ROVO_IDENTITY_SCOPES]);
  assert(fs.readFileSync(auth).equals(beforeAuth));
  assert(fs.readFileSync(compatibilityFile(p.root)).equals(beforeMarker));
  assert.equal(fs.readFileSync(path.join(p.config, 'opencode/opencode.json.pre-rovo-identity.bak'), 'utf8'), JSON.stringify(original, null, 2) + '\n');
  const again = await applyRovoIdentity(result, { checkPort: async () => assert.fail('No-op must not inspect/cancel a listener') });
  assert.equal(again.oauthIdentityChanged, false);
});

test('identity experiment rejects a missing DCR baseline without changing config', { skip: !available }, async t => {
  const p = fixture(t), file = path.join(p.config, 'opencode/opencode.json'), before = fs.readFileSync(file);
  await assert.rejects(applyRovoIdentity(p), /DCR baseline/);
  assert(fs.readFileSync(file).equals(before)); assert(!fs.existsSync(identityFile(p.root)));
});

test('identity config drift and callback conflicts create neither scope marker nor backup', { skip: !available }, async t => {
  const p = await applyRovoCompatibility(fixture(t), { checkPort: async () => {} });
  const file = path.join(p.config, 'opencode/opencode.json'), before = fs.readFileSync(file);
  await assert.rejects(applyRovoIdentity(p, { checkPort: async () => { throw new Error('occupied fixture'); } }), /occupied/);
  assert(fs.readFileSync(file).equals(before)); assert(!fs.existsSync(identityFile(p.root)));
  fs.appendFileSync(file, ' ');
  await assert.rejects(applyRovoIdentity(p, { checkPort: async () => {} }), /refusing upgrade/);
  assert(!fs.existsSync(identityFile(p.root)));
  assert(!fs.existsSync(file + '.pre-rovo-identity.bak'));
});

test('identity action cannot access the profile without client-close acknowledgment', { skip: !available }, t => {
  const p = fixture(t);
  const result = spawnSync(process.execPath, [new URL('../ticketing.mjs', import.meta.url).pathname, 'oauth-identity'], { env: { HOME: path.join(p.root, 'identity-home'), PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
  assert(!fs.existsSync(path.join(p.root, 'identity-home')));
});

test('unexpected identity marker fields fail without dumping their values', { skip: !available }, async t => {
  const p = await applyRovoCompatibility(fixture(t), { checkPort: async () => {} });
  fs.writeFileSync(identityFile(p.root), JSON.stringify({ schemaVersion: 1, owner: 'super-turing-opencode-ticketing', profile: p.root, scopes: [...ROVO_IDENTITY_SCOPES], unexpected: 'FIXTURE_VALUE_NOT_FOR_LOGS' }));
  assert.throws(() => readRovoIdentity(p.root), error => {
    assert(error.message.includes('values suppressed'));
    assert(!error.message.includes('FIXTURE_VALUE_NOT_FOR_LOGS'));
    return true;
  });
});
