// Operator-owned synthetic comparison. No arbitrary prompts, providers or projects.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { decodeList, nativeSources } from '../general/audit.mjs';
import { npmRuntime } from '../general/npm-runtime.mjs';
import { startOwnedServer, until } from '../general/owned-server.mjs';
import { generalEnvironment, noLinks, prepareGeneral } from '../general/profile.mjs';

const task = 'Given the synthetic flow controller → service → repository, name the intermediate layer.';
const revisions = {
  baseline: 'Fixture response revision STACK_AB_BASELINE. Answer with the intermediate layer only.',
  candidate: 'Fixture response revision STACK_AB_CANDIDATE. Answer with the intermediate layer followed by the next layer.',
};
const replies = { baseline: 'service', candidate: 'service → repository' };
const model = { providerID: 'workshop-mock', id: 'mock' };
const sha = text => createHash('sha256').update(text).digest('hex');
const plan = {
  taskID: 'synthetic-intermediate-layer',
  taskSHA256: sha(task),
  axis: 'agent-prompt',
  agent: 'code-inspector',
  model: 'workshop-mock/mock',
  rubric: 'The answer must include the intermediate layer.',
  promptRevisionSHA256: Object.fromEntries(Object.entries(revisions).map(([key, body]) => [key, sha(body)])),
  synthetic: true,
  realInference: false,
};

function temporaryParent(dir) {
  assert(path.isAbsolute(dir) && path.normalize(dir) === dir && dir !== '/', 'Explicit temporary directory required');
  noLinks(dir);
  assert(fs.statSync(dir).isDirectory(), 'Temporary directory must exist');
  // V2 discovers sources up to the filesystem root. Reject before parsing or
  // loading anything from an inherited project, including symlinked sources.
  for (let ancestor = dir;; ancestor = path.dirname(ancestor)) {
    for (const entry of ['.git', '.opencode', 'opencode.json', 'opencode.jsonc', 'AGENTS.md']) {
      assert(!fs.lstatSync(path.join(ancestor, entry), { throwIfNoEntry: false }), 'Use a neutral temporary directory without project or ancestor sources');
    }
    if (ancestor === '/') break;
  }
  return dir;
}

function fixturePrompt(variant) {
  return { id: 'stack-ab-fixture', apply({ agents }) {
    const agent = agents[plan.agent];
    assert(agent);
    agent.system += '\n\n' + revisions[variant];
    agent.permissions.push({ action: '*', resource: '*', effect: 'deny' }, { action: 'skill', resource: '*', effect: 'deny' });
  } };
}

function reply(response, text) {
  response.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const emit = (delta, finish_reason = null) => response.write('data: ' + JSON.stringify({
    id: 'stack-ab-fixture', object: 'chat.completion.chunk', model: 'mock', created: 1,
    choices: [{ index: 0, delta, finish_reason }],
  }) + '\n\n');
  emit({ role: 'assistant', content: text });
  emit({}, 'stop');
  response.end('data: [DONE]\n\n');
}

