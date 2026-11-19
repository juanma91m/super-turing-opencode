import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { layout, verify } from './staging.mjs';
import { prepareWorkshop, roles, readonly } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const trace = new Map();
const cases = {};

async function main() {
  verify(base);
  let requests = 0;
  const mock = http.createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 2 * 1024 * 1024); }
      const body = JSON.parse(raw); assert(++requests <= 50);
      const key = JSON.stringify(body.messages).match(/WORK_CASE_([A-Z_]+)/)?.[1];
      assert(cases[key], 'Unexpected mock case');
      const state = trace.get(key) ?? { results: [], calls: 0 };
      trace.set(key, state); state.calls++;
      state.identity = body.messages.map(message => typeof message.content === 'string' ? message.content : '').join('\n');
      const outputs = body.messages.filter(message => message.role === 'tool');
      state.results = outputs.map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
      const selected = cases[key];
      const common = { id: `mock-${key}`, object: 'chat.completion.chunk', created: 1, model: 'mock' };
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (outputs.length) send({ role: 'assistant', content: 'MOCK_OK' });
      else {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: `call_${key}`, type: 'function', function: { name: selected.tool, arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected.input) } }] });
      }
      send({}, outputs.length ? 'stop' : 'tool_calls'); response.end('data: [DONE]\n\n');
    } catch { response.writeHead(500); response.end('Synthetic protocol error'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const root = fs.mkdtempSync(path.join(base.root, 'workshop-smoke-'));
  const p = prepareWorkshop(root, { mock: `http://127.0.0.1:${mock.address().port}/v1` });
  fs.mkdirSync(path.join(p.project, '.ssh'));
  fs.writeFileSync(path.join(p.project, '.ssh/probe.txt'), 'SYNTHETIC_NOT_A_CREDENTIAL');
  Object.assign(cases, {
    READ: { agent: 'planner', tool: 'read', input: { path: 'app/message.txt' } },
    WRITE: { agent: 'master-dev', tool: 'write', input: { path: 'app/message.txt', content: 'Hola desde V2\n' } },
    RO_WRITE: { agent: 'planner', tool: 'write', input: { path: 'app/message.txt', content: 'MUST_NOT_WRITE' } },
    SHELL: { agent: 'master-dev', tool: 'shell', input: { command: p.commands[2] } },
    PLANNER_SHELL: { agent: 'planner', tool: 'shell', input: { command: p.commands[3] } },
    PLANNER_ESCAPE: { agent: 'planner', tool: 'shell', input: { command: p.commands[2] } },
    RISK: { agent: 'master-dev', tool: 'shell', input: { command: 'rm -rf app' } },
    OUTSIDE: { agent: 'master-dev', tool: 'write', input: { path: '../must-not-write.txt', content: 'MUST_NOT_WRITE' } },
    ATTR: { agent: 'master-dev', tool: 'agent_attribution', input: {} },
    DENY: { agent: 'master-dev', tool: 'agent_attribution', input: {}, deny: true },
    ASK: { agent: 'master-dev', tool: 'read', input: { path: '.ssh/probe.txt' }, ask: true },
  });
  let server;
  try {
    server = await startServer(base.binary, p);
    const api = server.request;
    const agents = await until(async () => {
      const result = await api('GET', '/api/agent');
      return roles.every(role => result.value?.data?.some(agent => agent.id === role)) ? result.value.data : undefined;
    }, 'all base agents');
    function decision(agent, action, resource) {
      const match = pattern => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.') + '$').test(resource);
      return agent.permissions.findLast(rule => (rule.action === '*' || rule.action === action) && match(rule.resource))?.effect;
    }
    for (const role of roles) {
      const agent = agents.find(agent => agent.id === role);
      assert.equal(decision(agent, 'edit', 'app/message.txt'), readonly.includes(role) ? 'deny' : 'allow', `${role} edit boundary`);
    }
    console.log('OK eleven agents: readonly/writer split preserved');
    for (const [name, selected] of Object.entries(cases)) {
      const created = await api('POST', '/api/session', { title: `Synthetic ${name}`, location: { directory: p.project }, agent: selected.agent, model: { providerID: 'workshop-mock', id: 'mock' }, ...(selected.deny ? { permissions: [{ action: '*', resource: '*', effect: 'deny' }] } : {}) });
      assert.equal(created.status, 200, `Create ${name}`);
      const id = created.value.data.id;
      const result = await api('POST', `/api/session/${id}/prompt`, { text: `WORK_CASE_${name} PRIVATE_SENTINEL` });
      assert.equal(result.status, 200, `Prompt ${name}`);
      if (selected.ask) {
        const pending = await until(async () => {
          const result = await api('GET', `/api/session/${id}/permission`);
          return result.value?.data?.[0];
        }, 'sensitive read approval');
        assert.equal(pending.action, 'read');
        const rejected = await api('POST', `/api/session/${id}/permission/${pending.id}/reply`, { decision: 'reject', message: 'Synthetic rejection; do not read' });
        assert([200, 204].includes(rejected.status));
      }
      await until(() => trace.get(name)?.results.length, `native ${name}`, 20000);
      const text = trace.get(name).results.join('\n');
      if (name === 'READ') assert(text.includes('Hola V2'), `Read failed: ${text}`);
      if (name === 'WRITE') assert.equal(fs.readFileSync(p.editable, 'utf8'), 'Hola desde V2\n', `Write failed: ${text}`);
      if (name === 'SHELL') assert(text.includes('"valid":true'), `Checker failed: ${text}`);
      if (name === 'PLANNER_SHELL') assert(!/error|blocked/i.test(text), `Broker failed: ${text}`);
      if (name === 'PLANNER_ESCAPE') assert(/canonical broker/.test(text), `Planner guard failed: ${text}`);
      if (name === 'ATTR') {
        assert(text.includes('model-visible-context') && text.includes('master-dev'));
        assert(!text.includes('PRIVATE_SENTINEL'));
        assert(trace.get(name).identity.includes('currently operating as the "master-dev" agent.'));
      }
      if (name === 'DENY') assert(!text.includes('model-visible-context'));
      if (name === 'ASK') assert(!text.includes('SYNTHETIC_NOT_A_CREDENTIAL'));
      if (!['READ'].includes(name)) assert.equal(fs.readFileSync(p.editable, 'utf8'), 'Hola desde V2\n');
      console.log(`OK native ${name}`);
    }
    assert(!fs.existsSync(path.join(p.root, 'home/must-not-write.txt')));
    console.log(JSON.stringify({ cases: Object.keys(cases).length, agents: roles.length, realProviderRequests: 0 }));
  } finally {
    await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  }
  verify(base);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
