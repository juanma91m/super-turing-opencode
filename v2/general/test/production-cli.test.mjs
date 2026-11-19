import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { invocation, connectedArguments, dispatchProductionCLI, nativeChild, runProductionCLI } from '../production-cli.mjs';
import { acquireCandidateLease } from '../launch.mjs';
import { assertNoProductionReaders } from '../production-leases.mjs';

test('native arguments preserve continue/session/prompt/files/format/permissions and -- data', () => {
  const argv = ['run', '--continue', '--session', 'ses_old', '--fork', '--file', 'a b.txt', '--file=x', '--format', 'json', '--auto', '--', 'two words', '--server=DATA'];
  assert.equal(invocation(argv, '/project').mode, 'managed');
  const at = argv.indexOf('--');
  assert.deepEqual(connectedArguments(argv, 'http://127.0.0.1:1'), [...argv.slice(0, at), '--server', 'http://127.0.0.1:1', ...argv.slice(at)]);
  assert.equal(invocation(['--session', 'ses_old', '/other'], '/project').project, '/other');
  assert.equal(invocation(['--prompt', '/not-a-directory'], '/project').project, '/project');
  assert.equal(invocation(['mini', '--prompt', '/not-a-directory'], '/project').project, '/project');
  assert.equal(invocation(['--', 'run'], '/project').command, 'tui');
  assert.equal(invocation(['run', '--prompt', '--server'], '/project').mode, 'managed');
  assert.equal(invocation(['run', '--title', '--help'], '/project').informational, false);
  assert.equal(invocation(['debug', 'heap-dump', '--directory', 'paths'], '/project').subcommand, 'heap-dump');
  assert.equal(invocation(['--completions', 'bash'], '/project').project, '/project');
  assert.equal(invocation(['--completions', 'bash'], '/project').informational, true);
  assert.equal(invocation(['--log-level', 'debug', 'run', 'hi'], '/project').command, 'run');
  for (const argv of [['--standalone'], ['--server=x'], ['serve'], ['service', 'status'], ['acp'], ['pair']]) assert.equal(invocation(argv, '/project').mode, 'native-hosting');
});

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp/opencode', 'production-cli-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'profile'), home = path.join(root, 'home'), storageRoot = path.join(directory, 'production-storage');
  const plan = { root, home, config: path.join(home, '.config'), data: path.join(home, '.local/share'), state: path.join(home, '.local/state'), cache: path.join(home, '.cache'), tmp: path.join(root, 'tmp'), project: directory };
  for (const file of [root, ...['home', 'config', 'cache', 'tmp'].map(key => plan[key]), path.join(storageRoot, 'data/opencode'), path.join(storageRoot, 'state')]) fs.mkdirSync(file, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(storageRoot, 'data/opencode/opencode.db'), 'SYNTHETIC', { mode: 0o600 });
  fs.writeFileSync(path.join(storageRoot, '.production-storage.json'), JSON.stringify({ schemaVersion: 1, owner: 'opencode-stack', kind: 'production-native-storage', nativeVersion: '2.2.7', root: storageRoot, phase: 'history-verified' }), { mode: 0o600 });
  const calls = [], connection = { url: 'http://127.0.0.1:1234', env: { OPENCODE_PASSWORD: 'SYNTHETIC_EPHEMERAL_PASSWORD' } };
  const options = { argv: ['run', '--session', 'ses_existing', '--format', 'json', 'hi'], cwd: directory, runtime: { binary: '/synthetic' }, storageRoot,
    select: async () => ({ plan, check: async () => { calls.push('check'); }, inspect: async () => { calls.push('inspect'); return { readyForChat: true }; } }),
    host: async (_binary, active, environment) => { calls.push('host'); assert.equal(environment(active).OPENCODE_DB, path.join(storageRoot, 'data/opencode/opencode.db')); return { connection, close: async () => { calls.push('close'); } }; },
    child: async (_binary, argv, { env }) => { calls.push('child'); assert.deepEqual(argv, connectedArguments(options.argv, connection.url)); assert.equal(env.OPENCODE_PASSWORD, connection.env.OPENCODE_PASSWORD); assert.equal(env.OPENCODE_STACK_TRANSPORT_FD, undefined); return 7; } };
  return { directory, root, options, calls };
}

test('orchestration keeps session selection native, exit status, production binding and cleanup', async t => {
  const { root, options, calls } = fixture(t);
  assert.equal(await dispatchProductionCLI(options), 7);
  assert.deepEqual(calls, ['check', 'host', 'inspect', 'child', 'close']);
  assertNoProductionReaders(root); assert(!fs.existsSync(path.join(root, '.candidate-launch.lock')));
});

test('two concurrent production readers are allowed; lifecycle writer is not', async t => {
  const { root, options } = fixture(t);
  let entered, unblock; const gate = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { unblock = resolve; });
  const first = dispatchProductionCLI({ ...options, child: async () => { entered(); await hold; return 0; } });
  await gate;
  assert.throws(() => acquireCandidateLease(root), /Production clients/);
  assert.equal(await dispatchProductionCLI(options), 7);
  unblock(); await first; assertNoProductionReaders(root);
  const release = acquireCandidateLease(root); release();
});

test('failed startup closes owned host and removes only its readers; unsupported hosting does not open storage', async t => {
  const { root, options, calls } = fixture(t);
  const original = options.select;
  await assert.rejects(dispatchProductionCLI({ ...options, select: async (...args) => ({ ...await original(...args), inspect: async () => ({ readyForChat: false }) }) }), /not ready/);
  assert.equal(calls.at(-1), 'close'); assertNoProductionReaders(root);
  calls.length = 0;
  await assert.rejects(dispatchProductionCLI({ ...options, argv: ['acp'], storageRoot: '/MUST_NOT_OPEN' }), /Managed harness does not support/);
  assert.deepEqual(calls, []);
});

test('version/help do not require production storage; native child preserves nonzero exit', async t => {
  const { options, calls } = fixture(t);
  assert.equal(await dispatchProductionCLI({ ...options, argv: ['--version'], storageRoot: '/MUST_NOT_OPEN', child: async (_binary, argv) => { assert.deepEqual(argv, ['--version']); return 0; } }), 0);
  assert.deepEqual(calls, []);
  assert.equal(await nativeChild(process.execPath, ['-e', 'process.exit(23)'], { cwd: options.cwd, env: { PATH: '/usr/bin:/bin' } }), 23);
});

test('relative TUI directory is resolved only by the native child; auth is usable without chat readiness', async t => {
  const { options, calls, directory } = fixture(t);
  fs.mkdirSync(path.join(directory, 'relative'));
  let childCwd;
  await dispatchProductionCLI({ ...options, argv: ['relative', '--session', 'ses_existing'], child: async (_binary, argv, { cwd }) => { childCwd = cwd; assert.equal(argv[0], 'relative'); return 0; } });
  assert.equal(childCwd, directory);
  calls.length = 0;
  assert.equal(await dispatchProductionCLI({ ...options, argv: ['auth', 'login', 'openai'], child: async () => 0 }), 0);
  assert.deepEqual(calls, ['check', 'host', 'close']);
});

test('public production entry requires the selected managed contract before runtime or storage work',async t=>{
  const {options,calls}=fixture(t);
  await assert.rejects(runProductionCLI(options),/Explicit managed-harness/);
  assert.deepEqual(calls,[]);
});
