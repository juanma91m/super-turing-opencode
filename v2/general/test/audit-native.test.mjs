import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { startServer, until } from '../../../v2/testing/private-server.mjs';
import { layout } from '../../../v2/runtime/staging.mjs';
import { nativeSources } from '../audit.mjs';

test('native source discovery and live-registry audit plus proposal-only scaffold through official host', async t => {
  const root = fs.mkdtempSync('/tmp/opencode/native-audit-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'), plugin = path.join(root, 'probe');
  fs.mkdirSync(project); fs.mkdirSync(plugin);
  assert.equal(spawnSync('/usr/bin/git', ['init', '--quiet'], { cwd: project, env: { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).status, 0);
  fs.writeFileSync(path.join(plugin, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(plugin, 'index.ts'), 'import {Plugin} from "@opencode/plugin";export default Plugin.define({id:"fixture.audit",async setup(ctx){await ctx.session.hook("title",e=>{e.result="Audit fixture"});}});');
  const trace = new Map(); let providerError;
  const mock = http.createServer(async (request, response) => {
    try {
      let raw = ''; for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw), kind = JSON.stringify(body.messages.filter(m => m.role === 'user').at(-1)).includes('PROPOSE') ? 'PROPOSE' : 'AUDIT';
      const result = body.messages.find(m => m.role === 'tool' && m.tool_call_id === kind);
      if (result) trace.set(kind, result.content);
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const emit = (delta, finish_reason = null) => response.write('data: ' + JSON.stringify({ id: 'audit', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
      if (!result) {
        const args = kind === 'PROPOSE' ? { deltas: { reviewer: { permissions: [{ action: 'shell', resource: 'git show *', effect: 'deny' }] } } } : {};
        emit({ role: 'assistant', tool_calls: [{ index: 0, id: kind, type: 'function', function: { name: kind === 'PROPOSE' ? 'stack-layer-scaffold' : 'stack-layer-audit', arguments: JSON.stringify(args) } }] });
      } else emit({ role: 'assistant', content: 'Fixture complete' });
      emit({}, result ? 'stop' : 'tool_calls'); response.end('data: [DONE]\n\n');
    } catch (error) { providerError = error.message; response.writeHead(500); response.end('Synthetic fixture failure'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve)); let server;
  const unpack = value => {
    if (typeof value === 'string') return unpack(JSON.parse(value));
    if (Array.isArray(value)) return unpack(value[0]);
    if (value.text !== undefined) return unpack(value.text);
    if (value.content !== undefined) return unpack(value.content);
    return value;
  };
  try {
    const p = prepareGeneral(path.join(root, 'profile'), { project, mock: 'http://127.0.0.1:' + mock.address().port + '/v1', plugins: [plugin] });
    const binary = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary;
    const discovered = nativeSources(binary, project, path.join(p.config, 'opencode'), generalEnvironment(p));
    assert(discovered.entries.some(entry => entry.type === 'document' && entry.info?.agents));
    assert.equal(discovered.applicationDataOpened, false);
    server = await startServer(binary, p, undefined, { environment: generalEnvironment });
    const run = async kind => {
      trace.delete(kind);
      const created = await server.request('POST', '/api/session', { agent: 'agent-design', location: { directory: project }, model: { providerID: 'workshop-mock', id: 'mock' } }); assert.equal(created.status, 200);
      await server.request('POST', '/api/session/' + created.value.data.id + '/prompt', { text: kind });
      await until(() => { if (providerError) throw new Error(providerError); return trace.has(kind); }, 'Native ' + kind, 45000);
      const result = unpack(trace.get(kind));
      assert(!result.type, 'Native tool failed: ' + JSON.stringify(result));
      return result;
    };
    const audit = await run('AUDIT');
    assert.equal(audit.status, 'pass', JSON.stringify(audit.findings));
    assert.equal(audit.agents.length, 11); assert(audit.agents.every(agent => agent.globalPromptRetained && !agent.modeChanged && !agent.modelChanged));
    assert.equal(audit.coverage.actualHierarchyAcceptance, false);
    assert(audit.toolIDs.includes('stack-layer-audit') && audit.toolIDs.includes('subagent'));
    const proposal = await run('PROPOSE');
    assert.equal(proposal.proposalOnly, true); assert.equal(proposal.writesPerformed, 0);
    assert.equal(proposal.nativeConfig.agents.reviewer.system, undefined);
    const proposalFile = path.join(root, 'proposal.json'); fs.writeFileSync(proposalFile, JSON.stringify(proposal.nativeConfig));
    const checked = spawnSync(binary, ['debug', 'config', '--standalone'], { cwd: project, env: { ...generalEnvironment(p), OPENCODE_CONFIG: proposalFile }, encoding: 'utf8', timeout: 30000 });
    assert.equal(checked.status, 0, 'Native host rejected proposed config; raw values suppressed');
    assert(!fs.existsSync(path.join(project, '.opencode')));
    // Restart after adding a native delta: audit must see both provenance and
    // actual permission expansion, not infer correctness from file presence.
    await server.close(); server = undefined;
    fs.mkdirSync(path.join(project, '.opencode'));
    const delta = { $schema: 'https://opencode.ai/config.json', agents: { reviewer: { permissions: [{ action: 'shell', resource: 'echo synthetic-audit', effect: 'allow' }] } } };
    fs.writeFileSync(path.join(project, '.opencode/opencode.json'), JSON.stringify(delta));
    server = await startServer(binary, p, undefined, { environment: generalEnvironment });
    const changed = await run('AUDIT');
    assert.equal(changed.status, 'warning'); assert(changed.findings.some(f => f.code === 'permission-broader' && f.subject === 'reviewer'));
    assert(changed.agentDeclarations.some(d => d.source === 'project/.opencode/opencode.json' && d.id === 'reviewer' && !d.replacesSystem));
    assert(changed.agents.every(agent => agent.globalPromptRetained));
    assert(!JSON.stringify(changed).includes('echo synthetic-audit'), 'Resource text must not leave the auditor');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, '.opencode/opencode.json'))), delta);
  } finally { await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
});
