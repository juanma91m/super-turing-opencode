// Complete question -> pending form -> real TUI -> reply, on disposable data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { layout, verify } from './staging.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';
import { prepareGeneral } from '../../v2/general/profile.mjs';
import { notifierContribution } from '../../../super-turing-opencode-notifier/v2/general.mjs';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const stockControl = process.argv[2] === '--stock-control';
const omitWorkshop = process.argv[2] === '--omit-workshop';
const regressionControl = process.argv[2] === '--regression-control';
const desktopParity = ['--desktop-parity', '--desktop-parity-permission'].includes(process.argv[2]);
const desktop = desktopParity || ['--desktop', '--desktop-permission'].includes(process.argv[2]);
const permission = process.argv[2] === '--permission' || ['--desktop-permission', '--desktop-parity-permission'].includes(process.argv[2]);
const forceProtocol = process.argv[2] === '--transport-osc777';
const transport = process.argv[2] === '--transport' || forceProtocol;
assert(process.argv.length === 2 || (stockControl || omitWorkshop || regressionControl || permission || transport || desktop) && process.argv.length === 3, 'Usage: node smoke-question.mjs [--stock-control|--omit-workshop|--regression-control|--permission|--transport|--transport-osc777|--desktop|--desktop-permission|--desktop-parity|--desktop-parity-permission]');
let modelRequests = 0;
let reply;
const input = { questions: [{ question: 'SYNTHETIC_QUESTION_UI', header: 'Fixture', options: [{ label: 'YES_FIXTURE', description: 'Synthetic yes' }, { label: 'NO_FIXTURE', description: 'Synthetic no' }] }] };