async function execute(temporary, runtime, signal) {
  const root = fs.mkdtempSync(path.join(temporaryParent(temporary), 'stack-ab-'));
  let provider, active, host, closing, observedTools;
  const closeHost = () => host ? (closing ??= host.close()) : Promise.resolve();
  const abort = () => { void closeHost().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    provider = http.createServer(async (request, response) => {
      try {
        assert(active && request.method === 'POST' && request.url === '/v1/chat/completions', 'transport');
        let raw = '';
        for await (const chunk of request) { raw += chunk; assert(raw.length < 1024 * 1024, 'request size'); }
        const body = JSON.parse(raw);
        const users = body.messages.filter(message => message.role === 'user');
        // The native title request may also contain a user message. Only the
        // exact benchmark turn supplies evidence about the measured agent.
        if (!users.some(message => message.content === task || message.content?.some?.(part => part.text === task))) {
          assert(!raw.includes('STACK_AB_BASELINE') && !raw.includes('STACK_AB_CANDIDATE'), 'task text');
          return reply(response, 'Synthetic comparison');
        }
        const system = body.messages.filter(message => message.role === 'system').map(row => row.content).join('\n');
        const other = active.variant === 'baseline' ? 'STACK_AB_CANDIDATE' : 'STACK_AB_BASELINE';
        assert(system.includes(revisions[active.variant]) && !system.includes(other), 'prompt revision');
        assert(body.model === 'mock', 'model');
        assert(users.length === 1 && !body.messages.some(message => ['assistant', 'tool'].includes(message.role)), 'session history');
        // Native skill discovery may still advertise `skill`. No tools are
        // called by this provider; both arms must see the same bounded catalog.
        const names = (body.tools ?? []).map(tool => tool.function?.name).sort().join(',');
        assert(names === '' || names === 'skill', 'tool visibility');
        observedTools ??= names;
        assert(names === observedTools, 'tool catalog changed');
        assert(++active.turns === 1, 'duplicate turn');
        reply(response, replies[active.variant]);
      } catch (error) {
        if (active) active.failed = error instanceof assert.AssertionError ? error.message : 'request format';
        response.writeHead(400).end('Synthetic request did not match the fixture.');
      }
    });
    await new Promise((resolve, reject) => {
      provider.once('error', reject);
      provider.listen(0, '127.0.0.1', resolve);
    });
    const results = {};
    for (const variant of Object.keys(revisions)) {
      signal.throwIfAborted();
      const project = path.join(root, `${variant}-project`);
      fs.mkdirSync(project, { mode: 0o700 });
      const profile = prepareGeneral(path.join(root, variant), {
        project, mock: `http://127.0.0.1:${provider.address().port}/v1`, contributions: [fixturePrompt(variant)],
      });
      const config = path.join(profile.config, 'opencode');
      const { entries } = nativeSources(runtime.binary, project, config, generalEnvironment(profile));
      const documents = entries.filter(entry => entry.type === 'document');
      assert(documents.length === 1 && documents[0].path === path.join(config, 'opencode.json'), 'Unexpected native config sources');
      assert(!Object.keys(documents[0].info.mcp?.servers ?? {}).length, 'No MCP is allowed in the synthetic fixture');
      signal.throwIfAborted();
      active = { variant, turns: 0, failed: false };
      host = await startOwnedServer(runtime.binary, profile, generalEnvironment);
      signal.throwIfAborted();
      const sessions = await host.request('GET', '/api/session');
      assert(sessions.status === 200 && decodeList(sessions.value).length === 0, 'Comparison host must start without session history');
      console.error(`${variant}: private host ready`);
      const created = await host.request('POST', '/api/session', { agent: plan.agent, title: 'Synthetic comparison', location: { directory: project }, model });
      const id = created.value?.data?.id;
      assert(created.status === 200 && /^ses_[a-zA-Z0-9]+$/.test(id ?? ''), 'Native session creation failed');
      const endpoint = `/api/session/${id}`;
      const prompted = await host.request('POST', endpoint + '/prompt', { text: task });
      assert(prompted.status === 200, 'Native prompt was rejected');
      await until(async () => {
        signal.throwIfAborted();
        assert(!active.failed, `Mock provider rejected fixture conditions: ${active.failed}`);
        const context = await host.request('GET', endpoint + '/context');
        return active.turns === 1 && context.status === 200 && context.value?.data?.at(-1)?.type === 'idle';
      }, 'Synthetic turn', 15000);
      const messages = await host.request('GET', endpoint + '/message?type=assistant');
      assert(messages.status === 200 && Array.isArray(messages.value?.data), 'Native assistant messages unavailable');
      const parts = messages.value.data.flatMap(message => message.content ?? []);
      const answer = parts.filter(part => part.type === 'text').map(part => part.text).join('');
      assert(answer === replies[variant], 'Stored synthetic reply differs from the mock response');
      results[variant] = { observedRevision: true, rubricPassed: /\bservice\b/.test(answer), responseSHA256: sha(answer) };
      await closeHost();
      host = closing = undefined;
    }
    signal.throwIfAborted();
    return { ...plan, runtimeVersion: runtime.version, results, qualityConclusion: null };
  } finally {
    signal.removeEventListener('abort', abort);
    try {
      await closeHost();
    } finally {
      if (provider?.listening) {
        provider.closeAllConnections();
        await new Promise(resolve => provider.close(resolve));
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

const stop = new AbortController();
for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => stop.abort());
try {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    'tmp-root': { type: 'string' }, runtime: { type: 'string' },
  } });
  const [command] = positionals;
  assert(positionals.length === 1 && ['prepare', 'execute'].includes(command), 'Usage: stack-ab.mjs prepare | execute --tmp-root DIR --runtime DIR');
  if (command === 'prepare') {
    assert(Object.keys(values).length === 0, 'prepare does not accept execution options');
    console.log(JSON.stringify(plan, null, 2));
  } else {
    assert(values.runtime && values['tmp-root'], 'Both --runtime and --tmp-root are required');
    console.log(JSON.stringify(await execute(values['tmp-root'], npmRuntime(values.runtime), stop.signal), null, 2));
  }
} catch (error) {
  console.error(stop.signal.aborted ? 'Synthetic comparison cancelled.' : error instanceof assert.AssertionError ? error.message : 'Synthetic comparison failed; runtime output suppressed.');
  process.exitCode = stop.signal.aborted ? 130 : 1;
}
