import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { planGeneral, prepareGeneral, generalPaths, generalEnvironment } from '../profile.mjs';
import { effect, shellEnvironment, externalClientSkill } from '../policy.mjs';

function fixture(t) {
  const base = fs.mkdtempSync('/tmp/opencode/general-profile-');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const project = path.join(base, 'project'), root = path.join(base, 'profile'); fs.mkdirSync(project);
  return { project, root, options: { project, mock: 'http://127.0.0.1:1/v1' } };
}

test('pure candidate plan has native roles, nine commands, four helper registries and no workshop dependency', t => {
  const { root, options } = fixture(t), p = planGeneral(root, options);
  assert(!fs.existsSync(root)); assert.equal(p.roles.length, 11); assert.equal(p.commands.length, 9);
  assert.equal([...p.assets.keys()].filter(file => file.includes('/planner-helpers/')).length, 4);
  assert(!JSON.stringify(p.document).includes('workshop-guard'));
  assert.deepEqual(p.document.mcp, { servers: {} }); assert.deepEqual(p.document.compaction, { auto: true });
  const localFileLinks = path.join(p.bundle, 'v2/general/plugins/local-file-links');
  const delegationPanel = path.join(p.bundle, 'v2/general/plugins/delegation-panel');
  assert.deepEqual(JSON.parse(p.assets.get(path.join(p.config, 'opencode/cli.json'))).plugins, [{ package: localFileLinks }, { package: delegationPanel }]);
  assert(p.assets.has(path.join(delegationPanel, 'tui.tsx')));
  assert(!p.document.plugins.some(plugin => (plugin.package ?? plugin) === delegationPanel));
  assert(p.assets.has(path.join(localFileLinks, 'tui.tsx')));
  assert(!p.document.plugins.some(plugin => (plugin.package ?? plugin) === localFileLinks));
  assert.match(p.assets.get(path.join(p.config, 'opencode/AGENTS.md')).toString(), /`opencode-local-file`/);
  assert.equal(p.document.snapshots, true); assert.equal(p.document.update, 'notify');
  const master = p.assets.get(path.join(p.config, 'opencode/agents/master-dev.md')).toString();
  assert(master.includes('action: "subagent"') && master.includes('resource: "reviewer"'));
  assert(!master.includes('delegate_isolated') && !master.includes('\ntools:') && !master.includes('\npermission:'));
  const source = planGeneral(root, { project: options.project });
  assert(source.assets.get(path.join(p.config, 'opencode/agents/master-dev.md')).toString().includes('openai/gpt-6.1-sol#high'));
  assert(source.assets.get(path.join(p.config, 'opencode/agents/reviewer.md')).toString().includes('openai/gpt-6.1-sol#medium'));
  assert(source.document.agents.plan.hidden && source.document.agents.build.hidden);
  const overlaySkill = p.assets.get(path.join(p.config, 'opencode/skills/overlays-locales-opencode/SKILL.md')).toString();
  assert(overlaySkill.includes('stack-layer-audit') && !overlaySkill.includes('tools` reinyectadas'));
  const delegationSkill = 'skills/delegacion-nativa-opencode/SKILL.md';
  assert.deepEqual(p.assets.get(path.join(p.config, 'opencode', delegationSkill)),
    fs.readFileSync(new URL('../../../' + delegationSkill, import.meta.url)));
  assert.match(p.assets.get(path.join(p.config, 'opencode/AGENTS.md')).toString(), /delegacion-nativa-opencode/);
  for (const name of ['init-project-agent-layer', 'stack-doctor', 'check-local-overlays']) {
    const command = p.assets.get(path.join(p.config, 'opencode/commands', name + '.md')).toString();
    assert(command.includes('stack-layer-audit')); assert(!command.includes('codegraph_project_init.sh') && !command.includes('JIRA_API_TOKEN'));
  }
});

test('preparation is idempotent, application files editable, and unknown managed drift is rejected', t => {
  const { root, project, options } = fixture(t), p = prepareGeneral(root, options);
  const file = path.join(project, 'app.txt'); fs.writeFileSync(file, 'User application edit\n');
  assert.deepEqual(prepareGeneral(root, options).document, p.document);
  assert.equal(fs.readFileSync(file, 'utf8'), 'User application edit\n');
  const script = path.join(p.config, 'opencode/scripts/planner_doc.py'); fs.appendFileSync(script, '\n# Unknown change\n');
  assert.throws(() => prepareGeneral(root, options), /drift/);
  assert(fs.readFileSync(script, 'utf8').endsWith('# Unknown change\n'));
});

