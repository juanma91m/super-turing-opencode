// Native V2 + synthetic model/MCPs + REAL local reader/converters on public
// synthetic documents. No user documents, publication, browser or index queries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { layout, environment, verify } from './staging.mjs';
import { prepareWorkshop, quote } from './workshop-profile.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { knowledgeExtension } from '../../../super-turing-opencode-knowledge/v2/composition.mjs';
import { ENGRAM_TOOLS } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { ticketingExtension } from '../../../super-turing-opencode-ticketing/v2/composition.mjs';
import { ROVO_TOOLS } from '../../../super-turing-opencode-ticketing/v2/config.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { codegraphExtension } from '../../../super-turing-opencode-codegraph/v2/composition.mjs';
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';
import { playwrightExtension } from '../../v2/playwright/composition.mjs';
import { inspectPlaywright } from '../../v2/playwright/inspect.mjs';
import { documentReaderExtension } from '../../../super-turing-opencode-documents/v2/reader/composition.mjs';
import { inspectReader } from '../../../super-turing-opencode-documents/v2/reader/inspect.mjs';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
const fixture = name => fileURLToPath(new URL('./fixtures/' + name, import.meta.url));
const trace = new Map();
let profile, officeReport, providerError;
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function text(value) {
  if (typeof value === 'string') { try { return text(JSON.parse(value)); } catch { return value; } }
  if (Array.isArray(value)) return value.map(text).join('\n');
  if (value && typeof value === 'object') {
    if (value.source && value.output_dir) return JSON.stringify(value);
    for (const key of ['text', 'stdout', 'output', 'content']) if (value[key] !== undefined) return text(value[key]);
    return JSON.stringify(value);
  }
  return '';
}

function report(value) {
  if (typeof value === 'string') {
    try { return report(JSON.parse(value)); } catch { /* native shell may add text */ }
    const first = value.indexOf('{'), last = value.lastIndexOf('}');
    if (first >= 0 && last > first) { try { return report(JSON.parse(value.slice(first, last + 1))); } catch { /* fail below */ } }
  } else if (Array.isArray(value)) {
    for (const item of value) { const found = report(item); if (found) return found; }
  } else if (value && typeof value === 'object') {
    if (value.source && value.output_dir) return value;
    for (const key of ['stdout', 'output', 'text', 'content', 'result']) { const found = report(value[key]); if (found) return found; }
  }
  return undefined;
}

function imageCount(value) {
  if (!value || typeof value !== 'object') return 0;
  let count = ['image', 'image_url', 'input_image'].includes(value.type) && (value.image_url || value.data || value.image || value.source) ? 1 : 0;
  for (const item of Object.values(value)) if (item && typeof item === 'object') count += imageCount(item);
  return count;
}

function helper(source, flags = '') {
  return `python3 ${quote(profile.broker)} helper document-review --source ${quote(source)}${flags ? ' ' + flags : ''}`;
}

function call(kind, results, tools) {
  if (kind === 'SKILL') {
    if (results.length) return undefined;
    const tool = tools.find(tool => (tool.function?.name ?? tool.name) === 'skill');
    const properties = tool?.function?.parameters?.properties ?? tool?.parameters?.properties ?? {};
    const key = ['id', 'name', 'skill'].find(key => properties[key]);
    assert(key, 'Unexpected native skill schema fields: ' + Object.keys(properties).join(', '));
    return ['skill', { [key]: 'lectura-documental' }];
  }
  if (kind === 'DISCOVERY') return results.length ? undefined : ['shell', { command: `python3 ${quote(profile.broker)} --help` }];
  if (['TEXT', 'OFFICE', 'PDF_RANGE', 'IMAGE'].includes(kind)) {
    if (!results.length) {
      const source = kind === 'TEXT' ? 'fixtures/documents-read/sample text.txt' : kind === 'OFFICE' ? 'fixtures/documents-read/sample document.odt'
        : kind === 'IMAGE' ? 'fixtures/documents-read/sample image.png' : path.relative(profile.project, officeReport.pdf);
      return ['shell', { command: helper(source, kind === 'OFFICE' ? '--render' : kind === 'PDF_RANGE' ? '--render --first-page 2 --last-page 2' : '') }];
    }
    const metadata = report(results[0]); assert(metadata, 'Helper JSON report not delivered through native shell');
    if (kind === 'OFFICE') officeReport = metadata;
    const files = [...(metadata.text ? [metadata.text] : []), ...(metadata.page_images ?? [])];
    if (results.length <= files.length) return ['read', { path: files[results.length - 1] }];
    return undefined;
  }
  if (results.length) return undefined;
  const good = helper('fixtures/documents-read/sample text.txt');
  const commands = {
    TRAVERSAL: helper('../outside.txt'), ABSOLUTE: helper('/outside/fixture.txt'),
    COMPOSITION: good + '; touch app/message.txt', OUTPUT_FLAG: good + ' --output app/message.txt',
    DIRECT_HELPER: `python3 ${quote(path.join(profile.config, 'opencode/scripts/review_document.py'))} --source fixture.txt`,
    OUTSIDE_SYMLINK: helper('fixtures/documents-read/outside.txt'),
    UNSUPPORTED: helper('fixtures/documents-read/unsupported.bin'),
    BAD_PDF: helper('fixtures/documents-read/bad.pdf'),
    BAD_RANGE: helper('fixtures/documents-read/sample document.odt', '--render --first-page 1 --last-page 3'),
    OUTPUT_SYMLINK: good, REVIEWER_DENY: good, SESSION_DENY: good, CWD_ESCAPE: good,
  };
  assert(commands[kind], 'Unknown reader fixture case');
  return ['shell', { command: commands[kind], ...(kind === 'CWD_ESCAPE' ? { workdir: path.dirname(profile.project) } : {}) }];
}

