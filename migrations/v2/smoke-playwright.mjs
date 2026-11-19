// Native V2 integration tests: synthetic model, five fixture MCPs, then a fresh
// isolated REAL headless browser against one owned loopback page. No user sites.
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
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';
import { playwrightExtension } from '../../v2/playwright/composition.mjs';
import { PLAYWRIGHT_TOOLS, PLAYWRIGHT_ROLES } from '../../v2/playwright/config.mjs';
import { inspectPlaywright } from '../../v2/playwright/inspect.mjs';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const fixture = name => fileURLToPath(new URL('./fixtures/' + name, import.meta.url));
const trace = new Map();
let profile, origin, providerError, pageRequests = 0;

function text(value) {
  if (typeof value === 'string') { try { return text(JSON.parse(value)); } catch { return value; } }
  if (Array.isArray(value)) return value.map(text).join('\n');
  if (value && typeof value === 'object') return typeof value.text === 'string' ? value.text : value.content ? text(value.content) : '';
  return '';
}

function call(kind, results) {
  if (kind === 'REAL_BROWSER') return [
    ['playwright_browser_set_mode', { mode: 'headless' }],
    ['playwright_browser_navigate', { url: origin + '/browser-fixture' }],
    ['playwright_browser_click', { target: '#increment' }],
    ['playwright_browser_snapshot', {}],
    ['playwright_browser_take_screenshot', { type: 'png', scale: 'css', filename: path.join(profile.cache, 'playwright-output/smoke.png') }],
    ['playwright_browser_close', {}],
  ][results.length];
  if (results.length) return undefined;
  if (['UNSAFE', 'SESSION_ALLOW_UNSAFE'].includes(kind)) return ['playwright_browser_run_code_unsafe', {}];
  if (kind === 'UNKNOWN') return ['playwright_unreviewed_tool', {}];
  if (kind === 'FILE_URL') return ['playwright_browser_navigate', { url: 'file:///fixture-never-read' }];
  if (kind === 'UPLOAD_ESCAPE') return ['playwright_browser_file_upload', { paths: ['/outside/fixture-never-read'] }];
  if (kind === 'SENSITIVE_UPLOAD') return ['playwright_browser_file_upload', { paths: [path.join(profile.project, '.env.fixture-never-read')] }];
  if (kind === 'OUTPUT_ESCAPE') return ['playwright_browser_take_screenshot', { filename: profile.editable }];
  if (kind === 'RELATIVE_OUTPUT') return ['playwright_browser_snapshot', { filename: 'app/message.txt' }];
  return ['playwright_browser_set_mode', { mode: 'headless' }];
}

