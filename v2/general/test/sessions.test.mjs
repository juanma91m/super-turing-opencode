import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidates, cleanup } from '../session-tools.mjs';

const row = (id, directory = '/project', parentID, updated = 1) => ({ id, location: { directory }, parentID, time: { updated } });
function fixture(rows) {
  const calls = [], api = {
    list: async () => ({ data: rows, cursor: { next: undefined } }),
    get: async ({ sessionID }) => { const result = rows.find(item => item.id === sessionID); assert(result); return result; },
    remove: async ({ sessionID }) => { calls.push(sessionID); },
  };
  return { api, calls };
}

test('default listing is current-directory child metadata, with explicit age/root/other-directory scope', async () => {
  const { api } = fixture([row('ses_root'), row('ses_child', '/project', 'ses_root'), row('ses_other', '/other', 'ses_otherroot'), row('ses_recent', '/project', 'ses_root', 100000)]);
  assert.deepEqual((await candidates(api, '/project', { olderThanMinutes: 1 }, 100000)).map(item => item.id), ['ses_child']);
  assert.equal((await candidates(api, '/project', { allProjects: true, includeRoot: true }, 100000)).length, 4);
});

test('cleanup validates explicit scope, protects current ancestry and asks before deleting', async () => {
  const { api, calls } = fixture([row('ses_parent'), row('ses_active', '/project', 'ses_parent'), row('ses_target', '/project', 'ses_parent')]);
  for (const id of ['ses_parent', 'ses_active', 'ses_absent']) await assert.rejects(cleanup(api, '/project', { includeRoot: true, sessionIDs: [id] }, 'ses_active', async () => {}), /scope|ancestry/);
  await assert.rejects(cleanup(api, '/project', { sessionIDs: ['ses_target'] }, 'ses_active', async () => { throw new Error('Rejected'); }), /Rejected/);
  assert.deepEqual(calls, []);
  const result = await cleanup(api, '/project', { sessionIDs: ['ses_target'] }, 'ses_active', async ids => { assert.deepEqual(ids, ['ses_target']); assert.deepEqual(calls, []); });
  assert(result.complete); assert.deepEqual(calls, ['ses_target']);
});

test('recursive deletion refuses descendants outside scope and includes permitted descendants in consent', async () => {
  const rows = [row('ses_active'), row('ses_target'), row('ses_child', '/other', 'ses_target')], { api, calls } = fixture(rows);
  await assert.rejects(cleanup(api, '/project', { includeRoot: true, sessionIDs: ['ses_target'] }, 'ses_active', async () => {}), /descendant/);
  assert.deepEqual(calls, []);
  await cleanup(api, '/project', { allProjects: true, includeRoot: true, sessionIDs: ['ses_target', 'ses_child'] }, 'ses_active', async ids => assert.deepEqual(ids, ['ses_target', 'ses_child']));
  assert.deepEqual(calls, ['ses_target']);
});

test('rejected/changed/paginated/incomplete sessions never become blind delete candidates', async () => {
  const rows = [row('ses_active'), row('ses_target')], { api, calls } = fixture(rows);
  await assert.rejects(cleanup(api, '/project', { includeRoot: true, sessionIDs: ['ses_target'] }, 'ses_active', async () => { rows.push(row('ses_new', '/project', 'ses_target')); }), /New descendant/);
  assert.deepEqual(calls, []);
  await assert.rejects(candidates({ list: async () => ({ data: rows, cursor: { next: 'same' } }) }, '/project', {}), /cursor/);
  await assert.rejects(candidates({ list: async () => ({ data: [null], cursor: {} }) }, '/project', {}));
});

test('selection snapshots cannot change under an approval and partial deletion failures are explicit', async () => {
  const rows = [row('ses_active'), row('ses_target')], { api, calls } = fixture(rows);
  await assert.rejects(cleanup(api, '/project', { includeRoot: true, sessionIDs: ['ses_target'] }, 'ses_active', async () => { rows[1].time.updated++; }), /changed/);
  assert.deepEqual(calls, []);
  rows.push(row('ses_second'));
  api.remove = async ({ sessionID }) => { if (sessionID === 'ses_second') throw new Error('Synthetic failure'); calls.push(sessionID); };
  const result = await cleanup(api, '/project', { includeRoot: true, sessionIDs: ['ses_target', 'ses_second'] }, 'ses_active', async () => {});
  assert.equal(result.complete, false); assert.deepEqual(result.deleted, ['ses_target']); assert.deepEqual(result.failed, ['ses_second']);
});
