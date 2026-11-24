import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { productionStorage, bindProductionStorage } from '../production-storage.mjs';
import { generalEnvironment } from '../profile.mjs';
import { interactiveEnvironment,serverEnvironment,terminalEnvironment } from '../launch.mjs';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp/opencode', 'production-storage-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'production-storage'), config = path.join(directory, 'configuration'), home = path.join(config, 'home');
  const profile = { root: config, home, config: path.join(home, '.config'), cache: path.join(home, '.cache'), tmp: path.join(config, 'tmp') };
  for (const name of [root, path.join(root, 'data/opencode'), path.join(root, 'state'), ...Object.values(profile)]) fs.mkdirSync(name, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, 'data/opencode/opencode.db'), 'SYNTHETIC_NOT_SQLITE', { mode: 0o600 });
  const marker = path.join(root, '.production-storage.json');
  const record = { schemaVersion: 1, owner: 'opencode-stack', kind: 'production-native-storage', nativeVersion: '2.2.7', root, phase: 'history-verified' };
  fs.writeFileSync(marker, JSON.stringify(record), { mode: 0o600 });
  return { root, profile, marker, record };
}

test('production binding is explicit; HOME/config/cache/tmp and inherited credentials remain isolated', t => {
  const { root, profile } = fixture(t), selected = productionStorage(root), bound = bindProductionStorage(profile, selected);
  const env = generalEnvironment(bound, { OPENCODE_DB: '/original/never.db', HOME: '/foreign', OPENAI_API_KEY: 'DO_NOT_PROPAGATE' });
  assert.equal(env.OPENCODE_DB, selected.db); assert.equal(env.XDG_STATE_HOME, selected.state);
  for (const key of ['home', 'config', 'cache', 'tmp']) assert.equal(bound[key], profile[key]);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.throws(() => generalEnvironment({ ...bound, data: '/foreign' }), /binding differs/);
  assert.throws(() => bindProductionStorage(profile, { ...selected, db: '/original/never.db' }), /descriptor changed/);
});

test('unpublished history, arbitrary paths, secrets in marker, loose permissions and links fail closed', t => {
  const { root, profile, marker, record } = fixture(t);
  assert.throws(() => productionStorage(path.dirname(root)), /production-storage root/);
  fs.writeFileSync(marker, JSON.stringify({ ...record, phase: 'preparing' }));
  assert.throws(() => productionStorage(root), /not published/);
  fs.writeFileSync(marker, JSON.stringify({ ...record, password: 'DO_NOT_PRINT' }));
  assert.throws(() => productionStorage(root), e => !e.message.includes('DO_NOT_PRINT') && /not published/.test(e.message));
  fs.writeFileSync(marker, JSON.stringify(record)); fs.chmodSync(marker, 0o644);
  assert.throws(() => productionStorage(root), /private/); fs.chmodSync(marker, 0o600);
  const selected = productionStorage(root); fs.unlinkSync(selected.db); fs.symlinkSync('/never-follow', selected.db);
  assert.throws(() => bindProductionStorage(profile, selected), /symlink/);
});

test('production refreshes native model metadata while offline checks and candidate environments stay frozen', t => {
  const {root,profile}=fixture(t),bound=bindProductionStorage(profile,productionStorage(root));
  const inherited={OPENCODE_DISABLE_MODELS_FETCH:'1',OPENCODE_MODELS_URL:'https://untrusted.invalid',OPENAI_API_KEY:'MUST_NOT_FORWARD'};
  assert.equal(generalEnvironment(bound,inherited).OPENCODE_DISABLE_MODELS_FETCH,'1','Schema/source checks remain offline even with production binding');
  const candidate={...profile,data:path.join(profile.home,'.local/share'),state:path.join(profile.home,'.local/state')};
  assert.equal(interactiveEnvironment(candidate,inherited).OPENCODE_DISABLE_MODELS_FETCH,'1','Unbound migration candidates remain deterministic');
  assert.equal(serverEnvironment(candidate,inherited).OPENCODE_DISABLE_MODELS_FETCH,'1');
  for(const env of [interactiveEnvironment(bound,inherited),serverEnvironment(bound,inherited),terminalEnvironment(bound,{url:'http://127.0.0.1:12345',env:{OPENCODE_PASSWORD:'SYNTHETIC_OWNED'}},inherited)]){
    assert.equal(env.OPENCODE_DISABLE_MODELS_FETCH,undefined);
    assert.equal(env.OPENCODE_DISABLE_AUTOUPDATE,'1','Catalog refresh never upgrades the pinned runtime');
    assert.equal(env.OPENCODE_MODELS_URL,undefined,'Do not inherit arbitrary catalog endpoints');
    assert.equal(env.OPENAI_API_KEY,undefined);
  }
});
