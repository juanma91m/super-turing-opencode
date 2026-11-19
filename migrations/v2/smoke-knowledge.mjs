// Native V2 + the explicitly selected existing Engram executable. All memory,
// auth, HOME and model traffic below are synthetic and owned by this fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { environment, layout, verify } from './staging.mjs';
import { prepareWorkshop, quote } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { ENGRAM_TOOLS, READER_DENIED, translateEngram } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { knowledgeExtension } from '../../../super-turing-opencode-knowledge/v2/composition.mjs';

const argument = process.argv[2];
assert(process.argv.length === 3 && argument?.startsWith('--engram-bin='), 'Usage: node smoke-knowledge.mjs --engram-bin=/absolute/existing/engram');
const binary = argument.slice('--engram-bin='.length);
assert(path.isAbsolute(binary) && fs.statSync(binary).isFile(), 'Select an existing Engram executable explicitly; never install/rebuild');
const addon = fileURLToPath(new URL('../../../super-turing-opencode-knowledge/', import.meta.url));
const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const trace = new Map();
let providerError;
let profile;

function helperFixture(home) {
  const config = path.join(home, '.config/opencode'), scripts = path.join(config, 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  for (const name of ['knowledge_env.sh', 'knowledge_search.sh', 'knowledge_status_qdrant.sh', 'knowledge_inventory.sh', 'knowledge_store.sh', 'knowledge_seed_global.sh']) fs.copyFileSync(path.join(addon, 'scripts', name), path.join(scripts, name));
  const python = path.join(home, '.local/share/super-turing-opencode-knowledge/.venv/bin/python');
  fs.mkdirSync(path.dirname(python), { recursive: true });
  const log = path.join(home, 'qdrant-calls.jsonl');
  fs.writeFileSync(python, '#!/usr/bin/python3\nimport json,os,sys\nrow={"marker":"FIXTURE_QDRANT","argv":sys.argv[1:],"home":os.environ["HOME"],"model":os.environ.get("OPENCODE_KNOWLEDGE_EMBEDDING_MODEL")}\nwith open(' + JSON.stringify(log) + ',"a") as f: f.write(json.dumps(row)+"\\n")\nprint(json.dumps(row))\n', { mode: 0o700 });
  fs.writeFileSync(path.join(scripts, 'knowledge_env.local.sh'), 'export OPENCODE_KNOWLEDGE_EMBEDDING_BACKEND=ollama\nexport OPENCODE_KNOWLEDGE_EMBEDDING_MODEL=fixture-existing-model\n');
  fs.mkdirSync(path.join(config, 'knowledge'));
  fs.writeFileSync(path.join(config, 'knowledge/global_seed_paths.txt'), 'fixture.md\n');
  fs.writeFileSync(path.join(config, 'fixture.md'), 'Synthetic corpus source\n');
  fs.mkdirSync(path.join(home, '.opencode/bin'), { recursive: true });
  fs.writeFileSync(path.join(home, '.opencode/bin/engram'), '#!/bin/bash\n[[ "$1" == --version ]] || exit 2\nexit 0\n', { mode: 0o700 });
  return { config, log };
}

function helperCall(kind) {
  const script = name => `bash ${quote(path.join(profile.config, 'opencode/scripts', name))}`;
  if (kind === 'PLANNER_QUERY') return `python3 ${quote(profile.broker)} helper knowledge-search --query 'fixture semantic evidence'`;
  if (kind === 'READER_STATUS') return script('knowledge_status.sh') + ' --qdrant-only';
  if (kind === 'READER_ENGRAM_STATUS') return script('knowledge_status.sh') + ' --engram-only';
  if (kind === 'CURATOR_INVENTORY') return script('knowledge_inventory.sh') + ' --collection fixture';
  if (kind === 'CURATOR_SEED') return script('knowledge_seed_global.sh');
  if (kind === 'CURATOR_STORE' || kind === 'READER_STORE' || kind === 'SHELL_OVERRIDE_DENY') return script('knowledge_store.sh') + ' store-text --title fixture --text literal-fixture';
  const query = script('knowledge_search.sh') + " --query 'fixture semantic evidence'";
  if (kind === 'READER_INJECTION') return query + `; touch ${quote(path.join(profile.project, 'must-not-exist'))}`;
  return query;
}

function textFrom(result) {
  try {
    const value = JSON.parse(result);
    if (Array.isArray(value.content)) return value.content.map(part => part.text ?? '').join('\n');
  } catch { /* May already be text. */ }
  return result;
}

function callFor(kind, results) {
  const last = results.at(-1) ?? '';
  if (['READER_QUERY', 'PLANNER_QUERY', 'READER_STATUS', 'READER_ENGRAM_STATUS', 'CURATOR_INVENTORY', 'CURATOR_SEED', 'CURATOR_STORE', 'READER_STORE', 'SHELL_OVERRIDE_DENY', 'READER_INJECTION', 'COMMAND_SEARCH'].includes(kind)) {
    return results.length ? undefined : ['shell', { command: helperCall(kind) }];
  }
  if (kind === 'SUMMARY' || kind === 'EXPLICIT') {
    const explicit = kind === 'EXPLICIT';
    const word = explicit ? 'explicitfixture' : 'fixturecontinuity';
    if (results.length < 2) return ['engram_mem_session_summary', {
      content: `${word} ${results.length ? 'second' : 'first'}`, source_agent: 'fixture',
      ...(explicit ? { session_id: 'ses_explicit_fixture' } : {}),
    }];
    if (results.length === 2) return ['engram_mem_search', { query: word, project: 'fixture-knowledge' }];
    if (results.length === 3) {
      const id = Number(last.match(/#(\d+)/)?.[1]);
      assert(id, 'Fixture summary was not searchable');
      return ['engram_mem_get_observation', { id }];
    }
    return undefined;
  }
  if (results.length) return undefined;
  if (['HINT', 'PLAIN', 'READER_HINT'].includes(kind)) return undefined;
  if (kind.endsWith('SAVE')) return ['engram_mem_save', { title: `Fixture save ${kind}`, content: `fixturesavemarker evidence ${kind}`, capture_prompt: false, source_agent: 'fixture' }];
  if (kind === 'UNKNOWN') return ['engram_mem_delete', { id: 1 }];
  if (kind === 'READER_DENY' || kind === 'OVERRIDE_DENY') return ['engram_mem_save', { title: 'Must not persist', content: 'fixturedeniedmarker', capture_prompt: false }];
  return ['engram_mem_search', { query: kind === 'VERIFY_DENIED' ? 'fixturedeniedmarker' : 'fixturecontinuity', project: 'fixture-knowledge' }];
}

async function main() {
  verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/knowledge-wire-');
  const data = path.join(root, 'engram-fixture');
  const runtimeHome = path.join(root, 'runtime-home');
  const runtimeConfig = path.join(runtimeHome, '.config/opencode');
  const mock = http.createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 2 * 1024 * 1024); }
      const body = JSON.parse(raw);
      const kind = JSON.stringify(body.messages).match(/KN_CASE_([A-Z_]+)/)?.[1];
      assert(kind, 'Fixture case not found');
      const state = trace.get(kind) ?? { requests: 0 };
      trace.set(kind, state); assert(++state.requests <= 7);
      state.tools = body.tools?.map(tool => tool.function?.name ?? tool.name) ?? [];
      state.hintCount = (JSON.stringify(body.messages).match(/\[MEMORY HINT\]/g) ?? []).length;
      state.results = body.messages.filter(message => message.role === 'tool').map(message => textFrom(typeof message.content === 'string' ? message.content : JSON.stringify(message.content)));
      const call = callFor(kind, state.results);
      const common = { id: 'knowledge-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock' };
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (call) {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: `call_${kind}_${state.results.length}`, type: 'function', function: { name: call[0], arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(call[1]) } }] });
      } else send({ role: 'assistant', content: 'MOCK_OK' });
      send({}, call ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n');
      state.finished = !call;
    } catch (error) { providerError = error.message; response.writeHead(500); response.end('Synthetic fixture failure'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  let server;
  try {
    const p = prepareWorkshop(root, { mock: `http://127.0.0.1:${mock.address().port}/v1`, context7: true,
      mcpFixture: { type: 'local', command: [process.execPath, fileURLToPath(new URL('./fixtures/context7-mcp.mjs', import.meta.url))], environment: { CONTEXT7_FIXTURE_LOG: path.join(root, 'context7-fixture.jsonl') }, codemode: false },
      extend: knowledgeExtension({ runtimeHome, runtimeConfig,
        server: translateEngram({ type: 'local', command: [binary, 'mcp', '--tools=' + ENGRAM_TOOLS.map(name => name.slice('engram_'.length)).join(','), '--project=fixture-knowledge'], cwd: path.join(root, 'home/project'), environment: { HOME: runtimeHome, ENGRAM_DATA_DIR: data, ENGRAM_CLOUD_AUTOSYNC: '0' }, enabled: true }),
        permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })),
      }) });
    profile = p;
    const helpers = helperFixture(runtimeHome);
    fs.mkdirSync(data, { mode: 0o700 });
    // Existing zero-byte SQLite prevents orphan migration outside this fixture.
    fs.writeFileSync(path.join(data, 'engram.db'), '', { flag: 'wx', mode: 0o600 });
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'Isolated debug config failed; raw output suppressed');
    for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep), 'Foreign configuration source');
    server = await startServer(base.binary, p);
    await until(async () => {
      const { value } = await server.request('GET', '/api/mcp');
      assert(value.data?.every(entry => ['engram', 'context7'].includes(entry.name)), 'Unexpected MCP server');
      return ['engram', 'context7'].every(name => value.data?.some(entry => entry.name === name && entry.status?.status === 'connected'));
    }, 'isolated Engram MCP connection', 30000);
    await until(async () => {
      const { value } = await server.request('GET', '/api/plugin');
      return value.data?.some(plugin => plugin.id === 'opencode-knowledge.engram');
    }, 'native Knowledge adapter');

    const skillList = (await server.request('GET', '/api/skill')).value.data;
    assert(p.skills.every(id => skillList.some(skill => skill.id === id)), 'Missing base/addon skills');
    const commandList = (await server.request('GET', '/api/command')).value.data;
    assert(['memory-init', 'knowledge-search', 'knowledge-status', 'knowledge-store-global', 'knowledge-index-global'].every(name => commandList.some(command => command.name === name)), 'Missing Knowledge commands');
    const agentList = (await server.request('GET', '/api/agent')).value.data;
    assert(p.roles.every(id => agentList.some(agent => agent.id === id)), 'Missing base/addon roles');
    const inspection = await inspectKnowledge(server, p, ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })));
    assert.equal(inspection.agents, 15);
    assert.equal(inspection.skills, 18);
    assert.equal(inspection.connected, false, 'Fixture must not reuse provider auth');
    assert(!fs.existsSync(helpers.log), 'Staging indexed or queried the corpus automatically');

    for (const kind of ['SAVE', 'PLANNER_SAVE', 'CURATOR_SAVE', 'SUMMARY', 'EXPLICIT', 'READER_READ', 'READER_DENY', 'OVERRIDE_DENY', 'UNKNOWN', 'VERIFY_DENIED', 'HINT', 'READER_HINT', 'PLAIN']) {
      const reader = kind.startsWith('READER');
      const created = await server.request('POST', '/api/session', { agent: reader ? 'knowledge-reader' : kind === 'PLANNER_SAVE' ? 'planner' : kind === 'CURATOR_SAVE' ? 'knowledge-curator' : 'master-dev', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project },
        ...(kind === 'OVERRIDE_DENY' ? { permissions: [{ action: 'engram_mem_save', resource: '*', effect: 'deny' }] } : {}) });
      assert.equal(created.status, 200);
      const sessionID = created.value.data.id;
      const admitted = await server.request('POST', `/api/session/${sessionID}/prompt`, { text: `KN_CASE_${kind} ${kind.endsWith('HINT') ? 'remember this synthetic fixture' : 'synthetic fixture validation'}` });
      assert.equal(admitted.status, 200);
      await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, `Knowledge ${kind}`, 30000);
      const state = trace.get(kind), result = state.results.join('\n');
      const offered = state.tools.filter(name => name.startsWith('engram_'));
      assert.deepEqual(offered.sort(), ENGRAM_TOOLS.filter(name => !(reader && READER_DENIED.includes(name)) && !(kind === 'OVERRIDE_DENY' && name === 'engram_mem_save')).sort(), `${kind} exact native tool exposure`);
      if (kind.endsWith('SAVE')) assert(/Memory saved/.test(result), 'Writer lost persistence');
      if (kind === 'SUMMARY' || kind === 'EXPLICIT') {
        assert(/Found 1 memories/.test(state.results[2]), 'Repeated summary created duplicate observations');
        assert(result.includes(`Session: ${kind === 'EXPLICIT' ? 'ses_explicit_fixture' : sessionID}`), 'Wrong summary session association');
        assert(/Revisions: 2/.test(result), 'Repeated summary did not update one observation');
      }
      if (kind === 'READER_READ') assert(result.includes('fixturecontinuity'), 'Reader lost retrieval');
      if (kind === 'READER_DENY' || kind === 'OVERRIDE_DENY' || kind === 'UNKNOWN') assert(!/Memory saved/.test(result));
      if (kind === 'VERIFY_DENIED') assert(/No memories found/.test(result), 'Denied tool reached persistent state');
      assert.equal(state.hintCount, kind.endsWith('HINT') ? 1 : 0, `${kind} hint parity`);
      console.log(`OK native Knowledge ${kind}`);
    }
    for (const kind of ['READER_QUERY', 'PLANNER_QUERY', 'READER_STATUS', 'READER_ENGRAM_STATUS', 'CURATOR_INVENTORY', 'CURATOR_STORE', 'CURATOR_SEED', 'READER_STORE', 'SHELL_OVERRIDE_DENY', 'READER_INJECTION', 'COMMAND_SEARCH']) {
      const before = fs.existsSync(helpers.log) ? fs.readFileSync(helpers.log, 'utf8').trim().split('\n').length : 0;
      const created = await server.request('POST', '/api/session', { agent: kind === 'PLANNER_QUERY' ? 'planner' : kind.startsWith('CURATOR') || kind === 'SHELL_OVERRIDE_DENY' ? 'knowledge-curator' : kind === 'COMMAND_SEARCH' ? 'master-dev' : 'knowledge-reader', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project },
        ...(kind === 'SHELL_OVERRIDE_DENY' ? { permissions: [{ action: 'shell', resource: '*', effect: 'deny' }] } : {}) });
      assert.equal(created.status, 200);
      const sessionID = created.value.data.id;
      const submitted = kind === 'COMMAND_SEARCH'
        ? await server.request('POST', `/api/session/${sessionID}/command`, { name: 'knowledge-search', text: `KN_CASE_${kind}` })
        : await server.request('POST', `/api/session/${sessionID}/prompt`, { text: `KN_CASE_${kind} synthetic helper validation` });
      assert.equal(submitted.status, kind === 'COMMAND_SEARCH' ? 204 : 200, `${kind} admission failed`);
      await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, `Knowledge helper ${kind}`, 20000);
      const result = trace.get(kind).results.join('\n');
      const calls = fs.existsSync(helpers.log) ? fs.readFileSync(helpers.log, 'utf8').trim().split('\n').map(JSON.parse) : [];
      const denied = ['READER_STORE', 'SHELL_OVERRIDE_DENY', 'READER_INJECTION'].includes(kind);
      if (denied || kind === 'READER_ENGRAM_STATUS') assert.equal(calls.length, before, `${kind} unexpectedly reached Qdrant`);
      else {
        assert.equal(calls.length, before + 1, `${kind} did not reach exactly one approved helper`);
        assert.equal(calls.at(-1).home, runtimeHome);
        assert.equal(calls.at(-1).model, 'fixture-existing-model');
        assert.equal(calls.at(-1).argv[0], path.join(runtimeConfig, 'scripts/knowledge_store.py'));
        if (kind === 'CURATOR_SEED') assert(calls.at(-1).argv.includes(runtimeConfig), 'Seed changed its source root');
        else assert(result.includes('FIXTURE_QDRANT'), `${kind} missing helper output`);
      }
      if (kind === 'READER_ENGRAM_STATUS') assert(result.includes('engram_mcp_enabled=yes'), 'Status did not inspect native profile configuration');
      if (kind === 'COMMAND_SEARCH') assert(READER_DENIED.every(name => !trace.get(kind).tools.includes(name)), 'Command did not select the reader actor');
      assert(!fs.existsSync(path.join(p.project, 'must-not-exist')), 'Shell composition escaped helper validation');
      console.log(`OK native Knowledge helper ${kind}`);
    }
    console.log(JSON.stringify({ cases: trace.size, agents: p.roles.length, skills: p.skills.length, commands: 5, mcpTools: ENGRAM_TOOLS.length, readerDenied: READER_DENIED.length, realProviderRequests: 0, realMemoryStoresConnected: 0, realQdrantClients: 0, backend: 'existing Engram / temporary SQLite; existing helper scripts / fake Qdrant interpreter', debugConfig: 'isolated sources verified' }));
  } finally {
    await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
  verify(base);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
