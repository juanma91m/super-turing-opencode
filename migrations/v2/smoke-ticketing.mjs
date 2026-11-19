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
import { getApiList } from './api-list.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { knowledgeExtension } from '../../../super-turing-opencode-knowledge/v2/composition.mjs';
import { ENGRAM_TOOLS } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { ticketingExtension } from '../../../super-turing-opencode-ticketing/v2/composition.mjs';
import { ROVO_ROLES, ROVO_TOOLS } from '../../../super-turing-opencode-ticketing/v2/config.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { buildTicketSessionTitle } from '../../../super-turing-opencode-ticketing/lib/ticket-session-title.ts';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const trace = new Map();
let providerError, profile;
const issue = { cloudId: 'fixture-site', issueIdOrKey: 'TST-101', fields: ['summary', 'description', 'comment'] };
const headings = ['Problema / Objetivo', 'Alcance', 'Estado actual', 'Causa / Hipótesis vigente', 'Solución propuesta', 'Validación esperada'];
const verdict = state => headings.map(heading => `## ${heading}\n${heading === 'Estado actual' ? state : 'Synthetic evidence; no remote lookup'}`).join('\n\n');

function textFrom(value) {
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed.content)) return parsed.content.map(part => part.text ?? '').join('\n'); } catch { /* Native content may be plain text. */ }
  return value;
}

function callFor(kind, results) {
  if (kind === 'DISCOVERY' && !results.length) return ['shell', { command: `python3 ${quote(profile.broker)} --help` }];
  if (['DRAFT', 'COMMAND'].includes(kind)) {
    const key = kind === 'COMMAND' ? 'TST-909' : 'TST-101';
    if (results.length === 0 || results.length === 2) return ['shell', { command: `python3 ${quote(profile.broker)} helper jira verdict ${key} --content ${quote(verdict(results.length ? 'listo: synthetic evidence confirmed' : 'borrador: pending hypothesis'))}` }];
    if (results.length === 1 || results.length === 3) return ['read', { path: path.join(profile.project, 'tmp', key, 'verdict.md') }];
    return undefined;
  }
  if (kind === 'ESCAPE' && !results.length) return ['shell', { command: `python3 ${quote(profile.broker)} helper jira write TST-101 --file ../app/message.txt --content forbidden` }];
  if (kind === 'DIRECT_EDIT' && !results.length) return ['write', { path: path.join(profile.project, 'app/message.txt'), content: 'Forbidden' }];
  if (kind === 'SYMLINK' && !results.length) return ['shell', { command: `python3 ${quote(profile.broker)} helper jira verdict ESC-101 --content forbidden` }];
  if (kind === 'RESULT' && !results.length) return ['shell', { command: `python3 ${quote(profile.broker)} helper jira write TST-101 --file result-dev.md --content 'Synthetic implementation result; no app changes'` }];
  if (['NO_HANDOFF', 'MANUAL_TITLE', 'PR_TITLE', 'BRANCH_TITLE'].includes(kind) || results.length) return undefined;
  const tool = kind === 'RESOURCES' ? ROVO_TOOLS[0] : kind === 'SEARCH' ? ROVO_TOOLS[1] : kind === 'CONFLUENCE' || kind === 'REVIEWER_CONFLUENCE_DENY' ? ROVO_TOOLS[3]
    : kind === 'MUTATION_DENY' ? 'atlassian-rovo_createJiraIssue' : kind === 'UNKNOWN_DENY' ? 'atlassian-rovo_unreviewedRead' : ROVO_TOOLS[2];
  return [tool, tool === ROVO_TOOLS[0] ? {} : tool === ROVO_TOOLS[1] ? { query: 'synthetic Jira fixture' } : tool === ROVO_TOOLS[2] ? issue : { cloudId: 'fixture-site', id: 'fixture-page' }];
}

