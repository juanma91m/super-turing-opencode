// Native host + synthetic model and all MCPs. Optional real CodeGraph ONLY
// initialize/tools-list on an unindexed disposable root, never tools/call.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { layout, environment, verify } from './staging.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { knowledgeExtension } from '../../../super-turing-opencode-knowledge/v2/composition.mjs';
import { ENGRAM_TOOLS } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { ticketingExtension } from '../../../super-turing-opencode-ticketing/v2/composition.mjs';
import { ROVO_TOOLS } from '../../../super-turing-opencode-ticketing/v2/config.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { codegraphExtension } from '../../../super-turing-opencode-codegraph/v2/composition.mjs';
import { CODEGRAPH_TOOL, CODEGRAPH_ROLES } from '../../../super-turing-opencode-codegraph/v2/config.mjs';
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const fixture = name => fileURLToPath(new URL('./fixtures/' + name, import.meta.url));
const trace = new Map();
let profile, providerError;

function call(kind) {
  const input = { query: 'Trace the synthetic caller -> callee', projectPath: profile.project };
  if (kind === 'MISSING_ROOT') delete input.projectPath;
  if (kind === 'RELATIVE_ROOT') input.projectPath = '.';
  if (kind === 'UNINDEXED') input.projectPath = path.join(profile.root, 'unindexed');
  if (kind === 'SUBDIRECTORY') input.projectPath = path.join(profile.project, 'src');
  if (kind === 'SYMLINK') input.projectPath = path.join(profile.root, 'linked-project');
  return [kind === 'UNKNOWN_TOOL' ? 'codegraph_codegraph_search' : kind === 'INIT_TOOL' ? 'codegraph_codegraph_init' : CODEGRAPH_TOOL, input];
}

