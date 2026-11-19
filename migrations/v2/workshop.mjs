import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, noSymlinks, verify } from './staging.mjs';
import { roles, readonly, prepareWorkshop } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';
import { interactive } from './pilot.mjs';
import { CONTEXT7_TOOLS, CONTEXT7_URL } from './context7-policy.mjs';

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const desktopPackage = fileURLToPath(new URL('../../../super-turing-opencode-notifier/v2/desktop/', import.meta.url)).replace(/\/$/, '');
const effect = (rules, action) => rules.findLast(rule => (rule.action === '*' || rule.action === action) && rule.resource === '*')?.effect;

async function inspect(binary, p) {
  const server = await startServer(binary, p);
  try {
    const get = async route => {
      const result = await server.request('GET', route);
      assert.equal(result.status, 200);
      return result.value.data ?? result.value;
    };
    const agents = await until(async () => {
      const data = await get('/api/agent');
      return roles.every(id => data.some(agent => agent.id === id)) ? data : undefined;
    }, 'base agents');
    const plugins = await until(async () => {
      const data = await get('/api/plugin');
      return data.filter(plugin => plugin.source.type !== 'builtin').length === 5 ? data : undefined;
    }, 'five stack adapters');
    const expected = ['env-guard', 'controlled-permissions', 'planner-shell', 'agent-identity', 'workshop-boundary'];
    assert.deepEqual(plugins.filter(plugin => plugin.source.type !== 'builtin').map(plugin => plugin.id).sort(), expected.map(id => `opencode-stack.${id}`).sort());
    for (const id of roles) {
      const agent = agents.find(agent => agent.id === id);
      assert.equal(agent.model.providerID, 'openai'); assert.equal(agent.model.id, 'gpt-6.1-sol');
      assert.equal(agent.model.variant, ['master-dev', 'planner', 'agent-design'].includes(id) ? 'high' : 'medium', `${id} default variant`);
      assert.equal(effect(agent.permissions, 'edit'), readonly.includes(id) ? 'deny' : 'allow', `${id} write policy`);
      for (const tool of CONTEXT7_TOOLS) assert.equal(effect(agent.permissions, tool), 'allow', `${id} documentation permission`);
      assert.equal(effect(agent.permissions, 'context7_unapproved-operation'), 'deny', `${id} unapproved MCP permission`);
    }
    for (const source of await get('/api/config')) assert(source.path.startsWith(p.root + path.sep), 'Foreign config source');
    const mcp = await until(async () => {
      const data = await get('/api/mcp');
      assert(data.length <= 1 && data.every(server => server.name === 'context7'), 'Unexpected MCP server');
      const server = data[0];
      if (server && !['pending', 'connecting'].includes(server.status?.status)) return data;
    }, 'Context7 connection', 45000);
    assert.equal(mcp[0].status.status, 'connected', 'Context7 connection failed; no silent fallback');
    const skills = await get('/api/skill');
    assert(p.skills.every(id => skills.some(skill => skill.id === id)), 'Missing base skill');
    const integrations = await get('/api/integration');
    const cli = JSON.parse(fs.readFileSync(path.join(p.config, 'opencode/cli.json'), 'utf8'));
    return { version: '2.2.7', defaultAgent: 'master-dev', agents: roles.length, baseSkills: p.skills.length, adapters: 5, mcpCount: mcp.length,
      context7: { status: 'connected', transport: 'remote HTTP', url: CONTEXT7_URL, allowedTools: CONTEXT7_TOOLS },
      connected: Boolean(integrations.find(integration => integration.id === 'openai')?.connections?.length),
      sharedAuth: 'existing V2 pilot native storage; no credential copying', project: p.project,
      alerts: { notifications: p.tuiBackend === 'libnotify' || (cli.attention?.notifications ?? false), nativeNotifications: cli.attention?.notifications ?? false, sound: cli.attention?.sound ?? false, backend: p.tuiBackend === 'libnotify' ? 'TUI addon / notify-send (libnotify)' : 'builtin opencode.notifications / terminal', focusPolicy: p.tuiBackend === 'libnotify' ? 'always' : 'blurred', desktopDelivery: 'not checked by verify' },
      selectableAgents: agents.filter(agent => roles.includes(agent.id) && ['primary', 'all'].includes(agent.mode)).map(agent => agent.id),
      editable: 'app/message.txt' };
  } finally { await server.close(); }
}

async function main() {
  const action = process.argv[2];
  const protocol = process.argv[3];
  assert(['prepare', 'verify', 'chat'].includes(action) && (process.argv.length === 3 || process.argv.length === 4 && ['verify', 'chat'].includes(action) && protocol === '--notification-protocol=osc777'), 'Uso: node workshop.mjs prepare|verify|chat [--notification-protocol=osc777]');
  if (action === 'chat') assert(process.stdin.isTTY && process.stdout.isTTY, 'Chat requiere tu terminal interactiva');
  const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  assert(!fs.existsSync(path.join(base.root, 'workshop/.knowledge-v2-enabled.json')), 'Knowledge ya está incorporado: usá migrations/v2/knowledge.mjs verify|chat para conservar esa composición');
  verify(base);
  const first = layout(path.join(base.root, 'pilot'));
  noSymlinks(first.marker);
  assert.equal(JSON.parse(fs.readFileSync(first.marker, 'utf8')).owner, 'opencode-stack');
  const firstFiles = [path.join(first.config, 'opencode/opencode.json'), path.join(first.project, 'fixture-readme.txt'), path.join(first.root, 'fixture.sha256')];
  const before = firstFiles.map(sha);
  const p = prepareWorkshop(path.join(base.root, 'workshop'), { shared: first, context7: true, approvedTuiPackage: desktopPackage });
  assert(!protocol || p.tuiBackend === 'native', 'El adaptador libnotify no usa OSC; omití --notification-protocol');
  if (protocol) p.notificationProtocol = 'osc777';
  const result = await inspect(base.binary, p);
  result.alerts.notificationProtocol = p.tuiBackend === 'libnotify' ? 'not used (libnotify)' : p.notificationProtocol ?? 'auto';
  assert.deepEqual(firstFiles.map(sha), before, 'First pilot assets changed');
  if (action !== 'chat') { console.log(JSON.stringify(result, null, 2)); return; }
  assert(result.connected, 'No se encontró el login V2 anterior; no se copian credenciales. Revisar el piloto inicial.');
  await interactive(base.binary, p, ['--standalone']);
  assert.deepEqual(firstFiles.map(sha), before, 'First pilot assets changed');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
