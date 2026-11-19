import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { nativeAddonFixture } from './fixtures/general-addon-stack.mjs';
import { prepareGeneral, generalEnvironment } from '../../v2/general/profile.mjs';
import { effect } from '../../v2/general/policy.mjs';
import { layout } from './staging.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { documentSpec } from '../../../super-turing-opencode-documents/v2/documenter/fixture-specs.mjs';

const root = fs.mkdtempSync('/tmp/opencode/general-composed-'), project = path.join(root, 'project');
fs.mkdirSync(path.join(project, 'artifact-studio'), { recursive: true }); fs.mkdirSync(path.join(project, 'fixtures'));
fs.mkdirSync(path.join(project, '.codegraph'));
fs.writeFileSync(path.join(project, 'fixtures/input.txt'), 'PUBLIC_SYNTHETIC_DOCUMENT\n');
fs.writeFileSync(path.join(project, 'app.txt'), 'Application unchanged\n');
assert.equal(spawnSync('/usr/bin/git', ['init', '--quiet'], { cwd: project, env: { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).status, 0);
const control = path.join(root, 'control'); fs.mkdirSync(control);
fs.writeFileSync(path.join(control, 'package.json'), '{"type":"module"}');
fs.writeFileSync(path.join(control, 'index.ts'), 'import {Plugin} from "@opencode/plugin"; export default Plugin.define({id:"fixture.general-control",async setup(ctx){await ctx.session.hook("title",e=>{e.result="Synthetic composed candidate"});await ctx.session.hook("context",e=>{e.system.push({type:"text",text:"SYNTHETIC_ORGANIZATION_LAYER; retain global and project contracts."})})}});');
fs.writeFileSync(path.join(project, 'AGENTS.md'), '# SYNTHETIC_PROJECT_LENS\nKeep project-only constraints here.\n');
const fixtures = nativeAddonFixture(root), trace = new Map();
let profile, server, providerError;
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const broker = args => 'python3 ' + profile.broker + ' ' + args;
function select(kind, results) {
  if (kind === 'HANDOFF') return [
    ['shell', { command: broker('helper jira verdict TST-101 --content ' + quote('## Estado actual\nSynthetic requested local handoff.\n')) }],
    ['read', { path: 'tmp/TST-101/verdict.md' }],
  ][results.length];
  if (results.length) return undefined;
  if (kind === 'LAYER_AUDIT' || kind === 'LAYER_AUDIT_DENY') return ['stack-layer-audit', {}];
  if (kind === 'LAYER_PROPOSE' || kind === 'LAYER_PROPOSE_DENY') return ['stack-layer-scaffold', { deltas: { reviewer: { permissions: [{ action: 'shell', resource: 'git show *', effect: 'deny' }] } } }];
  if (kind === 'CONTEXT7') return ['context7_resolve-library-id', { libraryName: 'Node.js', query: 'Public documentation for Node.js streams' }];
  if (kind === 'CONTEXT7_PRIVATE') return ['context7_query-docs', { libraryId: '/nodejs/node', query: '<private>synthetic marker must be refused</private>' }];
  if (['MEMORY_SEARCH', 'READER_SEARCH', 'CHILD_MEMORY'].includes(kind)) return ['engram_mem_search', { query: 'synthetic approved integration context' }];
  if (['MEMORY_SAVE', 'READER_SAVE', 'READER_SAVE_OVERRIDE', 'QA_SAVE'].includes(kind)) return ['engram_mem_save', { title: 'Synthetic only', content: 'Fixture backend; not real durable memory' }];
  if (kind === 'MEMORY_SUMMARY') return ['engram_mem_session_summary', { content: 'Synthetic integration summary' }];
  if (kind === 'QDRANT_STATUS') return ['shell', { command: 'bash ' + profile.config + '/opencode/scripts/knowledge_status.sh --qdrant-only' }];
  if (kind === 'PLANNER_CORPUS') return ['shell', { command: broker('helper knowledge-search --query ' + quote('public synthetic corpus')) }];
  if (['CURATOR_STORE', 'READER_STORE', 'READER_STORE_OVERRIDE'].includes(kind)) return ['shell', { command: 'bash ' + profile.config + '/opencode/scripts/knowledge_store.sh store-text --title Synthetic --text ' + quote('Only the fake Qdrant interpreter receives this') }];
  if (kind === 'ROVO_ISSUE' || kind === 'ROVO_MASTER') return ['atlassian-rovo_getJiraIssue', { cloudId: 'fixture', issueIdOrKey: 'TST-101' }];
  if (kind === 'ROVO_MUTATION') return ['atlassian-rovo_updateConfluenceContent', { id: 'fixture', body: 'MUST_NOT_FORWARD' }];
  if (kind === 'GRAPH' || kind === 'GRAPH_ROOT_DENY') return ['codegraph_codegraph_explore', { projectPath: kind === 'GRAPH' ? project : '../relative', query: 'synthetic symbol' }];
  if (kind === 'GRAPH_INIT') return ['codegraph_init', { projectPath: project }];
  if (kind === 'BROWSER' || kind === 'BROWSER_ACTOR') return ['playwright_browser_navigate', { url: 'http://127.0.0.1:1/synthetic' }];
  if (kind === 'BROWSER_UNSAFE') return ['playwright_browser_run_code_unsafe', { code: 'MUST_NOT_EXECUTE' }];
  if (kind === 'DOC_WRITE') return ['write', { path: 'artifact-studio/spec.json', content: JSON.stringify(documentSpec, null, 2) + '\n' }];
  if (kind === 'DOC_PROJECT_EDIT') return ['write', { path: 'app.txt', content: 'Documenter V1 edit allowed\n' }];
  if (kind === 'DOC_SHELL') return ['shell', { command: 'node --version' }];
  if (kind === 'PLAN_SHELL_OVERRIDE') return ['shell', { command: 'node --version' }];
  if (kind === 'DOC_VALIDATE') return ['artifact-validate', { input: 'artifact-studio/spec.json', kind: 'spec' }];
  if (kind === 'QA_RENDER') return ['artifact-render', { spec: 'artifact-studio/spec.json', format: 'pdf' }];
  if (kind === 'CANVAS_STATUS') return ['excalidraw-canvas', { action: 'status' }];
  if (kind === 'READER_DOCUMENT') return ['shell', { command: broker('helper document-review --source fixtures/input.txt') }];
  if (kind === 'TECH_DELEGATE' || kind === 'PLANNER_DELEGATE') return ['subagent', { agent: 'knowledge-reader', description: 'Bounded synthetic memory read', prompt: 'ACASE_CHILD_MEMORY\nSearch the fake Engram backend once, then return SYNTHETIC_CHILD_MEMORY.', background: false }];
  if (kind === 'DOC_DELEGATE') return ['subagent', { agent: 'visual-qa', description: 'Verify independent document specialist route', prompt: 'ACASE_CHILD_QA\nRead artifact-studio/spec.json; return ROUTING_ONLY_NOT_VISUAL_APPROVAL. No render, delegation or approval.', background: false }];
  if (kind === 'CHILD_QA') return ['read', { path: 'artifact-studio/spec.json' }];
  throw new Error('Unknown composed fixture case: ' + kind);
}
function text(value) {
  if (typeof value === 'string') { try { return text(JSON.parse(value)); } catch { return value; } }
  if (Array.isArray(value)) return value.map(text).join('\n');
  if (value?.error) return JSON.stringify(value.error);
  if (value?.text !== undefined) return text(value.text);
  if (value?.content !== undefined) return text(value.content);
  return JSON.stringify(value);
}
const mock = http.createServer(async (request, response) => {
  try {
    let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 12 * 1024 * 1024); }
    const body = JSON.parse(raw), system = JSON.stringify(body.messages.filter(message => message.role === 'system'));
    const requested = [...JSON.stringify(body.messages.filter(message => message.role === 'user').at(-1)).matchAll(/ACASE_([A-Z0-9_]+)/g)].at(-1)?.[1];
    const reader = system.includes('currently operating as the \\"knowledge-reader\\" agent') && !['READER_SEARCH', 'READER_SAVE', 'READER_SAVE_OVERRIDE', 'READER_STORE', 'READER_STORE_OVERRIDE', 'QDRANT_STATUS'].includes(requested);
    const qa = system.includes('currently operating as the \\"visual-qa\\" agent') && !['QA_SAVE', 'QA_RENDER'].includes(requested);
    const kind = reader ? 'CHILD_MEMORY' : qa ? 'CHILD_QA' : requested; assert(kind);
    const state = trace.get(kind) ?? { requests: 0 }; trace.set(kind, state); assert(++state.requests <= 12, kind);
    state.results = body.messages.filter(message => message.role === 'tool' && message.tool_call_id?.startsWith('call_' + kind + '_')).map(message => text(message.content));
    state.tools = body.tools?.map(item => (item.function ?? item).name) ?? [];
    state.layers = system.includes('SYNTHETIC_ORGANIZATION_LAYER') && system.includes('SYNTHETIC_PROJECT_LENS');
    const selected = select(kind, state.results);
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (delta, finish_reason = null) => response.write('data: ' + JSON.stringify({ id: 'general-addons-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
    if (selected) {
      send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_' + kind + '_' + state.results.length, type: 'function', function: { name: selected[0], arguments: '' } }] });
      send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected[1]) } }] });
    } else send({ role: 'assistant', content: kind === 'CHILD_QA' ? 'ROUTING_ONLY_NOT_VISUAL_APPROVAL' : kind === 'CHILD_MEMORY' ? 'SYNTHETIC_CHILD_MEMORY' : 'FIXTURE_OK' });
    send({}, selected ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n'); state.finished = !selected;
  } catch (error) { providerError = error.message; response.writeHead(500); response.end('Synthetic fixture failure'); }
});

