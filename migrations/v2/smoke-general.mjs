import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { layout } from './staging.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { prepareGeneral, generalEnvironment } from '../../v2/general/profile.mjs';
import { effect } from '../../v2/general/policy.mjs';

const root = fs.mkdtempSync('/tmp/opencode/general-native-'), project = path.join(root, 'project');
fs.mkdirSync(path.join(project, 'src'), { recursive: true });
fs.mkdirSync(path.join(project, '.opencode'), { recursive: true });
fs.writeFileSync(path.join(project, 'src/example.cjs'), 'module.exports = "old";\n');
fs.writeFileSync(path.join(project, '.env.synthetic'), 'SYNTHETIC_ONLY\n');
fs.writeFileSync(path.join(project, 'AGENTS.md'), '# PROJECT_DELTA_FIXTURE\nProject-specific synthetic instructions, not organizational policy or tool grants.\n');
fs.writeFileSync(path.join(project, '.opencode/opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', agents: {
  reviewer: { permissions: [{ action: 'shell', resource: 'git show *', effect: 'deny' }] },
  planner: { permissions: [{ action: 'subagent', resource: 'backend-java-developer', effect: 'allow' }] },
} }));
const git = spawnSync('/usr/bin/git', ['init', '--quiet'], { cwd: project, env: { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8' }); assert.equal(git.status, 0);
const organization = path.join(root, 'organization'); fs.mkdirSync(organization);
fs.writeFileSync(path.join(organization, 'package.json'), '{"type":"module"}');
fs.writeFileSync(path.join(organization, 'index.ts'), 'import { Plugin } from "@opencode/plugin"; export default Plugin.define({ id:"synthetic.organization", async setup(ctx) { await ctx.session.hook("context", event => { event.system.push({type:"text",text:"SYNTHETIC_ORGANIZATION_POLICY: additive context, no role replacement or permission grant."}); }); } });');
const control = path.join(root, 'control'); fs.mkdirSync(control);
fs.writeFileSync(path.join(control, 'package.json'), '{"type":"module"}');
fs.writeFileSync(path.join(control, 'index.ts'), 'import { Plugin } from "@opencode/plugin"; export default Plugin.define({ id:"synthetic.control", async setup(ctx) { await ctx.session.hook("title", event => { event.result="Synthetic candidate fixture"; }); } });');

const trace = new Map(); let profile, qaSession, parentSession, targetSession, unrelatedSession, providerError, server, providerRequests = 0;
const broker = suffix => 'python3 ' + profile.broker + ' ' + suffix;
function select(kind, results) {
  if (results.length) return undefined;
  if (['READ', 'BASE_ONLY', 'ORG_ONLY'].includes(kind)) return ['read', { path: 'src/example.cjs' }];
  if (kind === 'WRITE') return ['write', { path: 'src/example.cjs', content: 'module.exports = "new";\n' }];
  if (kind === 'BUILD') return ['shell', { command: 'node -e "if(require(\'./src/example.cjs\')!==\'new\')process.exit(1); console.log(\'GENERAL_BUILD_OK\'); console.log(process.env.OPENCODE_PASSWORD ? \'LEAK\' : \'NO_HOST_SECRET\')"' }];
  if (['RO_WRITE', 'UI_WRITE', 'RO_OVERRIDE'].includes(kind)) return ['write', { path: 'src/example.cjs', content: 'MUST_NOT_WRITE\n' }];
  if (kind === 'PLANNER_DOC') return ['shell', { command: broker("helper analysis-doc write --path tmp/general/analysis.md --content '# Synthetic analysis\nOnly an explicitly requested document.'") }];
  if (kind === 'PLANNER_READ_DOC') return ['read', { path: 'tmp/general/analysis.md' }];
  if (kind === 'PLANNER_ESCAPE') return ['shell', { command: broker("helper analysis-doc write --path src/escape.md --content 'MUST_NOT_WRITE'") }];
  if (kind === 'PLANNER_HELP' || kind === 'TAMPERED_BROKER') return ['shell', { command: broker('--help') }];
  if (kind === 'PLANNER_SHELL') return ['shell', { command: 'node --version' }];
  if (kind === 'ENV') return ['read', { path: '.env.synthetic' }];
  if (kind === 'STATUS') return ['stack-layer-status', {}];
  if (kind === 'ROUTE_READ' || kind === 'NESTED') return ['subagent', { agent: 'reviewer', description: 'Inspect synthetic source', prompt: 'GCASE_CHILD_READ\nRead src/example.cjs and return FIXTURE_CHILD_READ.', background: false }];
  if (kind === 'FOLLOWUP') return ['subagent', { agent: 'reviewer', sessionID: qaSession, description: 'Continue synthetic read-only inspection', prompt: 'GCASE_CHILD_READ\nReturn FIXTURE_CHILD_READ again.', background: false }];
  if (kind === 'WRONG_SESSION') return ['subagent', { agent: 'reviewer', sessionID: unrelatedSession, description: 'Must not resume unrelated session', prompt: 'MUST_NOT_EXECUTE', background: false }];
  if (kind === 'ROUTE_WRITE' || kind === 'PLANNER_WRITER') return ['subagent', { agent: 'backend-java-developer', description: 'Bounded synthetic writer', prompt: 'GCASE_CHILD_WRITE\nWrite only src/from-child.txt with FIXTURE_CHILD_WRITE. Do not delegate.', background: false }];
  if (kind === 'PLANNER_SESSION_WRITER') return ['subagent', { agent: 'frontend-web-developer', description: 'Undeclared native target must not run', prompt: 'GCASE_CHILD_WRITE', background: false }];
  if (kind === 'CHILD_READ') return ['read', { path: 'src/example.cjs' }];
  if (kind === 'CHILD_WRITE') return ['write', { path: 'src/from-child.txt', content: 'FIXTURE_CHILD_WRITE\n' }];
  if (kind === 'SESSIONS') return ['stack-sessions-list', { includeRoot: true }];
  if (['CLEAN', 'CLEAN_ASK', 'CLEAN_OWN'].includes(kind)) return ['stack-sessions-clean', { includeRoot: true, sessionIDs: [kind === 'CLEAN_OWN' ? parentSession : targetSession] }];
  if (kind === 'RESTRICTED_SHELL') return ['shell', { command: 'git show --stat' }];
  throw new Error('Unknown synthetic case: ' + kind);
}
function decode(value) {
  if (typeof value === 'string') { try { return decode(JSON.parse(value)); } catch { return value; } }
  if (Array.isArray(value)) return value.map(decode).join('\n');
  if (value?.error) return JSON.stringify(value.error);
  if (value?.text !== undefined) return decode(value.text);
  if (value?.content !== undefined) return decode(value.content);
  return JSON.stringify(value);
}
const mock = http.createServer(async (request, response) => {
  try {
    let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 8 * 1024 * 1024); }
    const body = JSON.parse(raw), system = JSON.stringify(body.messages.filter(message => message.role === 'system')); providerRequests++;
    const requested = [...JSON.stringify(body.messages.filter(message => message.role === 'user').at(-1)).matchAll(/GCASE_([A-Z_]+)/g)].at(-1)?.[1];
    const childRead = system.includes('currently operating as the \\"reviewer\\" agent') && !['RO_WRITE', 'RO_OVERRIDE', 'RESTRICTED_SHELL'].includes(requested);
    const kind = childRead ? 'CHILD_READ' : requested;
    assert(kind, 'Auxiliary request was not disabled by the production candidate; fixture received an unexpected request');
    const state = trace.get(kind) ?? { requests: 0 }; trace.set(kind, state); assert(++state.requests < 12, kind);
    state.tools = body.tools?.map(tool => (tool.function ?? tool).name) ?? [];
    state.results = body.messages.filter(message => message.role === 'tool' && message.tool_call_id?.startsWith('call_' + kind + '_')).map(message => decode(message.content));
    state.global = system.includes('Eres `master-dev`') || system.includes('Eres un reviewer tecnico') || system.includes('Eres `planner`');
    state.organization = system.includes('SYNTHETIC_ORGANIZATION_POLICY'); state.project = system.includes('PROJECT_DELTA_FIXTURE');
    const call = select(kind, state.results);
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (delta, finish_reason = null) => response.write('data: ' + JSON.stringify({ id: 'general-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
    if (call) {
      send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_' + kind + '_' + state.results.length, type: 'function', function: { name: call[0], arguments: '' } }] });
      send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(call[1]) } }] });
    } else send({ role: 'assistant', content: kind === 'CHILD_READ' ? 'FIXTURE_CHILD_READ' : kind === 'CHILD_WRITE' ? 'FIXTURE_CHILD_WRITE' : 'FIXTURE_OK' });
    send({}, call ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n'); state.finished = !call;
  } catch (error) { providerError = error.message; response.writeHead(500); response.end('Fixture failure'); }
});

