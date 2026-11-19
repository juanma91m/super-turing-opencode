// Opt-in browser integration. No global sync, browser download or auth copying.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, noSymlinks } from './staging.mjs';
import { assertUnindexedDefault } from './codegraph-profile.mjs';
import { selectPlaywrightProfile } from './playwright-profile.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';
import { inspectPlaywright } from '../../v2/playwright/inspect.mjs';
import { PLAYWRIGHT_TOOLS } from '../../v2/playwright/config.mjs';
import { interactive } from './pilot.mjs';

async function main() {
  const action = process.argv[2];
  assert(['plan', 'apply', 'verify', 'chat'].includes(action) && (process.argv.length === 3 || action === 'apply' && process.argv[3] === '--client-closed' && process.argv.length === 4), 'Uso: playwright.mjs plan | apply --client-closed | verify | chat');
  if (action === 'apply') assert(process.argv[3] === '--client-closed', 'Cerrá el workshop y confirmalo con --client-closed; no se detienen procesos ajenos');
  if (action === 'chat') assert(process.stdin.isTTY && process.stdout.isTTY, 'Chat requiere terminal interactiva');
  const selected = selectPlaywrightProfile();
  const { base, root, options, runtime, graph, browser, browserMarker: marker, browserState: state, browserInstalled: installed } = selected;
  noSymlinks(path.join(root, '.documents-read-v2-enabled.json'));
  assert(!fs.existsSync(path.join(root, '.documents-read-v2-enabled.json')), 'Documents reader ya incorporado: usá migrations/v2/documents-read.mjs verify|chat');
  if (action === 'plan') {
    console.log(JSON.stringify({ profile: root, status: installed ? 'applied; browser workflow validation is separate' : 'pending apply after client close', agents: 15, skills: 20, addonCommands: 11,
      playwright: { version: browser.version, existingBrowser: true, actors: browser.roles, tools: PLAYWRIGHT_TOOLS.length, defaultMode: 'headless', visible: 'explicit user request; display required', unsafeCode: false, isolated: true },
      ticketingScopeSelection: selected.discovery ? 'resource-metadata' : 'explicit configured scope', downloadsIssued: 0, browserToolCalls: 0 }, null, 2));
    return;
  }
  if (action !== 'apply') assert(installed, 'Primero ejecutar apply --client-closed');
  const p = prepareWorkshop(root, options);
  if (!installed) fs.writeFileSync(marker, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
  const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
  assert.equal(debug.status, 0, 'Debug config Playwright falló; salida omitida');
  for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep));
  assertUnindexedDefault(p, graph);
  const server = await startServer(base.binary, p);
  let result;
  try {
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-stack.playwright-access'), 'Playwright access plugin');
    await until(async () => (await get('/api/mcp')).some(item => item.name === 'playwright' && item.status?.status === 'connected'), 'Playwright MCP catalog');
    const prior = await inspectKnowledge(server, p, runtime.permissions, { additionalMcp: ['atlassian-rovo', 'codegraph', 'playwright'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access', 'opencode-stack.playwright-access'] });
    result = { ...prior, skills: p.skills.length, ...await inspectTicketing(get, p.roles), ...await inspectCodeGraph(get, p.roles), ...await inspectPlaywright(get, p.roles),
      ticketingScopeSelection: selected.discovery ? 'resource-metadata' : 'explicit configured scope', downloadsIssued: 0 };
  } finally { await server.close(); }
  console.log(JSON.stringify(result, null, 2));
  if (action === 'chat') { assert(result.connected, 'Falta el login V2 existente; no se copian credenciales'); await interactive(base.binary, p, ['--standalone']); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
