import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { planWorkingInputs } from '../working-inputs.mjs';
import { upgradeOwned } from '../owned-upgrade.mjs';

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/working-inputs-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('working data is seed-if-missing, not overwritten or parsed as trusted config', t => {
  const root = fixture(t), file = path.join(root, 'inputs/spec.json');
  const seeds = planWorkingInputs([{ file, initial: '{"sample":true}\n' }], root);
  assert(!fs.existsSync(file), 'Planning must not write');
  upgradeOwned(seeds); assert.equal(fs.readFileSync(file, 'utf8'), '{"sample":true}\n');
  fs.writeFileSync(file, '{"workInProgress":');
  assert.deepEqual(planWorkingInputs([{ file, initial: 'Different seed\n' }], root), []);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"workInProgress":');
});

test('working inputs cannot collide with protected ownership, escape, or use symlinks/directories', t => {
  const root = fixture(t), file = path.join(root, 'spec.json');
  assert.throws(() => planWorkingInputs([{ file, initial: 'seed' }], root, [file]), /ownership/);
  assert.throws(() => planWorkingInputs([{ file, initial: 'seed' }, { file, initial: 'other' }], root), /ownership/);
  for (const candidate of [path.join(root, '../outside'), path.join(root, '.env.production'), path.join(root, '.git/config')]) assert.throws(() => planWorkingInputs([{ file: candidate, initial: 'seed' }], root));
  fs.mkdirSync(file);
  assert.throws(() => planWorkingInputs([{ file, initial: 'seed' }], root), /regular/);
  fs.symlinkSync(file, path.join(root, 'link'));
  assert.throws(() => planWorkingInputs([{ file: path.join(root, 'link/spec.json'), initial: 'seed' }], root), /Symlink/);
  assert(!fs.existsSync(path.join(file, 'spec.json')));
});

test('unknown managed drift prevents creating missing project seeds', t => {
  const root = fixture(t), config = path.join(root, 'config.json'), input = path.join(root, 'spec.json');
  fs.writeFileSync(config, 'Operator config\n');
  const seeds = planWorkingInputs([{ file: input, initial: 'seed' }], root, [config]);
  assert.throws(() => upgradeOwned([...seeds, { file: config, desired: 'Trusted config\n' }]), /refusing upgrade/);
  assert(!fs.existsSync(input)); assert.equal(fs.readFileSync(config, 'utf8'), 'Operator config\n');
});
