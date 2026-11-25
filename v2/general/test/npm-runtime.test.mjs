import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { npmRuntime } from '../npm-runtime.mjs';
import { MANAGED_CONTRACT, runProductionCLI } from '../production-cli.mjs';

test('production accepts npm package replacement without a version allowlist or a stack deployment', async t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-runtime-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const stagingRoot = path.join(fixture, 'opencode-runtime'), prefix = path.join(stagingRoot, 'npm');
  const pkg = path.join(prefix, 'lib/node_modules/@opencode/cli'), bin = path.join(prefix, 'bin');
  fs.mkdirSync(prefix, { recursive: true, mode: 0o700 });
  fs.mkdirSync(pkg, { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(stagingRoot, 'home'));
  fs.writeFileSync(path.join(stagingRoot, 'home/npm-global-empty.rc'), '');
  fs.writeFileSync(path.join(stagingRoot, '.stack-runtime.json'), JSON.stringify({ schemaVersion: 1, owner: 'opencode-stack', kind: 'official-native-runtime', version: '2.2.7' }));
  const binary = path.join(pkg, 'official');
  fs.symlinkSync(binary, path.join(bin, 'opencode'));
  const write = version => {
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@opencode/cli', version, bin: { opencode: './official' } }));
    fs.writeFileSync(binary, '#!/bin/sh\n# ' + version + '\n', { mode: 0o700 });
  };
  write('2.2.7');
  assert.equal(npmRuntime(stagingRoot).version, '2.2.7');
  write('9.99.0');
  const options = { argv: ['upgrade', '9.99.0'], cwd: fixture, stagingRoot, managedContract: MANAGED_CONTRACT,
    select: () => assert.fail('Binary updates do not select/rebuild the stack'), storageRoot: '/not-opened',
    child: async (exe, argv, { cwd, env }) => {
      assert.equal(exe, binary);
      assert.equal(cwd, stagingRoot);
      assert.deepEqual(argv, ['upgrade', '9.99.0']);
      assert.equal(env.NPM_CONFIG_PREFIX, prefix);
      assert.equal(env.PATH.split(':')[0], bin);
      assert.equal(env.OPENCODE_DISABLE_AUTOUPDATE, undefined);
      return 0;
    } };
  assert.equal(npmRuntime(stagingRoot).version, '9.99.0');
  assert.equal(await runProductionCLI(options), 0);
  await assert.rejects(runProductionCLI({ ...options, argv: ['upgrade', '--method=curl'] }), /isolated npm prefix/);
  fs.unlinkSync(path.join(bin, 'opencode'));
  fs.symlinkSync(process.execPath, path.join(bin, 'opencode'));
  assert.throws(() => npmRuntime(stagingRoot), /escaped the selected package/);
});