async function main() {
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  try {
    const maintenanceModels = Object.fromEntries(['title', 'summary', 'compaction'].map(id => [id, { model: 'workshop-mock/mock#' + (id === 'title' ? 'low' : 'medium') }]));
    profile = prepareGeneral(path.join(root, 'profile'), { project, runtimeHome: fixtures.runtimeHome, mock: `http://127.0.0.1:${mock.address().port}/v1`, maintenanceModels, plugins: [control], contributions: fixtures.contributions });
    const binary = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary;
    const startup = path.join(root, 'debug-mcp-startups.txt');
    const debugDocument = structuredClone(profile.document);
    for (const entry of Object.values(debugDocument.mcp.servers)) entry.environment.FIXTURE_STARTUP_LOG = startup;
    fs.writeFileSync(path.join(profile.config, 'opencode/opencode.json'), JSON.stringify(debugDocument));
    const debug = spawnSync(binary, ['debug', 'config', '--standalone'], { cwd: project, env: generalEnvironment(profile, {}), encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(debug.status, 0, 'Native composed config rejected; output suppressed');
    assert(!fs.existsSync(startup), 'Source-only discovery must not initialize fixture MCPs');
    console.log(JSON.stringify({ debugConfigStartedMcp: fs.existsSync(startup) }));
    const debugAgents = spawnSync(binary, ['debug', 'agents', '--standalone'], { cwd: project, env: generalEnvironment(profile, {}), encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(debugAgents.status, 0, 'Native agent debug rejected; output suppressed');
    assert(fs.existsSync(startup), 'Pin-specific debug agents startup behavior changed; review auditor contract');
    console.log(JSON.stringify({ debugAgentsStartedMcp: fs.existsSync(startup), agentsDebugShape: Array.isArray(JSON.parse(debugAgents.stdout)) ? 'array' : Object.keys(JSON.parse(debugAgents.stdout)) }));
    fs.writeFileSync(path.join(profile.config, 'opencode/opencode.json'), JSON.stringify(debugDocument, null, 2) + '\n');
    server = await startServer(binary, profile, undefined, { environment: p => generalEnvironment(p, {}) });
    const get = route => getApiList(server.request, route);
    for (const id of ['opencode-stack.general', 'opencode-stack.context7-access', 'opencode-knowledge.engram', 'opencode-knowledge.runtime-env', 'opencode-ticketing.titles', 'opencode-codegraph.access', 'opencode-stack.playwright-access', 'opencode-documents.native']) await until(async () => (await get('/api/plugin')).some(plugin => plugin.id === id), id);
    const mcps = await until(async () => { const items = await get('/api/mcp'); return items.length === 5 && items.every(item => item.status?.status === 'connected') ? items : undefined; }, 'Five fixture MCP connections');
    const agents = await get('/api/agent');
    for (const id of ['plan', 'build']) assert(agents.find(agent => agent.id === id).hidden);
    assert.equal(effect(agents.find(agent => agent.id === 'knowledge-reader').permissions, 'engram_mem_save'), 'deny');
    assert.equal(effect(agents.find(agent => agent.id === 'planner').permissions, 'subagent', 'knowledge-reader'), 'allow');
    assert.equal(effect(agents.find(agent => agent.id === 'documenter').permissions, 'edit', 'artifact-studio/spec.json'), 'allow');
    assert.equal(effect(agents.find(agent => agent.id === 'documenter').permissions, 'edit', 'app.txt'), 'allow');
    const commands = await get('/api/command'); for (const name of profile.commands) assert(commands.some(command => command.name === name));
    const deniedCases = new Set(['LAYER_AUDIT_DENY', 'LAYER_PROPOSE_DENY', 'CONTEXT7_PRIVATE', 'READER_SAVE', 'READER_SAVE_OVERRIDE', 'QA_SAVE', 'READER_STORE', 'READER_STORE_OVERRIDE', 'ROVO_MASTER', 'ROVO_MUTATION', 'GRAPH_ROOT_DENY', 'GRAPH_INIT', 'BROWSER_ACTOR', 'BROWSER_UNSAFE', 'DOC_SHELL', 'QA_RENDER', 'PLAN_SHELL_OVERRIDE']);
    async function execute(kind, agent = 'master-dev', permissions) {
      const created = await server.request('POST', '/api/session', { agent, location: { directory: project }, model: { providerID: 'workshop-mock', id: 'mock' }, ...(permissions ? { permissions } : {}) }); assert.equal(created.status, 200);
      const id = created.value.data.id;
      assert.equal((await server.request('POST', `/api/session/${id}/prompt`, { text: 'ACASE_' + kind + '\nExplicitly requested bounded synthetic operation, no real backends/credentials. Handoff only if this case explicitly requests writing local handoff metadata.' })).status, 200);
      try { await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, kind, 90000); }
      catch (error) { const result = await server.request('GET', `/api/session/${id}/context`); console.log(JSON.stringify(result.value?.data?.filter(message => message.type === 'idle' && message.error).map(message => message.error))); throw error; }
      const state = trace.get(kind), errors = state.results.filter(value => { try { return ['unknown', 'tool.execution', 'permission.rejected', 'validation'].includes(JSON.parse(value).type); } catch { return false; } });
      if (deniedCases.has(kind)) assert(errors.length, kind + ': expected refusal, got ' + state.results.join('\n'));
      else assert.equal(errors.length, 0, kind + ': ' + errors.join('\n'));
      if (kind === 'DOC_PROJECT_EDIT') {
        assert.equal(fs.readFileSync(path.join(project, 'app.txt'), 'utf8'), 'Documenter V1 edit allowed\n');
        fs.writeFileSync(path.join(project, 'app.txt'), 'Application unchanged\n');
      } else assert.equal(fs.readFileSync(path.join(project, 'app.txt'), 'utf8'), 'Application unchanged\n');
      assert(state.layers, 'Organization/project context lost: ' + kind);
      console.log('OK native general addons ' + kind); return { ...state, sessionID: id };
    }
    const startupBeforeAudit = fs.readFileSync(startup, 'utf8');
    const audited = JSON.parse((await execute('LAYER_AUDIT', 'agent-design')).results[0]);
    assert.equal(audited.status, 'pass', JSON.stringify(audited.findings));
    assert.equal(audited.agents.length, 22); assert(audited.agents.every(agent => agent.globalPromptRetained));
    for (const id of ['title', 'summary', 'compaction']) assert(audited.builtins.some(agent => agent.id === id && agent.explicitModelCompared && !agent.modelChanged));
    assert.equal(fs.readFileSync(startup, 'utf8'), startupBeforeAudit, 'Live audit must not start additional MCP processes');
    const proposed = JSON.parse((await execute('LAYER_PROPOSE', 'agent-design')).results[0]);
    assert.equal(proposed.writesPerformed, 0); assert(!fs.existsSync(path.join(project, '.opencode')));
    await execute('LAYER_AUDIT_DENY', 'planner', [{ action: 'stack-layer-audit', resource: '*', effect: 'allow' }]);
    await execute('LAYER_PROPOSE_DENY', 'master-dev', [{ action: 'stack-layer-scaffold', resource: '*', effect: 'allow' }]);
    await execute('CONTEXT7'); await execute('CONTEXT7_PRIVATE');
    await execute('MEMORY_SEARCH'); await execute('MEMORY_SAVE');
    const summary = await execute('MEMORY_SUMMARY'); assert(summary.results.join('\n').includes(summary.sessionID));
    await execute('READER_SEARCH', 'knowledge-reader'); await execute('READER_SAVE', 'knowledge-reader');
    await execute('READER_SAVE_OVERRIDE', 'knowledge-reader', [{ action: 'engram_mem_save', resource: '*', effect: 'allow' }]);
    await execute('QA_SAVE', 'visual-qa');
    const status = await execute('QDRANT_STATUS', 'knowledge-reader');
    const report = JSON.parse(status.results[0]); assert.equal(report.home, fixtures.runtimeHome); assert.equal(report.model, 'fixture-model'); assert.equal(report.hostSecretPresent, false);
    await execute('PLANNER_CORPUS', 'planner');
    await execute('PLAN_SHELL_OVERRIDE', 'plan', [{ action: 'shell', resource: '*', effect: 'allow' }]);
    await execute('READER_STORE', 'knowledge-reader');
    await execute('READER_STORE_OVERRIDE', 'knowledge-reader', [{ action: 'shell', resource: '*', effect: 'allow' }]);
    const stored = await execute('CURATOR_STORE', 'knowledge-curator'); assert.equal(JSON.parse(stored.results[0]).operation, 'store-text');
    await execute('HANDOFF', 'planner'); assert(fs.readFileSync(path.join(project, 'tmp/TST-101/verdict.md'), 'utf8').includes('Synthetic requested local handoff'));
    await execute('ROVO_ISSUE', 'planner'); await execute('ROVO_MASTER');
    await execute('ROVO_MUTATION', 'planner', [{ action: 'atlassian-rovo_updateConfluenceContent', resource: '*', effect: 'allow' }]);
    await execute('GRAPH', 'planner'); await execute('GRAPH_ROOT_DENY', 'planner'); await execute('GRAPH_INIT', 'master-dev', [{ action: 'codegraph_*', resource: '*', effect: 'allow' }]);
    await execute('BROWSER'); await execute('BROWSER_ACTOR', 'reviewer', [{ action: 'playwright_*', resource: '*', effect: 'allow' }]); await execute('BROWSER_UNSAFE', 'master-dev', [{ action: 'playwright_*', resource: '*', effect: 'allow' }]);
    await execute('DOC_WRITE', 'documenter');
    await execute('DOC_PROJECT_EDIT', 'documenter'); await execute('DOC_SHELL', 'documenter', [{ action: 'shell', resource: '*', effect: 'allow' }]);
    const validation = await execute('DOC_VALIDATE', 'documenter'); assert.equal(JSON.parse(validation.results[0]).valid, true);
    await execute('QA_RENDER', 'visual-qa'); const canvas = await execute('CANVAS_STATUS', 'documenter'); assert.equal(JSON.parse(canvas.results[0]).running, false);
    await execute('READER_DOCUMENT', 'planner');
    const routed = await execute('TECH_DELEGATE'); assert(routed.results.join('\n').includes('SYNTHETIC_CHILD_MEMORY'));
    await execute('PLANNER_DELEGATE', 'planner');
    const qa = await execute('DOC_DELEGATE', 'documenter'); assert(qa.results.join('\n').includes('ROUTING_ONLY_NOT_VISUAL_APPROVAL'));
    const logs = Object.fromEntries(['engram', 'context7', 'rovo', 'graph', 'browser'].map(name => [name, fs.readFileSync(path.join(root, name + '-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)]));
    assert(logs.engram.some(row => row.tool === 'mem_session_summary' && row.summarySessionProvided));
    assert(!logs.rovo.some(row => row.tool === 'updateConfluenceContent')); assert(!logs.graph.some(row => row.tool === 'init')); assert(!logs.browser.some(row => row.tool === 'browser_run_code_unsafe'));
    console.log(JSON.stringify({ cases: trace.size, roles: profile.roles.length, profileCommands: profile.commands.length, mcpFixturesConnected: mcps.length, componentIds: profile.components,
      canonicalKnowledgeWrappers: true, oldHelperDispatchRequired: false, runtimeOverridePreserved: true, independentQaRoutingOnly: true,
      realBackendsOpened: false, businessRequests: 0, realModelRequests: 0, projectInputsSeededByInstall: 0, actualAuneOverlaysMigrated: false, productionOrWorkshopChanged: false }));
  } finally { await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