async function main() {
  verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/playwright-wire-'), log = path.join(root, 'browser-calls.jsonl');
  const mock = http.createServer(async (request, response) => {
    if (request.url === '/browser-fixture') {
      pageRequests++;
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><html><head><title>Playwright pilot fixture</title></head><body><h1>Playwright pilot fixture</h1><button id="increment" onclick="document.getElementById(\'count\').textContent=\'Count: 1\'">Increment</button><p id="count">Count: 0</p></body></html>');
      return;
    }
    if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 8 * 1024 * 1024); }
      const body = JSON.parse(raw), kind = JSON.stringify(body.messages).match(/PWCASE_([A-Z_]+)/)?.[1]; assert(kind);
      const state = trace.get(kind) ?? { requests: 0 }; trace.set(kind, state); assert(++state.requests <= 9);
      state.tools = body.tools?.map(tool => tool.function?.name ?? tool.name) ?? [];
      state.results = body.messages.filter(message => message.role === 'tool').map(message => text(message.content));
      const selected = call(kind, state.results);
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ id: 'browser-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (selected) {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_' + kind + '_' + state.results.length, type: 'function', function: { name: selected[0], arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected[1]) } }] });
      } else send({ role: 'assistant', content: 'MOCK_OK' });
      send({}, selected ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n'); state.finished = !selected;
    } catch (error) { providerError = error.message; response.writeHead(500); response.end('Synthetic failure; values suppressed'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + mock.address().port;
  const mcp = (names, file) => ({ type: 'local', command: [process.execPath, fixture('ticketing-mcp.mjs')], environment: { FIXTURE_TOOLS: JSON.stringify(names), FIXTURE_LOG: path.join(root, file) }, codemode: false });
  const prior = context => {
    const knowledge = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode',
      server: mcp(ENGRAM_TOOLS.map(name => name.slice('engram_'.length)), 'engram-calls.jsonl'), permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
    const ticketing = ticketingExtension({ server: mcp(ROVO_TOOLS.map(name => name.slice('atlassian-rovo_'.length)), 'rovo-calls.jsonl') });
    const graph = codegraphExtension({ binding: { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' },
      server: { type: 'local', command: [process.execPath, fixture('codegraph-mcp.mjs')], environment: { FIXTURE_LOG: path.join(root, 'graph-calls.jsonl'), FIXTURE_ROOT: path.join(root, 'home/project') }, codemode: false } });
    return graph({ ...context, ...ticketing({ ...context, ...knowledge(context) }) });
  };
  const options = { mock: origin + '/v1', context7: true,
    mcpFixture: { type: 'local', command: [process.execPath, fixture('context7-mcp.mjs')], environment: { CONTEXT7_FIXTURE_LOG: path.join(root, 'context7-calls.jsonl') }, codemode: false } };
  let server;
  async function inspect(p) {
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-stack.playwright-access'), 'Playwright access plugin');
    await until(async () => (await get('/api/mcp')).filter(item => item.status?.status === 'connected').length === 5, 'five MCP catalogs');
    assert.equal((await inspectPlaywright(get, p.roles)).playwrightStatus, 'connected');
    await inspectCodeGraph(get, p.roles); await inspectTicketing(get, p.roles);
    await inspectKnowledge(server, p, ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })), { additionalMcp: ['atlassian-rovo', 'codegraph', 'playwright'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access', 'opencode-stack.playwright-access'] });
  }
  async function execute(kind, agent, permissions) {
    const created = await server.request('POST', '/api/session', { agent, model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: profile.project }, ...(permissions ? { permissions } : {}) });
    assert.equal(created.status, 200);
    assert.equal((await server.request('POST', `/api/session/${created.value.data.id}/prompt`, { text: 'PWCASE_' + kind + '\nBrowser integration fixture only; no user sites or credentials.' })).status, 200);
    await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, kind, 45000);
    return trace.get(kind);
  }
  try {
    const browser = playwrightExtension({ runtime: { home: root + '/runtime-home', cli: '/fixture/cli.js', browser: '/fixture/chrome', version: '0.0.85' },
      server: { type: 'local', command: [process.execPath, fixture('playwright-mcp.mjs')], environment: { FIXTURE_LOG: log }, codemode: false } });
    profile = prepareWorkshop(root, { ...options, extend: context => browser({ ...context, ...prior(context) }) });
    const app = fs.readFileSync(profile.editable);
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: profile.project, env: environment(profile), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'Native browser config rejected; raw output suppressed');
    server = await startServer(base.binary, profile); await inspect(profile);
    const count = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').length : 0;
    const cases = [
      ...PLAYWRIGHT_ROLES.map((role, index) => ['ALLOWED_' + String.fromCharCode(65 + index), role, true]),
      ...profile.roles.filter(role => !PLAYWRIGHT_ROLES.includes(role)).map((role, index) => ['DENIED_' + String.fromCharCode(65 + index), role, false]),
      ...['UNSAFE', 'UNKNOWN', 'FILE_URL', 'UPLOAD_ESCAPE', 'SENSITIVE_UPLOAD', 'OUTPUT_ESCAPE', 'RELATIVE_OUTPUT', 'SESSION_DENY', 'SESSION_ALLOW_UNSAFE'].map(kind => [kind, 'planner', false]),
    ];
    for (const [kind, role, forwarded] of cases) {
      const before = count();
      const permissions = kind === 'SESSION_DENY' ? [{ action: 'playwright_*', resource: '*', effect: 'deny' }] : kind === 'SESSION_ALLOW_UNSAFE' ? [{ action: 'playwright_browser_run_code_unsafe', resource: '*', effect: 'allow' }] : undefined;
      const state = await execute(kind, role, permissions);
      assert.deepEqual(state.tools.filter(name => name.startsWith('playwright_')).sort(), PLAYWRIGHT_ROLES.includes(role) && kind !== 'SESSION_DENY' ? [...PLAYWRIGHT_TOOLS].sort() : [], kind + ' catalog');
      assert.equal(count(), before + Number(forwarded), kind + ' forwarding');
      assert.equal(state.results.join('\n').includes('FIXTURE_PLAYWRIGHT_OK'), forwarded);
      assert(fs.readFileSync(profile.editable).equals(app));
      console.log('OK native Playwright ' + kind);
    }
    assert.equal(pageRequests, 0);
    await server.close(); server = undefined;
    // A separate disposable profile, real cached backend/browser, fake model and
    // other MCPs. Nothing is copied from an existing browser or auth store.
    const realRoot = fs.mkdtempSync('/tmp/opencode/playwright-browser-');
    try {
      const selected = spawnSync('python3', [fileURLToPath(new URL('../../v2/playwright/selected-runtime.py', import.meta.url))], { input: JSON.stringify({ home: os.homedir(), config: path.join(os.homedir(), '.config/opencode') }), encoding: 'utf8', env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' } });
      assert.equal(selected.status, 0, 'Existing browser runtime unavailable; no install attempted');
      const extension = playwrightExtension({ runtime: JSON.parse(selected.stdout) });
      profile = prepareWorkshop(realRoot, { ...options, extend: context => extension({ ...context, ...prior(context) }) });
      const realApp = fs.readFileSync(profile.editable);
      server = await startServer(base.binary, profile); await inspect(profile);
      const state = await execute('REAL_BROWSER', 'dev-test');
      assert.equal(state.results.length, 6, 'Expected mode/navigation/click/snapshot/screenshot/close');
      assert(state.results[1].includes('Playwright pilot fixture'), 'Navigation did not read the owned page');
      assert(state.results[3].includes('Count: 1'), 'Actual click/DOM change was not observed');
      const image = fs.readFileSync(path.join(profile.cache, 'playwright-output/smoke.png'));
      assert(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Expected a real PNG artifact');
      assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
      assert(fs.readFileSync(profile.editable).equals(realApp)); assert(pageRequests > 0);
      await server.close(); server = undefined;
      console.log('OK real isolated headless Playwright: navigation/click/snapshot/PNG/close against owned loopback page');
    } finally { await server?.close(); server = undefined; fs.rmSync(realRoot, { recursive: true, force: true }); }
    for (const file of ['engram-calls.jsonl', 'rovo-calls.jsonl', 'graph-calls.jsonl']) assert(!fs.existsSync(path.join(root, file)));
    console.log(JSON.stringify({ permissionCases: cases.length, realBrowserToolCalls: 6, realSitesVisited: 0, ownedLoopbackPage: true, unsafeCodeForwarded: 0, personalProfilesReused: false,
      visibleBrowserOpened: false, downloadsIssued: 0, actualIndexQueries: 0, realJiraToolCalls: 0, otherAddonsPreserved: true }));
  } finally {
    await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