async function main() {
  verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/codegraph-wire-');
  const log = path.join(root, 'graph-calls.jsonl');
  const mock = http.createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 3 * 1024 * 1024); }
      const body = JSON.parse(raw), serialized = JSON.stringify(body.messages);
      const kind = serialized.match(/CGCASE_([A-Z_]+)/)?.[1]; assert(kind);
      const state = trace.get(kind) ?? { requests: 0 }; trace.set(kind, state); assert(++state.requests <= 3);
      state.tools = body.tools?.map(tool => tool.function?.name ?? tool.name) ?? [];
      state.results = body.messages.filter(message => message.role === 'tool').map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
      const selected = state.results.length ? undefined : call(kind);
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ id: 'codegraph-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (selected) {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_' + kind, type: 'function', function: { name: selected[0], arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected[1]) } }] });
      } else send({ role: 'assistant', content: 'MOCK_OK' });
      send({}, selected ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n'); state.finished = !selected;
    } catch (error) { providerError = error.message; response.writeHead(500); response.end('Synthetic failure; values suppressed'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  let server;
  const mcp = (names, file) => ({ type: 'local', command: [process.execPath, fixture('ticketing-mcp.mjs')], environment: { FIXTURE_TOOLS: JSON.stringify(names), FIXTURE_LOG: path.join(root, file) }, codemode: false });
  const prior = context => {
    const knowledge = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode',
      server: mcp(ENGRAM_TOOLS.map(name => name.slice('engram_'.length)), 'engram-calls.jsonl'), permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
    const ticketing = ticketingExtension({ server: mcp(ROVO_TOOLS.map(name => name.slice('atlassian-rovo_'.length)), 'rovo-calls.jsonl') });
    return ticketing({ ...context, ...knowledge(context) });
  };
  const options = { mock: `http://127.0.0.1:${mock.address().port}/v1`, context7: true,
    mcpFixture: { type: 'local', command: [process.execPath, fixture('context7-mcp.mjs')], environment: { CONTEXT7_FIXTURE_LOG: path.join(root, 'context7-calls.jsonl') }, codemode: false } };
  async function inspect(p) {
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-codegraph.access'), 'CodeGraph access plugin');
    await until(async () => (await get('/api/mcp')).filter(item => item.status?.status === 'connected').length === 4, 'four MCP catalogs');
    const state = await inspectCodeGraph(get, p.roles); assert.equal(state.codegraphStatus, 'connected');
    await inspectTicketing(get, p.roles);
    await inspectKnowledge(server, p, ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })), { additionalMcp: ['atlassian-rovo', 'codegraph'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access'] });
    return get;
  }
  try {
    const graph = codegraphExtension({ binding: { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' },
      server: { type: 'local', command: [process.execPath, fixture('codegraph-mcp.mjs')], environment: { FIXTURE_ROOT: path.join(root, 'home/project'), FIXTURE_LOG: log }, codemode: false } });
    profile = prepareWorkshop(root, { ...options, extend: context => graph({ ...context, ...prior(context) }) });
    // Empty sentinels for validation tests only, NOT initialized graph databases.
    fs.mkdirSync(path.join(profile.project, '.codegraph'));
    fs.mkdirSync(path.join(profile.project, 'src/.codegraph'), { recursive: true });
    fs.mkdirSync(path.join(root, 'unindexed'));
    fs.symlinkSync(profile.project, path.join(root, 'linked-project'));
    const app = fs.readFileSync(profile.editable);
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: profile.project, env: environment(profile), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'Native CodeGraph config rejected; values suppressed');
    for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep));
    server = await startServer(base.binary, profile);
    await inspect(profile);
    const count = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').length : 0;
    const cases = [
      ...CODEGRAPH_ROLES.map((role, index) => ['ALLOWED_' + String.fromCharCode(65 + index), role, true]),
      ...profile.roles.filter(role => !CODEGRAPH_ROLES.includes(role)).map((role, index) => ['DENIED_' + String.fromCharCode(65 + index), role, false]),
      ...['MISSING_ROOT', 'RELATIVE_ROOT', 'UNINDEXED', 'SUBDIRECTORY', 'SYMLINK', 'UNKNOWN_TOOL', 'INIT_TOOL', 'SESSION_DENY'].map(kind => [kind, 'planner', false]),
    ];
    for (const [kind, agent, forwarded] of cases) {
      const before = count();
      const created = await server.request('POST', '/api/session', { agent, model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: profile.project },
        ...(kind === 'SESSION_DENY' ? { permissions: [{ action: CODEGRAPH_TOOL, resource: '*', effect: 'deny' }] } : {}) });
      assert.equal(created.status, 200);
      const submitted = await server.request('POST', `/api/session/${created.value.data.id}/prompt`, { text: 'CGCASE_' + kind + '\nSynthetic CodeGraph query, no lifecycle or real data.' });
      assert.equal(submitted.status, 200);
      await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, kind, 20000);
      const state = trace.get(kind);
      assert.deepEqual(state.tools.filter(name => name.startsWith('codegraph_')), CODEGRAPH_ROLES.includes(agent) && kind !== 'SESSION_DENY' ? [CODEGRAPH_TOOL] : [], kind + ' catalog');
      assert.equal(count(), before + Number(forwarded), kind + ' forwarding');
      assert.equal(state.results.join('\n').includes('FIXTURE_CODEGRAPH_READ'), forwarded);
      assert(fs.readFileSync(profile.editable).equals(app));
      console.log('OK native CodeGraph ' + kind);
    }
    assert(!fs.existsSync(path.join(profile.project, '.codegraph/codegraph.db')));
    assert(!fs.existsSync(path.join(root, 'rovo-calls.jsonl')) && !fs.existsSync(path.join(root, 'engram-calls.jsonl')));
    await server.close(); server = undefined;
    // Separate unindexed profile: use REAL installed CodeGraph for catalog only.
    const realRoot = fs.mkdtempSync('/tmp/opencode/codegraph-catalog-');
    try {
      const home = os.homedir();
      const real = codegraphExtension({ binding: { runtime_home: home, runtime_bin: path.join(home, '.local/share/super-turing-opencode-codegraph/runtime/node_modules/.bin/codegraph') } });
      const p = prepareWorkshop(realRoot, { ...options, extend: context => real({ ...context, ...prior(context) }) });
      server = await startServer(base.binary, p);
      const get = await inspect(p);
      // Catalog is accessible to native clients; no prompt/tool call is made.
      assert((await get('/api/mcp')).some(item => item.name === 'codegraph' && item.status.status === 'connected'));
      assert(!fs.existsSync(path.join(p.project, '.codegraph')));
      assert(!fs.existsSync(path.join(p.home, '.codegraph')));
      await server.close(); server = undefined;
      console.log('OK real CodeGraph 1.5.0 native handshake/catalog; no index query');
    } finally { await server?.close(); server = undefined; fs.rmSync(realRoot, { recursive: true, force: true }); }
    console.log(JSON.stringify({ cases: cases.length, allowedActors: 5, deniedActors: profile.roles.length - 5, skills: profile.skills.length, actualIndexQueries: 0, actualIndexesCreated: 0, realJiraToolCalls: 0, otherAddonsPreserved: true, benchmarkV2Enabled: false, lifecycleEnabled: false }));
  } finally {
    await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
