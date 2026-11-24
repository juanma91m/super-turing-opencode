import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { nativeSources } from '../audit.mjs';

function probe(t, stdout, status = 0) {
  const root = fs.mkdtempSync('/tmp/opencode/audit-capabilities-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binary = path.join(root, 'mock-opencode');
  fs.writeFileSync(binary, `#!/usr/bin/env node
if (process.argv.slice(2).join(' ') !== 'debug config --standalone') process.exit(26);
if (!process.env.OPENCODE_DB.startsWith(${JSON.stringify(root + '/')})) process.exit(27);
if (process.env.OPENCODE_DISABLE_AUTOUPDATE !== '1' || process.env.FIXTURE_SECRET) process.exit(28);
process.stderr.write('PRIVATE_TEST_MARKER');
process.stdout.write(${JSON.stringify(stdout)});
process.exitCode = ${status};
`, { mode: 0o700 });
  const result = () => nativeSources(binary, root, root, { PATH: process.env.PATH, TMPDIR: root, FIXTURE_SECRET: 'fixture' });
  return { result, root };
}

test('discovers native sources in isolated storage without probing host version', t => {
  const sources = [{ type: 'document', path: '/fixture/opencode.json', info: {} }, { type: 'directory', path: '/fixture' }];
  const { result, root } = probe(t, JSON.stringify(sources));
  assert.deepEqual(result(), { entries: sources, runtimeOverridesPresent: false, applicationDataOpened: false });
  assert.deepEqual(fs.readdirSync(root), ['mock-opencode']);
});

test('fails closed without exposing child output for unavailable or malformed discovery', t => {
  const marker = 'PRIVATE_TEST_MARKER';
  const rejected = (stdout, status, expected) => {
    const { result, root } = probe(t, stdout, status);
    assert.throws(result, error => expected.test(error.message) && !error.message.includes(marker));
    assert.deepEqual(fs.readdirSync(root), ['mock-opencode']);
  };
  rejected(marker, 1, /^Native source discovery unavailable/);
  rejected(marker, 0, /^Native source JSON invalid/);
  for (const entries of [[null], { data: [] }, [{ type: 'document', path: '/fixture' }],
    [{ type: 'document', path: '/fixture', info: [] }]]) {
    rejected(JSON.stringify(entries), 0, /^Incompatible native config source format/);
  }
});
