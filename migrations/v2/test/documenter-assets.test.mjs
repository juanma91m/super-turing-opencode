import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareWorkshop } from '../workshop-profile.mjs';
import { applyBuiltinVisibility } from '../builtin-visibility.mjs';
import { check, shell } from '../workshop-guard/guard.mjs';
import { fixtureStack } from '../fixtures/documenter-stack.mjs';
import { selectDocumenter } from '../../../../super-turing-opencode-documents/v2/documenter/preflight.mjs';
import { documenterExtension } from '../../../../super-turing-opencode-documents/v2/documenter/composition.mjs';
import { documenterInputs, hasManagedInputPins } from '../../../../super-turing-opencode-documents/v2/documenter/working-inputs.mjs';
import { environment, layout } from '../staging.mjs';

function fixture(t, inputOwnership = 'editable') {
  const root = fs.mkdtempSync('/tmp/opencode/documenter-reopen-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prior = fixtureStack(root, 'http://127.0.0.1:1234/v1');
  applyBuiltinVisibility(prepareWorkshop(root, prior));
  const binding = selectDocumenter(os.homedir(), path.join(os.homedir(), '.config/opencode'));
  const extension = documenterExtension({ binding, inputOwnership });
  const options = { ...prior, extend: context => extension({ ...context, ...prior.extend(context) }) };
  const p = prepareWorkshop(root, options);
  return { root, options, p, prior, binding };
}

const boundary = p => p.document.plugins.find(item => typeof item === 'object' && item.package.endsWith('/workshop-guard/')).options;
const optionsFor = (prior, binding, extra = {}) => {
  const extension = documenterExtension({ binding, ...extra });
  return { ...prior, extend: context => extension({ ...context, ...prior.extend(context) }) };
};

test('Documenter reopening preserves legitimate edits to working specs', t => {
  const { root, options, p } = fixture(t);
  const spec = path.join(p.project, 'artifact-studio/fixtures/document-spec.json');
  const edited = fs.readFileSync(spec, 'utf8') + '\n';
  fs.writeFileSync(spec, edited);
  assert.doesNotThrow(() => prepareWorkshop(root, options));
  assert.equal(fs.readFileSync(spec, 'utf8'), edited);
});

test('editing a working spec does not invalidate a trusted broker/checker command', t => {
  const { p } = fixture(t);
  const spec = path.join(p.project, 'artifact-studio/fixtures/document-spec.json');
  fs.appendFileSync(spec, '\n');
  const boundary = p.document.plugins.find(item => typeof item === 'object' && item.package.endsWith('/workshop-guard/')).options;
  assert.doesNotThrow(() => shell(p.commands[0], p.project, boundary));
});

test('working input edits do not exempt trusted scripts from integrity or reopen checks', t => {
  const { root, options, p } = fixture(t);
  fs.appendFileSync(documenterInputs(p.project)[0].file, '\n');
  fs.appendFileSync(path.join(p.config, 'opencode/scripts/review_document.py'), '\n# Unknown drift\n');
  assert.throws(() => shell(p.commands[0], p.project, boundary(p)), /trusted asset changed/);
  assert.throws(() => prepareWorkshop(root, options), /refusing upgrade/);
});

test('known legacy upgrade removes only three seed pins and preserves edits, outputs, hidden agents, CLI and backups', t => {
  const { root, prior, binding, p } = fixture(t, 'managed');
  const config = path.join(p.config, 'opencode/opencode.json'), before = fs.readFileSync(config);
  const cli = fs.readFileSync(path.join(p.config, 'opencode/cli.json'));
  const oldBackup = fs.readFileSync(config + '.pre-documenter.bak');
  const originals = new Map(documenterInputs(p.project).map(({ file }, index) => [file, index === 0 ? '{"inProgress":' : 'Operator correction ' + index + '\n']));
  for (const [file, value] of originals) fs.writeFileSync(file, value);
  const output = path.join(p.project, 'artifact-studio/artifacts/output/operator-output.txt');
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, 'Keep generated evidence\n');
  assert(hasManagedInputPins(p.document, p.project));
  // Negative control reproduces both old failure paths without changing code or
  // the real workshop. The malformed working JSON is intentionally not trusted.
  assert.throws(() => shell(p.commands[0], p.project, boundary(p)), /trusted asset changed/);
  assert.throws(() => prepareWorkshop(root, optionsFor(prior, binding)), /refusing upgrade/);
  assert(fs.readFileSync(config).equals(before));
  const upgraded = prepareWorkshop(root, optionsFor(prior, binding, { upgradeManagedInputs: true }));
  const expected = structuredClone(p.document);
  const oldBoundary = expected.plugins.find(item => typeof item === 'object' && item.package.endsWith('/workshop-guard/')).options;
  for (const file of originals.keys()) delete oldBoundary.pinned[file];
  assert.deepEqual(upgraded.document, expected, 'Only the three public input pins may change');
  assert(!hasManagedInputPins(upgraded.document, p.project));
  assert(fs.readFileSync(config + '.pre-documenter-inputs.bak').equals(before));
  assert(fs.readFileSync(config + '.pre-documenter.bak').equals(oldBackup));
  assert(fs.readFileSync(path.join(p.config, 'opencode/cli.json')).equals(cli));
  for (const [file, value] of originals) assert.equal(fs.readFileSync(file, 'utf8'), value);
  assert.equal(fs.readFileSync(output, 'utf8'), 'Keep generated evidence\n');
  assert.doesNotThrow(() => shell(p.commands[0], p.project, boundary(upgraded)));
  assert.deepEqual(prepareWorkshop(root, optionsFor(prior, binding)).document, upgraded.document);
  assert.deepEqual(prepareWorkshop(root, optionsFor(prior, binding, { upgradeManagedInputs: true })).document, upgraded.document);
  const native = spawnSync(layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary, ['debug', 'config', '--standalone'], { cwd: upgraded.project, env: environment(upgraded), encoding: 'utf8', timeout: 30000 });
  assert.equal(native.status, 0, 'Native upgraded config rejected; output suppressed');
  for (const name of ['engram-calls.jsonl', 'rovo-calls.jsonl', 'graph-calls.jsonl', 'browser-calls.jsonl', 'context7-calls.jsonl']) assert(!fs.existsSync(path.join(root, name)), 'Config validation must not call a fixture backend');
});

