import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { prepareWorkshop } from '../workshop-profile.mjs';
import { upgradeOwned } from '../owned-upgrade.mjs';
import { shell } from '../workshop-guard/guard.mjs';
const addon = new URL('../../../../super-turing-opencode-knowledge/v2/', import.meta.url);
const available = fs.existsSync(new URL('composition.mjs', addon));
const { knowledgeExtension } = available ? await import(new URL('composition.mjs', addon)) : {};
const { translateEngram, ENGRAM_TOOLS } = available ? await import(new URL('engram-config.mjs', addon)) : {};

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/knowledge-assets-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const extend = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode',
    server: translateEngram({ type: 'local', command: ['/fixture/engram', 'mcp'], enabled: false }),
    permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })),
  });
  return { root, options: { mock: 'http://127.0.0.1:1234/v1', context7: true, extend } };
}

test('asset composition is additive, idempotent and preserves CLI/app plus prior upgrade backups', { skip: !available }, t => {
  const { root, options } = fixture(t);
  prepareWorkshop(root, { mock: options.mock });
  const prior = prepareWorkshop(root, { ...options, extend: undefined });
  fs.writeFileSync(prior.editable, 'Operator fixture edit\n');
  const cliFile = path.join(prior.config, 'opencode/cli.json');
  const cli = fs.readFileSync(cliFile);
  const p = prepareWorkshop(root, options);
  assert.equal(p.roles.length, 15);
  assert.equal(p.skills.length, 18);
  assert.equal(p.document.agents.plan.disabled, false);
  assert.equal(p.document.agents.build.disabled, false);
  assert.deepEqual(Object.keys(p.document.mcp.servers).sort(), ['context7', 'engram']);
  assert.equal(p.document.mcp.servers.engram.disabled, true, 'Do not activate a disabled backend');
  assert.equal(fs.readFileSync(p.editable, 'utf8'), 'Operator fixture edit\n');
  assert(fs.readFileSync(cliFile).equals(cli));
  assert(fs.existsSync(path.join(p.config, 'opencode/opencode.json.pre-context7.bak')));
  assert(fs.existsSync(path.join(p.config, 'opencode/opencode.json.pre-knowledge.bak')));
  assert.equal(prepareWorkshop(root, options).roles.length, 15);
});

test('unknown config drift prevents all agent/autonomy and helper additions', { skip: !available }, t => {
  const { root, options } = fixture(t);
  const prior = prepareWorkshop(root, { ...options, extend: undefined });
  const agent = path.join(prior.config, 'opencode/agents/master-dev.md');
  const before = fs.readFileSync(agent);
  const config = path.join(prior.config, 'opencode/opencode.json');
  fs.appendFileSync(config, ' ');
  assert.throws(() => prepareWorkshop(root, options), /refusing upgrade/);
  assert(fs.readFileSync(agent).equals(before));
  assert(!fs.existsSync(path.join(prior.config, 'opencode/scripts/knowledge_runtime.py')));
});

test('binary resources use byte comparisons and a separate safe upgrade namespace', { skip: !available }, t => {
  const { root } = fixture(t);
  const file = path.join(root, 'resources/example.bin');
  const first = Buffer.from([0, 255, 1]), second = Buffer.from([0, 128, 2]);
  upgradeOwned([{ file, desired: first, tag: 'knowledge' }]);
  upgradeOwned([{ file, desired: second, previous: first, backup: true, tag: 'knowledge' }]);
  assert(fs.readFileSync(file).equals(second));
  assert(fs.readFileSync(file + '.pre-knowledge.bak').equals(first));
  assert.throws(() => upgradeOwned([{ file, desired: second, tag: '../bad' }]), /tag/);
});

test('helper shell validation checks pinned assets before calling a non-executing validator', { skip: !available }, t => {
  const { root, options } = fixture(t), p = prepareWorkshop(root, options);
  const boundary = p.document.plugins.find(plugin => typeof plugin === 'object' && plugin.options?.helperValidator).options;
  const runner = (binary, args, call) => {
    assert.equal(binary, 'python3');
    assert.equal(args[1], '--check-command');
    assert.equal(JSON.parse(call.input).command, 'fixture helper');
    return { status: 0 };
  };
  assert.doesNotThrow(() => shell('fixture helper', p.project, boundary, runner));
  assert.throws(() => shell('fixture helper', p.project, boundary, () => ({ status: 2 })), /allowlist/);
  fs.appendFileSync(boundary.helperValidator, '\n# drift\n');
  assert.throws(() => shell('fixture helper', p.project, boundary, runner), /trusted asset/);
});

test('live composition requires a client-close acknowledgment before any profile or backend work', { skip: !available }, t => {
  const root = fs.mkdtempSync('/tmp/opencode/knowledge-consent-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [new URL('../knowledge.mjs', import.meta.url).pathname, 'apply'], {
    env: { HOME: root, PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert(result.stderr.includes('--client-closed'));
  assert.deepEqual(fs.readdirSync(root), []);
});
