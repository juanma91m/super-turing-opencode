// Build a base installation without reading the user's config or copying data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, layout, environment } from '../runtime/staging.mjs';
import { planGeneral } from '../general/profile.mjs';
import { officialRuntime } from '../general/lifecycle.mjs';
import { installRelease, validateReleaseSchema } from '../general/releases.mjs';
import { productionStorage } from '../general/production-storage.mjs';
import { startOwnedServer } from '../general/owned-server.mjs';
import { MANAGED_CONTRACT } from '../general/production-cli.mjs';
import { renderEntry } from './loader.mjs';

const [root, home] = process.argv.slice(2);
const coreRoot = fileURLToPath(new URL('../../', import.meta.url));
assert(fs.realpathSync(root) === root && fs.realpathSync(home) === home && process.env.HOME === home);
process.umask(0o077);
const stagingRoot = path.join(root, 'opencode-runtime');
const layoutPaths = layout(stagingRoot);
install(layoutPaths);
const runtime = officialRuntime(stagingRoot);
const generalRoot = path.join(root, 'general');
const maintenanceModels = Object.fromEntries(['title', 'summary', 'compaction'].map(id => [id, { model: 'openai/gpt-6.1-sol' }]));
const general = planGeneral(generalRoot, { project: layoutPaths.project, runtimeHome: home, maintenanceModels });
const { revision: generalRevision } = installRelease(general, { candidateOnly: true, clientClosed: true,
  validate: plan => validateReleaseSchema(plan, runtime) });

const storageRoot = path.join(root, 'production-storage');
const data = path.join(storageRoot, 'data'), state = path.join(storageRoot, 'state');
const db = path.join(data, 'opencode/opencode.db');
fs.mkdirSync(storageRoot, { mode: 0o700 });
for (const directory of [path.dirname(db), state]) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
// Ask the pinned native host to initialize an empty DB, using a deny-only config.
// No model, MCP, plugin or real HOME is involved in initialization.
const host = await startOwnedServer(runtime.binary, layoutPaths, profile => ({ ...environment(profile),
  XDG_DATA_HOME: data, XDG_STATE_HOME: state, OPENCODE_DB: db }));
try {
  const result = await host.request('GET', '/api/session');
  const sessions = Array.isArray(result.value) ? result.value : result.value?.data;
  assert(result.status === 200 && Array.isArray(sessions) && sessions.length === 0, 'Initial native store is not empty');
} finally { await host.close(); }
assert(fs.statSync(db).size > 0, 'Native DB was not initialized');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
write(path.join(storageRoot, '.production-storage.json'), { schemaVersion: 1, owner: 'opencode-stack',
  kind: 'production-native-storage', nativeVersion: runtime.version, root: storageRoot, phase: 'native-initialized' });
productionStorage(storageRoot);
write(path.join(root, 'settings.json'), { schemaVersion: 1, owner: 'portable-production-entry', profile: 'base', nativeVersion: runtime.version,
  managedContract: MANAGED_CONTRACT, coreRoot, stagingRoot, generalRoot, generalRevision, storageRoot });
fs.writeFileSync(path.join(root, 'entry.mjs'), renderEntry({ coreRoot, home, root }), { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ kind: 'fresh-native-staged', nativeVersion: runtime.version, profile: 'base', storageRoot }));