async function main() {
  verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/ticketing-wire-');
  const calls = path.join(root, 'rovo-calls.jsonl');
  const mock = http.createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 3 * 1024 * 1024); }
      const body = JSON.parse(raw), serialized = JSON.stringify(body.messages);
      const kind = serialized.match(/TCASE_([A-Z_]+)/)?.[1] ?? (serialized.includes('Analizá el ticket TST-909') ? 'COMMAND' : undefined);
      assert(kind, 'Unknown Ticketing fixture case');
      const state = trace.get(kind) ?? { requests: 0 };
      trace.set(kind, state); assert(++state.requests <= 7);
      state.tools = body.tools?.map(tool => tool.function?.name ?? tool.name) ?? [];
      state.results = body.messages.filter(message => message.role === 'tool').map(message => textFrom(typeof message.content === 'string' ? message.content : JSON.stringify(message.content)));
      const call = callFor(kind, state.results);
      const common = { id: 'ticketing-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock' };
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
  let server, unauthorized;
  try {
    const mcp = (names, log) => ({ type: 'local', command: [process.execPath, fileURLToPath(new URL('./fixtures/ticketing-mcp.mjs', import.meta.url))], environment: { FIXTURE_TOOLS: JSON.stringify(names), FIXTURE_LOG: log }, codemode: false });
    const knowledge = knowledgeExtension({ runtimeHome: path.join(root, 'runtime-home'), runtimeConfig: path.join(root, 'runtime-home/.config/opencode'), server: mcp(ENGRAM_TOOLS.map(name => name.slice('engram_'.length)), path.join(root, 'engram-calls.jsonl')), permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
    const ticketing = ticketingExtension({ server: mcp([...ROVO_TOOLS.map(name => name.slice('atlassian-rovo_'.length)), 'createJiraIssue', 'updateConfluenceContent', 'unreviewedRead'], calls) });
    const p = prepareWorkshop(root, { mock: `http://127.0.0.1:${mock.address().port}/v1`, context7: true,
      mcpFixture: { type: 'local', command: [process.execPath, fileURLToPath(new URL('./fixtures/context7-mcp.mjs', import.meta.url))], environment: { CONTEXT7_FIXTURE_LOG: path.join(root, 'context7-calls.jsonl') }, codemode: false },
      extend: context => ticketing({ ...context, ...knowledge(context) }) });
    profile = p;
    const beforeApp = fs.readFileSync(p.editable);
    fs.writeFileSync(path.join(p.project, 'AGENTS.md'), 'Synthetic fixture: handoff is enabled only for explicit TST planning requests. A ticket ID or review alone does not enable implementation handoff. Never use network or credentials in this fixture.\n');
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'Native config rejected; raw output suppressed');
    for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep), 'Foreign config source');
    server = await startServer(base.binary, p);
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-ticketing.titles'), 'Ticketing native plugin');
    await until(async () => (await get('/api/mcp')).filter(item => item.status?.status === 'connected').length === 3, 'three fixture MCPs');
    const inspected = await inspectTicketing(get, p.roles);
    assert.equal(inspected.rovoStatus, 'connected');
    const existing = await inspectKnowledge(server, p, ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })), { additionalMcp: ['atlassian-rovo'], additionalPlugins: ['opencode-ticketing.titles'] });
    assert.equal(existing.connected, false, 'Fixture must not reuse real provider auth');
    assert.equal(p.roles.length, 15); assert.equal(p.skills.length, 19);
    assert(!fs.existsSync(path.join(p.project, 'tmp')), 'Installing the addon activated handoff without a request');
    const count = () => fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').length : 0;
    const cases = [
      ['DISCOVERY', 'planner', 'Descubrir el contrato local del broker sin Jira'],
      ['NO_HANDOFF', 'planner', 'Consulta breve de TST-303; sin diagnóstico ni handoff'],
      ['RESOURCES', 'planner', 'Resolver sitio del fixture'], ['SEARCH', 'planner', 'Buscar sólo el fixture'],
      ['ISSUE', 'planner', 'Leer TST-101 con campos acotados'], ['CONFLUENCE', 'planner', 'Leer contenido Confluence del fixture'],
      ['REVIEWER_ISSUE', 'code-reviewer', 'Revisá PR #12 para TST-101'],
      ['REVIEWER_CONFLUENCE_DENY', 'code-reviewer', 'No habilitar lectura Confluence'],
      ['MASTER_DENY', 'master-dev', 'No ampliar acceso remoto'], ['MUTATION_DENY', 'planner', 'No crear tickets'],
      ['UNKNOWN_DENY', 'planner', 'No habilitar tools por wildcard'],
      ['MANUAL_TITLE', 'planner', 'Analizá TST-101 fixture'], ['PR_TITLE', 'code-reviewer', 'Revisá PR #802 para TST-101'],
      ['BRANCH_TITLE', 'code-reviewer', 'Revisá main <- feature/TST-101 para TST-101'],
      ['DRAFT', 'planner', 'Analizá el ticket TST-101 con handoff explícito'],
      ['ESCAPE', 'planner', 'Intento inválido de salida de sandbox'], ['DIRECT_EDIT', 'planner', 'No editar aplicación'],
      ['RESULT', 'master-dev', 'Registrar resultado sintético mediante helper'],
      ['COMMAND', 'master-dev', ''], ['SYMLINK', 'planner', 'No escribir por enlace a aplicación'],
    ];
    for (const [kind, actor, firstLine] of cases) {
      if (kind === 'SYMLINK') fs.symlinkSync(p.project, path.join(p.project, 'tmp/ESC-101'), 'dir');
      const created = await server.request('POST', '/api/session', { agent: actor, model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project }, ...(kind === 'MANUAL_TITLE' ? { title: 'Operator manual title' } : {}) });
      assert.equal(created.status, 200);
      const sessionID = created.value.data.id, before = count();
      const submitted = kind === 'COMMAND'
        ? await server.request('POST', `/api/session/${sessionID}/command`, { name: 'ticket-plan', text: 'TST-909' })
        : await server.request('POST', `/api/session/${sessionID}/prompt`, { text: `${firstLine}\nTCASE_${kind}` });
      assert.equal(submitted.status, kind === 'COMMAND' ? 204 : 200);
      await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, `Ticketing ${kind}`, 25000);
      const state = trace.get(kind), acting = kind === 'COMMAND' ? 'planner' : actor;
      assert.deepEqual(state.tools.filter(name => name.startsWith('atlassian-rovo_')).sort(), [...(ROVO_ROLES[acting] ?? [])].sort(), `${kind} tool exposure`);
      const forwarded = ['RESOURCES', 'SEARCH', 'ISSUE', 'CONFLUENCE', 'REVIEWER_ISSUE'].includes(kind);
      assert.equal(count(), before + Number(forwarded), `${kind} forwarding boundary`);
      if (forwarded) assert(state.results.join('\n').includes('FIXTURE_ROVO_READ'));
      if (kind === 'DISCOVERY') assert(state.results.join('\n').includes('verdict --content'), 'The approved helper was not discoverable');
      const sessionResponse = await server.request('GET', `/api/session/${sessionID}`);
      const session = sessionResponse.value.data ?? sessionResponse.value;
      if (kind === 'MANUAL_TITLE') assert.equal(session.title, 'Operator manual title');
      if (['PR_TITLE', 'BRANCH_TITLE', 'DRAFT'].includes(kind)) assert.equal(session.title, buildTicketSessionTitle(actor, firstLine));
      if (kind === 'COMMAND') assert.equal(session.title, 'Análisis TST-909');
      if (kind === 'NO_HANDOFF') assert(!fs.existsSync(path.join(p.project, 'tmp')), 'An isolated ticket activated handoff');
      if (kind === 'DRAFT' || kind === 'COMMAND') {
        const key = kind === 'COMMAND' ? 'TST-909' : 'TST-101';
        const actual = fs.readFileSync(path.join(p.project, 'tmp', key, 'verdict.md'), 'utf8');
        assert(actual.includes('listo: synthetic evidence confirmed'));
        assert(headings.every(heading => actual.includes(`## ${heading}`)));
        assert.equal(state.results.length, 4, 'Handoff was not written, reread, updated and reread');
        assert(state.results[1].includes('borrador: pending hypothesis'), 'The draft was not actually reread');
        assert(state.results[3].includes('listo: synthetic evidence confirmed'), 'The updated handoff was not actually reread');
      }
      if (kind === 'RESULT') assert(fs.readFileSync(path.join(p.project, 'tmp/TST-101/result-dev.md'), 'utf8').includes('Synthetic implementation result'));
      assert(fs.readFileSync(p.editable).equals(beforeApp), 'Planner changed application content');
      assert(!fs.existsSync(path.join(p.project, 'verdict.md')), 'Symlink escaped ticket sandbox');
      console.log(`OK native Ticketing ${kind}`);
    }
    const forwarded = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse);
    assert(forwarded.every(call => !/create|update|delete|unreviewed/i.test(call.tool)));
    await server.close(); server = undefined;
    let challenges = 0;
    unauthorized = http.createServer((_request, response) => {
      challenges++;
      response.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="fixture"' });
      response.end(JSON.stringify({ error: 'Fixture authorization required' }));
    });
    await new Promise(resolve => unauthorized.listen(0, '127.0.0.1', resolve));
    const authDocument = structuredClone(p.document);
    // OAuth deliberately disabled on this negative fixture: no browser, client
    // registration or real account can be involved in the 401-path test.
    authDocument.mcp.servers['atlassian-rovo'] = { type: 'remote', url: `http://127.0.0.1:${unauthorized.address().port}/mcp`, oauth: false, codemode: false };
    fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify(authDocument, null, 2) + '\n');
    const pending = { ...p, document: authDocument };
    server = await startServer(base.binary, pending);
    await until(async () => (await getApiList(server.request, '/api/plugin')).some(item => item.id === 'opencode-ticketing.titles'), 'Ticketing pending-auth plugin');
    await inspectKnowledge(server, pending, ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })), { additionalMcp: ['atlassian-rovo'], additionalPlugins: ['opencode-ticketing.titles'] });
    const authState = await inspectTicketing(route => getApiList(server.request, route), p.roles);
    assert.notEqual(authState.rovoStatus, 'connected', '401 was reported as an authenticated connection');
    assert(challenges > 0, 'Native client did not reach the local 401 fixture');
    console.log('OK native Ticketing UNAUTHORIZED_STATE');
    console.log(JSON.stringify({ cases: trace.size + 1, agents: p.roles.length, skills: p.skills.length, ticketCommands: 6, rovoFixtureReads: forwarded.length, remoteMutationsForwarded: 0, actualJiraRequests: 0, copiedCredentials: false, realModelRequests: 0, handoff: 'local broker write/reread/update verified', unauthenticatedRovo: authState.rovoStatus }));
  } finally {
    await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
    if (unauthorized) { unauthorized.closeAllConnections(); await new Promise(resolve => unauthorized.close(resolve)); }
    fs.rmSync(root, { recursive: true, force: true });
  }
  verify(base);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
