import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { permissionNeedsApproval, controlledBashPermission } from '../../../lib/permission-policy.ts';
import { controlledRules, evaluate, requiresApproval } from '../../../v2/plugins/controlled-permissions/policy.mjs';
import { checkPlanner } from '../../../v2/plugins/planner-shell/guard.mjs';
import { attribution, register as identity } from '../../../v2/plugins/agent-identity/identity.mjs';
import { prepareWorkshop, roles, readonly, workshopKeybinds } from '../workshop-profile.mjs';
import { cleanShellEnvironment, check, exposeDirectTools } from '../workshop-guard/guard.mjs';

test('policy extraction preserves V1 exported behavior against its committed implementation', async () => {
  const original = execFileSync('git', ['show', 'HEAD:plugins/permission-autopilot.ts'], { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' });
  const old = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(original, { mode: 'transform' })).toString('base64'));
  for (const action of ['bash', 'read', 'edit', 'unknown', 'external_directory']) {
    for (const resources of [[], ['git status --short'], ['rm -rf fixture'], ['.ssh/key'], ['.env.example'], ['sh -c ls']]) assert.equal(permissionNeedsApproval(action, resources), old.permissionNeedsApproval(action, resources));
  }
  for (const input of [undefined, 'allow', 'deny', 'ask', { '*': 'deny', 'git status*': 'allow' }, { '*': 'ask', 'git diff*': 'allow', 'git push*': 'deny' }]) assert.deepEqual(controlledBashPermission(input), old.controlledBashPermission(input));
  const current = await import('../../../plugins/permission-autopilot.ts');
  const before = await old.default(); const after = await current.default();
  const left = { permission: { bash: 'ask' }, agent: { planner: { permission: { bash: { '*': 'deny', 'git status*': 'allow' } } } } };
  const right = structuredClone(left);
  await before.config(left); await after.config(right); assert.deepEqual(right, left);
  for (const input of [{ type: 'bash', pattern: 'git status --short' }, { permission: 'bash', patterns: ['rm scratch'] }, { permission: 'read', patterns: ['.ssh/key'] }]) {
    const a = { status: 'ask' }, b = { status: 'ask' };
    await before['permission.ask'](input, a); await after['permission.ask'](input, b); assert.deepEqual(b, a);
  }
});

test('V2 approvals preserve final denies, sensitive asks and wrapper asks', () => {
  for (const command of ['rm fixture', 'git branch -D fixture', 'bash -c ls', 'sh -c ls', 'zsh -c ls', 'eval ls']) assert(requiresApproval('shell', [command]), command);
  for (const action of ['read', 'shell']) {
    const event = { action, resources: ['.ssh/key'], effect: 'allow' };
    evaluate(event); assert.equal(event.effect, 'ask');
  }
  const safe = { action: 'shell', resources: ['git status --short'], effect: 'ask' };
  evaluate(safe); assert.equal(safe.effect, 'allow');
  const denied = { ...safe, effect: 'deny' };
  evaluate(denied); assert.equal(denied.effect, 'deny');
  const unknown = { action: 'execute', resources: ['*'], effect: 'ask' };
  evaluate(unknown); assert.equal(unknown.effect, 'ask');
});

test('ordered rules do not expand deny-baseline agents and keep specific denies last', () => {
  const closed = [{ action: 'shell', resource: '*', effect: 'deny' }, { action: 'shell', resource: 'git status*', effect: 'allow' }];
  assert.deepEqual(controlledRules(closed), closed);
  const rules = controlledRules([{ action: 'edit', resource: '*', effect: 'deny' }, { action: 'shell', resource: '*', effect: 'ask' }, { action: 'shell', resource: 'git push*', effect: 'deny' }]);
  assert.deepEqual(rules.at(-1), { action: 'shell', resource: 'git push*', effect: 'deny' });
  assert.equal(rules[0].effect, 'deny');
});

test('synthetic shell strips credentials, interpreter preloads and Git config injection', () => {
  const env = cleanShellEnvironment({ PATH: '/usr/bin', HOME: '/tmp/opencode', NODE_OPTIONS: '--require unsafe', BASH_ENV: '/unsafe', PYTHONPATH: '/unsafe', LD_PRELOAD: '/unsafe', OPENAI_API_KEY: 'synthetic', GIT_CONFIG_PARAMETERS: 'unsafe' });
  assert.equal(env.PATH, '/usr/bin');
  for (const key of ['NODE_OPTIONS', 'BASH_ENV', 'PYTHONPATH', 'LD_PRELOAD', 'OPENAI_API_KEY', 'GIT_CONFIG_PARAMETERS']) assert.equal(env[key], undefined);
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
});

