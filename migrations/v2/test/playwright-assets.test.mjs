import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareWorkshop } from '../workshop-profile.mjs';
import { playwrightExtension } from '../../../v2/playwright/composition.mjs';
import { PLAYWRIGHT_TOOLS, PLAYWRIGHT_ROLES } from '../../../v2/playwright/config.mjs';
import { check } from '../../../v2/playwright/plugins/access/access.mjs';
const available = ['knowledge', 'ticketing', 'codegraph'].every(name => fs.existsSync(new URL('../../../../super-turing-opencode-' + name + '/v2/composition.mjs', import.meta.url)));
const { knowledgeExtension } = available ? await import('../../../../super-turing-opencode-knowledge/v2/composition.mjs') : {};
const { ENGRAM_TOOLS } = available ? await import('../../../../super-turing-opencode-knowledge/v2/engram-config.mjs') : {};
const { ticketingExtension } = available ? await import('../../../../super-turing-opencode-ticketing/v2/composition.mjs') : {};
const { rovoServer } = available ? await import('../../../../super-turing-opencode-ticketing/v2/config.mjs') : {};
const { dcrLoopbackServer, rovoDiscoveryServer } = available ? await import('../../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs') : {};
const { codegraphExtension } = available ? await import('../../../../super-turing-opencode-codegraph/v2/composition.mjs') : {};

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/playwright-assets-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const knowledge = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode', server: { type: 'local', command: ['/fixture/engram'], codemode: false, disabled: true }, permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
  const ticketing = ticketingExtension({ server: rovoDiscoveryServer(dcrLoopbackServer(rovoServer())) });
  const graph = codegraphExtension({ binding: { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' }, server: { type: 'local', command: ['/fixture/codegraph'], codemode: false, disabled: true } });
  const prior = context => graph({ ...context, ...ticketing({ ...context, ...knowledge(context) }) });
  const browser = playwrightExtension({ runtime: { home: root + '/runtime-home', cli: '/fixture/cli.js', browser: '/fixture/chrome', version: '0.0.85' }, server: { type: 'local', command: ['/fixture/browser'], codemode: false, disabled: true } });
  return { root, prior, next: context => browser({ ...context, ...prior(context) }) };
}

test('Playwright upgrade preserves prior MCPs, app, CLI and role guards, with stable reopening', { skip: !available }, t => {
  const { root, prior, next } = fixture(t);
  const p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', context7: true, extend: prior });
  const config = path.join(p.config, 'opencode'), before = fs.readFileSync(path.join(config, 'opencode.json')), cli = fs.readFileSync(path.join(config, 'cli.json'));
  fs.writeFileSync(p.editable, 'Operator-owned content\n');
  const after = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', context7: true, extend: next });
  assert.equal(after.roles.length, 15); assert.equal(after.skills.length, 20);
  for (const name of ['engram', 'atlassian-rovo', 'codegraph', 'context7']) assert.deepEqual(after.document.mcp.servers[name], p.document.mcp.servers[name]);
  assert(fs.readFileSync(path.join(config, 'opencode.json.pre-playwright.bak')).equals(before));
  assert(fs.readFileSync(path.join(config, 'cli.json')).equals(cli));
  assert.equal(fs.readFileSync(after.editable, 'utf8'), 'Operator-owned content\n');
  for (const role of PLAYWRIGHT_ROLES) {
    const text = fs.readFileSync(path.join(config, 'agents', role + '.md'), 'utf8');
    assert(text.includes('playwright_browser_set_mode: allow'));
    assert(text.includes('playwright_browser_run_code_unsafe: deny'));
    assert(!/"playwright_\*": true/.test(text));
    if (role === 'planner') assert(text.includes('  edit: deny') && text.includes('TICKETING_AUTONOMY_START') && text.includes('KNOWLEDGE_AUTONOMY_START'));
  }
  assert(!after.document.mcp.servers.stitch);
  assert.deepEqual(prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', context7: true, extend: next }).document, after.document);
});

test('Playwright refuses drift before adding runtime assets or changing actors', { skip: !available }, t => {
  const { root, prior, next } = fixture(t), p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', extend: prior });
  const config = path.join(p.config, 'opencode'), agent = path.join(config, 'agents/planner.md'), before = fs.readFileSync(agent);
  fs.appendFileSync(path.join(config, 'opencode.json'), ' ');
  assert.throws(() => prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', extend: next }), /refusing upgrade/);
  assert(fs.readFileSync(agent).equals(before)); assert(!fs.existsSync(path.join(config, 'scripts/playwright_runtime.py')));
});

test('browser boundary rejects host execution, sensitive uploads, output escapes and non-HTTP URLs', t => {
  const root = fs.mkdtempSync('/tmp/opencode/browser-boundary-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { tools: PLAYWRIGHT_TOOLS, project: root, outputDir: path.join(root, 'out') };
  check('playwright_browser_set_mode', { mode: 'headless' }, options);
  check('playwright_browser_navigate', { url: 'http://127.0.0.1:1234' }, options);
  for (const url of ['file:///fixture', 'javascript:void(0)', 'https://user:fixture@example.invalid']) assert.throws(() => check('playwright_browser_navigate', { url }, options));
  assert.throws(() => check('playwright_browser_run_code_unsafe', {}, options));
  assert.throws(() => check('playwright_browser_file_upload', { paths: [path.join(root, '.env.fixture')] }, options));
  assert.throws(() => check('playwright_browser_file_upload', { paths: ['/outside/fixture'] }, options));
  assert.throws(() => check('playwright_browser_take_screenshot', { filename: path.join(root, 'app.png') }, options));
  assert.throws(() => check('playwright_browser_snapshot', { filename: 'relative.txt' }, options));
  check('playwright_browser_take_screenshot', { filename: path.join(options.outputDir, 'smoke.png') }, options);
  fs.writeFileSync(path.join(root, 'upload.txt'), 'Fixture');
  check('playwright_browser_file_upload', { paths: [path.join(root, 'upload.txt')] }, options);
  fs.mkdirSync(options.outputDir); fs.symlinkSync(root, path.join(options.outputDir, 'linked'));
  assert.throws(() => check('playwright_browser_snapshot', { filename: path.join(options.outputDir, 'linked/escape.txt') }, options));
});

test('Playwright apply requires explicit client-close acknowledgment before access', { skip: !available }, () => {
  const result = spawnSync(process.execPath, [new URL('../playwright.mjs', import.meta.url).pathname, 'apply'], { env: { HOME: '/tmp/opencode/not-a-real-home', PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});
