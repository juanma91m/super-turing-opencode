import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { checkCandidate } from '../lifecycle.mjs';
import { inspectStartup, terminalEnvironment } from '../launch.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';

const binary = process.env.OPENCODE_TEST_MCP_STARTUP_TUI;
test('native TUI starts with zero connected MCPs; each joins without waiting for its siblings', {
  skip: !binary, timeout: 45000,
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-startup-tui-'));
  const project = path.join(root, 'project');
  const slowGate = path.join(root, 'release-slow-mcp');
  const fastGate = path.join(root, 'release-fast-mcp');
  const fixture = path.join(root, 'stdio-fixture.mjs');
  const socket = `mcp-startup-${process.pid}-${path.basename(root)}`;
  let server, terminal, lastStates;
  const tm = (...args) => spawnSync('tmux', ['-L', socket, ...args], {
    encoding: 'utf8', env: terminal,
  });
  const grab = () => tm('capture-pane', '-p', '-t', 'startup').stdout ?? '';
  try {
    fs.mkdirSync(project);
    fs.writeFileSync(fixture, `
import fs from 'node:fs';
import readline from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
const [gate] = process.argv.slice(2);
for await (const line of readline.createInterface({ input: process.stdin })) {
  const message = JSON.parse(line);
  if (!Object.hasOwn(message, 'id')) continue;
  let result;
  if (message.method === 'initialize') {
    while (gate && !fs.existsSync(gate)) await delay(25);
    result = { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } };
  } else if (message.method === 'tools/list') {
    result = { tools: [] };
  } else {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Unsupported fixture method' } })+'\\n');
    continue;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result })+'\\n');
}
`);
    const contribution = { id: 'mcp-startup-fixture', apply(ctx) {
      for (const [name, command] of Object.entries({
        slow: [process.execPath, fixture, slowGate],
        fast: [process.execPath, fixture, fastGate],
        failed: [process.execPath, '-e', 'process.exit(1)'],
      })) {
        ctx.document.mcp.servers[name] = { type: 'local', command, codemode: false, timeout: { startup: 30000 } };
        ctx.document.policies.push({ action: 'mcp.use', resource: name, effect: 'allow' });
      }
    }};
    const profile = prepareGeneral(path.join(root, 'profile'), {
      project, mock: 'http://127.0.0.1:1/v1', contributions: [contribution],
    });
    checkCandidate(profile, { binary }, { generalOnly: true });
    server = await startOwnedServer(binary, profile, generalEnvironment);
    const nativeRequest = server.request;
    const requested = [];
    const ready = await inspectStartup({ request(method, route) {
      requested.push(route);
      return nativeRequest(method, route);
    } }, profile);
    assert.equal(ready.readyForStartup, true);
    assert(requested.includes('/api/agent') && requested.every(route => ['/api/plugin', '/api/agent'].includes(route)));
    const quote = s => `'${s.replaceAll("'", "'\"'\"'")}'`;
    terminal = { ...terminalEnvironment(profile, server.connection), SHELL: '/bin/sh', TMUX: '' };
    const command = [binary, '--server', server.connection.url].map(quote).join(' ');
    assert.equal(tm('-f', '/dev/null', 'new-session', '-d', '-s', 'startup', '-x', '130', '-y', '40', '-c', project,
      `${command}; sleep 10`).status, 0);
    await until(() => /Ask anything|shift\+tab agents/i.test(grab()), 'TUI opens without either MCP', 12000);
    assert(!fs.existsSync(slowGate) && !fs.existsSync(fastGate));
    const states = async () => {
      const response = await nativeRequest('GET', '/api/mcp');
      assert.equal(response.status, 200);
      lastStates = Object.fromEntries((response.value.data ?? response.value).map(row => [row.name, row.status.status]));
      return lastStates;
    };
    const pending = status => ['pending', 'connecting'].includes(status);
    await until(async () => {
      const status = await states();
      return pending(status.slow) && pending(status.fast) && status.failed === 'failed';
    }, 'no MCP connected and independent failure', 6000);
    fs.writeFileSync(fastGate, 'released');
    await until(async () => {
      const status = await states();
      return pending(status.slow) && status.fast === 'connected' && status.failed === 'failed';
    }, 'slow pending, sibling ready and independent failure', 6000);
    fs.writeFileSync(slowGate, 'released');
    await until(async () => (await states()).slow === 'connected', 'slow MCP goes live without opening another TUI', 6000);
    assert.match(grab(), /Ask anything|shift\+tab agents/i);
  } catch (error) {
    console.error('Fixture states:', lastStates);
    console.error(grab().replaceAll(root, '<fixture>'));
    throw error;
  } finally {
    tm('kill-server');
    await server?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
