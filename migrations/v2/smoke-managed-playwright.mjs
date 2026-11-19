// Real copied public runtime; fake model/other backends; owned loopback page only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareGeneral, generalEnvironment } from '../../v2/general/profile.mjs';
import { nativeAddonFixture } from './fixtures/general-addon-stack.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { layout } from './staging.mjs';

const root = fs.mkdtempSync('/tmp/opencode/managed-browser-smoke-');
const runtimeRoot = path.join(root, 'playwright-mcp-0.0.85');
let server, profile, origin, completed = false, failure, pageRequests = 0;
const operations = [];
function text(value) {
  if (typeof value === 'string') { try { return text(JSON.parse(value)); } catch { return value; } }
  if (Array.isArray(value)) return value.map(text).join('\n');
  if (value?.error) return JSON.stringify(value.error);
  if (value?.text !== undefined) return text(value.text);
  if (value?.content !== undefined) return text(value.content);
  return JSON.stringify(value);
}
const run = (script, input) => {
  const result = spawnSync('/usr/bin/python3', [fileURLToPath(new URL(script, import.meta.url))], { input: JSON.stringify(input), encoding: 'utf8', timeout: 180000,
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: os.homedir(), PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 2 * 1024 * 1024 });
  assert(!result.error && result.status === 0, result.stderr || 'Runtime operation failed'); return JSON.parse(result.stdout);
};
const site = http.createServer((_req, response) => { pageRequests++; response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Managed runtime fixture</title><h1>Owned test</h1><button id="managed-button" onclick="this.textContent=\'Clicked\'">Click me</button>'); });
const provider = http.createServer(async (request, response) => {
  try {
    let raw = ''; for await (const chunk of request) raw += chunk;
    assert(raw.length < 12 * 1024 * 1024); const body = JSON.parse(raw);
    const results = body.messages.filter(message => message.role === 'tool');
    const calls = [
      ['playwright_browser_set_mode', { mode: 'headless' }],
      ['playwright_browser_navigate', { url: origin }],
      ['playwright_browser_click', { target: '#managed-button' }],
      ['playwright_browser_snapshot', {}],
      ['playwright_browser_evaluate', { function: '() => document.querySelector("#managed-button").textContent' }],
      ['playwright_browser_take_screenshot', { type: 'png', scale: 'css', filename: path.join(profile.cache, 'playwright-output/managed-smoke.png') }],
      ['playwright_browser_close', {}],
    ];
    for (const item of results) { const decoded = text(item.content); assert(!/^\{"type":/.test(decoded), 'Actual managed tool reported an error: ' + decoded); }
    const selected = calls[results.length];
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (delta, finish_reason = null) => response.write('data: ' + JSON.stringify({ id: 'managed-browser-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
    if (selected) {
      operations.push(selected[0]); send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_' + results.length, type: 'function', function: { name: selected[0], arguments: '' } }] });
      send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected[1]) } }] });
    } else {
      assert.equal(results.length, 7); assert(text(results[4].content).includes('Clicked'));
      send({ role: 'assistant', content: 'MANAGED_FIXTURE_OK' }); completed = true;
    }
    send({}, selected ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n');
  } catch (error) { failure = error.message; response.writeHead(500); response.end('Managed runtime fixture failure'); }
});

async function main() {
  try {
    const selected = run('../../v2/playwright/selected-runtime.py', { home: os.homedir(), config: path.join(os.homedir(), '.config/opencode') });
    const managed = run('../../v2/playwright/managed_runtime.py', { action: 'prepare', root: runtimeRoot, selected });
    assert(managed.cli.startsWith(runtimeRoot + path.sep)); assert(managed.browser.startsWith(runtimeRoot + path.sep));
    await new Promise(resolve => site.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + site.address().port;
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    const project = path.join(root, 'project'); fs.mkdirSync(project);
    const control = path.join(root, 'control'); fs.mkdirSync(control); fs.writeFileSync(path.join(control, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(control, 'index.ts'), 'import {Plugin} from "@opencode/plugin";export default Plugin.define({id:"fixture.control",async setup(ctx){await ctx.session.hook("title",e=>{e.result="Managed browser fixture"})}});');
    const fixtures = nativeAddonFixture(root, { browserRuntime: managed });
    profile = prepareGeneral(path.join(root, 'profile'), { project, mock: `http://127.0.0.1:${provider.address().port}/v1`, contributions: fixtures.contributions, plugins: [control] });
    server = await startServer(layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary, profile, undefined, { environment: generalEnvironment });
    await until(async () => (await getApiList(server.request, '/api/mcp')).some(item => item.name === 'playwright' && item.status?.status === 'connected'), 'Managed MCP connection', 45000);
    const created = await server.request('POST', '/api/session', { agent: 'dev-test', location: { directory: project }, model: { providerID: 'workshop-mock', id: 'mock' } }); assert.equal(created.status, 200);
    await server.request('POST', `/api/session/${created.value.data.id}/prompt`, { text: 'Owned managed-runtime loopback integration only; no credentials or real sites.' });
    await until(() => { if (failure) throw new Error(failure); return completed; }, 'Managed browser workflow', 120000);
    const image = fs.readFileSync(path.join(profile.cache, 'playwright-output/managed-smoke.png'));
    assert(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))); assert(pageRequests > 0);
    await server.close(); server = undefined;
    run('../../v2/playwright/managed_runtime.py', { action: 'status', root: runtimeRoot });
    console.log(JSON.stringify({ realManagedToolCalls: operations.length, realModelRequests: 0, ownedLoopbackPage: true, publicRuntimeCopiedToTemporaryOnly: true,
      sourceCachesModified: false, personalProfilesCopied: false, browserOpenedVisible: false, networkDownloads: 0, originalStorageOpened: false, integrityAfterExecution: true }));
  } finally {
    await server?.close(); site.closeAllConnections(); provider.closeAllConnections();
    if (site.listening) await new Promise(resolve => site.close(resolve));
    if (provider.listening) await new Promise(resolve => provider.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