test('native question remains allowed but is never redecorated by the direct-tool adapter', () => {
  const question = { options: { codemode: false }, execute() { throw new Error('Native handler must not be replaced or invoked'); } };
  const before = question.execute;
  const updated = [];
  exposeDirectTools({ update(name, edit) { updated.push(name); if (name === 'question') edit(question); else edit({ options: { codemode: true } }); } });
  assert(!updated.includes('question'));
  assert(updated.includes('read') && updated.includes('shell'));
  assert.equal(question.execute, before);
  assert.doesNotThrow(() => check({ tool: 'question', input: {} }, { project: '/tmp/opencode' }, '/tmp/opencode'));
});

test('addon boundary opt-in accepts only explicit tool names, without interpreting wildcards', () => {
  const options = { project: '/tmp/opencode', additionalTools: ['engram_mem_search'] };
  assert.doesNotThrow(() => check({ tool: 'engram_mem_search', input: {} }, options, options.project));
  for (const tool of ['engram_mem_save', 'engram_mem_delete', 'execute']) assert.throws(() => check({ tool, input: {} }, options, options.project), /unavailable/);
  assert.throws(() => check({ tool: 'engram_mem_save', input: {} }, { ...options, additionalTools: ['engram_*'] }, options.project), /unavailable/);
  assert.throws(() => check({ tool: 'read', input: { filePath: '/outside/file' } }, { ...options, additionalTools: ['read'] }, options.project), /outside/);
  assert.throws(() => check({ tool: 'execute', input: {} }, { ...options, additionalTools: ['execute'] }, options.project), /unavailable/);
  assert.throws(() => check({ tool: 'artifact-render', input: {} }, { ...options, additionalTools: ['artifact-render'] }, options.project), /unavailable/);
  assert.doesNotThrow(() => check({ tool: 'artifact-render', input: {} }, { ...options, documenter: { actor: 'documenter' }, additionalTools: ['artifact-render'] }, options.project));
});

test('planner check uses executing actor, fails closed and invokes only canonical --check', () => {
  let calls = 0;
  const runner = (command, args, options) => {
    calls++; assert.equal(command, 'python3'); assert.equal(args[1], '--check');
    assert.equal(JSON.parse(options.input).command, 'synthetic');
    return { status: 0 };
  };
  checkPlanner({ tool: 'shell', agent: 'master-dev', input: { command: 'synthetic' } }, '/tmp/opencode', runner);
  assert.equal(calls, 0);
  checkPlanner({ tool: 'shell', agent: 'planner', input: { command: 'synthetic' } }, '/tmp/opencode', runner);
  assert.equal(calls, 1);
  assert.throws(() => checkPlanner({ tool: 'shell', input: {} }, '/tmp/opencode', runner), /fails closed/);
  assert.throws(() => checkPlanner({ tool: 'shell', agent: 'planner', input: {} }, '/tmp/opencode', () => ({ status: 2 })), /blocked/);
});

test('identity is context-scoped, omits message bodies and checks permission before reading', async () => {
  const output = attribution([{ type: 'user', text: 'PRIVATE_SENTINEL' }, { type: 'assistant', agent: 'planner', model: { providerID: 'mock', id: 'model' }, content: ['PRIVATE_SENTINEL'] }]);
  assert.equal(output.completeHistory, false);
  assert(!JSON.stringify(output).includes('PRIVATE_SENTINEL'));
  let definition; let read = false; let hook;
  await identity({ session: { async hook(_kind, fn) { hook = fn; }, async context() { read = true; return []; } }, tool: { async transform(fn) { fn({ add(tool) { definition = tool; } }); } }, permission: { async assert() { throw new Error('denied'); } } });
  const context = { agent: 'planner', system: [] }; hook(context);
  assert(context.system[0].text.includes('planner'));
  await assert.rejects(definition.execute({}, { sessionID: 'synthetic', agent: 'reviewer' }), /denied/);
  assert.equal(read, false);
});

test('all eleven agents and complete base skills stage without Background APIs or global writes', t => {
  const root = fs.mkdtempSync('/tmp/opencode/workshop-unit-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1' });
  assert.equal(roles.length, 11);
  assert.equal(readonly.length, 5);
  for (const role of roles) assert(!/`delegate(?:_isolated)?`|delegation_/.test(fs.readFileSync(`${p.config}/opencode/agents/${role}.md`, 'utf8')));
  assert.equal(p.skills.length, 15);
  const cli = JSON.parse(fs.readFileSync(`${p.config}/opencode/cli.json`, 'utf8'));
  assert.deepEqual(cli.keybinds, workshopKeybinds);
  assert.deepEqual(workshopKeybinds, { 'agent.cycle': 'tab', 'agent.cycle.reverse': 'shift+tab', 'prompt.autocomplete.complete': 'ctrl+space' });
  for (const pattern of ['/outside/**', '../outside/**']) assert.throws(() => check({ tool: 'glob', input: { pattern } }, { project: p.project }, p.project), /external search/);
  assert(fs.readFileSync(p.checker, 'utf8').includes('readFileSync'));
  assert(!fs.readFileSync(p.checker, 'utf8').includes('import('));
  assert.equal(prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1' }).editable, p.editable);
});
