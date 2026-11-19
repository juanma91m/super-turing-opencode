// Synthetic approval fixture only. Never points at the user's ~/.ssh.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, noSymlinks } from './staging.mjs';

export const PROBE_TEXT = 'Prueba sintética de permiso para alertas V2. No es una clave ni contiene credenciales.\n';

export function prepareApprovalFixture(root) {
  const p = layout(root);
  noSymlinks(p.marker);
  const marker = JSON.parse(fs.readFileSync(p.marker, 'utf8'));
  assert(marker.owner === 'opencode-stack' && marker.kind === 'v2-clean-staging' && marker.version === '2.2.7', 'Unowned pilot');
  noSymlinks(p.project);
  const directory = path.join(p.project, '.ssh');
  const file = path.join(directory, 'notification-probe.txt');
  noSymlinks(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, 'utf8'), PROBE_TEXT, 'Approval fixture changed; refusing overwrite');
  else fs.writeFileSync(file, PROBE_TEXT, { flag: 'wx', mode: 0o400 });
  return { path: file, relativePath: '.ssh/notification-probe.txt', synthetic: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert(process.argv.length === 3 && process.argv[2] === 'prepare', 'Usage: node alerts-fixture.mjs prepare');
    console.log(JSON.stringify(prepareApprovalFixture(path.join(os.homedir(), '.local/share/opencode-v2-clean/workshop')), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
