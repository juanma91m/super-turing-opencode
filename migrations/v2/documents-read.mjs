// First Documents increment: canonical broker reader only, no publication/MCP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, noSymlinks } from './staging.mjs';
import { selectDocumentsReaderProfile } from './documents-reader-profile.mjs';
import { assertUnindexedDefault } from './codegraph-profile.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { getApiList } from './api-list.mjs';
import { startServer, until } from './private-server.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';
import { inspectPlaywright } from '../../v2/playwright/inspect.mjs';
import { inspectReader } from '../../../super-turing-opencode-documents/v2/reader/inspect.mjs';
import { interactive } from './pilot.mjs';
import { applyBuiltinVisibility, inspectBuiltinVisibility, readBuiltinVisibility } from './builtin-visibility.mjs';

async function main() {
  const action = process.argv[2];
  const changing = ['apply', 'hide-builtins'].includes(action);
  assert(['plan', 'apply', 'hide-builtins', 'verify', 'chat'].includes(action) && (process.argv.length === 3 || changing && process.argv[3] === '--client-closed' && process.argv.length === 4), 'Uso: documents-read.mjs plan | apply --client-closed | hide-builtins --client-closed | verify | chat');
  if (changing) assert(process.argv[3] === '--client-closed', 'Cerrá el workshop y confirmalo con --client-closed; no se detienen procesos ajenos');
  if (action === 'chat') assert(process.stdin.isTTY && process.stdout.isTTY, 'Chat requiere terminal interactiva');
  const selected = selectDocumentsReaderProfile();
  const { base, root, options, runtime, graph, readerCurrent: current, readerMarker: marker, readerState: state, readerInstalled: installed } = selected;
  noSymlinks(path.join(root, '.documenter-v2-enabled.json'));
  assert(!fs.existsSync(path.join(root, '.documenter-v2-enabled.json')), 'Documenter ya incorporado: usá migrations/v2/documents.mjs verify|chat');
  if (action === 'plan') {
    console.log(JSON.stringify({ profile: root, status: installed ? 'applied; document review is a separate workflow' : 'pending apply after client close', agents: 15, skills: 21, addonCommands: 11,
      reader: current, newMcpServers: 0, publicationEnabled: false, remoteWritesIssued: 0, originalsMutated: 0,
      hiddenBuiltins: readBuiltinVisibility(root)?.hidden ?? [], ticketingScopeSelection: selected.discovery ? 'resource-metadata' : 'explicit configured scope' }, null, 2));
    return;
  }
  if (action !== 'apply') assert(installed, 'Primero ejecutar apply --client-closed');
  let p = prepareWorkshop(root, options);
  if (!installed) fs.writeFileSync(marker, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
  if (action === 'hide-builtins') p = applyBuiltinVisibility(p);
  const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
  assert.equal(debug.status, 0, 'Debug config Documents reader falló; salida omitida');
  for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep));
  if (action === 'hide-builtins') {
    console.log(JSON.stringify({ hiddenBuiltins: ['plan', 'build'], changed: p.builtinVisibilityChanged, permissionsChanged: false,
      agentsDisabled: false, commandRoutingChanged: false, configValidated: true, nativeMcpStarted: false,
      next: 'documents-read.mjs chat; config loads on restart' }, null, 2));
    return;
  }
  assertUnindexedDefault(p, graph);
  const server = await startServer(base.binary, p);
  let result;
  try {
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/skill')).some(item => item.id === 'lectura-documental'), 'Documents reader skill');
    const prior = await inspectKnowledge(server, p, runtime.permissions, { additionalMcp: ['atlassian-rovo', 'codegraph', 'playwright'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access', 'opencode-stack.playwright-access'] });
    result = { ...prior, skills: p.skills.length, ...await inspectTicketing(get, p.roles), ...await inspectCodeGraph(get, p.roles), ...await inspectPlaywright(get, p.roles), ...await inspectReader(get), ...await inspectBuiltinVisibility(get, root), dependencies: current.dependencies };
  } finally { await server.close(); }
  console.log(JSON.stringify(result, null, 2));
  if (action === 'chat') { assert(result.connected, 'Falta el login V2 existente; no se copian credenciales'); await interactive(base.binary, p, ['--standalone']); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
