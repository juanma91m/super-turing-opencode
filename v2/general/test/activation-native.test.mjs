import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { existingV2Storage, bindV2Storage } from '../storage.mjs';
import { prepare, layout } from '../../../v2/runtime/staging.mjs';
import { startServer, until } from '../../../v2/testing/private-server.mjs';
import { getApiList } from '../../../v2/testing/api-list.mjs';

test('official host preserves maintenance models and reopens synthetic native sessions through opt-in shared storage', async t => {
  const root = fs.mkdtempSync('/tmp/opencode/native-activation-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const staging = path.join(root, 'opencode-v2-clean'); prepare(layout(staging)); const pilot = prepare(layout(path.join(staging, 'pilot')));
  const project = path.join(root, 'project'), control = path.join(root, 'control'), observed = path.join(root, 'observed-models.json');
  fs.mkdirSync(project); fs.mkdirSync(control); fs.writeFileSync(path.join(control, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(control, 'index.ts'), 'import {Plugin} from "@opencode/plugin";import fs from "node:fs";export default Plugin.define({id:"fixture.maintenance",async setup(ctx){for(const kind of ["title","compaction"])await ctx.session.hook(kind,e=>{let data={};try{data=JSON.parse(fs.readFileSync(' + JSON.stringify(observed) + ',"utf8"))}catch{}data[kind]=e.model;fs.writeFileSync(' + JSON.stringify(observed) + ',JSON.stringify(data))});}});');
  let requests = 0;
  const provider = http.createServer(async (request, response) => {
    for await (const _chunk of request) {} requests++;
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end('data: ' + JSON.stringify({ id: 'activation', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta: { role: 'assistant', content: 'Synthetic fixture summary' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve)); let server;
  const binary = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary;
  const options = { project, mock: 'http://127.0.0.1:' + provider.address().port + '/v1', plugins: [control], maintenanceModels: Object.fromEntries(['title', 'summary', 'compaction'].map(id => [id, { model: 'workshop-mock/mock#' + (id === 'title' ? 'low' : 'medium') }])) };
  try {
    const initial = prepareGeneral(path.join(root, 'initial-v2-config'), options);
    // Synthetic producer stands in for the first pilot. The official host alone
    // creates its native empty store, not a SQL fixture or copied credentials.
    server = await startServer(binary, { ...initial, data: pilot.data, state: pilot.state }, undefined, { environment: generalEnvironment });
    const agents = await until(async () => { const entries = await getApiList(server.request, '/api/agent'); return entries.some(agent => agent.id === 'master-dev') ? entries : undefined; }, 'Native agent registry');
    for (const id of ['title', 'summary', 'compaction']) {
      const result = await server.request('GET', '/api/agent/' + id);
      assert.equal(result.status, 200, id + ' effective native maintenance lookup');
      assert.deepEqual(result.value.data.model, { providerID: 'workshop-mock', id: 'mock', variant: id === 'title' ? 'low' : 'medium' });
    }
    const created = await server.request('POST', '/api/session', { agent: 'master-dev', location: { directory: project }, model: { providerID: 'workshop-mock', id: 'mock' } }); assert.equal(created.status, 200);
    const id = created.value.data.id;
    await server.request('POST', '/api/session/' + id + '/prompt', { text: 'Synthetic public activation fixture. Reply briefly; no tools.' });
    await until(async () => {
      const context = await server.request('GET', '/api/session/' + id + '/context');
      return fs.existsSync(observed) && context.value?.data?.some(message => message.type === 'idle');
    }, 'Native maintenance title', 30000);
    const openapi = (await server.request('GET', '/openapi.json')).value;
    let compact;
    for (const [route, methods] of Object.entries(openapi.paths)) for (const [method, operation] of Object.entries(methods)) if (operation.operationId === 'session.compact') compact = [method.toUpperCase(), route.replace('{sessionID}', id)];
    assert(compact, 'Validated pin must expose native compaction API');
    const compacted = await server.request(compact[0], compact[1], {}); assert.equal(compacted.status, 200);
    await until(() => fs.existsSync(observed) && JSON.parse(fs.readFileSync(observed)).compaction, 'Native compaction model', 30000);
    const models = JSON.parse(fs.readFileSync(observed));
    assert.equal(models.title.variant, 'low'); assert.equal(models.compaction.variant, 'medium');
    await until(() => requests >= 3, 'Normal, title and compaction loopback model requests');
    await server.close(); server = undefined;
    const candidate = prepareGeneral(path.join(root, 'candidate'), options);
    const selected = existingV2Storage(staging), bound = bindV2Storage(candidate, selected, { clientClosed: true, reuseV2Storage: true });
    server = await startServer(binary, bound, undefined, { environment: generalEnvironment });
    const reopened = await server.request('GET', '/api/session/' + id); assert.equal(reopened.status, 200); assert.equal(reopened.value.data.id, id);
    const integrations = await getApiList(server.request, '/api/integration');
    assert(!integrations.some(integration => integration.connections?.length), 'Fixture must not use any real provider credentials');
    assert.equal(fs.existsSync(path.join(candidate.data, 'opencode/opencode.db')), false, 'No hidden DB copy/fallback under candidate HOME');
    assert.equal(generalEnvironment(bound).OPENCODE_DB, selected.db);
  } finally { await server?.close(); provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); }
});
