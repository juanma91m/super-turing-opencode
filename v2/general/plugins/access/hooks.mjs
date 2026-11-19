import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { candidates, cleanup } from '../../session-tools.mjs';
import { effect, matches, shellEnvironment, libpqEnvironment } from '../../policy.mjs';
import { registerSkillIsolation } from '../../skills.mjs';
import { runtimeAudit } from '../../audit.mjs';
import { scaffoldProposal } from '../../scaffold.mjs';
import { nativeActor, nativeAllows, boundedNativeEdit } from './native-contract.mjs';

export async function register(ctx) {
  const { pinned, requiredSystems } = ctx.options;
  await registerSkillIsolation(ctx);
  const baselines = Object.fromEntries(Object.entries(ctx.options.auditBaselines).map(([id, baseline]) => [id, { ...baseline, system: requiredSystems[id] }]));
  await ctx.command.transform(editor => {
    editor.add({ name: 'stack-runtime-probe', description: 'Write one nonce-bound startup metadata receipt in the owned candidate cache; no model, tool dispatch, auth resolution or arbitrary output path.', execute: async input => {
      const session = await ctx.session.get({ sessionID: input.sessionID });
      assert(['master-dev', 'agent-design'].includes(session.agent), 'Runtime metadata probe is outside this role');
      const nonce = input.prompt?.text;
      assert(typeof nonce === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(nonce), 'Exact diagnostic nonce required; no arguments or attachments');
      assert(!input.prompt.files?.length && !input.prompt.skills?.length && !input.prompt.agents?.length, 'Probe accepts metadata nonce only');
      await ctx.permission.assert({ sessionID: input.sessionID, agent: session.agent, action: 'stack-runtime-probe', resources: ['*'] });
      const directory = ctx.options.runtimeProbeDir;
      assert(path.isAbsolute(directory), 'Owned diagnostic directory required');
      let current = directory;
      while (current !== path.dirname(current)) {
        if (fs.existsSync(current)) assert(!fs.lstatSync(current).isSymbolicLink(), 'Diagnostic directory symlink refused');
        current = path.dirname(current);
      }
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const audit = await runtimeAudit(ctx, baselines);
      fs.writeFileSync(path.join(directory, nonce + '.json'), JSON.stringify({ owner: 'opencode-stack', kind: 'native-runtime-probe', version: 1, nonce, audit }), { flag: 'wx', mode: 0o600 });
    } });
  });
  const integrity = () => {
    for (const [file, hash] of Object.entries(pinned)) assert(!fs.lstatSync(file).isSymbolicLink() && createHash('sha256').update(fs.readFileSync(file)).digest('hex') === hash, 'Trusted general-stack asset changed');
  };
  await ctx.session.hook('context', async event => {
    const expected = requiredSystems[event.agent];
    if (expected) {
      const { data: agent } = await ctx.agent.get({ agentID: event.agent });
      assert(agent?.system?.includes(expected), 'Local override removed the global role prompt; reconcile the additive layer');
    }
  });
  await ctx.tool.hook('execute.before', async event => {
    assert(event.agent, 'Executing actor required');
    for (const catalog of ctx.options.closedTools ?? []) if (matches(catalog.pattern, event.tool)) assert(catalog.tools.includes(event.tool), 'Tool is outside the reviewed addon catalog');
    const actors = ctx.options.toolActors?.[event.tool];
    let actor;
    const currentActor = async () => actor ??= await nativeActor(ctx, event.agent);
    if (actors) assert(nativeAllows(await currentActor(), event.tool), 'Addon tool is outside the native actor contract');
    if (['edit', 'write', 'patch'].includes(event.tool) && ctx.options.readOnlyRoles.includes(event.agent)) {
      assert(boundedNativeEdit(await currentActor(), event, { directory: ctx.location.directory,
        projectRoot: ctx.location.project?.directory ?? ctx.location.directory, home: process.env.HOME }),
      'Read-only role cannot edit application/configuration files outside its native bounded exceptions');
    }
    if (event.tool === 'shell') {
      integrity();
      if (ctx.options.readOnlyRoles.includes(event.agent)) {
        const rules = (await currentActor()).permissions.filter(rule => rule.action === '*' || rule.action === 'shell');
        const result = spawnSync('python3', [ctx.options.shellChecker], { input: JSON.stringify({ broker: ctx.options.broker, command: event.input.command, rules }),
          encoding: 'utf8', timeout: 10000, env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME, PYTHONDONTWRITEBYTECODE: '1' } });
        assert(!result.error && result.status === 0, 'Read-only shell is outside the composed contract');
      }
    }
    if (event.tool === 'subagent') {
      assert(typeof event.input?.agent === 'string' && nativeAllows(await currentActor(), 'subagent', event.input.agent), 'Subagent target is outside the native role contract');
      if (event.input?.sessionID) {
        const child = await ctx.session.get({ sessionID: event.input.sessionID });
        assert(child.parentID === event.sessionID && child.agent === event.input.agent, 'Cannot resume an unrelated child/session');
      }
    }
  });
  await ctx.shell.hook('create.before', event => {
    event.env = shellEnvironment();
    if (ctx.options.runtimeHome && /^\s*python3\s/.test(event.command) && event.command.includes(ctx.options.broker) && event.command.includes('helper')) {
      const result = spawnSync('python3', [ctx.options.shellChecker], { input: JSON.stringify({ broker: ctx.options.broker, command: event.command, runtimeMatch: true }),
        encoding: 'utf8', timeout: 10000, env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME, PYTHONDONTWRITEBYTECODE: '1' } });
      assert(!result.error && result.status === 0, 'Helper runtime invocation must be recognized literally');
      const helper=JSON.parse(result.stdout);
      if (typeof helper === 'string') {
        const home = ctx.options.runtimeHome;
        Object.assign(event.env, { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), XDG_STATE_HOME: path.join(home, '.local/state'), XDG_CACHE_HOME: path.join(home, '.cache') });
        for (const key of ['SSH_AUTH_SOCK', 'PGPASSFILE', 'PGSERVICEFILE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGSSLCRL', 'PGSSLMODE', 'PGCHANNELBINDING', 'PGGSSENCMODE']) if (process.env[key] !== undefined) event.env[key] = process.env[key];
        if(helper === 'psql-readonly') Object.assign(event.env,libpqEnvironment());
      }
    }
  });
  const checkActor = context => { assert(context.agent === 'master-dev', 'Session maintenance is only exposed to master-dev'); };
  const ask = (context, action, resources) => ctx.permission.assert({ sessionID: context.sessionID, agent: context.agent,
    source: { type: 'tool', messageID: context.messageID, id: context.id }, action, resources });
  const properties = { allProjects: { type: 'boolean', default: false }, includeRoot: { type: 'boolean', default: false }, olderThanMinutes: { type: 'integer', minimum: 0, default: 0 } };
  await ctx.tool.transform(editor => {
    editor.add({ name: 'stack-layer-audit', description: 'Audit native current-location sources and effective registry without printing resolved config/prompts. Bounded permission evidence, not semantic approval of the real hierarchy. No installer/indexer or new MCP startup.',
      options: { codemode: false }, input: { type: 'object', properties: {}, additionalProperties: false }, execute: async (_input, context) => {
        assert(['agent-design', 'master-dev'].includes(context.agent), 'Stack audit is outside this role');
        await ask(context, 'stack-layer-audit', ['*']); integrity();
        return { content: JSON.stringify(await runtimeAudit(ctx, baselines)) };
      } });
    editor.add({ name: 'stack-layer-scaffold', description: 'Return a proposal-only native role delta for explicit review. Never writes, copies global prompts, grants workspace access or initializes indexes.',
      options: { codemode: false }, input: { type: 'object', properties: { deltas: { type: 'object', additionalProperties: { type: 'object' } } }, required: ['deltas'], additionalProperties: false }, execute: async (input, context) => {
        assert(context.agent === 'agent-design', 'Layer proposals belong to agent-design');
        await ask(context, 'stack-layer-scaffold', ['*']); integrity();
        return { content: JSON.stringify(scaffoldProposal(input.deltas, baselines)) };
      } });
    editor.add({ name: 'stack-layer-status', description: 'Read effective native base-role metadata and check retained global prompts. Does not print prompts/config values or certify all overlay sources.',
      options: { codemode: false }, input: { type: 'object', properties: {}, additionalProperties: false }, execute: async (_input, context) => {
        assert(['agent-design', 'master-dev'].includes(context.agent), 'Stack diagnostics is outside this role');
        await ask(context, 'stack-layer-status', ['*']);
        const agents = [];
        for (const [id, expected] of Object.entries(requiredSystems)) {
          const { data: agent } = await ctx.agent.get({ agentID: id });
          assert(agent, 'Missing native base role');
          agents.push({ id, mode: agent.mode, model: agent.model, globalPromptRetained: Boolean(agent.system?.includes(expected)),
            editDefault: effect(agent.permissions, 'edit'), shellDefault: effect(agent.permissions, 'shell'), subagentDefault: effect(agent.permissions, 'subagent'), permissionRuleCount: agent.permissions.length });
        }
        return { content: JSON.stringify({ scope: 'effective base-role summary; source precedence and private addons need separate validation', agents }) };
      } });
    editor.add({ name: 'stack-sessions-list', description: 'List native session metadata in the selected scope, child sessions of current directory by default. No SQL or deletion.',
      options: { codemode: false }, input: { type: 'object', properties, additionalProperties: false }, execute: async (input, context) => {
        checkActor(context); await ask(context, 'stack-sessions-list', ['*']);
        return { content: JSON.stringify({ sessions: await candidates(ctx.session, ctx.location.directory, input) }) };
      } });
    editor.add({ name: 'stack-sessions-clean', description: 'Delete explicitly selected native sessions recursively; may interrupt them and delete descendants. Requires confirmation. Cannot remove current session/ancestors. Scope defaults to children of current directory.',
      options: { codemode: false }, input: { type: 'object', properties: { ...properties, sessionIDs: { type: 'array', minItems: 1, maxItems: 100, uniqueItems: true, items: { type: 'string', pattern: '^ses_[A-Za-z0-9]+$' } } }, required: ['sessionIDs'], additionalProperties: false }, execute: async (input, context) => {
        checkActor(context);
        return { content: JSON.stringify(await cleanup(ctx.session, ctx.location.directory, input, context.sessionID, ids => ask(context, 'stack-sessions-clean', ids), context.signal)) };
      } });
  });
}