for (const subject of ['configuration', 'instructions', 'script', 'additional-pin', 'missing-protected-pin']) test('legacy input upgrade rejects unknown ' + subject + ' drift without changing inputs/config', t => {
  const { root, prior, binding, p } = fixture(t, 'managed');
  const config = path.join(p.config, 'opencode/opencode.json');
  const input = documenterInputs(p.project)[0].file; fs.appendFileSync(input, '\n');
  const inputBytes = fs.readFileSync(input);
  if (subject === 'instructions') fs.appendFileSync(path.join(p.config, 'opencode/AGENTS.md'), '\nOperator instructions\n');
  else if (subject === 'script') fs.appendFileSync(path.join(p.config, 'opencode/scripts/review_document.py'), '\n# Unknown drift\n');
  else {
    const changed = JSON.parse(fs.readFileSync(config));
    if (subject === 'configuration') changed.permissions.push({ action: '*', resource: '*', effect: 'allow' });
    const pins = changed.plugins.find(item => typeof item === 'object' && item.package.endsWith('/workshop-guard/')).options.pinned;
    if (subject === 'additional-pin') pins[path.join(p.project, 'artifact-studio/another.json')] = '0'.repeat(64);
    if (subject === 'missing-protected-pin') delete pins[p.broker];
    fs.writeFileSync(config, JSON.stringify(changed, null, 2) + '\n');
  }
  const configBytes = fs.readFileSync(config);
  assert.throws(() => prepareWorkshop(root, optionsFor(prior, binding, { upgradeManagedInputs: true })), /refusing upgrade/);
  assert(fs.readFileSync(config).equals(configBytes));
  assert(fs.readFileSync(input).equals(inputBytes));
  assert(!fs.existsSync(config + '.pre-documenter-inputs.bak'));
});

