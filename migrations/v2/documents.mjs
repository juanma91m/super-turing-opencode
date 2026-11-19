import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, layout, noSymlinks } from './staging.mjs';
import { selectDocumentsReaderProfile } from './documents-reader-profile.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { inspectBuiltinVisibility, readBuiltinVisibility } from './builtin-visibility.mjs';
import { assertUnindexedDefault } from './codegraph-profile.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';
import { inspectPlaywright } from '../../v2/playwright/inspect.mjs';
import { selectDocumenter } from '../../../super-turing-opencode-documents/v2/documenter/preflight.mjs';
import { documenterExtension } from '../../../super-turing-opencode-documents/v2/documenter/composition.mjs';
import { documentMemoryOverrides } from '../../../super-turing-opencode-documents/v2/documenter/policy.mjs';
import { inspectDocumenter } from '../../../super-turing-opencode-documents/v2/documenter/inspect.mjs';
import { hasManagedInputPins } from '../../../super-turing-opencode-documents/v2/documenter/working-inputs.mjs';
import { interactive } from './pilot.mjs';

async function main() {
  const action = process.argv[2];
  const writes = ['apply', 'repair-inputs'].includes(action);
  assert(['plan', 'apply', 'repair-inputs', 'verify', 'chat'].includes(action) && (process.argv.length === 3 || writes && process.argv[3] === '--client-closed' && process.argv.length === 4), 'Uso: documents.mjs plan | apply --client-closed | repair-inputs --client-closed | verify | chat');
  if (writes) assert(process.argv[3] === '--client-closed', 'Cerrá el workshop y confirmalo con --client-closed; no se detienen procesos ajenos');
  if (action === 'chat') assert(process.stdin.isTTY && process.stdout.isTTY, 'Chat requiere terminal interactiva');
  const selected = selectDocumentsReaderProfile();
  assert(selected.readerInstalled, 'Primero incorporar y validar el lector');
  const { base, root, home, config, options, runtime, graph } = selected;
  assert(readBuiltinVisibility(root), 'Conservar la preferencia Plan/Build ocultos antes de incorporar Documenter');
  const binding = selectDocumenter(home, config);
  const marker = path.join(root, '.documenter-v2-enabled.json'); noSymlinks(marker);
  const state = { owner: 'opencode-stack', addon: 'super-turing-opencode-documents', profile: root, increment: 'documenter-local' };
  const installed = fs.existsSync(marker);
  if (installed) assert(JSON.stringify(JSON.parse(fs.readFileSync(marker))) === JSON.stringify(state), 'Unexpected Documenter marker (values suppressed)');
  const paths = layout(root), configFile = path.join(paths.config, 'opencode/opencode.json'); noSymlinks(configFile);
  let needsInputRepair = false;
  if (installed) {
    try { needsInputRepair = hasManagedInputPins(JSON.parse(fs.readFileSync(configFile)), paths.project); }
    catch { throw new Error('Could not inspect Documenter input ownership; configuration values suppressed'); }
  }
  if (action === 'plan') { console.log(JSON.stringify({ profile: root, status: installed ? 'applied; rendering/independent QA are separate workflows' : 'pending apply after client close', agents: 22, skills: 33, addonCommands: 18,
    documenter: { tools: 8, specialists: 6, formats: ['pdf', 'pptx', 'docx'], diagrams: true, canvas: 'owned loopback only; starts on demand', remotePublication: false },
    hiddenBuiltins: ['plan', 'build'], workingInputOwnership: needsInputRepair ? 'legacy managed pins; repair-inputs --client-closed required' : 'editable; missing inputs seeded only', legacyQmdOdt: 'separate operator workflow; not a hidden shell inside Documenter', rendersIssued: 0 }, null, 2)); return; }
  if (action !== 'apply') assert(installed, 'Primero ejecutar apply --client-closed');
  assert(!needsInputRepair || action === 'repair-inputs', 'Primero cerrar el workshop y ejecutar documents.mjs repair-inputs --client-closed; no se modificaron fuentes');
  const previous = options.extend, extension = documenterExtension({ binding, upgradeManagedInputs: action === 'repair-inputs' && needsInputRepair });
  const p = prepareWorkshop(root, { ...options, extend: context => extension({ ...context, ...previous(context) }) });
  if (!installed) fs.writeFileSync(marker, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
  if (action === 'repair-inputs') {
    console.log(JSON.stringify({ workingInputOwnership: 'editable; missing inputs seeded only', changed: Boolean(needsInputRepair),
      existingInputsReplaced: 0, permissionsAndToolsChanged: false, protectedAssets: 'strict drift checks retained; exact known baseline required',
      backup: needsInputRepair ? 'opencode.json.pre-documenter-inputs.bak' : null, mcpStarted: false, restartRequired: true }, null, 2));
    return;
  }
  const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
  assert.equal(debug.status, 0, 'Documenter config rejected; values suppressed');
  assertUnindexedDefault(p, graph);
  const server = await startServer(base.binary, p);
  let result;
  try {
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-documents.native'), 'Native document tools');
    const prior = await inspectKnowledge(server, p, runtime.permissions, { additionalMcp: ['atlassian-rovo', 'codegraph', 'playwright'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access', 'opencode-stack.playwright-access', 'opencode-documents.native'], rolePermissionOverrides: documentMemoryOverrides });
    result = { ...prior, ...await inspectTicketing(get, p.roles), ...await inspectCodeGraph(get, p.roles), ...await inspectPlaywright(get, p.roles), ...await inspectBuiltinVisibility(get, root), ...await inspectDocumenter(get, p.roles, p.project),
      documentDelegation: 'native Documenter -> six approved targets only; no nested/technical-role delegation', sourceDocumentsMutated: 0 };
  } finally { await server.close(); }
  console.log(JSON.stringify(result, null, 2));
  if (action === 'chat') { assert(result.connected, 'Falta login V2; no se copian credenciales'); await interactive(base.binary, p, ['--standalone']); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
