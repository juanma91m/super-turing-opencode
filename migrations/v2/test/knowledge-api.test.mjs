import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { layout, verify } from '../staging.mjs';
import { prepareWorkshop } from '../workshop-profile.mjs';
import { startServer, until } from '../private-server.mjs';
import { getApiList } from '../api-list.mjs';

test('list decoding accepts both V2 response shapes, including empty lists', async () => {
  for (const value of [[], { data: [] }, [{ path: '/fixture' }], { location: {}, data: [{ id: 'fixture' }] }]) {
    const result = await getApiList(async () => ({ status: 200, value }), '/api/config');
    assert.deepEqual(result, Array.isArray(value) ? value : value.data);
  }
});

test('malformed responses report the endpoint but never include response bodies', async () => {
  for (const response of [{ status: 500, value: { error: 'FIXTURE_SECRET' } }, { status: 200, value: { data: 'FIXTURE_SECRET' } }, { status: 200 }]) {
    await assert.rejects(getApiList(async () => response, '/api/config'), error => {
      assert(error.message.includes('/api/config'));
      assert(!error.message.includes('FIXTURE_SECRET'));
      return true;
    });
  }
});

test('native Knowledge config inspection handles the actual API response', { skip: process.env.KNOWLEDGE_API_NATIVE !== '1' }, async () => {
  const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/knowledge-api-');
  let server;
  try {
    const p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1' });
    server = await startServer(base.binary, p);
    const raw = await server.request('GET', '/api/config');
    assert(Array.isArray(raw.value), '2.2.7 config.get returns a direct array');
    // Negative control: the exact old assumption still reproduces the failure.
    await assert.rejects(async () => { for (const source of await Promise.resolve(raw.value.data)) void source; }, TypeError);
    for (const source of await getApiList(server.request, '/api/config')) assert(source.path.startsWith(root + path.sep));
    await until(async () => {
      const agents = await getApiList(server.request, '/api/agent');
      return agents.some(agent => agent.id === 'master-dev');
    }, 'fixture agents after asynchronous plugin loading');
  } finally {
    await server?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
