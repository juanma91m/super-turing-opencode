import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { layout, environment, verify } from './staging.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { applyBuiltinVisibility, inspectBuiltinVisibility } from './builtin-visibility.mjs';
import { startServer, until } from './private-server.mjs';
import { getApiList } from './api-list.mjs';
import { fixtureStack } from './fixtures/documenter-stack.mjs';
import { selectDocumenter } from '../../../super-turing-opencode-documents/v2/documenter/preflight.mjs';
import { documenterExtension } from '../../../super-turing-opencode-documents/v2/documenter/composition.mjs';
import { inspectDocumenter } from '../../../super-turing-opencode-documents/v2/documenter/inspect.mjs';
import { documentMemoryOverrides } from '../../../super-turing-opencode-documents/v2/documenter/policy.mjs';
import { inspectKnowledge } from './knowledge-inspect.mjs';
import { ENGRAM_TOOLS } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { inspectTicketing } from '../../../super-turing-opencode-ticketing/v2/inspect.mjs';
import { inspectCodeGraph } from '../../../super-turing-opencode-codegraph/v2/inspect.mjs';
import { inspectPlaywright } from '../../v2/playwright/inspect.mjs';
import { portAvailable } from '../../../super-turing-opencode-documents/v2/documenter/runtime.mjs';

const trace = new Map();
let profile, firstPreview, qaSessionID, unrelatedSessionID;
const artifact = extension => path.join(profile.project, 'artifact-studio/artifacts/output/prueba-local-de-documenter-v2.' + extension);

function text(value) {
  if (typeof value === 'string') { try { return text(JSON.parse(value)); } catch { return value; } }
  if (Array.isArray(value)) return value.map(text).join('\n');
  if (value && typeof value === 'object') {
    if ('valid' in value || 'pages' in value || 'ok' in value) return JSON.stringify(value);
    if (value.error) return JSON.stringify(value.error);
    if (value.text !== undefined) return text(value.text);
    if (value.content !== undefined) return text(value.content);
    return JSON.stringify(value);
  }
  return '';
}

function imageCount(value) {
  if (!value || typeof value !== 'object') return 0;
  const own = ['image', 'image_url', 'input_image'].includes(value.type) && (value.image_url || value.data || value.image || value.source) ? 1 : 0;
  return own + Object.values(value).reduce((count, item) => count + imageCount(item), 0);
}

