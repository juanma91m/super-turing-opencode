import assert from 'node:assert/strict';
import path from 'node:path';
import { until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { ENGRAM_TOOLS, READER_DENIED } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';

const effect = (rules, action) => rules.findLast(rule => (rule.action === '*' || rule.action === action) && rule.resource === '*')?.effect;

// Shared by the live launcher and native fixture: the smoke must exercise the
// actual post-apply verification path, not a second partial implementation.
export async function inspectKnowledge(server, p, permissions, { additionalMcp = [], additionalPlugins = [], rolePermissionOverrides = {} } = {}) {
  const get = route => getApiList(server.request, route);
  const agents = await until(async () => { const items = await get('/api/agent'); return p.roles.every(id => items.some(item => item.id === id)) ? items : undefined; }, 'Knowledge agents');
  for (const id of p.roles) for (const tool of ENGRAM_TOOLS) {
    assert.equal(effect(agents.find(agent => agent.id === id).permissions, tool), rolePermissionOverrides[id]?.[tool] ?? (id === 'knowledge-reader' && READER_DENIED.includes(tool) ? 'deny' : permissions.find(rule => rule.action === tool).effect), `${id} ${tool} permission`);
  }
  const disabled = p.document.mcp.servers.engram.disabled === true;
  const mcp = await until(async () => {
    const entries = await get('/api/mcp');
    assert(entries.every(entry => ['context7', 'engram', ...additionalMcp].includes(entry.name)), 'Unexpected MCP');
    const expected = [...(disabled ? ['context7'] : ['context7', 'engram']), ...additionalMcp.filter(name => p.document.mcp.servers[name]?.disabled !== true)];
    return expected.every(name => entries.some(entry => entry.name === name)) && entries.every(entry => !['pending', 'connecting'].includes(entry.status?.status)) ? entries : undefined;
  }, 'Knowledge MCP connections', 45000);
  for (const entry of mcp) {
    if (additionalMcp.includes(entry.name)) continue; // The owning addon diagnoses its auth/readiness.
    if (disabled && entry.name === 'engram') assert.notEqual(entry.status.status, 'connected', 'Disabled Engram was activated');
    else assert.equal(entry.status.status, 'connected', `${entry.name} did not connect`);
  }
  const skills = await get('/api/skill'); assert(p.skills.every(id => skills.some(item => item.id === id)), 'Missing skill');
  const commands = await get('/api/command'); assert(['memory-init', 'knowledge-search', 'knowledge-status', 'knowledge-store-global', 'knowledge-index-global'].every(name => commands.some(command => command.name === name)), 'Missing command');
  for (const source of await get('/api/config')) assert(typeof source.path === 'string' && source.path.startsWith(p.root + path.sep), 'Foreign config source');
  const plugins = await until(async () => { const items = await get('/api/plugin'); return items.some(item => item.id === 'opencode-knowledge.engram') ? items : undefined; }, 'Knowledge plugin');
  assert.equal(plugins.filter(plugin => plugin.source.type !== 'builtin').length, 6 + additionalPlugins.length);
  for (const id of additionalPlugins) assert(plugins.some(plugin => plugin.id === id), 'Missing addon plugin');
  const integrations = await get('/api/integration');
  return { version: '2.2.7', agents: p.roles.length, skills: p.skills.length, knowledgeCommands: 5, engram: disabled ? 'disabled; current setting preserved' : 'connected; existing backend', context7: 'connected',
    qdrant: 'wrappers staged; backend status/query require the manual test', auth: 'existing V2 pilot native storage; not copied', alerts: p.tuiBackend,
    connected: Boolean(integrations.find(item => item.id === 'openai')?.connections?.length),
    delegations: 'workshop boundary remains closed; canonical role grants preserved', realModelRequests: 0, automaticIndexing: false, storesCopied: false };
}
