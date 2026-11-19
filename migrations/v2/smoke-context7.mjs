import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, verify } from './staging.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { CONTEXT7_TOOLS } from './context7-policy.mjs';
import { startServer, until } from './private-server.mjs';

const live = process.argv[2] === '--live';
assert(process.argv.length === 2 || live && process.argv.length === 3, 'Usage: node smoke-context7.mjs [--live]');
const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const trace = new Map();
let libraryId;
let providerError;

function textFrom(result) {
  try { const parsed = JSON.parse(result); if (Array.isArray(parsed.content)) return [...parsed.content.map(part => part.text ?? ''), parsed.error?.message ?? ''].join('\n'); } catch { /* Native content may already be plain text. */ }
  return result;
}

async function main() {
  verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/context7-wire-');
  const log = path.join(root, 'calls.jsonl');
  const mock = http.createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 2 * 1024 * 1024); }
      const body = JSON.parse(raw);
      const kind = JSON.stringify(body.messages).match(/CTX_CASE_(RESOLVE|DOCS|UNKNOWN|PRIVATE|DENY)/)?.[1];
      assert(kind);
      const tools = body.tools?.map(tool => tool.function?.name ?? tool.name) ?? [];
      const state = trace.get(kind) ?? { results: [], requests: 0, tools };
      trace.set(kind, state); assert(++state.requests <= 3);
      const outputs = body.messages.filter(message => message.role === 'tool');
      state.results = outputs.map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
      const name = kind === 'RESOLVE' ? CONTEXT7_TOOLS[0] : kind === 'UNKNOWN' ? 'context7_unapproved-operation' : CONTEXT7_TOOLS[1];
      const input = kind === 'RESOLVE' ? { libraryName: 'React', query: 'Official React useEffect cleanup documentation' } : { libraryId: libraryId ?? '/fixture/react', query: kind === 'PRIVATE' ? '<private>' : 'How does the useEffect cleanup function unsubscribe from an external subscription?', language: 'TypeScript' };
      const common = { id: 'ctx-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock' };
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (outputs.length) send({ role: 'assistant', content: 'MOCK_OK' });
      else {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: `call_${kind}`, type: 'function', function: { name, arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(input) } }] });
      }
      send({}, outputs.length ? 'stop' : 'tool_calls'); response.end('data: [DONE]\n\n');
    } catch (error) { providerError = error.message; response.writeHead(500); response.end('Synthetic protocol failure'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const fixture = live ? undefined : { type: 'local', command: [process.execPath, fileURLToPath(new URL('./fixtures/context7-mcp.mjs', import.meta.url))], environment: { CONTEXT7_FIXTURE_LOG: log }, codemode: false };
  const p = prepareWorkshop(root, { mock: `http://127.0.0.1:${mock.address().port}/v1`, context7: true, mcpFixture: fixture });
  let server;
  try {
    server = await startServer(base.binary, p);
    const api = server.request;
    const mcp = await until(async () => {
      const result = await api('GET', '/api/mcp'); const entry = result.value.data?.[0];
      return entry && !['pending', 'connecting'].includes(entry.status?.status) ? entry : undefined;
    }, 'Context7 connection', 45000);
    assert.equal(mcp.name, 'context7'); assert.equal(mcp.status.status, 'connected', 'Context7 did not connect');
    for (const kind of live ? ['RESOLVE', 'DOCS'] : ['RESOLVE', 'DOCS', 'UNKNOWN', 'PRIVATE', 'DENY']) {
      const created = await api('POST', '/api/session', { title: 'Context7 synthetic validation', agent: kind === 'RESOLVE' ? 'planner' : 'master-dev', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project }, ...(kind === 'DENY' ? { permissions: [{ action: '*', resource: '*', effect: 'deny' }] } : {}) });
      assert.equal(created.status, 200);
      const admitted = await api('POST', `/api/session/${created.value.data.id}/prompt`, { text: `CTX_CASE_${kind}` });
      assert.equal(admitted.status, 200);
      await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.results.length; }, `native MCP ${kind}`, live ? 70000 : 20000);
      const state = trace.get(kind); const result = state.results.map(textFrom).join('\n');
      if (kind === 'RESOLVE') {
        assert(CONTEXT7_TOOLS.every(name => state.tools.includes(name)), `Unexpected native MCP IDs: ${state.tools.filter(name => name.startsWith('context7')).join(',')}`);
        libraryId = result.match(/Context7-compatible library ID:\s*(\/[A-Za-z0-9._/-]+)/i)?.[1];
        assert(libraryId, 'Resolver did not return a library ID');
      }
      if (kind === 'DOCS') assert(live ? /useEffect|cleanup/i.test(result) && result.length > 200 : result.includes('FIXTURE_DOCS'), 'Documentation call returned no usable content');
      if (kind === 'UNKNOWN') assert(!state.tools.includes('context7_unapproved-operation'));
      if (kind === 'PRIVATE') assert(/private-marked/.test(result), 'Private marker was not blocked before MCP');
      console.log(`OK native MCP ${kind}`);
    }
    if (!live) {
      const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
      assert.deepEqual(calls.map(call => call.tool), ['resolve-library-id', 'query-docs']);
      console.log(JSON.stringify({ fixtureMcpCalls: calls.length, unapprovedForwarded: false, sessionMetadataPresent: calls.every(call => call.sessionMetadataPresent) }));
    }
    console.log(JSON.stringify({ liveDocumentation: live, libraryId, realModelRequests: 0, context7Tools: CONTEXT7_TOOLS }));
  } finally { await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
  verify(base);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
