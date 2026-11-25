// Only the dedicated Context7 process receives the credential, never the
// OpenCode host's resolved configuration, environment or command arguments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function owned(file, directory, mode) {
  assert(path.isAbsolute(file) && fs.realpathSync(file) === file);
  const info = fs.lstatSync(file);
  assert(info.uid === process.getuid() && (directory ? info.isDirectory() : info.isFile() && info.nlink === 1)
    && (info.mode & 0o777) === mode);
}

try {
  const [keyFile, runtime] = process.argv.slice(2);
  assert(process.argv.length === 4);
  owned(path.dirname(keyFile), true, 0o700);
  owned(keyFile, false, 0o600);
  owned(runtime, true, 0o700);
  const pkg = path.join(runtime, 'node_modules/@upstash/context7-mcp');
  const manifest = path.join(pkg, 'package.json'), entry = path.join(pkg, 'dist/index.js');
  assert(fs.realpathSync(manifest) === manifest && fs.realpathSync(entry) === entry);
  const { name, version } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert(name === '@upstash/context7-mcp' && version === '4.8.0');
  const fd = fs.openSync(keyFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  let key;
  try {
    const info = fs.fstatSync(fd);
    assert(info.isFile() && info.uid === process.getuid() && info.nlink === 1 && (info.mode & 0o777) === 0o600 && info.size <= 1024);
    const buffer = Buffer.alloc(1025);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    assert(size > 0 && size <= 1024);
    key = buffer.subarray(0, size).toString('utf8').trim();
    assert(/^[A-Za-z0-9._~-]{16,1024}$/.test(key));
  } finally { fs.closeSync(fd); }
  const child = spawn(process.execPath, [entry, '--transport', 'stdio'], {
    cwd: runtime,
    env: { HOME: runtime, PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', OTEL_SDK_DISABLED: 'true', CONTEXT7_API_KEY: key },
    stdio: ['inherit', 'inherit', 'ignore'],
  });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
  child.once('error', () => { console.error('Context7 local runtime could not start.'); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
} catch {
  console.error('Context7 credential or local runtime unavailable. Check the private binding.');
  process.exitCode = 1;
}
