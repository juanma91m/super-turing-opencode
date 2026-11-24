import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { launchConsent, acquireCandidateLease, interactiveEnvironment, terminalEnvironment, runLiveCandidate } from '../launch.mjs';
import { prepareGeneral } from '../profile.mjs';
import { generalEnvironment } from '../profile.mjs';
import { prepare, layout } from '../../../v2/runtime/staging.mjs';
import { existingV2Storage, bindV2Storage } from '../storage.mjs';
import { startOwnedServer } from '../owned-server.mjs';
import { decodeList } from '../audit.mjs';
import { translateDormantProviders } from '../dormant-providers.mjs';
import { dormantFixture } from './dormant-fixture.mjs';
import { officialRuntime, candidateStatus } from '../lifecycle.mjs';
import { nativeAddonFixture } from '../../../v2/testing/fixtures/general-addon-stack.mjs';

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/general-launch-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'); fs.mkdirSync(project); fs.writeFileSync(path.join(project, 'app.txt'), 'PUBLIC_APPLICATION_UNCHANGED\n');
  return { root, project, target: path.join(root, 'candidate') };
}
const consent = { candidateOnly: true, clientClosed: true };
test('live consent separates candidate scope, client closure, reuse and actual TTY', () => {
  for (const options of [{}, { candidateOnly: true }, { clientClosed: true }]) assert.throws(() => launchConsent('verify-live', options), /candidate-only/);
  assert.doesNotThrow(() => launchConsent('verify-live', consent));
  assert.throws(() => launchConsent('chat', { ...consent, reuseV2Storage: true }, { input: false, output: false }), /interactive terminal/);
  assert.throws(() => launchConsent('chat', consent, { input: true, output: true }), /reuse-v2-storage/);
  assert.doesNotThrow(() => launchConsent('chat', { ...consent, reuseV2Storage: true }, { input: true, output: true }));
});
test('candidate lease refuses overlap and prepare, removes only its own inode, never adopts a stale/replaced lease', t => {
  const { target, project } = fixture(t), p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1' });
  const file = path.join(p.root, '.candidate-launch.lock'), release = acquireCandidateLease(p.root);
  assert.throws(() => acquireCandidateLease(p.root), /lease exists/); assert.throws(() => prepareGeneral(target, { project }), /lease exists/);
  release(); assert(!fs.existsSync(file));
  const second = acquireCandidateLease(p.root); fs.renameSync(file, file + '.retired'); fs.writeFileSync(file, 'UNKNOWN_REPLACEMENT');
  assert.throws(second, /lease changed/); assert.equal(fs.readFileSync(file, 'utf8'), 'UNKNOWN_REPLACEMENT');
});
test('terminal environment forwards only owned connection auth and approved desktop metadata', t => {
  const { target, project } = fixture(t), p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1' });
  const connection = { url: 'http://127.0.0.1:12345', env: { OPENCODE_PASSWORD: 'SYNTHETIC_OWNED' } };
  const env = terminalEnvironment(p, connection, { DISPLAY: ':8', GNOME_TERMINAL_SERVICE: ':fixture', GNOME_TERMINAL_SCREEN: '/fixture-screen', OPENCODE_PASSWORD: 'FOREIGN', OPENCODE_DB: '/v1/MUST_NOT_OPEN', OPENAI_API_KEY: 'MUST_NOT_FORWARD', NODE_OPTIONS: 'MUST_NOT_FORWARD' });
  assert.equal(env.OPENCODE_PASSWORD, 'SYNTHETIC_OWNED'); assert.equal(env.DISPLAY, ':8'); assert.equal(env.HOME, p.home);
  assert.equal(env.GNOME_TERMINAL_SERVICE, ':fixture'); assert.equal(env.GNOME_TERMINAL_SCREEN, '/fixture-screen');
  assert.equal(env.OPENCODE_DB, path.join(p.data, 'opencode/opencode.db')); assert.equal(env.OPENAI_API_KEY, undefined); assert.equal(env.NODE_OPTIONS, undefined);
  const server = interactiveEnvironment(p, { DISPLAY: ':8', WAYLAND_DISPLAY: 'wayland-fixture', OPENCODE_PASSWORD: 'FOREIGN', OPENAI_API_KEY: 'MUST_NOT_FORWARD' });
  assert.equal(server.DISPLAY, ':8'); assert.equal(server.WAYLAND_DISPLAY, 'wayland-fixture'); assert.equal(server.OPENCODE_PASSWORD, undefined); assert.equal(server.OPENAI_API_KEY, undefined);
  assert.throws(() => terminalEnvironment(p, { ...connection, url: 'http://outside.invalid' }), /Owned native connection/);
});
test('live invocation rejects prebound or overridden store paths before any native launch', async t => {
  const { target, project } = fixture(t), p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1' });
  for (const plan of [{ ...p, storageBinding: {} }, { ...p, data: '/v1/MUST_NOT_OPEN' }]) await assert.rejects(() => runLiveCandidate(plan, { binary: '/MUST_NOT_EXECUTE' }, 'verify-live', consent), /Unbound candidate/);
  assert(!fs.existsSync(path.join(p.root, '.candidate-launch.lock')));
});
test('live verification checks native base metadata without inference/login and removes its temporary probe and lease', async t => {
  const { target, project } = fixture(t); let requests = 0;
  const mock = http.createServer(async (request, response) => { for await (const _chunk of request) {} requests++; response.writeHead(500); response.end('No model call authorized'); });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  try {
    const p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:' + mock.address().port + '/v1' });
    const runtime = officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
    const report = await runLiveCandidate(p, runtime, 'verify-live', consent);
    assert.equal(report.ready, true); assert.equal(report.auditStatus, 'pass'); assert.equal(report.storage, 'candidate-isolated');
    assert.equal(report.mcpStarted, false); assert.equal(report.diagnosticSessionRemoved, true);
    assert.equal(report.actualHierarchyAcceptance, false); assert.equal(requests, 0); assert(!fs.existsSync(path.join(p.root, '.candidate-launch.lock')));
    assert.equal(fs.readFileSync(path.join(project, 'app.txt'), 'utf8'), 'PUBLIC_APPLICATION_UNCHANGED\n');
    assert(!JSON.stringify(report).includes('OPENCODE_PASSWORD'));
    assert.equal(fs.readdirSync(path.join(p.cache, 'general-runtime-probes')).length, 0); assert.equal(candidateStatus(p).status, 'ready-assets');
  } finally { mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
});
test('composed live verification starts only the five fixture MCP catalogs and retains22 roles and guards', async t => {
  const { root, project, target } = fixture(t), addons = nativeAddonFixture(root);
  const p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1', contributions: addons.contributions, runtimeHome: addons.runtimeHome });
  const report = await runLiveCandidate(p, officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')), 'verify-live', consent);
  assert.equal(report.ready, true); assert.equal(report.roles, 22); assert.equal(report.commands, 34); assert.equal(report.mcp.length, 5);
  assert(report.mcp.every(item => item.status === 'connected')); assert.equal(report.modelRequestsIssuedByLauncher, 0);
  for (const name of ['engram', 'context7', 'rovo', 'graph', 'browser']) assert(!fs.existsSync(path.join(root, name + '-calls.jsonl')), 'No functional backend tools should run');
  assert(!fs.existsSync(path.join(p.root, '.candidate-launch.lock')));
});
test('live verification checks preserved dormant providers and disabled discovery without contacting the owned endpoint', async t => {
  const { target, project } = fixture(t); let requests = 0;
  const local = http.createServer(async (request, response) => { for await (const _chunk of request) {} requests++; response.writeHead(500); response.end('No local discovery/inference authorized'); });
  await new Promise(resolve => local.listen(0, '127.0.0.1', resolve));
  try {
    const dormantProviders = translateDormantProviders(dormantFixture('http://127.0.0.1:' + local.address().port + '/v1'));
    const p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1', dormantProviders });
    const report = await runLiveCandidate(p, officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')), 'verify-live', consent);
    assert.equal(report.ready, true); assert.deepEqual(report.dormantProvidersChecked, ['ollama']); assert(report.disabledDiscoveryPluginsChecked.includes('opencode.provider.ollama'));
    assert.equal(requests, 0); assert.equal(report.modelRequestsIssuedByLauncher, 0);
  } finally { local.closeAllConnections(); await new Promise(resolve => local.close(resolve)); }
});
test('unreviewed local execution layers fail before host startup, shared-store selection or execution of a local plugin', async t => {
  const { target, project, root } = fixture(t), p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1' });
  fs.mkdirSync(path.join(project, '.opencode'));
  const marker = path.join(root, 'MUST_NOT_EXECUTE');
  fs.writeFileSync(path.join(project, '.opencode/evil.ts'), 'import fs from "node:fs";fs.writeFileSync(' + JSON.stringify(marker) + ',"MUST_NOT_EXECUTE");export default {};');
  fs.writeFileSync(path.join(project, '.opencode/opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', plugins: [path.join(project, '.opencode/evil.ts')] }));
  await assert.rejects(() => runLiveCandidate(p, officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')), 'verify-live', { ...consent, reuseV2Storage: true, stagingRoot: '/MUST_NOT_SELECT_STORAGE' }), /Unreviewed/);
  assert(!fs.existsSync(marker)); assert(!fs.existsSync(path.join(p.data, 'opencode/opencode.db'))); assert(!fs.existsSync(path.join(p.root, '.candidate-launch.lock')));
});

test('native metadata command rejects other actors and non-nonce input without writing a receipt or starting inference', async t => {
  const { target, project } = fixture(t), p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1' });
  const runtime = officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  const server = await startOwnedServer(runtime.binary, p, generalEnvironment);
  try {
    for (const [agent, text] of [['reviewer', '01234567-0123-0123-0123-0123456789ab'], ['agent-design', '../../MUST_NOT_WRITE']]) {
      const created = await server.request('POST', '/api/session', { agent, title: 'Owned negative diagnostic fixture', location: { directory: project } }); assert.equal(created.status, 200);
      const id = created.value.data.id;
      const invoked = await server.request('POST', '/api/session/' + id + '/command', { name: 'stack-runtime-probe', text });
      assert(invoked.status >= 400, 'Unauthorized metadata command must fail before execution');
      assert.equal((await server.request('DELETE', '/api/session/' + id)).status, 204);
    }
    assert(!fs.existsSync(path.join(p.cache, 'general-runtime-probes')));
  } finally { await server.close(); }
});

test('failed MCP startup is reported as not ready and the launcher still releases its host and lease', async t => {
  const { target, project } = fixture(t);
  const contribution = { id: 'failed-mcp-fixture', apply(ctx) {
    ctx.document.mcp.servers.fixture = { type: 'local', command: ['/MUST_NOT_EXIST_CANDIDATE_MCP'], codemode: false };
    ctx.document.policies.push({ action: 'mcp.use', resource: 'fixture', effect: 'allow' });
  } };
  const p = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1', contributions: [contribution] });
  const report = await runLiveCandidate(p, officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')), 'verify-live', consent);
  assert.equal(report.ready, false); assert.equal(report.readyForChat, false); assert.notEqual(report.mcp[0].status, 'connected');
  assert(!fs.existsSync(path.join(p.root, '.candidate-launch.lock')));
});

for (const authenticatedFixture of [true, false]) test(authenticatedFixture ? 'real candidate TUI opens a fresh mock session in reused native fixture storage and releases its owned resources' : 'real candidate launcher stops before TUI when OpenAI native connection metadata is absent; no login fallback', async t => {
  const { root, project, target } = fixture(t), syntheticStaging = path.join(root, 'opencode-v2-clean');
  prepare(layout(syntheticStaging)); const pilot = prepare(layout(path.join(syntheticStaging, 'pilot')));
  const runtime = officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')); let server, requests = 0;
  const mock = http.createServer(async (request, response) => { for await (const _chunk of request) {} requests++; response.writeHead(500); response.end('No inference authorized'); });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  try {
    const mockURL = 'http://127.0.0.1:' + mock.address().port + '/v1';
    const initial = prepareGeneral(path.join(root, 'initial'), { project, mock: mockURL });
    server = await startOwnedServer(runtime.binary, { ...initial, data: pilot.data, state: pilot.state }, generalEnvironment);
    const created = await server.request('POST', '/api/session', { agent: 'master-dev', title: 'Existing synthetic session must remain unchanged', location: { directory: project }, model: { providerID: 'workshop-mock', id: 'mock' } });
    assert.equal(created.status, 200); const existingSessionID = created.value.data.id; await server.close(); server = undefined;
    const plan = { project, ...(authenticatedFixture ? { mock: mockURL } : {}) }, p = prepareGeneral(target, plan);
    const descriptor = path.join(root, 'public-chat-fixture.json'); fs.writeFileSync(descriptor, JSON.stringify({ target, plan, syntheticStaging, existingSessionID, officialRoot: path.join(os.homedir(), '.local/share/opencode-v2-clean') }));
    const child = spawn('/usr/bin/python3', [new URL('./chat-pty.py', import.meta.url).pathname, process.execPath, new URL('./chat-worker.mjs', import.meta.url).pathname, descriptor], { cwd: project, env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: os.homedir(), PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.resume();
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }); assert.equal(code, 0, 'Synthetic terminal harness failed; transcript suppressed');
    const terminal = JSON.parse(stdout); assert.equal(terminal.workerExited, true); assert.equal(terminal.workerClosed, true);
    assert.equal(terminal.nativeTuiReady, authenticatedFixture); assert.equal(terminal.authNotReady, !authenticatedFixture); assert.equal(terminal.prelaunchFailed, !authenticatedFixture);
    assert.equal(requests, 0); assert(!fs.existsSync(path.join(p.root, '.candidate-launch.lock'))); assert.equal(fs.readdirSync(path.join(p.cache, 'general-runtime-probes')).length, 0);
    const bound = bindV2Storage(p, existingV2Storage(syntheticStaging), { clientClosed: true, reuseV2Storage: true });
    server = await startOwnedServer(runtime.binary, bound, generalEnvironment);
    const old = await server.request('GET', '/api/session/' + existingSessionID); assert.equal(old.status, 200); assert.equal(old.value.data.title, 'Existing synthetic session must remain unchanged');
    const sessions = decodeList((await server.request('GET', '/api/session')).value);
    assert.equal(sessions.length, authenticatedFixture ? 2 : 1, 'Only a fresh chat may survive; diagnostic session must be removed');
    assert(!fs.existsSync(path.join(p.data, 'opencode/opencode.db')), 'No DB copy or isolated fallback after explicit reuse');
  } finally { await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
});