test('one general profile is project-independent and cannot target active config/workshop', t => {
  const { root, project, options } = fixture(t);
  assert.throws(() => generalPaths(project, project), /candidate\/configuration/);
  assert.throws(() => generalPaths(root, path.join(root, 'project')), /candidate\/configuration/);
  for (const candidate of [os.homedir(), path.join(os.homedir(), '.config/opencode'), path.join(os.homedir(), '.opencode'), path.join(os.homedir(), '.local/share/opencode-v2-clean/workshop')]) assert.throws(() => generalPaths(candidate, project), /Active/);
  const first = prepareGeneral(root, options);
  const other = path.join(path.dirname(project), 'other'); fs.mkdirSync(other);
  assert.deepEqual(prepareGeneral(root, { ...options, project: other }).document, first.document);
  assert(!Object.hasOwn(JSON.parse(fs.readFileSync(path.join(root, '.general-candidate.json'))), 'project'));
});

test('candidate environment enables native project discovery but strips credentials, loaders and external skills', t => {
  const { root, project } = fixture(t), env = generalEnvironment(generalPaths(root, project));
  assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, undefined);
  assert.equal(env.OPENCODE_DISABLE_EXTERNAL_SKILLS, '1');
  assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS, '1'); assert.equal(env.OPENCODE_DISABLE_AUTOUPDATE, '1');
  for (const source of ['/home/fixture/.agents/skills/extra/SKILL.md', '/repo/.claude/skills/extra/SKILL.md']) assert(externalClientSkill(source));
  for (const source of ['/repo/.opencode/skills/extra/SKILL.md', '/owned/config/skills/extra/SKILL.md']) assert(!externalClientSkill(source));
  for (const key of ['OPENAI_API_KEY', 'NODE_OPTIONS', 'LD_PRELOAD', 'OPENCODE_CONFIG_CONTENT', 'SSH_AUTH_SOCK']) assert.equal(env[key], undefined);
  assert.deepEqual(shellEnvironment({ HOME: '/fixture', OPENCODE_PASSWORD: 'SYNTHETIC', PYTHONPATH: '/untrusted', NODE_OPTIONS: 'bad', PATH: '/usr/bin' }), { PATH: '/usr/bin', HOME: '/fixture' });
  assert.equal(effect([{ action: '*', resource: '*', effect: 'deny' }, { action: 'subagent', resource: 'reviewer', effect: 'allow' }], 'subagent', 'reviewer'), 'allow');
  const selected = { ...generalPaths(root, project), runtimeHome: '/approved-runtime-home' };
  const transport = generalEnvironment(selected, { SSH_AUTH_SOCK: '/run/user/1000/agent.sock', PGPASSFILE: '/approved/private/pgpass', PGSSLMODE: 'verify-full', OPENAI_API_KEY: 'MUST_NOT_COPY', NODE_OPTIONS: 'MUST_NOT_COPY' });
  assert.equal(transport.SSH_AUTH_SOCK, '/run/user/1000/agent.sock'); assert.equal(transport.PGSSLMODE, 'verify-full');
  assert.equal(transport.OPENAI_API_KEY, undefined); assert.equal(transport.NODE_OPTIONS, undefined);
  assert.equal(generalEnvironment(selected, { PGPASSWORD: 'SYNTHETIC_SECRET' }).PGPASSWORD,undefined,'Offline/general environment never materializes libpq password; only owned runtime server binding does');
});

test('general prepare requires explicit candidate-close acknowledgment', () => {
  const result = spawnSync(process.execPath, [new URL('../../../v2/tools/general.mjs', import.meta.url).pathname, 'prepare', '--project', '/tmp/opencode'], { env: { HOME: '/tmp/opencode/no-such-home', PATH: '/usr/bin:/bin' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert(result.stderr.includes('--client-closed'));
});

test('maintenance config accepts only reviewed provider model overrides, not prompts or V1 aliases', t => {
  const { root, options } = fixture(t);
  const p = planGeneral(root, { ...options, maintenanceModels: { title: { model: 'workshop-mock/mock#low' } } });
  assert.deepEqual(p.document.agents.title, { model: 'workshop-mock/mock#low' }); assert.equal(p.document.small_model, undefined);
  for (const maintenanceModels of [{ reviewer: { model: 'workshop-mock/mock' } }, { title: { model: 'foreign/new' } }, { title: { model: 'workshop-mock/mock', system: 'MUST_NOT_COPY' } }]) assert.throws(() => planGeneral(root, { ...options, maintenanceModels }));
});
