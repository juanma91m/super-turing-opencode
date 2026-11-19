import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { register } from '../../playwright/plugins/access/access.mjs';

test('general browser upload scope is runtime location, old explicit scope remains compatible', async t => {
  const root = fs.mkdtempSync('/tmp/opencode/browser-location-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'), other = path.join(root, 'other'), outputDir = path.join(root, 'output');
  for (const dir of [project, other, outputDir]) fs.mkdirSync(dir);
  for (const dir of [project, other]) fs.writeFileSync(path.join(dir, 'file.txt'), 'Synthetic upload\n');
  for (const explicit of [false, true]) {
    let before;
    await register({ location: { directory: project }, options: { tools: ['playwright_browser_file_upload'], outputDir, ...(explicit ? { project } : {}) }, tool: { async hook(_kind, callback) { before = callback; } } });
    assert.doesNotThrow(() => before({ tool: 'playwright_browser_file_upload', input: { paths: ['file.txt'] } }));
    assert.throws(() => before({ tool: 'playwright_browser_file_upload', input: { paths: [path.join(other, 'file.txt')] } }), /outside/);
  }
});