async function main() {
  verify(base);
  const mock = http.createServer(async (request, response) => {
    try {
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 2 * 1024 * 1024); }
      const body = JSON.parse(raw); assert(++modelRequests <= 4);
      if (permission) assert(!raw.includes('SYNTHETIC_PERMISSION_CONTENT_MUST_NOT_REACH_MODEL'), 'Rejected fixture content reached the model');
      const outputs = body.messages.filter(message => message.role === 'tool');
      if (outputs.length) reply = outputs.map(message => message.content).join('\n');
      const common = { id: 'question-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock' };
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (outputs.length) send({ role: 'assistant', content: 'QUESTION_DONE' });
      else {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_question', type: 'function', function: { name: permission ? 'read' : 'question', arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(permission ? { path: '.ssh/PERMISSION_UI_PROBE.txt' } : input) } }] });
      }
      send({}, outputs.length ? 'stop' : 'tool_calls'); response.end('data: [DONE]\n\n');
    } catch { response.writeHead(500); response.end('Synthetic protocol failure'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const root = fs.mkdtempSync('/tmp/opencode/question-ui-');
  const p = prepareWorkshop(root, { mock: `http://127.0.0.1:${mock.address().port}/v1` });
  const probeReport = path.join(root, 'transport-probe.jsonl');
  const desktopLog = path.join(root, 'desktop-dry-run.jsonl');
  const desktopCalls = () => fs.existsSync(desktopLog) ? fs.readFileSync(desktopLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  if (desktop) {
    const file = path.join(p.config, 'opencode/cli.json');
    const cli = JSON.parse(fs.readFileSync(file, 'utf8'));
    cli.attention = { notifications: false, sound: false };
    cli.plugins = ['-opencode.notifications', { package: fileURLToPath(new URL('../../../super-turing-opencode-notifier/v2/desktop/', import.meta.url)).replace(/\/$/, ''), options: { directory: p.project, when: 'always', dryRunLog: desktopLog } }];
    if (desktopParity) {
      const configPath=path.join(root,'notify.json'); fs.writeFileSync(configPath,'{"quietHours":{"enabled":false},"sounds":{"idle":"Fixture","question":"Fixture","permission":"Fixture"}}');
      const candidate=prepareGeneral(path.join(root,'notifier-candidate'),{project:p.project,mock:`http://127.0.0.1:${mock.address().port}/v1`,contributions:[notifierContribution({configPath})]});
      const configured=JSON.parse(candidate.assets.get(path.join(candidate.config,'opencode/cli.json'))).plugins;
      configured[1].options.dryRunLog=desktopLog; cli.plugins=configured;
    }
    fs.writeFileSync(file, JSON.stringify(cli));
  }
  if (transport) {
    const file = path.join(p.config, 'opencode/cli.json');
    const cli = JSON.parse(fs.readFileSync(file, 'utf8'));
    cli.attention = { notifications: true, sound: false };
    cli.plugins = [{ package: fileURLToPath(new URL('../../../super-turing-opencode-notifier/v2/transport-probe/', import.meta.url)), options: { report: probeReport, testOnlyCaptureNotify: true } }];
    fs.writeFileSync(file, JSON.stringify(cli));
  }
  if (permission) {
    fs.mkdirSync(path.join(p.project, '.ssh'));
    fs.writeFileSync(path.join(p.project, '.ssh/PERMISSION_UI_PROBE.txt'), 'SYNTHETIC_PERMISSION_CONTENT_MUST_NOT_REACH_MODEL');
  }
  if (stockControl) fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify({ ...p.document, plugins: [] }, null, 2));
  if (omitWorkshop) fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify({ ...p.document, plugins: p.document.plugins.slice(0, -1) }, null, 2));
  if (regressionControl) {
    // Negative control: restore the proven bad transformation in a temporary
    // copy, never in the user's plugin or storage.
    const directory = path.join(root, 'counterfactual'); fs.mkdirSync(directory);
    fs.copyFileSync(new URL('../../v2/context7/policy.mjs', import.meta.url), path.join(root, 'context7-policy.mjs'));
    let guard = fs.readFileSync(new URL('./workshop-guard/guard.mjs', import.meta.url), 'utf8');
    const original = "if (name === 'question') continue;";
    assert(guard.includes(original));
    guard = guard.replace(original, '');
    fs.writeFileSync(path.join(directory, 'guard.mjs'), guard);
    fs.copyFileSync(new URL('./workshop-guard/index.ts', import.meta.url), path.join(directory, 'index.ts'));
    fs.copyFileSync(new URL('./workshop-guard/package.json', import.meta.url), path.join(directory, 'package.json'));
    const document = structuredClone(p.document); document.plugins.at(-1).package = directory;
    fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify(document, null, 2));
  }
  let server, client;
  try {
    server = await startServer(base.binary, p);
    const created = await server.request('POST', '/api/session', { title: 'Question fixture', agent: 'master-dev', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project } });
    assert.equal(created.status, 200);
    const sessionID = created.value.data.id;
    const clientEnv = { ...server.connection.env, ...(transport ? { VTE_VERSION: '8001' } : {}), ...(forceProtocol ? { OPENTUI_NOTIFICATION_PROTOCOL: 'osc777' } : {}) };
    client = spawn('python3', [fileURLToPath(new URL('./question-pty.py', import.meta.url)), base.binary, server.connection.url, sessionID, p.project], { cwd: p.project, env: clientEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    client.stderr.resume();
    const records = [];
    createInterface({ input: client.stdout }).on('line', line => { try { records.push(JSON.parse(line)); } catch { /* No transcript output expected. */ } });
    const ready = await until(() => records.find(record => record.kind === 'ready'), 'TUI ready');
    assert(ready.agentVisible, 'Master footer missing');
    if (desktop) {
      client.stdin.write(JSON.stringify({ action: 'desktop-test' }) + '\n');
      await until(() => desktopCalls().some(call => call.kind === 'test'), 'manual TUI notification command');
      await until(() => records.find(record => record.kind === 'desktop-test'), 'TUI test command settled');
      assert.equal(modelRequests, 0, 'Notification test command unexpectedly invoked a model');
      assert.equal(desktopCalls().filter(call => call.kind === 'test').length, 1, 'Test command duplicated');
    }
    if (transport) {
      await until(() => fs.existsSync(probeReport) && fs.readFileSync(probeReport, 'utf8').includes('"loaded"'), 'transport probe loaded');
      client.stdin.write(JSON.stringify({ action: 'blur' }) + '\n');
      await until(() => records.find(record => record.kind === 'blur'), 'simulated focus report');
    }
    assert.equal((await server.request('POST', `/api/session/${sessionID}/prompt`, { text: 'Synthetic question fixture' })).status, 200);
    const pendingPath = `/api/session/${sessionID}/${permission ? 'permission' : 'form'}`;
    const forms = await until(async () => {
      const result = await server.request('GET', pendingPath);
      return result.value?.data?.length ? result.value.data : undefined;
    }, 'backend interactive request', 20000);
    console.log(JSON.stringify({ stockControl, permission, backendPending: forms.length, sessionMatch: forms[0].sessionID === sessionID }));
    client.stdin.write(JSON.stringify({ action: 'inspect' }) + '\n');
    const ui = await until(() => records.find(record => record.kind === 'inspect'), 'TUI inspection');
    console.log(JSON.stringify(ui));
    if (desktop) {
      assert.equal(ui.osc777Notifications + ui.osc9Notifications, 0, 'Native notification output must remain disabled');
      await until(() => desktopCalls().some(call => call.kind === (permission ? 'permission' : 'question')), 'desktop event routed to simulated sender');
    }
    if (transport) {
      const log = fs.readFileSync(probeReport, 'utf8').trim().split('\n').map(JSON.parse);
      console.log(JSON.stringify({ transportProbe: log }));
      const notified = log.find(record => record.kind === 'notify-result');
      assert(notified && notified.focus === 'blurred' && !notified.skipped, 'Focus/configuration prevented transport test');
      if (forceProtocol) {
        assert(notified.notificationsCapability && notified.notification && ui.osc777Notifications >= 2, 'OSC 777 was not emitted');
      } else {
        assert(!notified.notificationsCapability && !notified.notification && ui.osc777Notifications === 0, 'Auto detection changed; review before keeping override');
      }
    }
    if (permission) {
      assert(ui.permissionVisible && ui.permissionProbeVisible, 'Backend permission exists but TUI does not render it');
      client.stdin.write(JSON.stringify({ action: 'reject' }) + '\n');
      await until(async () => (await server.request('GET', pendingPath)).value.data.length === 0, 'permission rejection', 10000);
      assert(!reply?.includes('SYNTHETIC_PERMISSION_CONTENT_MUST_NOT_REACH_MODEL'));
      console.log(JSON.stringify({ permissionLifecycle: 'rendered/rejected', contentDisclosed: false, modelRequests, realModelRequests: 0 }));
      if (desktop) console.log(JSON.stringify({ desktopPermissionEvents: desktopCalls().filter(call => call.kind === 'permission').length, realOsNotifications: 0 }));
      return;
    }
    if (regressionControl) {
      assert(!ui.questionVisible && !ui.yesVisible && !ui.noVisible, 'Negative control no longer reproduces; review pinned host behavior');
      console.log(JSON.stringify({ regressionReproduced: true, userStorageTouched: false, realModelRequests: 0 }));
      return;
    }
    assert(ui.questionVisible && ui.yesVisible && ui.noVisible, 'Backend form exists but TUI does not render it');
    client.stdin.write(JSON.stringify({ action: 'answer' }) + '\n');
    await until(() => reply, 'question answer', 10000);
    assert(reply.includes('YES_FIXTURE'), 'Native keyboard reply did not reach tool');
    assert.equal((await server.request('GET', `/api/session/${sessionID}/form`)).value.data.length, 0);
    if (desktop) {
      await until(() => desktopCalls().some(call => call.kind === 'done'), 'desktop completion event');
      const calls = desktopCalls();
      for (const kind of ['test', 'question', 'done']) assert.equal(calls.filter(call => call.kind === kind).length, 1, `Duplicate/missing ${kind}`);
      console.log(JSON.stringify({ desktopEvents: calls.map(call => call.kind), realOsNotifications: 0 }));
    }
    console.log(JSON.stringify({ questionLifecycle: 'rendered/replied/completed', modelRequests, realModelRequests: 0 }));
  } finally {
    if (client) {
      const ended = new Promise(resolve => client.once('exit', resolve));
      client.stdin.end(JSON.stringify({ action: 'stop' }) + '\n');
      await Promise.race([ended, new Promise(resolve => setTimeout(resolve, 7000))]);
      if (client.exitCode === null && client.signalCode === null) client.kill('SIGTERM');
    }
    await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
