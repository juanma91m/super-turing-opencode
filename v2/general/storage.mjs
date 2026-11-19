// Opt-in native V2 storage reuse. Read only public ownership markers and stat
// known directories/DB path; never open a DB, credential, account or auth file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateProductionBinding } from './production-storage.mjs';

function noLinks(file) {
  let current = path.parse(file).root;
  for (const part of path.relative(current, file).split(path.sep)) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'Native storage symlink requires explicit review');
  }
}
function marker(root) {
  const file = path.join(root, '.stack-v2-migration.json'); noLinks(file);
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('Invalid public V2 ownership marker; values suppressed'); }
  assert(Object.keys(value ?? {}).sort().join(',') === 'kind,owner,schemaVersion,version' && value.schemaVersion === 1 && value.owner === 'opencode-stack' && value.kind === 'v2-clean-staging' && value.version === '2.2.7', 'Unexpected V2 storage owner/version; values suppressed');
}

export function existingV2Storage(stagingRoot) {
  assert(typeof stagingRoot === 'string' && path.isAbsolute(stagingRoot) && path.resolve(stagingRoot) === stagingRoot && path.basename(stagingRoot) === 'opencode-v2-clean', 'Explicit official V2 staging root required, never a V1 storage path');
  marker(stagingRoot);
  const sourceRoot = path.join(stagingRoot, 'pilot'); marker(sourceRoot);
  const data = path.join(sourceRoot, 'home/.local/share'), state = path.join(sourceRoot, 'home/.local/state'), db = path.join(data, 'opencode/opencode.db');
  for (const directory of [data, state]) { noLinks(directory); assert(fs.statSync(directory).isDirectory(), 'Existing native V2 storage directory required'); }
  noLinks(db); assert(fs.statSync(db).isFile(), 'Existing V2 DB required; no initialization or fallback to V1');
  return { schemaVersion: 1, kind: 'existing-v2-native-storage', stagingRoot, sourceRoot, data, state, db, credentialState: 'not queried; native runtime owns authentication' };
}

export function bindV2Storage(profile, selected, { clientClosed = false, reuseV2Storage = false } = {}) {
  assert(clientClosed === true && reuseV2Storage === true, 'Native V2 storage reuse requires explicit reuse acknowledgment and client-close confirmation');
  assert(JSON.stringify(selected) === JSON.stringify(existingV2Storage(selected.stagingRoot)), 'Native storage descriptor changed; no arbitrary DB/path binding');
  assert(profile.root !== selected.stagingRoot && !profile.root.startsWith(selected.stagingRoot + path.sep + 'pilot' + path.sep) && profile.root !== selected.sourceRoot, 'Source pilot cannot become candidate configuration');
  ownedIdentity(profile, selected);
  return { ...profile, data: selected.data, state: selected.state, storageBinding: selected };
}

export function validateStorageBinding(profile) {
  const selected = profile.storageBinding;
  if (selected?.kind === 'production-native-storage') return validateProductionBinding(profile);
  assert(JSON.stringify(selected) === JSON.stringify(existingV2Storage(selected.stagingRoot)), 'Native storage descriptor changed');
  assert(profile.data === selected.data && profile.state === selected.state, 'Native storage paths differ from approved binding');
  ownedIdentity(profile, selected);
}

function ownedIdentity(profile, selected) {
  assert(path.isAbsolute(profile.root) && path.resolve(profile.root) === profile.root && profile.root !== selected.sourceRoot, 'Canonical separate candidate root required');
  const home = path.join(profile.root, 'home');
  for (const [key, expected] of Object.entries({ home, config: path.join(home, '.config'), cache: path.join(home, '.cache'), tmp: path.join(profile.root, 'tmp') })) {
    assert(profile[key] === expected && !expected.startsWith(selected.sourceRoot + path.sep), 'Only data/state may be shared; HOME/config/cache/tmp stay candidate-owned');
    noLinks(expected);
  }
}
