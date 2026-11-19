// Public native host, owned by this invocation only. Never log auth-bearing
// stdout/stderr or serialize the ephemeral connection environment.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function startOwnedServer(binary, paths, environment) {
  assert(typeof environment === 'function', 'Explicit native host environment required');
  const password = randomUUID(), env = { ...environment(paths), OPENCODE_PASSWORD: password, OPENCODE_STACK_TRANSPORT_FD: '3' };
  const child = spawn(binary, ['serve', '--stdio', '--hostname', '127.0.0.1', '--port', '0'], { cwd: paths.project, env, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {}); // Owned process may close before stdin drains.
  child.stdio[3].on('error', () => {});
  const exited = new Promise(resolve => { child.once('exit', resolve); child.once('error', resolve); });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout });
  async function close() {
    lines.close(); child.stdin.end(); child.stdio[3].destroy();
    await Promise.race([exited, delay(2000)]);
    for (const signal of ['SIGTERM', 'SIGKILL']) if (child.exitCode === null && child.signalCode === null) { child.kill(signal); await Promise.race([exited, delay(2000)]); }
    await exited;
  }
  let timer;
  try {
    const ready = await Promise.race([(async () => {
      for await (const line of lines) { let record; try { record = JSON.parse(line); } catch { continue; } if (typeof record.url === 'string') return record.url; }
      throw new Error('Owned native host exited before readiness');
    })(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned native host readiness timeout')), 15000); })]);
    const url = new URL(ready);
    assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password, 'Owned loopback endpoint required');
    // Public HTTP-only APIs are not all exposed by Plugin.Context in 2.2.7.
    // Explicit parent-to-server pipe, not an auth file or inheritable secret env.
    // The plugin reads/closes it once and retains the connection only in RAM.
    child.stdio[3].end(JSON.stringify({ version: 1, pid: child.pid, url: ready, password }));
    const request = async (method, endpoint, body) => {
      assert(endpoint.startsWith('/') && !endpoint.startsWith('//'));
      const response = await fetch(new URL(endpoint, url), { method, redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      let value; try { value = await response.json(); } catch {}
      return { status: response.status, value };
    };
    return { request, close, connection: { url: ready, env } };
  } catch (error) { await close(); throw error; } finally { clearTimeout(timer); }
}

export async function until(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const result = await check(); if (result) return result; await delay(100); }
  throw new Error('Timed out: ' + label);
}