function call(kind, results) {
  if (kind === 'BROWSER_OPEN') return [
    ['playwright_browser_set_mode', { mode: 'headless' }], ['playwright_browser_navigate', { url: 'http://127.0.0.1:3000' }], ['playwright_browser_wait_for', { time: 1 }],
  ][results.length];
  if (kind === 'CHILD_QA') return results.length ? undefined : ['read', { path: firstPreview }];
  if (results.length) return undefined;
  if (kind === 'CATALOG') return undefined;
  if (kind === 'WRITE') return ['write', { path: 'artifact-studio/source-note.md', content: 'Synthetic source; not an approved final artifact.\n' }];
  if (kind === 'APP_WRITE') return ['write', { path: 'app/message.txt', content: 'MUST_NOT_WRITE' }];
  if (kind === 'VALIDATE') return ['artifact-validate', { input: 'artifact-studio/fixtures/document-spec.json', kind: 'spec' }];
  if (kind === 'FONTS') return ['artifact-fonts', {}];
  if (kind === 'RENDER' || kind === 'QA_RENDER_DENY' || kind === 'PLANNER_RENDER_DENY' || kind === 'RENDER_SESSION_DENY') return ['artifact-render', { spec: 'artifact-studio/fixtures/document-spec.json', format: 'all' }];
  if (kind.startsWith('PREVIEW_')) return ['artifact-preview', { artifact: artifact(kind.slice('PREVIEW_'.length).toLowerCase()) }];
  if (kind.startsWith('CHECK_')) return ['artifact-validate', { input: artifact(kind.slice('CHECK_'.length).toLowerCase()), kind: 'artifact' }];
  if (kind === 'FLOW') return ['artifact-service-flow', { spec: 'artifact-studio/fixtures/service-flow.json', format: 'all' }];
  if (kind === 'SEQUENCE') return ['artifact-narrated-sequence', { spec: 'artifact-studio/fixtures/narrated-sequence.json', format: 'all' }];
  if (kind === 'RECEIPT') return ['artifact-verify-receipt', { receipt: 'artifact-studio/artifacts/output/service-flow.service-flow-report.json', spec: 'artifact-studio/fixtures/service-flow.json' }];
  if (kind === 'SVG_CHECK') return ['artifact-validate', { input: 'artifact-studio/artifacts/output/service-flow.svg', kind: 'artifact' }];
  if (kind === 'ESCAPE') return ['artifact-render', { spec: '../outside.json', format: 'pdf' }];
  if (kind === 'OUTPUT_ESCAPE') return ['artifact-preview', { artifact: artifact('pdf'), output: 'app' }];
  if (kind === 'READ_REFERENCE') return ['read', { path: path.join(profile.config, 'opencode/skills/artifact-generation/references/workflow.md') }];
  if (kind === 'ROUTE_QA' || kind === 'MASTER_DELEGATE_DENY' || kind === 'NESTED_DENY') return ['subagent', { agent: 'visual-qa', description: 'Synthetic independent QA routing', prompt: 'DCASE_CHILD_QA\nRead the single public synthetic preview ' + firstPreview + '. Do not render, delegate or approve semantic quality in this fixture.', background: false }];
  if (kind === 'FOLLOWUP_QA') return ['subagent', { agent: 'visual-qa', sessionID: qaSessionID, description: 'Synthetic QA followup', prompt: 'DCASE_CHILD_QA\nReturn only MOCK_QA_FOLLOWUP, no new tools.', background: false }];
  if (kind === 'WRONG_TARGET') return ['subagent', { agent: 'code-inspector', description: 'Forbidden target', prompt: 'Do not execute this fixture.' }];
  if (kind === 'WRONG_SESSION') return ['subagent', { agent: 'visual-qa', sessionID: unrelatedSessionID, description: 'Forbidden unrelated session', prompt: 'Do not execute this fixture.' }];
  if (kind === 'CANVAS_FOREIGN' || kind === 'CANVAS_START') return ['excalidraw-canvas', { action: 'start' }];
  if (kind === 'CANVAS_STATUS') return ['excalidraw-canvas', { action: 'status' }];
  if (kind === 'CANVAS_ADD') return ['excalidraw-canvas', { action: 'add', payload: JSON.stringify([
    { id: 'input', type: 'rectangle', x: 100, y: 100, width: 180, height: 70, text: 'Entrada', backgroundColor: '#a5d8ff', fillStyle: 'solid' },
    { id: 'output', type: 'rectangle', x: 420, y: 100, width: 180, height: 70, text: 'Resultado', backgroundColor: '#b2f2bb', fillStyle: 'solid' },
    { id: 'link', type: 'arrow', x: 0, y: 0, startElementId: 'input', endElementId: 'output', text: 'render' },
  ]) }];
  if (kind === 'CANVAS_UPDATE') return ['excalidraw-canvas', { action: 'update', elementId: 'input', payload: JSON.stringify({ backgroundColor: '#b197fc' }) }];
  if (kind === 'CANVAS_QUERY') return ['excalidraw-canvas', { action: 'query' }];
  if (kind === 'CANVAS_DESCRIBE') return ['excalidraw-canvas', { action: 'describe' }];
  if (kind === 'CANVAS_SAVE') return ['excalidraw-canvas', { action: 'snapshot-save', snapshot: 'smoke-before-clear' }];
  if (kind === 'CANVAS_LIST') return ['excalidraw-canvas', { action: 'snapshot-list' }];
  if (kind === 'CANVAS_CLEAR_DENY') return ['excalidraw-canvas', { action: 'clear', confirmClear: false }];
  if (kind === 'CANVAS_CLEAR') return ['excalidraw-canvas', { action: 'clear', confirmClear: true }];
  if (kind === 'CANVAS_RESTORE') return ['excalidraw-canvas', { action: 'snapshot-restore', snapshot: 'smoke-before-clear' }];
  if (kind === 'CANVAS_EXPORT') return ['excalidraw-canvas', { action: 'export', path: 'artifact-studio/artifacts/output/canvas.excalidraw' }];
  if (kind === 'CANVAS_IMPORT') return ['excalidraw-canvas', { action: 'import', path: 'artifact-studio/artifacts/output/canvas.excalidraw', replace: true }];
  if (kind === 'CANVAS_PNG' || kind === 'CANVAS_SVG') return ['excalidraw-canvas', { action: 'screenshot', path: 'artifact-studio/artifacts/output/canvas.' + kind.slice('CANVAS_'.length).toLowerCase() }];
  if (kind === 'CANVAS_STOP') return ['excalidraw-canvas', { action: 'stop' }];
  if (kind === 'BROWSER_CLOSE') return ['playwright_browser_close', {}];
  throw new Error('Unknown native document fixture case');
}

