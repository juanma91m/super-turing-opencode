import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { noSymlinks } from './staging.mjs';

// Migration-only compare-before-replace. Validate the entire set before writing;
// unknown user edits are never accepted as a new managed baseline.
export function upgradeOwned(entries) {
  const changes = [];
  for (const { file, desired, previous, backup = false, tag = 'context7' } of entries) {
    assert(/^[a-z][a-z0-9-]*$/.test(tag), 'Invalid managed upgrade tag');
    noSymlinks(file);
    const current = fs.existsSync(file) ? fs.readFileSync(file) : undefined;
    const same = value => value !== undefined && current !== undefined && current.equals(Buffer.from(value));
    if (same(desired)) continue;
    assert(current === undefined || same(previous), `Managed asset changed; refusing upgrade: ${file}`);
    const saved = file + `.pre-${tag}.bak`;
    noSymlinks(saved);
    if (backup && current !== undefined && fs.existsSync(saved)) assert(fs.readFileSync(saved).equals(current), 'Existing upgrade backup differs');
    changes.push({ file, desired, current, backup, saved, tag });
  }
  for (const change of changes) {
    fs.mkdirSync(path.dirname(change.file), { recursive: true, mode: 0o700 });
    if (change.backup && change.current !== undefined && !fs.existsSync(change.saved)) fs.writeFileSync(change.saved, change.current, { flag: 'wx', mode: 0o600 });
    const temp = change.file + `.${change.tag}.tmp`;
    noSymlinks(temp);
    fs.writeFileSync(temp, change.desired, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, change.file);
  }
}
