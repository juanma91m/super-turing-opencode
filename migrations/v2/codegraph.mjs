// Opt-in query-only CodeGraph increment. No init/sync/reindex or global install.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, noSymlinks } from './staging.mjs';
import { selectCodeGraphProfile, assertUnindexedDefault } from './codegraph-profile.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { getApiList } from './api-list.mjs';
import { startServer, until } from './private-server.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';
import { interactive } from './pilot.mjs';

async function main() {
  const action = process.argv[2];
  assert(['plan', 'apply', 'verify', 'chat'].includes(action) && (process.argv.length === 3 || action === 'apply' && process.argv[3] === '--client-closed' && process.argv.length === 4), 'Uso: codegraph.mjs plan | apply --client-closed | verify | chat');
  if (action === 'apply') assert(process.argv[3] === '--client-closed', 'Cerrá el workshop y confirmalo con --client-closed; no se detienen procesos');
  if (action === 'chat') assert(process.stdin.isTTY && process.stdout.isTTY, 'Chat requiere tu terminal interactiva');
  const selected = selectCodeGraphProfile();
  const { base, root, options, runtime, graph, graphMarker: marker, graphState: state } = selected;
  noSymlinks(path.join(root, '.playwright-v2-enabled.json'));
  assert(!fs.existsSync(path.join(root, '.playwright-v2-enabled.json')), 'Playwright ya incorporado: usá migrations/v2/playwright.mjs verify|chat');
  if (action === 'plan') {
    console.log(JSON.stringify({ profile: root, status: fs.existsSync(marker) ? 'applied; actual indexed query is separate' : 'pending apply after client close', agents: 15, skills: 20, addonCommands: 11,
      codegraph: { version: graph.version, tools: graph.tools, actors: graph.roles, existingRuntime: true, lifecycleEnabled: false, benchmarkV2Enabled: false },
      ticketingScopeSelection: selected.discovery ? 'resource-metadata' : 'explicit configured scope', actualIndexQueries: 0, indexesCreated: 0 }, null, 2));
    return;
  }
  if (action !== 'apply') assert(fs.existsSync(marker), 'Primero ejecutar apply --client-closed');
  const p = prepareWorkshop(root, options);
  if (!fs.existsSync(marker)) fs.writeFileSync(marker, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
  const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
  assert.equal(debug.status, 0, 'Debug config CodeGraph falló; salida omitida');
  for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep), 'Foreign config source');
  // Never let metadata verification open an indexed default root implicitly.
  assertUnindexedDefault(p, graph);
  const server = await startServer(base.binary, p);
  let result;
  try {
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-codegraph.access'), 'CodeGraph access plugin');
    await until(async () => (await get('/api/mcp')).some(item => item.name === 'codegraph' && item.status?.status === 'connected'), 'CodeGraph MCP handshake');
    const knowledge = await inspectKnowledge(server, p, runtime.permissions, { additionalMcp: ['atlassian-rovo', 'codegraph'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access'] });
    result = { ...knowledge, skills: p.skills.length, ...await inspectTicketing(get, p.roles), ...await inspectCodeGraph(get, p.roles), ticketingScopeSelection: selected.discovery ? 'resource-metadata' : 'explicit configured scope', indexesCreated: 0 };
  } finally { await server.close(); }
  console.log(JSON.stringify(result, null, 2));
  if (action === 'chat') {
    assert(result.connected, 'Falta el login V2 existente; no se copian credenciales');
    await interactive(base.binary, p, ['--standalone']);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
