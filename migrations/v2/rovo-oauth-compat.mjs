import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { noSymlinks } from './staging.mjs';
import { upgradeOwned } from './owned-upgrade.mjs';
import { dcrLoopbackServer, DCR_CALLBACK_PORT, rovoIdentityServer, ROVO_IDENTITY_SCOPES, rovoDiscoveryServer } from '../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs';

export function compatibilityFile(root) { return path.join(root, '.ticketing-oauth-compat.json'); }

export function readRovoCompatibility(root) {
  const file = compatibilityFile(root);
  noSymlinks(file);
  if (!fs.existsSync(file)) return undefined;
  const value = JSON.parse(fs.readFileSync(file));
  assert.deepEqual(value, { schemaVersion: 1, owner: 'super-turing-opencode-ticketing', profile: root, mode: 'dcr-loopback', callbackPort: DCR_CALLBACK_PORT }, 'Unexpected Rovo OAuth compatibility marker');
  return value;
}

export async function callbackPortAvailable(port = DCR_CALLBACK_PORT) {
  const listener = net.createServer();
  try {
    await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(port, '127.0.0.1', resolve); });
  } catch {
    throw new Error(`Puerto OAuth ${port} ocupado o no disponible. No se detuvo ni canceló otro proceso.`);
  } finally {
    if (listener.listening) await new Promise(resolve => listener.close(resolve));
  }
}

// Caller first prepares the unchanged, canonical Ticketing composition. The
// previous bytes below come from that known renderer, never from arbitrary
// deployed content. No native auth API/credential/OAuth attempt is touched.
export async function applyRovoCompatibility(p, { checkPort = callbackPortAvailable } = {}) {
  const prior = readRovoCompatibility(p.root);
  if (prior) {
    assert.equal(p.document.mcp.servers['atlassian-rovo'].oauth.redirect_uri, `http://127.0.0.1:${DCR_CALLBACK_PORT}/callback`);
    return { ...p, oauthCompatibility: 'already configured' };
  }
  await checkPort();
  const document = structuredClone(p.document);
  document.mcp.servers['atlassian-rovo'] = dcrLoopbackServer(document.mcp.servers['atlassian-rovo']);
  const marker = { schemaVersion: 1, owner: 'super-turing-opencode-ticketing', profile: p.root, mode: 'dcr-loopback', callbackPort: DCR_CALLBACK_PORT };
  upgradeOwned([
    { file: path.join(p.config, 'opencode/opencode.json'), desired: JSON.stringify(document, null, 2) + '\n', previous: JSON.stringify(p.document, null, 2) + '\n', backup: true, tag: 'rovo-oauth' },
    { file: compatibilityFile(p.root), desired: JSON.stringify(marker, null, 2) + '\n', tag: 'rovo-oauth' },
  ]);
  return { ...p, document, oauthCompatibility: 'DCR via explicit native loopback callback' };
}

export function identityFile(root) { return path.join(root, '.ticketing-oauth-identity.json'); }

export function readRovoIdentity(root) {
  const file = identityFile(root);
  noSymlinks(file);
  if (!fs.existsSync(file)) return undefined;
  const value = JSON.parse(fs.readFileSync(file));
  const expected = { schemaVersion: 1, owner: 'super-turing-opencode-ticketing', profile: root, scopes: [...ROVO_IDENTITY_SCOPES] };
  assert(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => key === 'scopes'
      ? Array.isArray(value.scopes) && value.scopes.length === item.length && value.scopes.every((scope, index) => scope === item[index])
      : value[key] === item), 'Unexpected Rovo identity scope marker (values suppressed)');
  assert(readRovoCompatibility(root), 'Identity scope experiment requires the known DCR baseline');
  return value;
}

