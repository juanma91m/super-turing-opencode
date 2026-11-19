import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { layout, environment, verify } from '../staging.mjs';
import { prepareWorkshop } from '../workshop-profile.mjs';
import { applyBuiltinVisibility, hideBuiltinAgents, readBuiltinVisibility, visibilityFile, inspectBuiltinVisibility } from '../builtin-visibility.mjs';
import { startServer, until } from '../private-server.mjs';
import { getApiList } from '../api-list.mjs';

const addon = new URL('../../../../super-turing-opencode-knowledge/v2/', import.meta.url);
const available = fs.existsSync(new URL('composition.mjs', addon));
const { knowledgeExtension } = available ? await import(new URL('composition.mjs', addon)) : {};
const { ENGRAM_TOOLS } = available ? await import(new URL('engram-config.mjs', addon)) : {};

function fixture(t, mock = 'http://127.0.0.1:1234/v1') {
  const root = fs.mkdtempSync('/tmp/opencode/builtin-visibility-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const extension = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode',
    server: { type: 'local', command: ['/fixture/engram'], codemode: false, disabled: true }, permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
  return { root, options: { mock, extend: extension } };
}

test('visibility changes only hidden flags and never disables or changes permissions/routing', { skip: !available }, t => {
  const { root, options } = fixture(t), p = prepareWorkshop(root, options), original = structuredClone(p.document);
  const changed = applyBuiltinVisibility(p);
  const expected = structuredClone(original); expected.agents.plan.hidden = true; expected.agents.build.hidden = true;
  assert.deepEqual(changed.document, expected); assert.deepEqual(p.document, original);
  assert.equal(changed.document.agents.plan.disabled, false); assert.equal(changed.document.agents.build.disabled, false);
  assert.equal(fs.readFileSync(path.join(p.config, 'opencode/opencode.json.pre-builtin-visibility.bak'), 'utf8'), JSON.stringify(original, null, 2) + '\n');
  assert.equal(applyBuiltinVisibility(prepareWorkshop(root, options)).builtinVisibilityChanged, false);
  assert.deepEqual(readBuiltinVisibility(root).hidden, ['plan', 'build']);
});

test('visibility survives a later addon upgrade whose known predecessor did not contain the preference', { skip: !available }, t => {
  const { root, options } = fixture(t);
  const current = applyBuiltinVisibility(prepareWorkshop(root, options));
  const before = fs.readFileSync(path.join(current.config, 'opencode/opencode.json'));
  const previous = options.extend;
  const upgraded = prepareWorkshop(root, { ...options, extend: context => {
    const prior = previous(context), next = structuredClone(prior.document);
    next.policies.push({ action: 'websearch.use', resource: 'future-fixture', effect: 'deny' });
    return { ...prior, document: next, previousDocument: JSON.stringify(prior.document, null, 2) + '\n', tag: 'future-fixture' };
  } });
  assert.equal(upgraded.document.agents.plan.hidden, true); assert.equal(upgraded.document.agents.build.hidden, true);
  assert(fs.readFileSync(path.join(current.config, 'opencode/opencode.json.pre-future-fixture.bak')).equals(before));
});

test('visibility rejects drift or malformed markers without dumping values or hiding the default agent', { skip: !available }, t => {
  const { root, options } = fixture(t), p = prepareWorkshop(root, options), file = path.join(p.config, 'opencode/opencode.json');
  fs.appendFileSync(file, ' ');
  assert.throws(() => applyBuiltinVisibility(p), /refusing upgrade/);
  assert(!fs.existsSync(visibilityFile(root)));
  for (const body of ['FIXTURE_VALUE_NOT_FOR_LOGS', JSON.stringify({ token: 'FIXTURE_VALUE_NOT_FOR_LOGS' })]) {
    fs.writeFileSync(visibilityFile(root), body);
    assert.throws(() => readBuiltinVisibility(root), error => error.message.includes('values suppressed') && !error.message.includes('FIXTURE_VALUE_NOT_FOR_LOGS'));
  }
  assert.throws(() => hideBuiltinAgents({ ...p.document, default_agent: 'plan' }), /default agent/);
});

test('hide-builtins action requires client-close confirmation before profile access', { skip: !available }, () => {
  const result = spawnSync(process.execPath, [new URL('../documents-read.mjs', import.meta.url).pathname, 'hide-builtins'], { env: { HOME: '/tmp/opencode/not-a-real-home', PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});

test('native V2 keeps hidden builtins compiled and routable while primary picker omits them', { skip: !available || process.env.KNOWLEDGE_API_NATIVE !== '1' }, async t => {
  const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')); verify(base);
  const observed = [];
  const mock = http.createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    observed.push(body.messages.map(message => typeof message.content === 'string' ? message.content : '').join('\n'));
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end('data: ' + JSON.stringify({ id: 'visibility-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta: { role: 'assistant', content: 'VISIBILITY_OK' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const { root, options } = fixture(t, `http://127.0.0.1:${mock.address().port}/v1`);
  let server;
  const getAgents = async p => {
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-knowledge.engram'), 'Visibility fixture plugins');
    return until(async () => { const agents = await get('/api/agent'); return p.roles.every(id => agents.some(agent => agent.id === id)) ? agents : undefined; }, 'Visibility fixture agents');
  };
  try {
    const before = prepareWorkshop(root, options);
    server = await startServer(base.binary, before);
    const original = await getAgents(before);
    for (const id of ['plan', 'build']) assert.equal(original.find(agent => agent.id === id).hidden, false, 'Negative control must reproduce the old visible state');
    await server.close(); server = undefined;
    applyBuiltinVisibility(before);
    const after = prepareWorkshop(root, options);
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: after.project, env: environment(after), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'Visibility config rejected; output suppressed');
    server = await startServer(base.binary, after);
    const agents = await getAgents(after), get = route => getApiList(server.request, route);
    await inspectBuiltinVisibility(get, root);
    for (const prior of original) {
      const actual = agents.find(agent => agent.id === prior.id); assert(actual);
      assert.deepEqual({ ...actual, hidden: prior.hidden }, prior, 'No compiled agent properties except hidden may change');
    }
    // Same predicate as the stock 2.2.7 TUI local.agent.list(): native source
    // confirmed, not a replacement UI or patch of the host.
    const primary = agents.filter(agent => agent.mode !== 'subagent' && !agent.hidden).map(agent => agent.id);
    assert(!primary.includes('plan') && !primary.includes('build'));
    assert(primary.includes('planner') && primary.includes('master-dev'));
    const created = await server.request('POST', '/api/session', { agent: 'master-dev', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: after.project } });
    assert.equal(created.status, 200);
    assert.equal((await server.request('POST', `/api/session/${created.value.data.id}/command`, { name: 'memory-init', text: '' })).status, 204);
    await until(() => observed.some(body => body.includes('currently operating as the "plan" agent.')), 'Command routing to hidden plan');
    const build = await server.request('POST', '/api/session', { agent: 'build', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: after.project } });
    assert.equal(build.status, 200);
    assert.equal((await server.request('POST', `/api/session/${build.value.data.id}/prompt`, { text: 'Synthetic visibility test; do not call tools.' })).status, 200);
    await until(() => observed.some(body => body.includes('currently operating as the "build" agent.')), 'Explicit hidden build route');
  } finally { await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
});
