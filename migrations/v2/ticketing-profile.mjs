// Non-deploying selection shared by the Ticketing and subsequent addon launchers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { noSymlinks } from './staging.mjs';
import { selectKnowledgeProfile } from './knowledge-profile.mjs';
import { ticketingExtension } from '../../../super-turing-opencode-ticketing/v2/composition.mjs';
import { rovoServer, ROVO_ROLES } from '../../../super-turing-opencode-ticketing/v2/config.mjs';
import { dcrLoopbackServer, rovoIdentityServer, rovoDiscoveryServer } from '../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs';
import { readRovoCompatibility, readRovoIdentity, readRovoDiscovery } from './rovo-oauth-compat.mjs';

export function selectTicketingProfile() {
  const selected = selectKnowledgeProfile();
  const { root, marker: knowledgeMarker, config, options } = selected;
  noSymlinks(knowledgeMarker);
  assert(fs.existsSync(knowledgeMarker), 'Primero incorporar y validar Knowledge');
  assert.deepEqual(JSON.parse(fs.readFileSync(knowledgeMarker)), { owner: 'opencode-stack', addon: 'super-turing-opencode-knowledge', profile: root }, 'Unexpected Knowledge marker');
  const preflight = spawnSync('python3', [fileURLToPath(new URL('../../../super-turing-opencode-ticketing/v2/preflight.py', import.meta.url)), path.join(config, 'opencode.json')], {
    encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert(!preflight.error && preflight.status === 0, 'No se pudo auditar Ticketing; salida cruda omitida');
  const current = JSON.parse(preflight.stdout);
  assert(current.serverPresent && current.canonicalEndpoint && current.canonicalOAuthRequest && current.globallyHidden && current.unsupportedServerFields === 0, 'Wiring Rovo distinto del canónico: reconciliar explícitamente, sin copiar secretos ni normalizar');
  assert.deepEqual(current.roleReads, ROVO_ROLES, 'La exposición actual de Rovo requiere reconciliación antes de migrar');
  const compatibility = readRovoCompatibility(root), identity = readRovoIdentity(root), discovery = readRovoDiscovery(root);
  const marker = path.join(root, '.ticketing-v2-enabled.json');
  noSymlinks(marker);
  const state = { owner: 'opencode-stack', addon: 'super-turing-opencode-ticketing', profile: root };
  const installed = fs.existsSync(marker);
  if (installed) assert.deepEqual(JSON.parse(fs.readFileSync(marker)), state, 'Unexpected Ticketing marker');
  let nativeServer = { ...rovoServer(), disabled: !current.enabled };
  if (compatibility) nativeServer = dcrLoopbackServer(nativeServer, compatibility.callbackPort);
  if (identity) nativeServer = rovoIdentityServer(nativeServer);
  if (discovery) nativeServer = rovoDiscoveryServer(nativeServer);
  const ticketing = ticketingExtension({ server: nativeServer }), previous = options.extend;
  return { ...selected, marker, state, installed, current, compatibility, identity, discovery,
    options: { ...options, extend: context => ticketing({ ...context, ...previous(context) }) } };
}
