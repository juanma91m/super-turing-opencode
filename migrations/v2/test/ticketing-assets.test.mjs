import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareWorkshop } from '../workshop-profile.mjs';

const knowledge = new URL('../../../../super-turing-opencode-knowledge/v2/', import.meta.url);
const ticketing = new URL('../../../../super-turing-opencode-ticketing/v2/', import.meta.url);
const available = fs.existsSync(new URL('composition.mjs', knowledge)) && fs.existsSync(new URL('composition.mjs', ticketing)) && fs.existsSync(new URL('oauth-compat.mjs', ticketing));
const { knowledgeExtension } = available ? await import(new URL('composition.mjs', knowledge)) : {};
const { ENGRAM_TOOLS } = available ? await import(new URL('engram-config.mjs', knowledge)) : {};
const { ticketingExtension } = available ? await import(new URL('composition.mjs', ticketing)) : {};
const { rovoServer } = available ? await import(new URL('config.mjs', ticketing)) : {};
const { dcrLoopbackServer, rovoIdentityServer, rovoDiscoveryServer } = available ? await import(new URL('oauth-compat.mjs', ticketing)) : {};
const { applyRovoCompatibility, applyRovoIdentity, applyRovoDiscovery } = available ? await import('../rovo-oauth-compat.mjs') : {};

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/ticketing-assets-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prior = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode', server: { type: 'local', command: ['/fixture/engram'], codemode: false, disabled: true }, permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
  const next = ticketingExtension({ server: { type: 'local', command: ['/fixture/rovo'], codemode: false, disabled: true } });
  const options = { mock: 'http://127.0.0.1:1234/v1', context7: true, extend: prior };
  return { root, options, extend: context => next({ ...context, ...prior(context) }) };
}

test('Ticketing upgrades a known Knowledge baseline without dropping its guards, CLI or operator work', { skip: !available }, t => {
  const { root, options, extend } = fixture(t);
  const prior = prepareWorkshop(root, options);
  const config = path.join(prior.config, 'opencode');
  const beforeConfig = fs.readFileSync(path.join(config, 'opencode.json'));
  const beforeCli = fs.readFileSync(path.join(config, 'cli.json'));
  fs.writeFileSync(prior.editable, 'Operator application fixture\n');
  const next = prepareWorkshop(root, { ...options, extend });
  assert.equal(next.roles.length, 15); assert.equal(next.skills.length, 19);
  assert(fs.readFileSync(path.join(config, 'cli.json')).equals(beforeCli));
  assert(fs.readFileSync(path.join(config, 'opencode.json.pre-ticketing.bak')).equals(beforeConfig));
  assert.equal(fs.readFileSync(next.editable, 'utf8'), 'Operator application fixture\n');
  for (const role of ['planner', 'master-dev']) {
    const text = fs.readFileSync(path.join(config, 'agents', role + '.md'), 'utf8');
    assert(text.includes('KNOWLEDGE_AUTONOMY_START'));
    assert(text.includes('TICKETING_AUTONOMY_START'));
  }
  assert(fs.readFileSync(path.join(config, 'agents/planner.md'), 'utf8').includes('  edit: deny'));
  assert.deepEqual(prepareWorkshop(root, { ...options, extend }).document, next.document);
});

test('Ticketing refuses drift before replacing existing agents or creating helpers', { skip: !available }, t => {
  const { root, options, extend } = fixture(t), p = prepareWorkshop(root, options);
  const config = path.join(p.config, 'opencode');
  const agent = path.join(config, 'agents/planner.md'), before = fs.readFileSync(agent);
  fs.appendFileSync(path.join(config, 'opencode.json'), ' ');
  assert.throws(() => prepareWorkshop(root, { ...options, extend }), /refusing upgrade/);
  assert(fs.readFileSync(agent).equals(before));
  assert(!fs.existsSync(path.join(config, 'scripts/jira_helper.sh')));
});

test('Ticketing apply requires client-close acknowledgment before profile selection or network', { skip: !available }, t => {
  const root = fs.mkdtempSync('/tmp/opencode/ticketing-consent-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [new URL('../ticketing.mjs', import.meta.url).pathname, 'apply'], { env: { HOME: root, PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  assert(result.stderr.includes('--client-closed'));
  assert.deepEqual(fs.readdirSync(root), []);
});

test('OAuth compatibility survives the next full composition without changing any role guard', { skip: !available }, async t => {
  const { root, options } = fixture(t);
  const server = { ...rovoServer(), disabled: true };
  const original = ticketingExtension({ server });
  const p = prepareWorkshop(root, { ...options, extend: context => original({ ...context, ...options.extend(context) }) });
  const patched = await applyRovoCompatibility(p, { checkPort: async () => {} });
  const compat = ticketingExtension({ server: dcrLoopbackServer(server) });
  const reopened = prepareWorkshop(root, { ...options, extend: context => compat({ ...context, ...options.extend(context) }) });
  assert.deepEqual(reopened.document, patched.document);
  assert.deepEqual(reopened.document.permissions, p.document.permissions);
  assert.deepEqual(reopened.document.policies, p.document.policies);
  const identity = await applyRovoIdentity(reopened, { checkPort: async () => {} });
  const identityExtension = ticketingExtension({ server: rovoIdentityServer(dcrLoopbackServer(server)) });
  const afterRestart = prepareWorkshop(root, { ...options, extend: context => identityExtension({ ...context, ...options.extend(context) }) });
  assert.deepEqual(afterRestart.document, identity.document);
  assert.deepEqual(afterRestart.document.permissions, p.document.permissions);
  assert.deepEqual(afterRestart.document.policies, p.document.policies);
  const discovered = await applyRovoDiscovery(afterRestart, { checkPort: async () => {} });
  const discoveryExtension = ticketingExtension({ server: rovoDiscoveryServer(dcrLoopbackServer(server)) });
  const reopenedDiscovery = prepareWorkshop(root, { ...options, extend: context => discoveryExtension({ ...context, ...options.extend(context) }) });
  assert.deepEqual(reopenedDiscovery.document, discovered.document);
  assert.deepEqual(reopenedDiscovery.document.permissions, p.document.permissions);
  assert.deepEqual(reopenedDiscovery.document.policies, p.document.policies);
});