async function main() {
  const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')); verify(base);
  const root = fs.mkdtempSync('/tmp/opencode/documenter-wire-');
  const observed = [];
  let providerError;
  const mock = http.createServer(async (request, response) => {
    try {
      let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 16 * 1024 * 1024); }
      const body = JSON.parse(raw); observed.push(body);
      const childQa = JSON.stringify(body.messages.filter(message => message.role === 'system')).includes('currently operating as the \\"visual-qa\\" agent');
      const requestedCase = [...JSON.stringify(body.messages.filter(message => message.role === 'user').at(-1)).matchAll(/DCASE_([A-Z_]+)/g)].at(-1)?.[1];
      const kind = childQa && requestedCase !== 'QA_RENDER_DENY' ? 'CHILD_QA' : requestedCase ?? 'CATALOG';
      const state = trace.get(kind) ?? { requests: 0 }; trace.set(kind, state); assert(++state.requests <= 10, 'Fixture request limit: ' + kind);
      state.tools = body.tools?.map(item => (item.function ?? item).name) ?? [];
      state.images = imageCount(body.messages);
      // Native Read may append image content as a user message after the tool
      // result. Scope by this fixture's call IDs, not by the last user message;
      // also prevents old parent-turn results from faking a followup call.
      state.results = body.messages.filter(message => message.role === 'tool' && message.tool_call_id?.startsWith('call_' + kind + '_')).map(message => text(message.content));
      const selected = call(kind, state.results);
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => response.write('data: ' + JSON.stringify({ id: 'documenter-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
      if (selected) {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_' + kind + '_' + state.results.length, type: 'function', function: { name: selected[0], arguments: '' } }] });
        send({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(selected[1]) } }] });
      } else send({ role: 'assistant', content: kind === 'CHILD_QA' ? 'MOCK_QA_ROUTING_ONLY; NOT SEMANTIC VISUAL APPROVAL' : 'MOCK_OK' });
      send({}, selected ? 'tool_calls' : 'stop'); response.end('data: [DONE]\n\n'); state.finished = !selected;
    } catch (error) { providerError = error.message; response.writeHead(500); response.end('Fixture failure'); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  let server;
  try {
    const browserProbe = spawnSync('python3', [new URL('../../v2/playwright/selected-runtime.py', import.meta.url).pathname], { input: JSON.stringify({ home: os.homedir(), config: path.join(os.homedir(), '.config/opencode') }), encoding: 'utf8', env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(browserProbe.status, 0, 'Existing isolated browser unavailable; no install attempted');
    const prior = fixtureStack(root, `http://127.0.0.1:${mock.address().port}/v1`, JSON.parse(browserProbe.stdout));
    applyBuiltinVisibility(prepareWorkshop(root, prior));
    const binding = selectDocumenter(os.homedir(), path.join(os.homedir(), '.config/opencode'));
    const extension = documenterExtension({ binding });
    const p = prepareWorkshop(root, { ...prior, extend: context => extension({ ...context, ...prior.extend(context) }) });
    const document = structuredClone(p.document); document.providers['workshop-mock'].models.mock.capabilities.input.push('image');
    fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify(document, null, 2) + '\n');
    profile = { ...p, document };
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'Native Documenter config rejected; output suppressed');
    server = await startServer(base.binary, p);
    const get = route => getApiList(server.request, route);
    await until(async () => (await get('/api/plugin')).some(item => item.id === 'opencode-documents.native'), 'Native document plugin');
    await inspectDocumenter(get, p.roles, p.project);
    await inspectBuiltinVisibility(get, root);
    await inspectKnowledge(server, p, ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })), { additionalMcp: ['atlassian-rovo', 'codegraph', 'playwright'], additionalPlugins: ['opencode-ticketing.titles', 'opencode-codegraph.access', 'opencode-stack.playwright-access', 'opencode-documents.native'], rolePermissionOverrides: documentMemoryOverrides });
    await inspectTicketing(get, p.roles); await inspectCodeGraph(get, p.roles); await inspectPlaywright(get, p.roles);
    if (process.argv.includes('--catalog-only')) {
      console.log(JSON.stringify({ legacyWorkshopCatalogAndRoleContracts: true, documentDelegationMode: 'documenter-only default', rendersIssued: 0, canvasStarted: false, realModelRequests: 0 }));
      return;
    }
    const beforeApp = fs.readFileSync(p.editable);
    async function execute(kind, agent = 'documenter', permissions, existingSession) {
      const created = existingSession ? { status: 200, value: { data: { id: existingSession } } } : await server.request('POST', '/api/session', { agent, model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project }, ...(permissions ? { permissions } : {}) });
      assert.equal(created.status, 200);
      assert.equal((await server.request('POST', `/api/session/${created.value.data.id}/prompt`, { text: 'DCASE_' + kind + '\nSynthetic local document integration test; do not use accounts or business content.' })).status, 200);
      await until(() => { if (providerError) throw new Error(providerError); return trace.get(kind)?.finished; }, kind, 200000);
      assert(fs.readFileSync(p.editable).equals(beforeApp), 'Document tools altered application content');
      const denied = ['APP_WRITE', 'QA_RENDER_DENY', 'PLANNER_RENDER_DENY', 'MASTER_DELEGATE_DENY', 'NESTED_DENY', 'WRONG_TARGET', 'ESCAPE', 'OUTPUT_ESCAPE', 'RENDER_SESSION_DENY', 'WRONG_SESSION', 'CANVAS_FOREIGN', 'CANVAS_CLEAR_DENY'].includes(kind);
      const results = trace.get(kind).results;
      const errors = results.filter(value => { try { return ['unknown', 'permission.rejected', 'validation', 'tool.execution'].includes(JSON.parse(value).type); } catch { return false; } });
      if (denied) assert(errors.length > 0, kind + ': expected a native error, got ' + results.join('\n'));
      else assert.equal(errors.length, 0, kind + ': ' + errors.join('\n'));
      console.log('OK native Documenter ' + kind);
      return { ...trace.get(kind), sessionID: created.value.data.id };
    }
    await execute('CATALOG');
    await execute('WRITE');
    assert(fs.readFileSync(path.join(p.project, 'artifact-studio/source-note.md'), 'utf8').includes('Synthetic source'));
    await execute('APP_WRITE');
    const reference = (await execute('READ_REFERENCE')).results.join('\n');
    assert(reference.includes('Required stages'), reference || 'Native Read returned no reference content');
    const validation = await execute('VALIDATE');
    assert.equal(JSON.parse(validation.results[0]).valid, true, validation.results[0]);
    await execute('FONTS');
    await execute('RENDER');
    for (const ext of ['pdf', 'pptx', 'docx']) {
      assert(fs.statSync(artifact(ext)).size > 0, 'Missing real ' + ext + ' output');
      const result = await execute('PREVIEW_' + ext.toUpperCase());
      const preview = JSON.parse(result.results[0]);
      assert(preview.pages.length > 0 && preview.pages.every(file => fs.statSync(file).size > 0));
      if (ext === 'pdf') firstPreview = preview.pages[0];
      const check = await execute('CHECK_' + ext.toUpperCase());
      assert(JSON.parse(check.results[0]).valid, ext + ' structural checks failed');
    }
    await execute('FLOW'); await execute('SEQUENCE');
    const receipt = await execute('RECEIPT'); assert(JSON.parse(receipt.results[0]).ok);
    const svg = await execute('SVG_CHECK'); assert(JSON.parse(svg.results[0]).valid, svg.results[0]);
    for (const [kind, actor] of [['QA_RENDER_DENY', 'visual-qa'], ['PLANNER_RENDER_DENY', 'planner'], ['MASTER_DELEGATE_DENY', 'master-dev'], ['NESTED_DENY', 'artifact-planner'], ['WRONG_TARGET', 'documenter'], ['ESCAPE', 'documenter'], ['OUTPUT_ESCAPE', 'documenter']]) {
      const result = await execute(kind, actor); assert(result.results.length, 'Denied operation must report a result/error');
      if (kind.includes('DELEGATE') || kind === 'NESTED_DENY') assert(!result.tools.includes('subagent'));
    }
    await execute('RENDER_SESSION_DENY', 'documenter', [{ action: 'artifact-*', resource: '*', effect: 'deny' }]);
    const qa = await execute('ROUTE_QA');
    assert(qa.results.join('\n').includes('MOCK_QA_ROUTING_ONLY'), 'Real native subagent route: ' + qa.results.join('\n'));
    assert(trace.get('CHILD_QA').images >= 1, 'QA child must receive the actual public preview as multimodal input');
    assert(!trace.get('CHILD_QA').tools.includes('subagent'), 'QA child must not inherit nested dispatch');
    qaSessionID = qa.results.join('\n').match(/\bses_[A-Za-z0-9]+\b/)?.[0]; assert(qaSessionID, 'Native subagent result must identify its child session');
    const followup = await execute('FOLLOWUP_QA', 'documenter', undefined, qa.sessionID);
    assert(followup.results.join('\n').includes('MOCK_QA_ROUTING_ONLY'), 'QA followup must succeed in its original parent session');
    const unrelated = await server.request('POST', '/api/session', { agent: 'master-dev', model: { providerID: 'workshop-mock', id: 'mock' }, location: { directory: p.project } });
    unrelatedSessionID = unrelated.value.data.id;
    const wrongSession = await execute('WRONG_SESSION'); assert(wrongSession.results.join('\n').includes('unrelated'));
    let canvasAvailable = true;
    try { await portAvailable(3000); } catch { canvasAvailable = false; }
    if (canvasAvailable) {
      const foreign = http.createServer((_request, response) => response.end('Foreign fixture, must not be controlled'));
      await new Promise(resolve => foreign.listen(3000, '127.0.0.1', resolve));
      try { const rejected = await execute('CANVAS_FOREIGN'); assert(rejected.results.join('\n').includes('occupied')); assert(foreign.listening); }
      finally { await new Promise(resolve => foreign.close(resolve)); }
      await execute('CANVAS_START');
      await execute('CANVAS_STATUS');
      await execute('BROWSER_OPEN', 'dev-test');
      await execute('CANVAS_ADD'); await execute('CANVAS_UPDATE');
      await execute('CANVAS_QUERY'); await execute('CANVAS_DESCRIBE');
      await execute('CANVAS_SAVE'); await execute('CANVAS_LIST');
      await execute('CANVAS_CLEAR_DENY'); await execute('CANVAS_CLEAR'); await execute('CANVAS_RESTORE');
      await execute('CANVAS_EXPORT');
      const scene = JSON.parse(fs.readFileSync(path.join(p.project, 'artifact-studio/artifacts/output/canvas.excalidraw'), 'utf8'));
      assert(scene.elements.length >= 3, 'Editable canvas source missing real elements');
      await execute('CANVAS_IMPORT'); await execute('CANVAS_PNG'); await execute('CANVAS_SVG');
      assert(fs.statSync(path.join(p.project, 'artifact-studio/artifacts/output/canvas.png')).size > 0);
      assert(fs.readFileSync(path.join(p.project, 'artifact-studio/artifacts/output/canvas.svg'), 'utf8').includes('<svg'));
      await execute('BROWSER_CLOSE', 'dev-test'); await execute('CANVAS_STOP');
      await portAvailable(3000);
    } else console.log('BLOCKED real canvas tests: port 3000 occupied; no existing service was attached or stopped');
    console.log(JSON.stringify({ cases: trace.size, agents: p.roles.length, skills: p.skills.length, localFormats: ['pdf', 'pptx', 'docx'], nativeQaRouting: true, independentSemanticQaApproved: false,
      canvasTested: canvasAvailable, foreignServicesStopped: 0, applicationMutations: 0, businessDocumentsRead: 0, remotePublication: false }));
  } finally {
    await server?.close(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
    if (process.argv.includes('--keep-artifacts') && profile) {
      const evidence = fs.mkdtempSync('/tmp/opencode/documenter-evidence-');
      fs.cpSync(path.join(profile.project, 'artifact-studio'), path.join(evidence, 'artifact-studio'), { recursive: true });
      console.log(JSON.stringify({ publicSyntheticEvidence: evidence, independentSemanticQaApproved: false }));
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