// The operator authorized exactly the two identity scopes. DCR/callback remain
// fixed and a known baseline is still required; no auth API or token is read.
export async function applyRovoIdentity(p, { checkPort = callbackPortAvailable } = {}) {
  assert(!readRovoDiscovery(p.root), 'Discovery is active; do not restore an explicit scope override');
  assert(readRovoCompatibility(p.root), 'Prepare the DCR baseline before the identity-only experiment');
  const server = p.document.mcp.servers['atlassian-rovo'];
  assert.equal(server.oauth.redirect_uri, `http://127.0.0.1:${DCR_CALLBACK_PORT}/callback`, 'Keep the approved DCR callback unchanged');
  const scoped = rovoIdentityServer(server);
  if (readRovoIdentity(p.root)) {
    assert(server.oauth.scope === scoped.oauth.scope, 'Identity marker does not match the known native configuration (values suppressed)');
    return { ...p, oauthIdentity: 'already configured', oauthIdentityChanged: false };
  }
  await checkPort();
  const document = structuredClone(p.document);
  document.mcp.servers['atlassian-rovo'] = scoped;
  const marker = { schemaVersion: 1, owner: 'super-turing-opencode-ticketing', profile: p.root, scopes: [...ROVO_IDENTITY_SCOPES] };
  upgradeOwned([
    { file: path.join(p.config, 'opencode/opencode.json'), desired: JSON.stringify(document, null, 2) + '\n', previous: JSON.stringify(p.document, null, 2) + '\n', backup: true, tag: 'rovo-identity' },
    { file: identityFile(p.root), desired: JSON.stringify(marker, null, 2) + '\n', tag: 'rovo-identity' },
  ]);
  return { ...p, document, oauthIdentity: 'read:account and email appended', oauthIdentityChanged: true };
}

export function discoveryFile(root) { return path.join(root, '.ticketing-oauth-discovery.json'); }

export function readRovoDiscovery(root) {
  const file = discoveryFile(root);
  noSymlinks(file);
  if (!fs.existsSync(file)) return undefined;
  let value;
  try { value = JSON.parse(fs.readFileSync(file)); }
  catch { throw new Error('Invalid Rovo discovery marker (values suppressed)'); }
  const expected = { schemaVersion: 1, owner: 'super-turing-opencode-ticketing', profile: root, mode: 'resource-metadata' };
  assert(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => value[key] === item), 'Unexpected Rovo discovery marker (values suppressed)');
  assert(readRovoCompatibility(root), 'Discovery requires the known DCR baseline');
  return value;
}

export async function applyRovoDiscovery(p, { checkPort = callbackPortAvailable } = {}) {
  assert(readRovoCompatibility(p.root), 'Prepare the DCR baseline before restoring scope discovery');
  const server = p.document.mcp.servers['atlassian-rovo'];
  assert(server.oauth?.redirect_uri === `http://127.0.0.1:${DCR_CALLBACK_PORT}/callback`, 'Keep the known DCR callback unchanged');
  if (readRovoDiscovery(p.root)) {
    assert(!Object.hasOwn(server.oauth, 'scope'), 'Discovery marker does not match the known configuration (values suppressed)');
    return { ...p, oauthDiscovery: 'already configured', oauthDiscoveryChanged: false };
  }
  assert(typeof server.oauth?.scope === 'string', 'Expected the known explicit scope baseline');
  await checkPort();
  const document = structuredClone(p.document);
  document.mcp.servers['atlassian-rovo'] = rovoDiscoveryServer(server);
  const marker = { schemaVersion: 1, owner: 'super-turing-opencode-ticketing', profile: p.root, mode: 'resource-metadata' };
  upgradeOwned([
    { file: path.join(p.config, 'opencode/opencode.json'), desired: JSON.stringify(document, null, 2) + '\n', previous: JSON.stringify(p.document, null, 2) + '\n', backup: true, tag: 'rovo-discovery' },
    { file: discoveryFile(p.root), desired: JSON.stringify(marker, null, 2) + '\n', tag: 'rovo-discovery' },
  ]);
  return { ...p, document, oauthDiscovery: 'native provider scope discovery restored', oauthDiscoveryChanged: true };
}
