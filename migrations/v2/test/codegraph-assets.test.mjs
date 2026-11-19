import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareWorkshop } from '../workshop-profile.mjs';

const addon = new URL('../../../../super-turing-opencode-codegraph/v2/', import.meta.url);
const available = fs.existsSync(new URL('composition.mjs', addon));
const { codegraphExtension } = available ? await import(new URL('composition.mjs', addon)) : {};
const { CODEGRAPH_TOOL, CODEGRAPH_ROLES } = available ? await import(new URL('config.mjs', addon)) : {};
const { checkProject } = available ? await import(new URL('plugins/access/access.mjs', addon)) : {};
const { knowledgeExtension } = available ? await import('../../../../super-turing-opencode-knowledge/v2/composition.mjs') : {};
const { ENGRAM_TOOLS } = available ? await import('../../../../super-turing-opencode-knowledge/v2/engram-config.mjs') : {};
const { ticketingExtension } = available ? await import('../../../../super-turing-opencode-ticketing/v2/composition.mjs') : {};
const { rovoServer } = available ? await import('../../../../super-turing-opencode-ticketing/v2/config.mjs') : {};
const { dcrLoopbackServer, rovoDiscoveryServer } = available ? await import('../../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs') : {};

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/codegraph-assets-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binding = { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' };
  const knowledge = knowledgeExtension({ runtimeHome: binding.runtime_home, runtimeConfig: binding.runtime_home + '/.config/opencode', server: { type: 'local', command: ['/fixture/engram'], codemode: false, disabled: true }, permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
  const ticketing = ticketingExtension({ server: rovoDiscoveryServer(dcrLoopbackServer(rovoServer())) });
  const prior = context => ticketing({ ...context, ...knowledge(context) });
  const graph = codegraphExtension({ binding, server: { type: 'local', command: ['/fixture/codegraph'], codemode: false, disabled: true } });
  return { root, binding, prior, next: context => graph({ ...context, ...prior(context) }) };
}

test('query-only CodeGraph is additive, idempotent and preserves Rovo discovery, CLI, app and guards', { skip: !available }, t => {
  const { root, prior, next } = fixture(t);
  const before = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', context7: true, extend: prior });
  const file = path.join(before.config, 'opencode/opencode.json'), original = fs.readFileSync(file);
  const cli = fs.readFileSync(path.join(before.config, 'opencode/cli.json'));
  fs.writeFileSync(before.editable, 'Operator changes\n');
  const after = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', context7: true, extend: next });
  assert.equal(after.roles.length, 15); assert.equal(after.skills.length, 20);
  assert.deepEqual(after.document.mcp.servers['atlassian-rovo'], before.document.mcp.servers['atlassian-rovo']);
  assert(!Object.hasOwn(after.document.mcp.servers['atlassian-rovo'].oauth, 'scope'));
  assert(fs.readFileSync(file + '.pre-codegraph.bak').equals(original));
  assert(fs.readFileSync(path.join(after.config, 'opencode/cli.json')).equals(cli));
  assert.equal(fs.readFileSync(after.editable, 'utf8'), 'Operator changes\n');
  for (const role of CODEGRAPH_ROLES) {
    const text = fs.readFileSync(path.join(after.config, 'opencode/agents', role + '.md'), 'utf8');
    assert(text.includes(CODEGRAPH_TOOL + ': allow'));
    if (role === 'planner') assert(text.includes('KNOWLEDGE_AUTONOMY_START') && text.includes('TICKETING_AUTONOMY_START') && text.includes('  edit: deny'));
  }
  assert(!fs.existsSync(path.join(after.config, 'opencode/commands/codegraph-benchmark.md')));
  assert.deepEqual(prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', context7: true, extend: next }).document, after.document);
});

test('CodeGraph refuses drift before adding assets or replacing actors', { skip: !available }, t => {
  const { root, prior, next } = fixture(t), p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', extend: prior });
  const config = path.join(p.config, 'opencode'), agent = path.join(config, 'agents/planner.md'), before = fs.readFileSync(agent);
  fs.appendFileSync(path.join(config, 'opencode.json'), ' ');
  assert.throws(() => prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', extend: next }), /refusing upgrade/);
  assert(fs.readFileSync(agent).equals(before));
  assert(!fs.existsSync(path.join(config, 'scripts/codegraph_runtime.py')));
});

test('CodeGraph requires client-close acknowledgment before profile selection', { skip: !available }, () => {
  const result = spawnSync(process.execPath, [new URL('../codegraph.mjs', import.meta.url).pathname, 'apply'], { env: { HOME: '/tmp/opencode/not-a-real-home', PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});

test('root guard rejects implicit, relative, unindexed, symlink and subdirectory roots without backend work', { skip: !available }, t => {
  const root = fs.mkdtempSync('/tmp/opencode/codegraph-roots-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { runtimeHome: root + '/home' };
  for (const projectPath of [undefined, '.', root, '/', options.runtimeHome]) assert.throws(() => checkProject({ projectPath }, options));
  fs.mkdirSync(path.join(root, '.codegraph'));
  checkProject({ projectPath: root }, options, () => ({ status: 0, stdout: root + '\n' }));
  assert.throws(() => checkProject({ projectPath: root }, options, () => ({ status: 0, stdout: path.dirname(root) + '\n' })), /exact Git/);
  fs.rmdirSync(path.join(root, '.codegraph')); fs.symlinkSync(root, path.join(root, '.codegraph'));
  assert.throws(() => checkProject({ projectPath: root }, options), /symlink/);
  fs.mkdirSync(path.join(root, '.codegraph-existing'));
  checkProject({ projectPath: root }, { ...options, indexDir: '.codegraph-existing' }, () => ({ status: 0, stdout: root + '\n' }));
});

test('CodeGraph asset layer preserves explicit caller denies instead of duplicating or widening them', { skip: !available }, t => {
  const { root, binding } = fixture(t), config = path.join(root, 'config/opencode');
  const guarded = '---\npermission:\n  "codegraph_*": deny\n  edit: deny\n---\nKeep local guard\n';
  const ordinary = '---\npermission:\n  edit: deny\n---\nKeep role\n';
  const assets = CODEGRAPH_ROLES.map(role => ({ file: path.join(config, 'agents', role + '.md'), desired: role === 'planner' ? guarded : ordinary }));
  const result = codegraphExtension({ binding, server: { type: 'local', command: ['/fixture/codegraph'], codemode: false } })({
    config, assets, instructions: 'Prior instructions', skills: [], document: { mcp: { servers: {} }, permissions: [], policies: [],
      plugins: [{ package: '/fixture/workshop-guard/', options: { pinned: {} } }] },
  });
  assert.equal(result.assets.find(asset => asset.file.endsWith('/agents/planner.md')).desired, guarded);
});