test('input symlink refuses known upgrade before removing pins or writing backup', t => {
  const { root, prior, binding, p } = fixture(t, 'managed');
  const config = path.join(p.config, 'opencode/opencode.json'), bytes = fs.readFileSync(config);
  const input = documenterInputs(p.project)[0].file;
  const target = path.join(root, 'outside-spec.json'); fs.writeFileSync(target, 'Do not touch\n');
  fs.unlinkSync(input); fs.symlinkSync(target, input);
  assert.throws(() => prepareWorkshop(root, optionsFor(prior, binding, { upgradeManagedInputs: true })), /Symlink/);
  assert(fs.readFileSync(config).equals(bytes)); assert.equal(fs.readFileSync(target, 'utf8'), 'Do not touch\n');
  assert(!fs.existsSync(config + '.pre-documenter-inputs.bak'));
});

test('Documenter upgrade is additive, idempotent, preserves hidden builtins and prior integrations', t => {
  const root = fs.mkdtempSync('/tmp/opencode/documenter-assets-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prior = fixtureStack(root, 'http://127.0.0.1:1234/v1');
  const before = applyBuiltinVisibility(prepareWorkshop(root, prior));
  const cli = fs.readFileSync(path.join(before.config, 'opencode/cli.json'));
  fs.writeFileSync(before.editable, 'Operator work\n');
  const binding = selectDocumenter(os.homedir(), path.join(os.homedir(), '.config/opencode'));
  const extension = documenterExtension({ binding });
  const options = { ...prior, extend: context => extension({ ...context, ...prior.extend(context) }) };
  const p = prepareWorkshop(root, options);
  assert.equal(p.roles.length, 22); assert.equal(p.skills.length, 33);
  assert.deepEqual(p.document.mcp, before.document.mcp);
  assert(p.document.agents.plan.hidden && p.document.agents.build.hidden);
  assert(fs.readFileSync(path.join(p.config, 'opencode/cli.json')).equals(cli));
  assert.equal(fs.readFileSync(p.editable, 'utf8'), 'Operator work\n');
  assert.deepEqual(prepareWorkshop(root, options).document, p.document);
  const boundary = p.document.plugins.find(item => typeof item === 'object' && item.package.endsWith('/workshop-guard/')).options;
  const reference = path.join(p.config, 'opencode/skills/artifact-generation/references/workflow.md');
  assert.doesNotThrow(() => check({ tool: 'read', agent: 'visual-qa', input: { path: reference } }, boundary, p.project));
  assert.throws(() => check({ tool: 'read', agent: 'planner', input: { path: reference } }, boundary, p.project), /outside/);
  assert.throws(() => check({ tool: 'write', agent: 'documenter', input: { path: reference } }, boundary, p.project), /outside/);
  assert.doesNotThrow(() => check({ tool: 'write', agent: 'documenter', input: { path: 'artifact-studio/source.json' } }, boundary, p.project));
  assert.throws(() => check({ tool: 'write', agent: 'artifact-renderer', input: { path: 'artifact-studio/source.json' } }, boundary, p.project), /authorized actor/);
  assert.throws(() => check({ tool: 'new-unreviewed-tool', agent: 'documenter', input: {} }, boundary, p.project), /unavailable/);
  fs.appendFileSync(path.join(p.config, 'opencode/opencode.json'), ' ');
  assert.throws(() => prepareWorkshop(root, options), /refusing upgrade/);
});

test('Documenter apply rejects missing operator acknowledgment before reading a profile', () => {
  const result = spawnSync(process.execPath, [new URL('../documents.mjs', import.meta.url).pathname, 'apply'], { env: { HOME: '/tmp/opencode/not-a-real-home', PATH: '/usr/bin:/bin' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});

test('Documenter input repair requires client-close acknowledgment before reading a profile', () => {
  const result = spawnSync(process.execPath, [new URL('../documents.mjs', import.meta.url).pathname, 'repair-inputs'], { env: { HOME: '/tmp/opencode/not-a-real-home', PATH: '/usr/bin:/bin' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});
