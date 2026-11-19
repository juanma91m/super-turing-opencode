import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export function releaseStorePath(root) {
  assert(path.isAbsolute(root) && path.resolve(root) === root && root !== path.parse(root).root, 'Canonical candidate root required');
  return path.join(path.dirname(root), '.' + path.basename(root) + '-distribution');
}
export function assertNoPendingDistribution(root) {
  const store = releaseStorePath(root), journal = path.join(store, 'transaction.json');
  let current = journal;
  while (current !== path.dirname(current)) {
    try { assert(!fs.lstatSync(current).isSymbolicLink(), 'Distribution path symlink refused'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    current = path.dirname(current);
  }
  assert(!fs.existsSync(journal), 'Pending distribution transaction; explicit recovery required before prepare or launch');
}
