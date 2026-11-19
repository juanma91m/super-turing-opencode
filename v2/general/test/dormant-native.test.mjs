import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { translateDormantProviders } from '../dormant-providers.mjs';
import { officialRuntime } from '../lifecycle.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';
import { decodeList } from '../audit.mjs';
import { dormantFixture } from './dormant-fixture.mjs';

for (const blockDiscovery of [true, false]) test(blockDiscovery ? 'official2.2.7 retains seven dormant definitions, excludes catalog and refuses local overrides with zero requests' : 'negative control: provider policy alone hides models but builtin discovery still probes the owned fixture endpoint', async t => {
  const root = fs.mkdtempSync('/tmp/opencode/dormant-native-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'); fs.mkdirSync(project);
  fs.mkdirSync(path.join(project, '.opencode'));
  fs.writeFileSync(path.join(project, '.opencode/opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', policies: [{ action: 'provider.use', resource: 'ollama', effect: 'allow' }, { action: 'plugin.use', resource: 'opencode.provider.ollama', effect: 'allow' }] }));
  let localRequests = 0, mainRequests = 0; const localPaths = new Set();
  const local = http.createServer(async (request, response) => { for await (const _chunk of request) {} localRequests++; localPaths.add(request.url); response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{"models":[],"data":[]}'); });
  const main = http.createServer(async (request, response) => { for await (const _chunk of request) {} mainRequests++; response.writeHead(500); response.end('No inference authorized'); });
  await new Promise(resolve => local.listen(0, '127.0.0.1', resolve)); await new Promise(resolve => main.listen(0, '127.0.0.1', resolve)); let server;
  try {
    const source = dormantFixture('http://127.0.0.1:' + local.address().port + '/v1'), dormantProviders = translateDormantProviders(source);
    const p = prepareGeneral(path.join(root, 'profile'), { project, mock: 'http://127.0.0.1:' + main.address().port + '/v1', dormantProviders });
    if (!blockDiscovery) {
      // Counterfactual only in this disposable profile; no upstream patch or
      // source/installed configuration mutation. The endpoint is owned loopback.
      const counterfactual = structuredClone(p.document);
      counterfactual.plugins = counterfactual.plugins.filter(plugin => plugin !== '-opencode.provider.ollama');
      counterfactual.policies = counterfactual.policies.filter(rule => !(rule.action === 'plugin.use' && rule.resource === 'opencode.provider.ollama'));
      fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify(counterfactual));
    }
    server = await startOwnedServer(officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary, p, generalEnvironment);
    const spec = (await server.request('GET', '/openapi.json')).value;
    const operation = async id => {
      for (const [route, methods] of Object.entries(spec.paths)) for (const [method, entry] of Object.entries(methods)) if (entry.operationId === id) {
        assert.equal(method, 'get'); const response = await server.request('GET', route); assert.equal(response.status, 200); return decodeList(response.value);
      }
      throw new Error('Required native metadata operation missing: ' + id);
    };
    await until(async () => (await operation('plugin.list')).some(plugin => plugin.id === 'opencode-stack.general'), 'Native general setup');
    const sources = await operation('config.get');
    const compiled = sources.find(entry => entry.type === 'document' && entry.path === path.join(p.config, 'opencode/opencode.json')).info;
    assert.deepEqual(compiled.providers.ollama.models, source.provider.ollama.models); assert.equal(Object.keys(compiled.providers.ollama.models).length, 7);
    const available = await operation('model.list'); assert(!available.some(model => model.providerID === 'ollama'));
    assert.equal((await operation('plugin.list')).some(plugin => plugin.id === 'opencode.provider.ollama'), !blockDiscovery, 'Builtin discovery is separate from provider use');
    const firstModel = Object.keys(source.provider.ollama.models)[0];
    const created = await server.request('POST', '/api/session', { agent: 'master-dev', title: 'Synthetic denied provider selection', location: { directory: project }, model: { providerID: 'ollama', id: firstModel } });
    assert.equal(created.status, 200); const id = created.value.data.id;
    await server.request('POST', '/api/session/' + id + '/prompt', { text: 'Synthetic attempt at an explicitly disabled provider; must not send a request.' });
    await until(async () => { const result = await server.request('GET', '/api/session/' + id + '/context'); return result.value?.data?.some(message => message.type === 'idle' && message.error); }, 'Disabled provider refusal', 15000);
    await new Promise(resolve => setTimeout(resolve, 1200));
    if (blockDiscovery) assert.equal(localRequests, 0, 'Disabled provider must not perform discovery or inference against configured loopback');
    else { assert(localRequests > 0, 'Negative control must expose the discovery side effect'); assert([...localPaths].every(route => ['/api/tags', '/api/show', '/v1/models'].includes(route)), 'Only fixture discovery, never inference'); }
    assert.equal(mainRequests, 0, 'No model fallback');
    assert.equal((await server.request('DELETE', '/api/session/' + id)).status, 204);
  } finally { await server?.close(); for (const listener of [local, main]) { listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); } }
});
