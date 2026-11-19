// Native tool/policy checks with a synthetic loopback provider; no real inference.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { layout, verify } from './staging.mjs';
import { preparePilot } from './pilot-profile.mjs';
import { startServer, until } from './private-server.mjs';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const trace = new Map();
const cases = {
  READ: { tool: 'read', args: { path: 'fixture-readme.txt' } },
  ENV: { tool: 'read', args: { path: '.env.synthetic-probe' } },
  OUTSIDE: { tool: 'read', args: { path: '../never-read.txt' } },
  SHELL: { tool: 'shell', args: { command: 'touch must-not-exist' } },
  EDIT: { tool: 'write', args: { filePath: 'fixture-readme.txt', content: 'must not write' } },
  DENY: { tool: 'read', args: { path: 'fixture-readme.txt' } },
};

async function main() {
  verify(base);
  let requests = 0;
  const mock = http.createServer(async (request, response) => {
    try {
      assert(request.url === '/v1/chat/completions');
      let raw = '';
      for await (const chunk of request) { raw += chunk; assert(raw.length < 1024 * 1024); }
      const body = JSON.parse(raw);
      assert(++requests <= 30, 'Unexpected model loop');
      const flattened = JSON.stringify(body.messages);
      const name = flattened.match(/CASE_(READ|ENV|OUTSIDE|SHELL|EDIT|DENY)/)?.[1];
      assert(name, 'Unknown synthetic case');
      const state = trace.get(name) ?? { calls: 0, results: [] };
      trace.set(name, state);
      state.calls++;
      const outputs = body.messages.filter(message => message.role === 'tool');
      state.results = outputs.map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
      const selected = cases[name];
      const delta = outputs.length ? { role: 'assistant', content: 'MOCK_OK' } : {
        role: 'assistant', tool_calls: [{ index: 0, id: `call_${name}`, type: 'function', function: { name: selected.tool, arguments: '' } }],
      };
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const send = value => response.write(`data: ${JSON.stringify(value)}\n\n`);
      const common = { id: `mock-${name}`, object: 'chat.completion.chunk', created: 1, model: 'mock' };
      send({ ...common, choices: [{ index: 0, delta, finish_reason: null }] });
      if (!outputs.length) send({ ...common, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected.args) } }] }, finish_reason: null }] });
      send({ ...common, choices: [{ index: 0, delta: {}, finish_reason: outputs.length ? 'stop' : 'tool_calls' }] });
      response.end('data: [DONE]\n\n');
    } catch {
      response.writeHead(500); response.end('Synthetic provider protocol failure');
    }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const runRoot = fs.mkdtempSync(path.join(base.root, 'pilot-smoke-'));
  const p = preparePilot(runRoot, `http://127.0.0.1:${mock.address().port}/v1`);
  const marker = fs.readFileSync(p.fixture, 'utf8').match(/read_probe=(.+)/)[1];
  let server;
  try {
    server = await startServer(base.binary, p);
    const api = server.request;
    const schema = await api('GET', '/openapi.json');
    assert.equal(schema.status, 200);
    // Check public HTTP contract rather than using private host imports.
    assert(schema.value.paths['/api/session']);
    const sessions = [];
    for (const name of Object.keys(cases)) {
      const created = await api('POST', '/api/session', {
        title: `Synthetic ${name}`, agent: 'v2-pilot', model: { providerID: 'pilot-mock', id: 'mock' },
        location: { directory: p.project },
        ...(name === 'DENY' ? { permissions: [{ action: '*', resource: '*', effect: 'deny' }] } : {}),
      });
      assert.equal(created.status, 200, `Create ${name}`);
      const id = created.value.data.id;
      sessions.push(id);
      const admitted = await api('POST', `/api/session/${id}/prompt`, { text: `CASE_${name}` });
      assert.equal(admitted.status, 200, `Prompt ${name}`);
      await until(() => trace.get(name)?.results.length, `native ${name} tool result`, 20000);
      const result = trace.get(name).results.join('\n');
      if (name === 'READ') assert(result.includes(marker), 'Native read did not reach fixture');
      else assert(!result.includes(marker), `Unexpected data disclosure: ${name}`);
      if (name === 'ENV') assert(result.includes('secret-safe'), 'Base env-guard did not reject native tool execution');
      if (name === 'OUTSIDE') assert(result.includes('fixture-readme.txt'), 'Fixture boundary did not reject outside path');
      console.log(`OK native ${name}`);
    }
    const before = requests;
    const attachment = await api('POST', `/api/session/${sessions[0]}/prompt`, {
      text: 'Never admit this attachment', files: [{ uri: `file://${path.join(p.project, 'missing-attachment.txt')}` }],
    });
    assert(attachment.status >= 400, 'Attachment unexpectedly admitted');
    assert.equal(requests, before, 'Rejected attachment triggered inference');
    assert(fs.readFileSync(p.fixture, 'utf8').includes(marker));
    assert(!fs.existsSync(path.join(p.project, 'must-not-exist')));
    console.log('OK attachment rejected; fixture unchanged; shell sentinel absent');
    console.log(JSON.stringify({ nativeChecks: 9, modelRequests: requests, realProviderRequests: 0 }));
  } finally {
    await server?.close();
    mock.closeAllConnections();
    await new Promise(resolve => mock.close(resolve));
  }
  verify(base);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
