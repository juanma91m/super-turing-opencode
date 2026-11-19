// Loading smoke only. No model request, filesystem tool execution or real MCP.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { environment, layout, noSymlinks, verify } from './staging.mjs';

const p = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const plugin = fileURLToPath(new URL('../../v2/plugins/env-guard/', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  verify(p);
  noSymlinks(plugin);
  const env = {
    ...environment(p), OPENCODE_PASSWORD: randomUUID(),
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ plugins: [plugin] }),
  };
  const child = spawn(p.binary, ['serve', '--stdio', '--hostname', '127.0.0.1', '--port', '0'], {
    cwd: p.project, env, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.stderr.resume(); // Do not persist logs or auth-bearing diagnostics.
  const lines = createInterface({ input: child.stdout });
  let timer;
  try {
    const ready = await Promise.race([
      (async () => {
        for await (const line of lines) {
          try {
            const record = JSON.parse(line);
            if (typeof record.url === 'string') return record.url;
          } catch { /* Ignore non-protocol text without printing it. */ }
        }
        throw new Error('Server exited before readiness');
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Server readiness timeout')), 15_000); }),
    ]);
    clearTimeout(timer);
    const url = new URL(ready);
    assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.username === '' && url.password === '', 'Non-private server URL refused');
    let loaded = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      await delay(250);
      const result = spawnSync(p.binary, ['plugin', 'list', '--server', ready], {
        cwd: p.project, env, encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024,
      });
      assert.equal(result.status, 0, 'Private plugin-list request failed');
      if (result.stdout.includes('opencode-stack.env-guard')) {
        loaded = true;
        // This profile contains no credentials/user data. Print only the state
        // label lines, never configuration, raw logs or the server descriptor.
        console.log(result.stdout.trim());
        break;
      }
    }
    assert(loaded, 'Env guard never appeared in the native plugin catalog');
  } finally {
    clearTimeout(timer);
    lines.close();
    child.stdin.end();
    await Promise.race([exited, delay(3000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await Promise.race([exited, delay(3000)]);
    }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  verify(p); // Inline config must not mutate the closed baseline on disk.
  console.log('Official V2 plugin-loading smoke OK; native blocked-read execution remains pending.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
