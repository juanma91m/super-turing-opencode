// Native configuration discovery + effective registry evidence. No raw prompts,
// resolved config, credentials or command-resource strings leave this module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { effect } from './policy.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
export function decodeList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  throw new Error('Unknown native audit list shape; cannot certify coverage');
}

export function nativeSources(binary, directory, profileConfig, parent = process.env) {
  assert(path.isAbsolute(binary) && path.isAbsolute(directory) && path.isAbsolute(profileConfig), 'Explicit native audit paths required');
  const temporaryParent = parent.TMPDIR ?? '/tmp/opencode';
  assert(path.isAbsolute(temporaryParent), 'Absolute audit temporary directory required');
  const temporary = fs.mkdtempSync(path.join(temporaryParent, 'native-source-audit-'));
  try {
    const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'TERM', 'XDG_CONFIG_HOME'].filter(key => parent[key] !== undefined).map(key => [key, parent[key]]));
    Object.assign(env, { OPENCODE_CONFIG_DIR: profileConfig, XDG_DATA_HOME: path.join(temporary, 'data'), XDG_STATE_HOME: path.join(temporary, 'state'), XDG_CACHE_HOME: path.join(temporary, 'cache'),
      OPENCODE_DB: path.join(temporary, 'audit.db'), TMPDIR: temporary, TMP: temporary, TEMP: temporary,
      OPENCODE_DISABLE_EXTERNAL_SKILLS: '1', OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: '1', OPENCODE_DISABLE_MODELS_FETCH: '1', OPENCODE_DISABLE_AUTOUPDATE: '1' });
    const version = spawnSync(binary, ['--version'], { cwd: directory, env, encoding: 'utf8', timeout: 10000 });
    assert(version.status === 0 && version.stdout.trim() === 'opencode v2.2.7', 'Audit requires the validated official V2 pin, not opencode from PATH');
    const result = spawnSync(binary, ['debug', 'config', '--standalone'], { cwd: directory, env, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    assert(!result.error && result.status === 0, 'Native source discovery failed; raw config/log values suppressed');
    let entries;
    try { entries = JSON.parse(result.stdout); } catch { throw new Error('Native source JSON invalid; raw config values suppressed'); }
    assert(Array.isArray(entries) && entries.every(entry => typeof entry.type === 'string' && typeof entry.path === 'string'), 'Unknown config source format');
    return { entries, runtimeOverridesPresent: Boolean(parent.OPENCODE_CONFIG_CONTENT || parent.OPENCODE_CONFIG || parent.OPENCODE_DISABLE_PROJECT_CONFIG), applicationDataOpened: false };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

function modelKey(model) {
  if (!model) return null;
  if (typeof model === 'string') return model;
  return model.providerID + '/' + (model.id ?? model.modelID ?? model.model) + (model.variant ? '#' + model.variant : '');
}
function label(file, directory, config) {
  if (!path.isAbsolute(file)) return 'non-file#' + sha(file).slice(0, 12);
  if (file === config || file.startsWith(config + path.sep)) return 'global/' + path.relative(config, file);
  if (file === directory || file.startsWith(directory + path.sep)) return 'project/' + path.relative(directory, file);
  return 'ancestor-or-external#' + sha(file).slice(0, 12) + '/' + path.basename(file);
}
function permissionWitnesses(expected, actual, tools) {
  const actions = new Set([...tools, 'read', 'edit', 'shell', 'subagent', 'question', 'webfetch', '__audit_unknown_action__']);
  const resources = new Set(['*', '__audit_resource__', 'app.txt', 'artifact-studio/spec.json']);
  for (const rule of [...expected, ...actual]) {
    if (!/[*?]/.test(rule.action)) actions.add(rule.action);
    resources.add(rule.resource);
    resources.add(rule.resource.replaceAll('*', '__audit__').replaceAll('?', 'x'));
  }
  const rank = { deny: 0, ask: 1, allow: 2 }, changes = [];
  for (const action of actions) for (const resource of resources) {
    const before = effect(expected, action, resource) ?? 'ask', after = effect(actual, action, resource) ?? 'ask';
    if (before !== after) changes.push({ action: /^[a-zA-Z0-9_*-]+$/.test(action) ? action : 'custom#' + sha(action).slice(0, 12), resourceHash: sha(resource), before, after, direction: rank[after] > rank[before] ? 'broader' : 'narrower' });
    if (changes.length >= 300) return { changes, truncated: true };
  }
  return { changes, truncated: false };
}

export function auditEvidence({ sources, agents, commands = [], skills = [], plugins = [], tools, baselines, directory, config, managedTools = [], guards = {}, builtinExpectations = {}, runtimeOverridesPresent = false }) {
  const findings = [], rows = [], declarations = [], files = [];
  const add = (severity, code, subject, message) => findings.push({ severity, code, subject, message });
  const actual = new Map(agents.map(agent => [agent.id, agent]));
  const sourceRows = sources.map((entry, index) => ({ order: index, type: entry.type, path: label(entry.path, directory, config) }));
  for (const entry of sources) {
    if (entry.type === 'document') {
      if (!entry.info || typeof entry.info !== 'object') { add('error', 'source-info-missing', label(entry.path, directory, config), 'Native document has no decoded metadata'); continue; }
      for (const [id, delta] of Object.entries(entry.info.agents ?? {})) declarations.push({ id, source: label(entry.path, directory, config), fields: Object.keys(delta ?? {}), replacesSystem: typeof delta?.system === 'string' && Boolean(delta.system.trim()) });
    }
    if (entry.type === 'directory' && path.isAbsolute(entry.path) && fs.existsSync(entry.path)) {
      let ancestor = entry.path, linked = false;
      while (ancestor !== path.dirname(ancestor)) {
        if (fs.lstatSync(ancestor).isSymbolicLink()) { linked = true; break; }
        ancestor = path.dirname(ancestor);
      }
      if (linked) { add('warning', 'source-symlink', label(entry.path, directory, config), 'Source directory ancestry uses a symlink; inventory not traversed'); continue; }
      let inspected = 0;
      const walk = (folder, kind, prefix = '', depth = 0) => {
        assert(depth <= 16 && ++inspected <= 10000, 'Source inventory limit reached; cannot certify coverage');
        if (!fs.existsSync(folder)) return;
        if (fs.lstatSync(folder).isSymbolicLink()) { add('warning', 'source-symlink', kind, 'Source directory uses a symlink; ownership needs review'); return; }
        for (const name of fs.readdirSync(folder).sort()) {
          if (name.startsWith('.') || name === 'node_modules') continue;
          const file = path.join(folder, name), info = fs.lstatSync(file);
          if (info.isSymbolicLink()) { add('warning', 'source-symlink', kind + '/' + name, 'Source file uses a symlink; not traversed by audit'); continue; }
           if (info.isDirectory()) walk(file, kind, prefix + name + '/', depth + 1);
          else if (info.isFile() && (kind === 'skill' ? name === 'SKILL.md' : name.endsWith('.md'))) files.push({ kind, id: kind === 'skill' ? (prefix.endsWith('/') ? prefix.slice(0, -1) : prefix) : prefix + name.slice(0, -3), path: label(file, directory, config) });
        }
      };
      for (const [folder, kind] of [['agents', 'agent'], ['agent', 'agent'], ['commands', 'command'], ['command', 'command'], ['skills', 'skill'], ['skill', 'skill']]) walk(path.join(entry.path, folder), kind);
    }
  }
  if (runtimeOverridesPresent) add('warning', 'runtime-config-override', 'runtime', 'Inline runtime config override was not forwarded; source/registry disagreement must be reviewed');
  for (const [id, expected] of Object.entries(baselines)) {
    const agent = actual.get(id);
    if (!agent) { add('error', 'missing-global-role', id, 'Expected global role is absent/disabled'); continue; }
    assert(Array.isArray(expected.permissions) && Array.isArray(agent.permissions), 'Unknown native permission shape; cannot certify coverage');
    const retained = typeof expected.system === 'string' && Boolean(expected.system.trim()) && typeof agent.system === 'string' && agent.system.includes(expected.system.trim());
    if (!retained) add('error', 'global-prompt-lost', id, 'Effective role lost part/all of its global prompt; no automatic inheritance reconstruction');
    const modeChanged = agent.mode !== expected.mode, modelChanged = modelKey(agent.model) !== modelKey(expected.model), hiddenChanged = Boolean(agent.hidden) !== Boolean(expected.hidden);
    if (modeChanged) add('warning', 'mode-changed', id, 'Effective role mode differs; require scoped authorization');
    if (modelChanged) add('warning', 'model-changed', id, 'Effective role model/variant differs; require scoped authorization');
    if (hiddenChanged) add('warning', 'visibility-changed', id, 'Effective role visibility differs from the global definition');
    const witness = permissionWitnesses(expected.permissions, agent.permissions, managedTools);
    if (witness.changes.some(change => change.direction === 'broader')) add('warning', 'permission-broader', id, 'Native permission witnesses are broader; explicit authorization and extra contract guards need review');
    if (witness.truncated) add('warning', 'permission-audit-limit', id, 'Permission witness report truncated; not complete evidence');
    rows.push({ id, globalPromptRetained: retained, modeChanged, modelChanged, hiddenChanged, nativePermissionChanges: witness.changes,
      guards: { contractSource: 'effective-native-agent-not-session', readOnlyEdit: guards.readOnlyRoles?.includes(id) ?? false,
        boundedNativeExceptions: guards.readOnlyRoles?.includes(id) ?? false, literalShellContract: Object.hasOwn(guards.readOnlyShellRules ?? {}, id),
        delegationTargets: agents.filter(target => ['allow','ask'].includes(effect(agent.permissions,'subagent',target.id))).map(target => target.id) } });
  }
  for (const declaration of declarations) {
    if (!Object.hasOwn(baselines, declaration.id) && !actual.has(declaration.id) && !builtinExpectations[declaration.id]?.disabled) add('error', 'unbacked-agent-delta', declaration.id, 'Source declares an agent with no effective definition');
    if (!declaration.source.startsWith('global/') && declaration.replacesSystem && Object.hasOwn(baselines, declaration.id)) add('warning', 'system-replacement-declared', declaration.id, 'Local source declares system explicitly; review preservation instead of assuming prompt inheritance');
  }
  const builtins = [];
  for (const [id, expected] of Object.entries(builtinExpectations)) {
    const agent = actual.get(id);
    if (expected.disabled ? Boolean(agent) : !agent || expected.hidden !== undefined && agent.hidden !== expected.hidden) add('error', 'builtin-state-changed', id, 'Builtin disabled/hidden expectation differs');
    const permissionDrift = agent && (expected.permissions ?? []).some(rule => effect(agent.permissions, rule.action, rule.resource) !== rule.effect);
    if (permissionDrift) add('warning', 'builtin-permission-changed', id, 'Explicit builtin permission expectation differs; review without assuming complete builtin parity');
    const modelChanged = expected.model !== undefined && modelKey(agent?.model) !== modelKey(expected.model);
    if (modelChanged) add('warning', 'builtin-model-changed', id, 'Explicit maintenance model/variant differs');
    builtins.push({ id, present: Boolean(agent), hidden: Boolean(agent?.hidden), permissionDrift: Boolean(permissionDrift), explicitModelCompared: expected.model !== undefined, modelChanged, fullPromptModelBaseline: false });
  }
  for (const agent of agents) if (!Object.hasOwn(baselines, agent.id) && !Object.hasOwn(builtinExpectations, agent.id) && !['general', 'explore', 'compaction', 'title', 'summary'].includes(agent.id)) add('warning', 'extra-effective-role', agent.id, 'Role outside the global baseline requires its own full contract review');
  const localOverrides = files.filter(file => !file.path.startsWith('global/'));
  for (const file of localOverrides) {
     if (file.kind === 'agent' && Object.hasOwn(baselines, file.id)) add('warning', 'whole-agent-file', file.id, 'Local whole-agent file shadows a global role; prefer native deltas without system unless explicitly justified');
     if (file.kind === 'command' || file.kind === 'skill') add('warning', 'local-' + file.kind + '-override', file.id, 'Local source requires content/workflow review; inventory is not semantic approval');
  }
  const toolIDs = tools?.map(tool => tool.id);
  if (toolIDs) for (const name of managedTools) if (!toolIDs.includes(name)) add('warning', 'managed-tool-missing', name, 'Composed tool is not registered; connection/catalog readiness requires separate diagnosis');
  const status = findings.some(item => item.severity === 'error') ? 'error' : findings.length ? 'warning' : 'pass';
  return { schemaVersion: 1, status, scope: 'native source discovery plus effective current-location registry; not business/LLM/whole-workspace approval', sources: sourceRows, agentDeclarations: declarations,
    files, agents: rows, builtins, commandNames: commands.map(item => item.name), skillIDs: skills.map(item => item.id), pluginIDs: plugins.map(item => item.id), toolIDs,
    managedToolActors: Object.fromEntries(Object.keys(guards.toolActors ?? {}).map(tool => [tool, agents.filter(agent => ['allow','ask'].includes(effect(agent.permissions??[],tool))).map(agent => agent.id)])), findings,
    coverage: { nativeConfigSources: true, effectiveRegistry: true, modesModelsPrompts: 'global owned roles; builtin expectations limited to explicit overrides; inherited model is not a per-session selection proof', tools: tools ? 'registered catalog, not per-model/session visibility or execution approval' : 'not supplied', sourceSnapshot: 'current files rediscovered; not a proof that files have not changed since host startup', permissions: 'bounded witnesses, not formal wildcard inclusion or saved-approval proof',
      localCommandsSkills: 'provenance + explicit semantic-review warnings', runtimePolicies: 'separate enforcement; native permission witnesses are not whole authorization', actualHierarchyAcceptance: false } };
}

export async function runtimeAudit(ctx, baselines) {
  const discovered = nativeSources(ctx.options.nativeBinary ?? process.execPath, ctx.location.directory, ctx.options.profileConfig);
  return auditEvidence({ sources: discovered.entries, agents: decodeList(await ctx.agent.list()), commands: decodeList(await ctx.command.list()), skills: decodeList(await ctx.skill.list()), plugins: decodeList(await ctx.plugin.list()), tools: decodeList(await ctx.tool.list()),
    baselines, directory: ctx.location.directory, config: ctx.options.profileConfig, builtinExpectations: ctx.options.builtinExpectations, managedTools: Object.keys(ctx.options.toolActors ?? {}), guards: ctx.options, runtimeOverridesPresent: discovered.runtimeOverridesPresent });
}
