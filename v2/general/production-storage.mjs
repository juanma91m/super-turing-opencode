// Production has a distinct, explicitly published storage contract. This module
// never initializes, migrates, copies, opens SQLite, reads auth, or adopts a pilot.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function privatePath(file, directory = false) {
  let current = path.parse(file).root;
  for (const part of path.relative(current, file).split(path.sep)) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'Production storage symlink refused');
  }
  const stat = fs.statSync(file);
  assert(directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1, 'Production storage type/link mismatch');
  assert(stat.uid === process.getuid() && !(stat.mode & 0o077), 'Production storage must be private and user-owned');
}

export function productionStorage(root) {
  assert(typeof root === 'string' && path.isAbsolute(root) && path.resolve(root) === root && path.basename(root) === 'production-storage', 'Explicit canonical production-storage root required, not original/pilot/trial');
  privatePath(root, true);
  const file = path.join(root, '.production-storage.json'); privatePath(file);
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('Invalid production storage marker; values suppressed'); }
  assert(Object.keys(record ?? {}).sort().join(',') === 'kind,nativeVersion,owner,phase,root,schemaVersion' && record.schemaVersion === 1 && record.owner === 'opencode-stack' && record.kind === 'production-native-storage' && record.nativeVersion === '2.2.7' && record.root === root && ['history-verified', 'native-initialized'].includes(record.phase), 'Production storage not published/verified; no initialization or fallback');
  const data = path.join(root, 'data'), state = path.join(root, 'state'), db = path.join(data, 'opencode/opencode.db');
  for (const directory of [data, state, path.dirname(db)]) privatePath(directory, true);
  privatePath(db);
  return { schemaVersion: 1, kind: 'production-native-storage', root, data, state, db };
}

export function bindProductionStorage(profile, selected) {
  const bound = { ...profile, data: selected.data, state: selected.state, storageBinding: selected };
  validateProductionBinding(bound);
  return bound;
}

export function validateProductionBinding(profile) {
  const selected = profile.storageBinding;
  assert(JSON.stringify(selected) === JSON.stringify(productionStorage(selected.root)), 'Production storage descriptor changed');
  assert(profile.data === selected.data && profile.state === selected.state, 'Production data/state binding differs');
  assert(path.isAbsolute(profile.root) && path.resolve(profile.root) === profile.root && ![profile.root, selected.root].some((root, index, both) => root === both[1-index] || root.startsWith(both[1-index] + path.sep)), 'Configuration and production storage must remain separate');
  const home = path.join(profile.root, 'home');
  for (const [key, expected] of Object.entries({ home, config: path.join(home, '.config'), cache: path.join(home, '.cache'), tmp: path.join(profile.root, 'tmp') })) {
    assert(profile[key] === expected, 'Only production data/state may be rebound');
    privatePath(expected, true);
  }
}
