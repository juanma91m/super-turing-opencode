// Shared reader leases: many production clients, but no config lifecycle writes.
// A crash retains its lease for explicit reconciliation, never PID-based removal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function assertNoProductionReaders(root) {
  const directory = path.join(root, '.production-readers');
  if (!fs.existsSync(directory)) return;
  const info = fs.lstatSync(directory);
  assert(info.isDirectory() && !info.isSymbolicLink() && fs.readdirSync(directory).length === 0, 'Production clients or unreconciled reader leases exist; no configuration writes');
}

// Caller holds the existing exclusive candidate lease during publication.
export function publishProductionReader(root) {
  const directory = path.join(root, '.production-readers');
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
  const info = fs.lstatSync(directory);
  assert(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && !(info.mode & 0o077), 'Private production lease directory required');
  const file = path.join(directory, randomUUID() + '.json'), fd = fs.openSync(file, 'wx', 0o600), identity = fs.fstatSync(fd);
  fs.writeFileSync(fd, JSON.stringify({ owner: 'opencode-stack', kind: 'production-reader', pid: process.pid }) + '\n');
  return () => {
    try { const current = fs.lstatSync(file); assert(current.ino === identity.ino && current.dev === identity.dev && !current.isSymbolicLink(), 'Production lease changed; unknown lease retained'); fs.unlinkSync(file); }
    finally { fs.closeSync(fd); }
  };
}