async function main() {
  assert(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--keep-previews', 'Only --keep-previews is supported');
  verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/documents-wire-');
  const mock = http.createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 16 * 1024 * 1024); }
      const body = JSON.parse(raw), kind = JSON.stringify(body.messages).match(/DRCASE_([A-Z_]+)/)?.[1]; assert(kind);
      const state = trace.get(kind) ?? { requests: 0 }; trace.set(kind, state); assert(++state.requests <= 7);
      state.tools = body.tools?.map(tool => tool.function?.name ?? tool.name) ?? [];
      state.results = body.messages.filter(message => message.role === 'tool').map(message => text(message.content));
      state.images = imageCount(body.messages);
      const selected = call(kind, state.results, body.tools ?? []);
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ id: 'reader-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (selected) {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_' + kind + '_' + state.results.length, type: 'function', function: { name: selected[0], arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected[1]) } }] });
      } else send({ role: 'assistant', content: 'MOCK_OK' });
      send({}, selected ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n'); state.finished = !selected;
    } catch (error) { providerError = error.message; response.writeHead(500); response.end('Reader fixture failed; values suppressed'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const mcp = (names, file) => ({ type: 'local', command: [process.execPath, fixture('ticketing-mcp.mjs')], environment: { FIXTURE_TOOLS: JSON.stringify(names), FIXTURE_LOG: path.join(root, file) }, codemode: false });
  let server;
  try {
    const knowledge = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode',
      server: mcp(ENGRAM_TOOLS.map(name => name.slice('engram_'.length)), 'engram-calls.jsonl'), permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
    const ticketing = ticketingExtension({ server: mcp(ROVO_TOOLS.map(name => name.slice('atlassian-rovo_'.length)), 'rovo-calls.jsonl') });
    const graph = codegraphExtension({ binding: { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' }, server: { type: 'local', command: [process.execPath, fixture('codegraph-mcp.mjs')], environment: { FIXTURE_ROOT: path.join(root, 'home/project'), FIXTURE_LOG: path.join(root, 'graph-calls.jsonl') }, codemode: false } });
    const browser = playwrightExtension({ runtime: { home: root + '/runtime-home', cli: '/fixture/cli.js', browser: '/fixture/chrome', version: '0.0.85' }, server: { type: 'local', command: [process.execPath, fixture('playwright-mcp.mjs')], environment: { FIXTURE_LOG: path.join(root, 'browser-calls.jsonl') }, codemode: false } });
    const reader = documentReaderExtension();
    const p = prepareWorkshop(root, { mock: `http://127.0.0.1:${mock.address().port}/v1`, context7: true,
      mcpFixture: { type: 'local', command: [process.execPath, fixture('context7-mcp.mjs')], environment: { CONTEXT7_FIXTURE_LOG: path.join(root, 'context7-calls.jsonl') }, codemode: false },
      extend: context => reader({ ...context, ...browser({ ...context, ...graph({ ...context, ...ticketing({ ...context, ...knowledge(context) }) }) }) }) });
    const document = structuredClone(p.document);
    document.providers['workshop-mock'].models.mock.capabilities.input.push('image');
    fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify(document, null, 2) + '\n');
    profile = { ...p, document };
    const app = fs.readFileSync(p.editable), originals = new Map(['sample text.txt', 'sample document.odt', 'sample image.png'].map(name => [path.join(p.project, 'fixtures/documents-read', name), digest(path.join(p.project, 'fixtures/documents-read', name))]));
    fs.writeFileSync(path.join(root, 'outside.txt'), 'Public outside fixture, must not be read');
    fs.symlinkSync(path.join(root, 'outside.txt'), path.join(p.project, 'fixtures/documents-read/outside.txt'));
    fs.writeFileSync(path.join(p.project, 'fixtures/documents-read/unsupported.bin'), 'Public unsupported input');
    fs.writeFileSync(path.join(p.project, 'fixtures/documents-read/bad.pdf'), 'Not a PDF');
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'Native reader config rejected; output suppressed');
    server = await startServer(base.binary, profile);
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/skill')).some(item => item.id === 'lectura-documental'), 'Reader skill');
    await until(async () => (await get('/api/mcp')).filter(item => item.status?.status === 'connected').length === 5, 'Existing five MCPs');
    await inspectReader(get); await inspectPlaywright(get, p.roles); await inspectCodeGraph(get, p.roles); await inspectTicketing(get, p.roles);
    await inspectKnowledge(server, profile, ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })), { additionalMcp: ['atlassian-rovo', 'codegraph', 'playwright'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access', 'opencode-stack.playwright-access'] });
    const output = path.join(p.project, 'tmp/document-review');
    const count = () => fs.existsSync(output) ? fs.readdirSync(output).length : 0;
    const cases = ['SKILL', 'DISCOVERY', 'TEXT', 'OFFICE', 'PDF_RANGE', 'IMAGE', 'TRAVERSAL', 'ABSOLUTE', 'COMPOSITION', 'OUTPUT_FLAG', 'DIRECT_HELPER', 'OUTSIDE_SYMLINK', 'UNSUPPORTED', 'BAD_PDF', 'BAD_RANGE', 'REVIEWER_DENY', 'SESSION_DENY', 'CWD_ESCAPE', 'OUTPUT_SYMLINK'];
    for (const kind of cases) {
      let saved;
      if (kind === 'OUTPUT_SYMLINK') { saved = output + '-saved'; fs.renameSync(output, saved); fs.symlinkSync(path.join(p.project, 'app'), output); }
      const before = kind === 'OUTPUT_SYMLINK' ? 0 : count();
      try {
        const created = await server.request('POST', '/api/session', { agent: kind === 'REVIEWER_DENY' ? 'code-reviewer' : 'planner', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project },
          ...(kind === 'SESSION_DENY' ? { permissions: [{ action: 'shell', resource: '*', effect: 'deny' }] } : {}) });
        assert.equal(created.status, 200);
        assert.equal((await server.request('POST', `/api/session/${created.value.data.id}/prompt`, { text: 'DRCASE_' + kind + '\nSynthetic document reader test, no business docs or publication.' })).status, 200);
        await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, kind, 45000);
        const state = trace.get(kind);
        if (kind === 'SKILL') assert(state.results.join('\n').includes('lectura-documental'));
        if (kind === 'DISCOVERY') assert(state.results.join('\n').includes('document-review'));
        const successful = ['TEXT', 'OFFICE', 'PDF_RANGE', 'IMAGE'].includes(kind);
        if (kind !== 'OUTPUT_SYMLINK') assert.equal(count(), before + Number(successful), kind + ' derived outputs');
        if (successful) {
          const metadata = report(state.results[0]); assert(metadata);
          assert(metadata.output_dir.startsWith(output + path.sep));
          if (kind === 'TEXT') assert(state.results[1].includes('DOCS_REVIEW_TEXT'));
          if (kind === 'OFFICE') {
            assert.equal(metadata.page_count, 2); assert.equal(metadata.page_images.length, 2);
            assert(state.results[1].includes('DOCS_REVIEW_PAGE_ONE') && state.results[1].includes('DOCS_REVIEW_PAGE_TWO'));
            assert.equal(state.results.length, 4, 'Must open text and both page images after conversion');
            assert(state.images >= 2, 'Both rendered pages must reach the multimodal model request');
          }
          if (kind === 'PDF_RANGE') { assert.deepEqual(metadata.rendered_range, [2, 2]); assert.equal(metadata.page_images.length, 1); assert(state.images >= 1); }
          if (kind === 'IMAGE') { assert(metadata.warnings.some(item => item.includes('No OCR'))); assert(state.images >= 1); }
        } else if (!['SKILL', 'DISCOVERY'].includes(kind)) assert(!report(state.results[0]), 'Blocked input must not return a successful report');
        assert(fs.readFileSync(p.editable).equals(app));
        for (const [file, expected] of originals) assert.equal(digest(file), expected, 'Original mutated');
        console.log('OK native document reader ' + kind);
      } finally { if (saved) { fs.unlinkSync(output); fs.renameSync(saved, output); } }
    }
    for (const file of ['engram-calls.jsonl', 'rovo-calls.jsonl', 'graph-calls.jsonl', 'browser-calls.jsonl']) assert(!fs.existsSync(path.join(root, file)));
    if (process.argv[2] === '--keep-previews') {
      const preview = fs.mkdtempSync('/tmp/opencode/documents-reader-previews-');
      for (const [index, image] of officeReport.page_images.entries()) fs.copyFileSync(image, path.join(preview, 'page-' + (index + 1) + '.png'));
      console.log(JSON.stringify({ publicSyntheticPreviews: preview, pages: officeReport.page_images.length }));
    }
    console.log(JSON.stringify({ cases: cases.length, agents: p.roles.length, skills: p.skills.length, newMcpServers: 0, originalsMutated: 0,
      nativeTextRead: true, renderedPagesDeliveredToModel: true, publisherEnabled: false, realBusinessDocuments: 0, realRemoteToolCalls: 0, convertersInstalled: false }));
  } finally { await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
