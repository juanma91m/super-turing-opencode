// Migration-only launcher for the existing workshop, opt-in after client close.
// No installer, auth copying, backend rebuild, corpus seed or runtime manager.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, noSymlinks } from './staging.mjs';
import { selectKnowledgeProfile } from './knowledge-profile.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { startServer } from './private-server.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { interactive } from './pilot.mjs';
import { ENGRAM_TOOLS } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';

async function main() {
  const action = process.argv[2];
  assert(['plan', 'apply', 'verify', 'chat'].includes(action) && (process.argv.length === 3 || action === 'apply' && process.argv[3] === '--client-closed' && process.argv.length === 4), 'Uso: knowledge.mjs plan | apply --client-closed | verify | chat');
  if (action === 'apply') assert(process.argv[3] === '--client-closed', 'Cerrá primero el cliente del workshop y confirmalo con --client-closed; no se detienen procesos ajenos');
  if (action === 'chat') assert(process.stdin.isTTY && process.stdout.isTTY, 'Chat requiere tu terminal interactiva');
  const { base, root, marker, runtime, options } = selectKnowledgeProfile();
  assert(!fs.existsSync(path.join(root, '.ticketing-v2-enabled.json')), 'Ticketing ya incorporado: usá migrations/v2/ticketing.mjs verify|chat para conservar la composición');
  if (action === 'plan') {
    console.log(JSON.stringify({ profile: root, action: 'pending explicit apply after client close', agents: 15, skills: 18, commands: 5, helpers: 7,
      engram: { enabled: runtime.server.enabled !== false, tools: ENGRAM_TOOLS.length, usesExistingExecutable: true },
      qdrant: 'existing wrappers, overrides and runtime; no seed or reindex', secretsCopied: false, storesCopied: false }, null, 2));
    return;
  }
  if (action !== 'apply') { noSymlinks(marker); assert(fs.existsSync(marker), 'Primero ejecutá apply --client-closed con el workshop cerrado'); }
  const state = { owner: 'opencode-stack', addon: 'super-turing-opencode-knowledge', profile: root };
  noSymlinks(marker);
  if (fs.existsSync(marker)) assert.deepEqual(JSON.parse(fs.readFileSync(marker)), state, 'Unexpected Knowledge profile marker');
  const p = prepareWorkshop(root, options);
  if (!fs.existsSync(marker)) fs.writeFileSync(marker, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  else assert.deepEqual(JSON.parse(fs.readFileSync(marker)), state, 'Unexpected Knowledge profile marker');
  const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
  assert.equal(debug.status, 0, 'Debug config del perfil falló; salida cruda omitida');
  for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep), 'Foreign configuration source');
  const server = await startServer(base.binary, p);
  let result;
  try {
    result = await inspectKnowledge(server, p, runtime.permissions);
  } finally { await server.close(); }
  console.log(JSON.stringify(result, null, 2));
  if (action === 'chat') {
    assert(result.connected, 'No se encontró el login V2 existente; no se copian credenciales. Revisar el piloto inicial.');
    await interactive(base.binary, p, ['--standalone']);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
