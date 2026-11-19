import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { existingV2Storage, bindV2Storage } from '../storage.mjs';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/storage-binding-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const staging = path.join(root, 'opencode-v2-clean'), pilot = path.join(staging, 'pilot');
  for (const directory of [staging, pilot]) {
    fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, '.stack-v2-migration.json'), JSON.stringify({ schemaVersion: 1, owner: 'opencode-stack', kind: 'v2-clean-staging', version: '2.2.7' }));
  }
  fs.mkdirSync(path.join(pilot, 'home/.local/share/opencode'), { recursive: true }); fs.mkdirSync(path.join(pilot, 'home/.local/state'), { recursive: true });
  fs.writeFileSync(path.join(pilot, 'home/.local/share/opencode/opencode.db'), 'SYNTHETIC_NOT_A_REAL_DB');
  const project = path.join(root, 'project'); fs.mkdirSync(project);
  const profile = prepareGeneral(path.join(root, 'candidate'), { project, mock: 'http://127.0.0.1:1/v1' });
  return { root, staging, pilot, profile };
}
test('binding reuses only native data/state with explicit acknowledgment; environment rejects arbitrary inherited DB', t => {
  const { staging, profile } = fixture(t), selected = existingV2Storage(staging);
  for (const consent of [{}, { clientClosed: true }, { reuseV2Storage: true }]) assert.throws(() => bindV2Storage(profile, selected, consent), /acknowledgment/);
  const bound = bindV2Storage(profile, selected, { clientClosed: true, reuseV2Storage: true });
  const env = generalEnvironment(bound, { OPENCODE_DB: '/v1/MUST_NOT_OPEN.db', HOME: '/foreign', OPENAI_API_KEY: 'SYNTHETIC_SECRET' });
  assert.equal(env.XDG_DATA_HOME, selected.data); assert.equal(env.XDG_STATE_HOME, selected.state); assert.equal(env.OPENCODE_DB, selected.db);
  for (const key of ['home', 'config', 'cache', 'tmp']) assert.equal(bound[key], profile[key]);
  assert.equal(env.HOME, profile.home); assert.equal(env.OPENAI_API_KEY, undefined);
  assert.throws(() => generalEnvironment({ ...bound, data: '/foreign' }), /paths differ/);
  assert.throws(() => generalEnvironment({ ...bound, config: path.join(selected.sourceRoot, 'home/.config') }), /candidate-owned/);
});
test('wrong owner, drifted descriptor, missing DB and symlinks fail without adopting V1', t => {
  const { root, staging, pilot, profile } = fixture(t), selected = existingV2Storage(staging);
  assert.throws(() => existingV2Storage(path.join(root, 'opencode')), /V1/);
  assert.throws(() => bindV2Storage(profile, { ...selected, db: '/v1/MUST_NOT_OPEN.db' }, { clientClosed: true, reuseV2Storage: true }), /descriptor changed/);
  fs.unlinkSync(selected.db); assert.throws(() => existingV2Storage(staging));
  fs.symlinkSync('/never-follow-this', selected.db); assert.throws(() => existingV2Storage(staging), /symlink/);
  fs.unlinkSync(selected.db); fs.writeFileSync(selected.db, 'SYNTHETIC');
  fs.writeFileSync(path.join(pilot, '.stack-v2-migration.json'), '{"owner":"PRIVATE_SENTINEL"}');
  assert.throws(() => existingV2Storage(staging), error => error.message.includes('owner/version') && !error.message.includes('PRIVATE_SENTINEL'));
});