async function main() {
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  try {
    const binary = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary;
    for (const kind of ['BASE_ONLY', 'ORG_ONLY', 'REPLACED_PROMPT']) {
      const directory = path.join(root, kind); fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
      fs.writeFileSync(path.join(directory, 'src/example.cjs'), 'module.exports="fixture";\n');
      assert.equal(spawnSync('/usr/bin/git', ['init', '--quiet'], { cwd: directory, env: { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).status, 0);
      if (kind === 'REPLACED_PROMPT') {
        fs.mkdirSync(path.join(directory, '.opencode'));
        fs.writeFileSync(path.join(directory, '.opencode/opencode.json'), JSON.stringify({ agents: { 'master-dev': { system: 'Replacement loses the global role' } } }));
      }
      const p = prepareGeneral(path.join(root, kind + '-profile'), { project: directory, mock: `http://127.0.0.1:${mock.address().port}/v1`, plugins: [control, ...(kind === 'ORG_ONLY' ? [organization] : [])] });
      const probe = await startServer(binary, p, undefined, { environment: generalEnvironment });
      try {
        await until(async () => (await getApiList(probe.request, '/api/plugin')).some(plugin => plugin.id === 'opencode-stack.general'), 'Layer probe ready');
        const created = await probe.request('POST', '/api/session', { agent: 'master-dev', location: { directory }, model: { providerID: 'workshop-mock', id: 'mock' } });
        assert.equal(created.status, 200); const id = created.value.data.id, before = providerRequests;
        await probe.request('POST', `/api/session/${id}/prompt`, { text: 'GCASE_' + kind });
        if (kind === 'REPLACED_PROMPT') {
          const failure = await until(async () => { const result = await probe.request('GET', `/api/session/${id}/context`); return result.value?.data?.find(message => message.type === 'idle' && message.error)?.error; }, 'Replacement must fail closed');
          assert(failure.message.includes('global role prompt')); assert.equal(providerRequests, before);
        } else {
          await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, kind, 30000);
          assert(trace.get(kind).global); assert.equal(trace.get(kind).organization, kind === 'ORG_ONLY'); assert.equal(trace.get(kind).project, false);
        }
        console.log('OK native layer ' + kind);
      } finally { await probe.close(); }
    }
    profile = prepareGeneral(path.join(root, 'profile'), { project, mock: `http://127.0.0.1:${mock.address().port}/v1`, plugins: [control, organization] });
    const debug = spawnSync(binary, ['debug', 'config', '--standalone'], { cwd: project, env: generalEnvironment(profile), encoding: 'utf8', timeout: 30000 }); assert.equal(debug.status, 0, 'Native general config rejected; output suppressed');
    server = await startServer(binary, profile, undefined, { environment: generalEnvironment });
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(plugin => plugin.id === 'opencode-stack.general'), 'General plugin');
    const agents = await get('/api/agent'), reviewer = agents.find(agent => agent.id === 'reviewer');
    assert(reviewer.system.includes('Eres un reviewer tecnico')); assert.equal(reviewer.mode, 'subagent');
    assert.equal(effect(reviewer.permissions, 'edit'), 'deny'); assert.equal(effect(reviewer.permissions, 'subagent'), 'deny');
    assert.equal(effect(reviewer.permissions, 'shell', 'git diff --stat'), 'allow'); assert.equal(effect(reviewer.permissions, 'shell', 'git show --stat'), 'deny');
    for (const id of ['plan', 'build']) assert(agents.find(agent => agent.id === id).hidden);
    const commands = await get('/api/command'); for (const name of profile.commands) assert(commands.some(command => command.name === name));
    const create = async (agent = 'master-dev', permissions) => {
      const result = await server.request('POST', '/api/session', { agent, location: { directory: project }, model: { providerID: 'workshop-mock', id: 'mock' }, ...(permissions ? { permissions } : {}) });
      assert.equal(result.status, 200); return result.value.data.id;
    };
    const execute = async (kind, agent = 'master-dev', permissions, sessionID) => {
      const id = sessionID ?? await create(agent, permissions);
      if (kind === 'CLEAN_OWN') parentSession = id;
      assert.equal((await server.request('POST', `/api/session/${id}/prompt`, { text: 'GCASE_' + kind + '\nOnly the owned synthetic project; no accounts, services or private data.' })).status, 200);
      if (kind === 'CLEAN_ASK') {
        const pending = await until(async () => { const result = await server.request('GET', `/api/session/${id}/permission`); return result.value?.data?.[0]; }, 'Cleanup confirmation');
        assert.equal(pending.action, 'stack-sessions-clean');
        await server.request('POST', `/api/session/${id}/permission/${pending.id}/reply`, { decision: 'reject', message: 'Synthetic rejection; do not delete' });
      }
      try { await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, kind, 30000); }
      catch (error) {
        const context = await server.request('GET', `/api/session/${id}/context`);
        console.log('Synthetic context failure: ' + JSON.stringify(context.value?.data?.filter(message => message.type === 'idle' && message.error).map(message => message.error)));
        throw error;
      }
      const state = trace.get(kind), denied = ['RO_WRITE', 'UI_WRITE', 'RO_OVERRIDE', 'PLANNER_ESCAPE', 'PLANNER_SHELL', 'ENV', 'NESTED', 'PLANNER_SESSION_WRITER', 'WRONG_SESSION', 'CLEAN_ASK', 'CLEAN_OWN', 'RESTRICTED_SHELL', 'TAMPERED_BROKER'].includes(kind);
      const errors = state.results.filter(value => { try { return JSON.parse(value)?.type; } catch { return false; } });
      if (denied) assert(errors.length, kind + ': expected native refusal, got ' + state.results.join('\n'));
      else assert.equal(errors.length, 0, kind + ': ' + errors.join('\n'));
      console.log('OK general native ' + kind); return { ...state, sessionID: id };
    };
    await execute('READ'); await execute('WRITE');
    const build = await execute('BUILD'); assert(build.results.join('\n').includes('GENERAL_BUILD_OK') && build.results.join('\n').includes('NO_HOST_SECRET'));
    await execute('RO_WRITE', 'reviewer'); await execute('UI_WRITE', 'ui-web-designer');
    await execute('RO_OVERRIDE', 'reviewer', [{ action: 'edit', resource: '*', effect: 'allow' }]);
    assert.equal(fs.readFileSync(path.join(project, 'src/example.cjs'), 'utf8'), 'module.exports = "new";\n');
    const help = await execute('PLANNER_HELP', 'planner'); for (const id of ['analysis-doc', 'local-inspect', 'psql-readonly', 'ssh-inspect']) assert(help.results.join('\n').includes(id));
    await execute('PLANNER_DOC', 'planner');
    assert(fs.readFileSync(path.join(project, 'tmp/general/analysis.md'), 'utf8').includes('Synthetic analysis'));
    const read = await execute('PLANNER_READ_DOC', 'planner'); assert(read.results.join('\n').includes('Synthetic analysis'));
    await execute('PLANNER_ESCAPE', 'planner'); await execute('PLANNER_SHELL', 'planner'); await execute('ENV');
    const status = await execute('STATUS', 'agent-design'); assert(JSON.parse(status.results[0]).agents.every(agent => agent.globalPromptRetained));
    const routed = await execute('ROUTE_READ'); assert(routed.results.join('\n').includes('FIXTURE_CHILD_READ'));
    qaSession = routed.results.join('\n').match(/\bses_[A-Za-z0-9]+\b/)?.[0]; assert(qaSession);
    await execute('FOLLOWUP', 'master-dev', undefined, routed.sessionID);
    unrelatedSession = await create(); await execute('WRONG_SESSION'); await execute('NESTED', 'code-inspector');
    // This target is explicitly allowed by the native PROJECT delta above. The
    // old static global snapshot incorrectly denied it; session-only escalation
    // to a different target must still fail.
    await execute('PLANNER_WRITER', 'planner'); assert(fs.existsSync(path.join(project, 'src/from-child.txt')));
    await execute('PLANNER_SESSION_WRITER', 'planner', [{ action: 'subagent', resource: 'frontend-web-developer', effect: 'allow' }]);
    await execute('ROUTE_WRITE'); assert.equal(fs.readFileSync(path.join(project, 'src/from-child.txt'), 'utf8'), 'FIXTURE_CHILD_WRITE\n');
    const listing = await execute('SESSIONS'); assert(Array.isArray(JSON.parse(listing.results[0]).sessions));
    targetSession = await create(); await execute('CLEAN_ASK'); assert.equal((await server.request('GET', '/api/session/' + targetSession)).status, 200);
    await execute('CLEAN_OWN', 'master-dev', [{ action: 'stack-sessions-clean', resource: '*', effect: 'allow' }]);
    await execute('CLEAN', 'master-dev', [{ action: 'stack-sessions-clean', resource: '*', effect: 'allow' }]);
    assert.notEqual((await server.request('GET', '/api/session/' + targetSession)).status, 200);
    await execute('RESTRICTED_SHELL', 'reviewer');
    const brokerBytes = fs.readFileSync(profile.broker), executionMarker = path.join(root, 'untrusted-broker-executed');
    fs.writeFileSync(profile.broker, 'from pathlib import Path\nPath(' + JSON.stringify(executionMarker) + ').write_text("MUST_NOT_EXECUTE")\n');
    const tampered = await execute('TAMPERED_BROKER', 'planner');
    assert(tampered.results.join('\n').includes('Trusted general-stack asset changed'));
    assert(!fs.existsSync(executionMarker), 'Integrity must precede broker --check execution');
    fs.writeFileSync(profile.broker, brokerBytes);
    for (const kind of ['READ', 'ROUTE_READ', 'CHILD_READ', 'PLANNER_DOC']) assert(trace.get(kind).global && trace.get(kind).organization && trace.get(kind).project, 'Synthetic three-layer context not retained: ' + kind);
    console.log(JSON.stringify({ cases: trace.size, baseRoles: profile.roles.length, commands: commands.length, nativeProjectDeltaPreserved: true, syntheticThreeLayerContext: true,
      actualAuneOrProjectOverlaysMigrated: false, nativeSessionApiCleanup: true, realProviderRequests: 0, realInfraRequests: 0, productionChanged: false, addonsComposed: false }));
  } finally { await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
