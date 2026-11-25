import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { generalPaths } from '../profile.mjs';
import { officialRuntime } from '../lifecycle.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';
import { generalEnvironment } from '../profile.mjs';
import { publishSkills, rollbackSkills, selectSkills, skillEnvironment } from '../skill-release.mjs';

const skill = 'skills/review/SKILL.md';
const old = '---\nname: review\ndescription: Review changes.\n---\nOld body.\n';
const fresh = old.replace('Old body.', 'New finding IDs.');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp/opencode', 'skill-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plan = { ...generalPaths(path.join(root, 'base'), root), document: {}, roles: [], commands: [], components: [], componentMetadata: {} };
  const config = path.join(plan.config, 'opencode');
  plan.assets = new Map([[path.join(config, 'opencode.json'), Buffer.from('{}\n')], [path.join(config, skill), Buffer.from(old)]]);
  for (const [file, bytes] of plan.assets) { fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); fs.writeFileSync(file, bytes, { mode: 0o600 }); }
  fs.mkdirSync(plan.tmp, { mode: 0o700 });
  return { plan, config, root };
}

test('publication switches only new launches and rollback keeps original assets', t => {
  const { plan, config } = fixture(t);
  const original = selectSkills(plan);
  const launch = generalEnvironment(plan);
  assert.equal(original, null);
  const id = publishSkills(plan, new Map([[skill, Buffer.from(fresh)]]), () => {});
  const next = selectSkills(plan);
  assert.equal(next.id, id);
  assert.equal(fs.readFileSync(path.join(next.directory, skill), 'utf8'), fresh);
  assert.equal(fs.readFileSync(path.join(config, skill), 'utf8'), old);
  assert.equal(launch.OPENCODE_CONFIG_DIR, config);
  assert.deepEqual(skillEnvironment(launch, next), { ...launch, OPENCODE_CONFIG_DIR: next.directory, XDG_CONFIG_HOME: path.dirname(next.directory) });
  assert.equal(selectSkills({ ...plan, assets: new Map([...plan.assets, [path.join(plan.root, 'bundle/changed'), Buffer.from('new base')]]) }), null);
  assert.throws(() => rollbackSkills(plan, 'stale'), /no blind rollback/);
  rollbackSkills(plan, id);
  assert.equal(selectSkills(plan), null);
  assert.equal(fs.readFileSync(path.join(next.directory, skill), 'utf8'), fresh);
});

test('no additions, non-skill changes, header changes, unchecked publication or edited candidate', t => {
  const { plan } = fixture(t);
  for (const [file, bytes] of [['opencode.json', fresh], ['skills/extra/SKILL.md', fresh], [skill, fresh.replace('name: review', 'name: other')]])
    assert.throws(() => publishSkills(plan, new Map([[file, Buffer.from(bytes)]]), () => {}));
  assert.throws(() => publishSkills(plan, new Map([[skill, Buffer.from(fresh)]]), () => { throw new Error('validation failed'); }), /validation failed/);
  assert.equal(selectSkills(plan), null);
  publishSkills(plan, new Map([[skill, Buffer.from(fresh)]]), () => {});
  const next = selectSkills(plan);
  fs.writeFileSync(path.join(next.directory, skill), old);
  assert.throws(() => selectSkills(plan), /integrity/);
});

test('official runtime registers new body, and project skill keeps precedence', { skip: !process.env.OPENCODE_TEST_RUNTIME_ROOT }, async t => {
  const { plan, root } = fixture(t);
  const runtime = officialRuntime(process.env.OPENCODE_TEST_RUNTIME_ROOT);
  const verify = variant => variant.verify(runtime, plan);
  publishSkills(plan, new Map([[skill, Buffer.from(fresh)]]), verify);
  const next = selectSkills(plan);
  const inspect = async expected => {
    next.verify(runtime, plan);
    const server = await startOwnedServer(runtime.binary, plan, () => skillEnvironment(generalEnvironment(plan), next));
    try {
      const entry = await until(async () => {
        const response = await server.request('GET', '/api/skill');
        return (response.value?.data ?? response.value)?.find?.(item => item.id === 'review');
      }, 'review skill');
      assert.match(entry.content, expected);
    } finally { await server.close(); }
  };
  await inspect(/New finding IDs/);
  const local = path.join(root, '.opencode', skill);
  fs.mkdirSync(path.dirname(local), { recursive: true }); fs.writeFileSync(local, old.replace('Old body.', 'Project body.'));
  await inspect(/Project body/);
});
