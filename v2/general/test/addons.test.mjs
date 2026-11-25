import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { planGeneral, prepareGeneral } from '../profile.mjs';
import { effect } from '../policy.mjs';
import { generalAddons } from '../addons.mjs';
import { selectDocumenter } from '../../../../super-turing-opencode-documents/v2/documenter/preflight.mjs';
import { ENGRAM_TOOLS } from '../../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { PLAYWRIGHT_TOOLS } from '../../playwright/config.mjs';

export function fixtureContributions(root, project) {
  const server = { type: 'local', command: ['/fixture/mcp'], codemode: false, disabled: true };
  return generalAddons({ context7: server,
    knowledge: { runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-config', server,
      permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) },
    ticketing: { server }, codegraph: { binding: { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' }, server },
    playwright: { runtime: { version: '0.0.85', home: root + '/runtime-home', cli: '/fixture/cli.js', browser: '/fixture/browser' }, server },
    documents: { binding: selectDocumenter(os.homedir(), path.join(os.homedir(), '.config/opencode')) },
  });
}

test('native addon contribution plan composes without workshop/V1-header edits or project seeds', t => {
  const root = fs.mkdtempSync('/tmp/opencode/general-addons-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'); fs.mkdirSync(project);
  const target = path.join(root, 'profile');
  const p = planGeneral(target, { project, mock: 'http://127.0.0.1:1/v1', contributions: fixtureContributions(root, project) });
  assert.equal(p.roles.length, 22); assert.equal(p.commands.length, 34);
  assert.equal([...p.assets.keys()].filter(file => file.endsWith('/SKILL.md')).length, 34);
  assert.equal([...p.assets.keys()].filter(file => file.includes('/planner-helpers/')).length, 7);
  assert.equal(Object.keys(p.document.mcp.servers).length, 5);
  assert(!JSON.stringify(p.document).includes('workshop-guard'));
  assert([...p.assets.keys()].every(file => file.startsWith(target + path.sep)));
  assert(!fs.existsSync(target)); assert.deepEqual(fs.readdirSync(project), []);
  const access = p.document.plugins.find(plugin => typeof plugin === 'object' && plugin.package.endsWith('/general/plugins/access')).options;
  assert(access.delegationTargets['master-dev'].includes('knowledge-reader'));
  assert(access.delegationTargets.documenter.includes('visual-qa'));
  assert(!access.readOnlyRoles.includes('documenter')); assert(access.readOnlyRoles.includes('visual-qa'));
  const documenter = p.assets.get(path.join(p.config, 'opencode/agents/documenter.md')).toString();
  assert(documenter.includes('action: "edit"\n    resource: "*"\n    effect: allow'), 'V1 Documenter edit:allow must be retained');
  assert(!documenter.includes('action: "edit"\n    resource: "*"\n    effect: deny'), 'No new global edit restriction for Documenter');
  assert(!access.toolActors.engram_mem_save.includes('knowledge-reader'));
  for (const id of ['artifact-planner', 'artifact-renderer', 'content-editor', 'data-viz', 'diagram-designer', 'visual-qa']) assert(!access.toolActors.engram_mem_save.includes(id));
  assert.equal(access.toolActors.atlassian_rovo_getJiraIssue, undefined);
  assert.deepEqual(access.toolActors['atlassian-rovo_getJiraIssue'], ['code-reviewer', 'planner']);
  assert.equal(access.toolActors.playwright_browser_navigate.length, 5);
  assert.equal(access.toolActors['codegraph_codegraph_explore'].length, 5);
  assert.deepEqual(access.toolActors['excalidraw-canvas'], ['documenter']);
  assert.equal(access.toolActors['document-editable'], undefined, 'Unrequested derived-format prototype is not the harness');
  assert.equal(access.toolActors['document-qmd'], undefined, 'Static-only prototype must not replace full V1 QMD workflow');
  assert.deepEqual(access.toolActors['atlassian-rovo_executeRead'], ['documenter']);
  const documentTools = p.document.plugins.find(item => typeof item === 'object' && item.package.endsWith('/documenter/plugins/native')).options.definitions;
  assert.equal(documentTools.find(tool => tool.name === 'artifact-render').input.properties.output.default, 'artifacts/output');
  assert.equal(documentTools.find(tool => tool.name === 'artifact-preview').input.properties.output.default, 'artifacts/previews');
  assert.equal(p.componentMetadata.documents.tools, 8);
  assert.equal(p.componentMetadata.documents.compatibilityPrototype, false);
  for (const name of ['publish_document.py', 'render_diagram.py', 'render_infographic.py']) assert(p.assets.has(path.join(p.config, 'opencode/scripts', name)));
  for (const name of ['publicar-documento', 'crear-diagrama']) {
    const command = p.assets.get(path.join(p.config, 'opencode/commands', name + '.md')).toString();
    assert(!/^agent:/m.test(command), 'V1 legacy command keeps the selected agent, not a new forced primary');
    assert(command.includes('HOME='));
  }
  assert.equal(effect(p.document.policies, 'tool.use', 'atlassian-rovo_updateConfluenceContent:*'), 'allow');
  assert.deepEqual(access.toolActors['atlassian-rovo_updateConfluenceContent'], ['documenter']);
  assert.deepEqual(access.toolActors['atlassian-rovo_createConfluenceContent'], ['documenter']);
  assert(PLAYWRIGHT_TOOLS.every(name => access.toolActors[name].length === 5));
  const cli = JSON.parse(p.assets.get(path.join(p.config, 'opencode/cli.json')));
  assert.equal(cli.plugins[1].options.directoryScope, 'launch'); assert.equal(cli.attention.notifications, false);
  assert.equal(p.document.mcp.servers.stitch,undefined);assert(!p.components.includes('stitch'));
  assert.equal(effect(p.document.policies,'mcp.use','stitch'),'deny');assert.equal(effect(p.document.policies,'tool.use','stitch_generate_screen_from_text:*'),'deny');
  assert(![...p.assets.keys()].some(file=>file.includes('/v2/stitch/')||file.includes('/skills/stitch-playwright-')));
  const browserSkill = p.assets.get(path.join(p.config, 'opencode/skills/playwright-ui-opencode/SKILL.md'));
  assert.deepEqual(browserSkill, fs.readFileSync(new URL('../../../skills/playwright-ui-opencode/SKILL.md', import.meta.url)));
  for (const role of ['ui-web-designer', 'frontend-web-developer']) {
    const text = p.assets.get(path.join(p.config, 'opencode/agents', role + '.md')).toString();
    const prompt = text.split('\n---\n')[1];
    assert.match(prompt, /playwright-ui-opencode/);
    assert.doesNotMatch(prompt, /stitch/i);
  }
  assert.doesNotMatch(p.assets.get(path.join(p.config, 'opencode/AGENTS.md')).toString(), /stitch/i);
  assert.equal(cli.plugins[1].options.legacy.configPath, path.join(p.config,'opencode/notify.json'));
  const notifierBackend=p.assets.get(path.join(p.root,'bundle/notifier/v2/desktop/legacy-backend.mjs')).toString();
  assert(notifierBackend.includes('focusGnomeTerminalTabBySessionTitle')); assert(!notifierBackend.includes('@opencode-ai/plugin'));
  assert.equal(p.componentMetadata.notifier.configCopied,false);
  const actual = prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1', contributions: fixtureContributions(root, project) });
  assert.deepEqual(actual.document, p.document);
  fs.mkdirSync(path.join(project, 'artifact-studio')); fs.writeFileSync(path.join(project, 'artifact-studio/user-spec.json'), '{"unfinished":');
  assert.deepEqual(prepareGeneral(target, { project, mock: 'http://127.0.0.1:1/v1', contributions: fixtureContributions(root, project) }).document, actual.document);
  assert.equal(fs.readFileSync(path.join(project, 'artifact-studio/user-spec.json'), 'utf8'), '{"unfinished":');
});

test('contributions cannot replace prior roles/rules or collide with another owner asset', t => {
  const root = fs.mkdtempSync('/tmp/opencode/general-contract-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'); fs.mkdirSync(project);
  const options = { project, mock: 'http://127.0.0.1:1/v1' };
  assert.throws(() => planGeneral(path.join(root, 'profile'), { ...options, contributions: [{ id: 'bad-role', apply(ctx) { ctx.agents.planner.permissions = []; } }] }), /preserve/);
  assert.throws(() => planGeneral(path.join(root, 'profile'), { ...options, contributions: [{ id: 'bad-body', apply(ctx) { ctx.agents.planner.system = 'Replace global'; } }] }), /replace/);
  assert.throws(() => planGeneral(path.join(root, 'profile'), { ...options, contributions: [{ id: 'bad-file', apply(ctx) { ctx.addConfig('scripts/planner_shell.py', 'replacement'); } }] }));
  for (const key of ['permissions', 'policies', 'plugins']) assert.throws(() => planGeneral(path.join(root, 'profile'), { ...options, contributions: [{ id: 'bad-guard', apply(ctx) { ctx.document[key] = []; } }] }), /global guards/);
  for (const [key, value] of [['snapshots', false], ['compaction', { auto: false }], ['update', 'auto'], ['warming', true]]) assert.throws(() => planGeneral(path.join(root, 'profile'), { ...options, contributions: [{ id: 'bad-default', apply(ctx) { ctx.document[key] = value; } }] }), /defaults implicitly/);
  const p = planGeneral(path.join(root, 'profile'), { ...options, contributions: [{ id: 'closed-catalog', apply(ctx) {
    ctx.document.policies.push({ action: 'tool.use', resource: 'fixture_read:/private/**', effect: 'deny' });
    ctx.closeTools('fixture_*', ['fixture_read']);
  } }] });
  assert.equal(effect(p.document.policies, 'tool.use', 'fixture_read:/private/file.txt'), 'deny');
  assert.equal(effect(p.document.policies, 'tool.use', 'fixture_unknown:*'), 'deny');
});
