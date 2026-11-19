// Opt-in Ticketing composition. Native OAuth is handled by /mcps in the TUI;
// this launcher never reads/copies V1 MCP auth stores or calls Jira tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, noSymlinks } from './staging.mjs';
import { selectTicketingProfile } from './ticketing-profile.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { getApiList } from './api-list.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { startServer, until } from './private-server.mjs';
import { interactive } from './pilot.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { DCR_CALLBACK_PORT, ROVO_IDENTITY_SCOPES } from '../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs';
import { applyRovoCompatibility, applyRovoIdentity, applyRovoDiscovery } from './rovo-oauth-compat.mjs';

async function main() {
  const action = process.argv[2];
  const changing = ['apply', 'oauth-compat', 'oauth-identity', 'oauth-discovery'].includes(action);
  assert(['plan', 'apply', 'oauth-compat', 'oauth-identity', 'oauth-discovery', 'verify', 'chat'].includes(action) && (process.argv.length === 3 || changing && process.argv[3] === '--client-closed' && process.argv.length === 4), 'Uso: ticketing.mjs plan | apply --client-closed | oauth-compat --client-closed | oauth-identity --client-closed | oauth-discovery --client-closed | verify | chat');
  if (changing) assert(process.argv[3] === '--client-closed', 'Cerrá el workshop y confirmalo con --client-closed; no se detienen procesos ajenos');
  if (action === 'chat') assert(process.stdin.isTTY && process.stdout.isTTY, 'Chat requiere tu terminal interactiva');
  const { base, root, marker, state, installed, current, runtime, options, compatibility, identity, discovery } = selectTicketingProfile();
  noSymlinks(path.join(root, '.codegraph-v2-enabled.json'));
  assert(!fs.existsSync(path.join(root, '.codegraph-v2-enabled.json')), 'CodeGraph ya incorporado: usá migrations/v2/codegraph.mjs verify|chat para conservar la composición');
  if (action === 'oauth-identity') assert(!discovery, 'Discovery is active; do not restore an explicit scope override');
  if (action === 'plan') {
    console.log(JSON.stringify({ profile: root, status: installed ? 'already applied; real OAuth/readiness is separate' : 'pending apply after client close', agents: 15, skills: 19, commands: 11,
      rovo: { endpoint: 'canonical MCP v2', enabled: current.enabled, plannerReads: 4, reviewerReads: 3, otherRoles: 0 },
      oauth: compatibility ? 'native DCR loopback compatibility; /mcps; no token copying' : 'native V2 /mcps; no V1 token copying', scopeSelection: discovery ? 'resource-metadata; review provider consent' : 'explicit configured scope', identityScopes: discovery ? [] : identity?.scopes ?? [], realJiraRequests: 0, localHandoff: 'project opt-in; sandboxed broker; no Jira credentials required' }, null, 2));
    return;
  }
  if (!installed) assert(action === 'apply', 'Primero ejecutar apply --client-closed con el workshop cerrado');
  let p = prepareWorkshop(root, options);
  if (!fs.existsSync(marker)) fs.writeFileSync(marker, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  if (action === 'oauth-compat') p = await applyRovoCompatibility(p);
  if (action === 'oauth-identity') p = await applyRovoIdentity(p);
  if (action === 'oauth-discovery') p = await applyRovoDiscovery(p);
  const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
  assert.equal(debug.status, 0, 'Debug config Ticketing falló; salida cruda omitida');
  for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep), 'Foreign config source');
  if (['oauth-compat', 'oauth-identity', 'oauth-discovery'].includes(action)) {
    const discovered = discovery || action === 'oauth-discovery';
    console.log(JSON.stringify({ status: action === 'oauth-discovery' ? p.oauthDiscovery : action === 'oauth-identity' ? p.oauthIdentity : p.oauthCompatibility, callbackPort: DCR_CALLBACK_PORT, hostPatched: false, credentialOperationsIssued: false,
      nativeOAuthStarted: false, mcpPermissionsChanged: false, scopesChanged: p.oauthIdentityChanged === true || p.oauthDiscoveryChanged === true,
      scopeSelection: discovered ? 'resource-metadata; may request broader provider consent' : 'explicit configured scope', identityScopes: discovered ? [] : action === 'oauth-identity' ? [...ROVO_IDENTITY_SCOPES] : identity?.scopes ?? [], realAtlassianRequests: 0, next: 'ticketing.mjs chat; start a fresh /mcps authorization' }, null, 2));
    return;
  }
  const server = await startServer(base.binary, p);
  let result;
  try {
    await until(async () => (await getApiList(server.request, '/api/plugin')).some(item => item.id === 'opencode-ticketing.titles'), 'Ticketing plugin');
    const knowledge = await inspectKnowledge(server, p, runtime.permissions, { additionalMcp: ['atlassian-rovo'], additionalPlugins: ['opencode-ticketing.titles'] });
    const status = await inspectTicketing(route => getApiList(server.request, route), p.roles);
    result = { ...knowledge, skills: p.skills.length, ...status, oauth: status.rovoStatus === 'connected' ? 'connected' : 'revisar /mcps en el chat; no se autentica automáticamente',
      actualJiraToolCalls: 0, copiedOAuthTokens: false, localHandoff: 'available through broker; never activated by installation alone' };
  } finally { await server.close(); }
  console.log(JSON.stringify(result, null, 2));
  if (action === 'chat') {
    assert(result.connected, 'No se encontró el login V2 existente; no se copian credenciales');
    await interactive(base.binary, p, ['--standalone']);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
