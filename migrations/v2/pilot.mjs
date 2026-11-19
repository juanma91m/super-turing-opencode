import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { environment, layout, verify } from './staging.mjs';
import { preparePilot } from './pilot-profile.mjs';
import { startServer, until } from './private-server.mjs';

export async function callbackAvailable(port = 1455) {
  for (const host of ['127.0.0.1', '::1']) {
    const listener = net.createServer();
    try {
      await new Promise((resolve, reject) => {
        listener.once('error', reject);
        listener.listen({ port, host, ipv6Only: true }, resolve);
      });
    } catch (error) {
      if (host === '::1' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) continue;
      throw new Error(`El puerto OAuth ${port} no está disponible. No se detuvo ni canceló otro proceso.`);
    } finally {
      if (listener.listening) await new Promise(resolve => listener.close(resolve));
    }
  }
}

function endpoint(schema, operationID) {
  for (const [route, methods] of Object.entries(schema.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation.operationId === operationID) return [method.toUpperCase(), route];
    }
  }
  throw new Error(`Missing public API operation: ${operationID}`);
}

export async function inspectPilot(binary, p) {
  const server = await startServer(binary, p);
  try {
    const spec = await server.request('GET', '/openapi.json');
    assert.equal(spec.status, 200);
    const get = async operation => {
      const [method, route] = endpoint(spec.value, operation);
      const result = await server.request(method, route);
      assert.equal(result.status, 200, `${operation} failed`);
      return result.value.data ?? result.value;
    };
    const agents = await until(async () => {
      const result = await get('agent.list');
      return result.some(agent => agent.id === 'v2-pilot') ? result : undefined;
    }, 'pilot agent');
    const plugins = await until(async () => {
      const result = await get('plugin.list');
      return ['opencode-stack.env-guard', 'opencode-stack.v2-pilot-boundary'].every(id => result.some(plugin => plugin.id === id)) ? result : undefined;
    }, 'pilot guards');
    assert.equal(plugins.filter(plugin => plugin.source.type !== 'builtin').length, 2, 'Unexpected external plugin');
    const pilot = agents.find(agent => agent.id === 'v2-pilot');
    assert.deepEqual(pilot.model, { id: 'gpt-6.1-sol', providerID: 'openai', variant: 'high' }, 'Unexpected effective model');
    const lastDenyAll = pilot.permissions.findLastIndex(rule => rule.action === '*' && rule.resource === '*' && rule.effect === 'deny');
    assert(lastDenyAll >= 0, 'Missing effective deny-all');
    const tail = pilot.permissions.slice(lastDenyAll + 1);
    assert(tail.every(rule => ['allow', 'deny'].includes(rule.effect)), 'Unexpected ask after deny-all');
    // Native plugins may append additional denies; preserve them. Only the two
    // exact fixture read forms may be granted after the final broad deny.
    assert.deepEqual(tail.filter(rule => rule.effect === 'allow'), p.document.permissions.slice(1), 'Unexpected effective allows');
    const sources = await get('config.get');
    for (const source of sources) assert(source.path.startsWith(p.root + path.sep), 'Foreign config source discovered');
    const mcp = await get('mcp.list');
    assert.equal(mcp.length, 0, 'Unexpected MCP server');
    const skills = await get('skill.list');
    assert.equal(skills.length, 0, 'Unexpected skill');
    const integrations = await get('integration.list');
    const openai = integrations.find(integration => integration.id === 'openai');
    // Metadata only: do not resolve credentials or print integration/account data.
    return {
      version: '2.2.7', agent: 'v2-pilot', model: 'openai/gpt-6.1-sol#high',
      guardCount: plugins.filter(plugin => plugin.id.startsWith('opencode-stack.')).length,
      mcpCount: mcp.length, skillCount: skills.length,
      connected: Boolean(openai?.connections?.length),
      browserLoginAvailable: Boolean(openai?.methods?.some(method => method.id === 'chatgpt-browser')),
      primaryAgents: agents.filter(agent => agent.mode === 'primary' && !agent.hidden && !agent.disabled).map(agent => agent.id),
    };
  } finally { await server.close(); }
}

export function interactiveEnv(p) {
  const env = environment(p);
  // Operator-selected diagnostic only; never inherit arbitrary OPENTUI_*.
  if (p.notificationProtocol !== undefined) {
    assert.equal(p.notificationProtocol, 'osc777', 'Unsupported pilot notification protocol');
    env.OPENTUI_NOTIFICATION_PROTOCOL = p.notificationProtocol;
  }
  // Local desktop transport only, for browser/clipboard. No keys, endpoints,
  // shell preloads or arbitrary OPENCODE_* variables inherited from the caller.
  for (const name of ['DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_SESSION_TYPE', 'XAUTHORITY', 'COLORTERM', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'VTE_VERSION']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  return env;
}

export async function interactive(binary, p, args) {
  const child = spawn(binary, args, { cwd: p.project, env: interactiveEnv(p), stdio: 'inherit' });
  // Forward terminal interrupts only to this child, never kill by name/PID search.
  const interrupt = () => child.kill('SIGINT');
  process.on('SIGINT', interrupt);
  try {
    await new Promise((resolve, reject) => {
      child.once('error', () => reject(new Error('No se pudo iniciar el cliente oficial')));
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`El cliente terminó con código ${code}`)));
    });
  } finally { process.off('SIGINT', interrupt); }
}

async function main() {
  const action = process.argv[2];
  assert.equal(process.argv.length, 3, 'Uso: node pilot.mjs prepare|verify|login|chat');
  assert(['prepare', 'verify', 'login', 'chat'].includes(action), 'Acción desconocida');
  if (['login', 'chat'].includes(action)) assert(process.stdin.isTTY && process.stdout.isTTY, 'Login/chat requieren tu terminal interactiva; no se ejecutan desde tools ni logs');
  const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  verify(base);
  const p = preparePilot(path.join(base.root, 'pilot'));
  if (action === 'prepare') {
    console.log(JSON.stringify({ profile: p.root, project: p.project, runtime: 'official 2.2.7', credentialCopy: false }));
    return;
  }
  const status = await inspectPilot(base.binary, p);
  if (action === 'verify') { console.log(JSON.stringify(status, null, 2)); return; }
  if (action === 'login') {
    assert(status.browserLoginAvailable, 'El método ChatGPT browser no está disponible en este perfil');
    await callbackAvailable(); // Check only; never invoke /cancel on another login.
    await interactive(base.binary, p, ['auth', 'login', 'openai', '--method', 'chatgpt-browser', '--standalone']);
    console.log('Login finalizado. Verificá el perfil con: node migrations/v2/pilot.mjs verify');
  } else {
    assert(status.connected, 'Primero iniciá sesión: node migrations/v2/pilot.mjs login');
    await interactive(base.binary, p, ['--standalone']);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
