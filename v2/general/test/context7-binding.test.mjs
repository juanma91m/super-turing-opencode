import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { context7Contribution } from '../../context7/general.mjs';
import { context7Server } from '../../context7/policy.mjs';
import { planGeneral } from '../profile.mjs';

test('preprovisioned Context7 keeps the key out of the profile and passes it only to stdio', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'context7-binding-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeRoot = path.join(root, 'runtime');
  const pkg = path.join(runtimeRoot, 'node_modules/@upstash/context7-mcp');
  const credentialFile = path.join(root, 'private/api-key');
  const key = 'synthetic-credential-only';
  fs.mkdirSync(runtimeRoot, { mode: 0o700 });
  fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  fs.mkdirSync(path.dirname(credentialFile), { mode: 0o700 });
  fs.writeFileSync(credentialFile, key + '\n', { mode: 0o600 });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@upstash/context7-mcp', version: '4.8.0' }));
  fs.writeFileSync(path.join(pkg, 'dist/index.js'), `
if (process.env.CONTEXT7_API_KEY !== ${JSON.stringify(key)} || process.env.OPENCODE_PASSWORD ||
  process.argv.slice(2).join(' ') !== '--transport stdio') process.exit(2);
console.log('fixture ok');
`);
  const p = planGeneral(path.join(root, 'profile'), { project: root,
    contributions: [context7Contribution({ ...context7Server(), privateBinding: { credentialFile, runtimeRoot } })] });
  const server = p.document.mcp.servers.context7;
  assert.equal(server.type, 'local');
  assert(!('privateBinding' in server || 'environment' in server || 'headers' in server));
  assert([...p.assets.values()].every(bytes => !bytes.includes(key)));
  const [node, wrapper, ...args] = server.command;
  fs.mkdirSync(path.dirname(wrapper), { recursive: true });
  fs.writeFileSync(wrapper, p.assets.get(wrapper));
  const run = () => spawnSync(node, [wrapper, ...args], { encoding: 'utf8', timeout: 3000, env: { OPENCODE_PASSWORD: 'fixture-host-only' } });
  assert.equal(run().stdout.trim(), 'fixture ok');
  fs.chmodSync(credentialFile, 0o644);
  const refused = run();
  assert.equal(refused.status, 1);
  assert(!refused.stderr.includes(key));
});
