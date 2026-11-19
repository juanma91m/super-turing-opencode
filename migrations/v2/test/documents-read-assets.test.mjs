import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareWorkshop, quote } from '../workshop-profile.mjs';
import { shell } from '../workshop-guard/guard.mjs';

const available = ['knowledge', 'ticketing', 'codegraph', 'documents'].every(name => fs.existsSync(new URL('../../../../super-turing-opencode-' + name + '/' + (name === 'documents' ? 'v2/reader/composition.mjs' : 'v2/composition.mjs'), import.meta.url)));
const { documentReaderExtension } = available ? await import('../../../../super-turing-opencode-documents/v2/reader/composition.mjs') : {};
const { knowledgeExtension } = available ? await import('../../../../super-turing-opencode-knowledge/v2/composition.mjs') : {};
const { ENGRAM_TOOLS } = available ? await import('../../../../super-turing-opencode-knowledge/v2/engram-config.mjs') : {};
const { ticketingExtension } = available ? await import('../../../../super-turing-opencode-ticketing/v2/composition.mjs') : {};
const { rovoServer } = available ? await import('../../../../super-turing-opencode-ticketing/v2/config.mjs') : {};
const { dcrLoopbackServer, rovoDiscoveryServer } = available ? await import('../../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs') : {};
const { codegraphExtension } = available ? await import('../../../../super-turing-opencode-codegraph/v2/composition.mjs') : {};
import { playwrightExtension } from '../../../v2/playwright/composition.mjs';

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/documents-assets-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const knowledge = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode', server: { type: 'local', command: ['/fixture/engram'], codemode: false, disabled: true }, permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
  const ticketing = ticketingExtension({ server: rovoDiscoveryServer(dcrLoopbackServer(rovoServer())) });
  const graph = codegraphExtension({ binding: { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' }, server: { type: 'local', command: ['/fixture/codegraph'], codemode: false, disabled: true } });
  const browser = playwrightExtension({ runtime: { home: root + '/runtime-home', cli: '/fixture/cli.js', browser: '/fixture/chrome', version: '0.0.85' }, server: { type: 'local', command: ['/fixture/browser'], codemode: false, disabled: true } });
  const prior = context => browser({ ...context, ...graph({ ...context, ...ticketing({ ...context, ...knowledge(context) }) }) });
  const reader = documentReaderExtension();
  return { root, prior, next: context => reader({ ...context, ...prior(context) }) };
}

test('reader is additive, deterministic and preserves prior MCPs/roles/CLI/app without publication', { skip: !available }, t => {
  const { root, prior, next } = fixture(t), options = { mock: 'http://127.0.0.1:1234/v1', context7: true };
  const p = prepareWorkshop(root, { ...options, extend: prior });
  const config = path.join(p.config, 'opencode'), before = fs.readFileSync(path.join(config, 'opencode.json')), cli = fs.readFileSync(path.join(config, 'cli.json'));
  const agent = fs.readFileSync(path.join(config, 'agents/planner.md'));
  fs.writeFileSync(p.editable, 'Operator content\n');
  const after = prepareWorkshop(root, { ...options, extend: next });
  assert.equal(after.roles.length, 15); assert.equal(after.skills.length, 21);
  assert.deepEqual(after.document.mcp, p.document.mcp);
  assert(fs.readFileSync(path.join(config, 'opencode.json.pre-documents-read.bak')).equals(before));
  assert(fs.readFileSync(path.join(config, 'cli.json')).equals(cli));
  assert(fs.readFileSync(path.join(config, 'agents/planner.md')).equals(agent));
  assert.equal(fs.readFileSync(after.editable, 'utf8'), 'Operator content\n');
  assert(!fs.existsSync(path.join(config, 'agents/documenter.md')));
  assert(!fs.existsSync(path.join(config, 'commands/publicar-documento.md')));
  const binary = path.join(p.project, 'fixtures/documents-read/sample document.odt'), original = fs.readFileSync(binary);
  assert.deepEqual(prepareWorkshop(root, { ...options, extend: next }).document, after.document);
  assert(fs.readFileSync(binary).equals(original));
});

test('reader refuses drift before adding helper, registry, skill or fixtures', { skip: !available }, t => {
  const { root, prior, next } = fixture(t), p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', extend: prior });
  fs.appendFileSync(path.join(p.config, 'opencode/opencode.json'), ' ');
  assert.throws(() => prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', extend: next }), /refusing upgrade/);
  assert(!fs.existsSync(path.join(p.config, 'opencode/scripts/review_document.py')));
  assert(!fs.existsSync(path.join(p.project, 'fixtures/documents-read')));
});

test('reader helper shell uses canonical validation and pinned scripts, not direct execution or general shell', { skip: !available }, t => {
  const { root, next } = fixture(t), p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1', extend: next });
  const boundary = p.document.plugins.find(plugin => typeof plugin === 'object' && plugin.package.endsWith('/workshop-guard/')).options;
  const command = `python3 ${quote(p.broker)} helper document-review --source 'fixtures/documents-read/sample document.odt' --render`;
  assert.doesNotThrow(() => shell(command, p.project, boundary));
  for (const bad of [command + '; touch app/message.txt', command + ' --output app/message.txt', command.replace('fixtures/documents-read/sample document.odt', '../outside.odt'), `python3 ${quote(path.join(p.config, 'opencode/scripts/review_document.py'))} --source fixture.odt`]) assert.throws(() => shell(bad, p.project, boundary));
  assert(!fs.existsSync(path.join(p.project, 'tmp')), 'Validators must never convert');
  fs.appendFileSync(path.join(p.config, 'opencode/scripts/review_document.py'), '\n# Drift fixture\n');
  assert.throws(() => shell(command, p.project, boundary), /trusted asset/);
});

test('reader apply requires client-close acknowledgment before profile or converter access', { skip: !available }, () => {
  const result = spawnSync(process.execPath, [new URL('../documents-read.mjs', import.meta.url).pathname, 'apply'], { env: { HOME: '/tmp/opencode/not-a-real-home', PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});
