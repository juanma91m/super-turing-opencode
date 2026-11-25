import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';

const binary = process.env.OPENCODE_TEST_BROKER_ROUTE;
test('native shell routes only a permitted literal broker verb in scope', { skip: !binary, timeout: 30000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'broker-route-'));
  const project = path.join(root, 'workspace', 'project');
  const elsewhere = path.join(root, 'outside');
  const seen = [];
  let calls = 0, server, requestCommand;
  const provider = http.createServer(async (req, res) => {
    try {
      let data = '';
      for await (const part of req) data += part;
      const body = JSON.parse(data);
      const results = body.messages.filter(message => message.role === 'tool');
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({
        id: 'broker-route-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock',
        choices: [{ index: 0, delta, finish_reason }],
      })}\n\n`);
      if (results.length) {
        seen.push(JSON.stringify(results));
        send({ role: 'assistant', content: 'Fixture done' });
      } else {
        send({ role: 'assistant', tool_calls: [{
          index: 0, id: `fixture_${++calls}`, type: 'function',
          function: { name: 'shell', arguments: JSON.stringify({ command: requestCommand, description: 'Check fixture route' }) },
        }] });
      }
      send({}, results.length ? 'stop' : 'tool_calls');
      res.end('data: [DONE]\n\n');
    } catch { res.writeHead(500); res.end(); }
  });
  try {
    for (const dir of [project, elsewhere]) {
      fs.mkdirSync(dir, { recursive: true });
      assert.equal(spawnSync('git', ['init', '-q', dir]).status, 0);
    }
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    const contribution = { id: 'broker-route-fixture', apply(ctx) {
      const operation = { positionals: [{ pattern: '[A-Z]+-[0-9]+' }] };
      ctx.addConfig('planner-helpers/test-jira.json', JSON.stringify({
        jira: { path: 'scripts/test-jira.sh', interpreter: 'bash', verbs: { context: operation, issue: operation } },
      }));
      ctx.addConfig('scripts/test-jira.sh', 'printf "FIXTURE_BASE_%s\\n" "$1"\n');
    }};
    const profile = prepareGeneral(path.join(root, 'profile'), { project, runtimeHome: root,
      mock: `http://127.0.0.1:${provider.address().port}/v1`, contributions: [contribution] });
    const conf = path.join(profile.config, 'opencode');
    const access = profile.document.plugins.find(item => item.package?.endsWith('/general/plugins/access'));
    // Use a byte-identical base broker and declaration, with distinct trusted helper outputs.
    const prior = path.join(root, 'prior');
    for (const dir of ['scripts', 'planner-helpers']) fs.mkdirSync(path.join(prior, dir), { recursive: true });
    const broker = path.join(prior, 'scripts/planner_shell.py');
    const target = path.join(conf, 'scripts/planner_shell.py');
    for (const file of ['scripts/planner_shell.py', 'scripts/test-jira.sh', 'planner-helpers/test-jira.json']) {
      fs.copyFileSync(path.join(conf, file), path.join(prior, file));
    }
    const newer = path.join(conf, 'scripts/test-jira.sh');
    fs.writeFileSync(newer, 'printf "FIXTURE_SHARED_%s\\n" "$1"\n');
    for (const file of [broker, path.join(prior, 'scripts/test-jira.sh'), path.join(prior, 'planner-helpers/test-jira.json'), newer]) {
      access.options.pinned[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
    access.options.broker = broker;
    access.options.brokerRoute = { helper: 'jira', verb: 'context', target, scopeRoot: path.dirname(project) };
    fs.writeFileSync(path.join(conf, 'opencode.json'), JSON.stringify(profile.document));
    server = await startOwnedServer(binary, profile, generalEnvironment);
    const run = async (directory, suffix) => {
      requestCommand = `python3 ${broker} helper jira ${suffix}`;
      const count = seen.length;
      const made = await server.request('POST', '/api/session', {
        location: { directory }, agent: 'master-dev', model: { providerID: 'workshop-mock', id: 'mock' },
      });
      assert.equal(made.status, 200);
      const id = made.value.data.id;
      assert.equal((await server.request('POST', `/api/session/${id}/prompt`, { text: 'Run synthetic fixture.' })).status, 200);
      return until(() => seen[count], 'shell result completed', 5000);
    };
    assert.match(await run(project, 'context TEST-1'), /FIXTURE_SHARED_context/);
    assert.match(await run(project, 'issue TEST-1'), /FIXTURE_BASE_issue/);
    assert.match(await run(elsewhere, 'context TEST-1'), /FIXTURE_BASE_context/);
    const rejected = await run(project, 'context TEST-1; printf FORBIDDEN_EXTRA');
    assert.doesNotMatch(rejected, /FIXTURE_(SHARED|BASE)/);
  } finally {
    await server?.close();
    provider.closeAllConnections();
    if (provider.listening) await new Promise(resolve => provider.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
