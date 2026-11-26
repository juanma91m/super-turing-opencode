import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const tool = fileURLToPath(new URL('../../tools/stack-ab.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', timeout: 90000 });

test('prepare exposes one reproducible fixture without requiring the runtime', () => {
  const first = run('prepare'), repeated = run('prepare');
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, repeated.stdout);
  const plan = JSON.parse(first.stdout);
  assert.equal(plan.axis, 'agent-prompt');
  assert.equal(plan.realInference, false);
  assert.notEqual(plan.promptRevisionSHA256.baseline, plan.promptRevisionSHA256.candidate);
  assert.notEqual(run('prepare', '--runtime', '/not-used').status, 0);
  assert.notEqual(run('execute').status, 0);
});

const runtime = process.env.STACK_AB_TEST_RUNTIME;
const temp = process.env.STACK_AB_TEST_TMP;
const skip = !runtime || !temp ? 'Explicit managed runtime and neutral temporary root required' : false;

test('native A/B uses private hosts, rejects inherited config and retains no run data', { skip }, t => {
  const root = fs.mkdtempSync(path.join(temp, 'stack-ab-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = path.join(root, 'opencode.json');
  fs.writeFileSync(config, '{ intentionally invalid fixture');
  const args = ['execute', '--runtime', runtime, '--tmp-root', root];
  const rejected = run(...args);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /neutral temporary directory/);
  assert.deepEqual(fs.readdirSync(root), ['opencode.json']);
  fs.unlinkSync(config);

  const executed = run(...args);
  assert.equal(executed.status, 0, executed.stderr);
  const report = JSON.parse(executed.stdout);
  assert.equal(report.realInference, false);
  assert.equal(report.qualityConclusion, null);
  for (const arm of Object.values(report.results)) {
    assert.equal(arm.observedRevision, true);
    assert.equal(arm.rubricPassed, true);
  }
  assert.notEqual(report.results.baseline.responseSHA256, report.results.candidate.responseSHA256);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('native cancellation cleans up without running the second arm', { skip }, async t => {
  const root = fs.mkdtempSync(path.join(temp, 'stack-ab-cancel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'keep.txt'), 'outside the run');
  const child = spawn(process.execPath, [tool, 'execute', '--runtime', runtime, '--tmp-root', root],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', sent = false;
  const fallback = setTimeout(() => child.kill('SIGTERM'), 75000);
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => {
    stderr += data;
    if (!sent && stderr.includes('baseline: private host ready')) {
      sent = true;
      child.kill('SIGINT');
    }
  });
  let status;
  try {
    status = await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('close', resolve);
    });
  } finally { clearTimeout(fallback); }
  assert(sent, stderr);
  assert.equal(status, 130, stderr);
  assert.match(stderr, /comparison cancelled/);
  assert.doesNotMatch(stderr, /candidate: private host ready/);
  assert.equal(stdout, '');
  assert.deepEqual(fs.readdirSync(root), ['keep.txt']);
  assert.equal(fs.readFileSync(path.join(root, 'keep.txt'), 'utf8'), 'outside the run');
});
