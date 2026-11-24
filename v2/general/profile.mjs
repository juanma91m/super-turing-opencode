import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { basePermissions, effect, matches } from './policy.mjs';
import { validateStorageBinding } from './storage.mjs';
import { assertNoPendingDistribution, releaseStorePath } from './ownership.mjs';
import { validateDormantProviders, dormantPluginDisables } from './dormant-providers.mjs';
import { assertNoProductionReaders } from './production-leases.mjs';
import { acquireCandidateLease } from './launch.mjs';

const source = fileURLToPath(new URL('../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function noLinks(file) {
  let current = path.parse(file).root;
  for (const part of path.relative(current, file).split(path.sep)) {
    current = path.join(current, part);
    try { assert(!fs.lstatSync(current).isSymbolicLink(), 'Candidate symlink refused'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export function assertCandidateRoot(root) {
  assert(path.isAbsolute(root) && path.resolve(root) === root && root !== path.parse(root).root, 'Explicit canonical candidate root required');
  assert(root !== os.homedir() && ![path.join(os.homedir(), '.config/opencode'), path.join(os.homedir(), '.opencode'), path.join(os.homedir(), '.local/share/opencode-v2-clean/workshop')].some(protectedRoot => root === protectedRoot || root.startsWith(protectedRoot + path.sep)), 'Active install/workshop is not a candidate target');
  noLinks(root);
}
export function generalPaths(root, project) {
  assertCandidateRoot(root);
  assert(path.isAbsolute(project) && path.resolve(project) === project, 'Explicit canonical project required');
  assert(root !== project && !project.startsWith(root + path.sep), 'Application project cannot be the candidate/configuration tree');
  noLinks(project);
  const home = path.join(root, 'home');
  return { root, project, home, config: path.join(home, '.config'), data: path.join(home, '.local/share'), state: path.join(home, '.local/state'), cache: path.join(home, '.cache'), tmp: path.join(root, 'tmp'), bundle: path.join(root, 'bundle/opencode-stack') };
}

export function generalEnvironment(p, parent = process.env) {
  if (p.storageBinding) validateStorageBinding(p);
  // Deliberately no OPENCODE_DISABLE_PROJECT_CONFIG: native project deltas and
  // AGENTS are part of the inheritance contract, not a disposable test boundary.
  const env = { HOME: p.home, USER: os.userInfo().username, LOGNAME: os.userInfo().username,
    PATH: [path.dirname(process.execPath), '/usr/local/bin', '/usr/bin', '/bin'].join(':'), LANG: 'C.UTF-8', TERM: 'xterm-256color',
    XDG_CONFIG_HOME: p.config, XDG_DATA_HOME: p.data, XDG_STATE_HOME: p.state, XDG_CACHE_HOME: p.cache, TMPDIR: p.tmp, TMP: p.tmp, TEMP: p.tmp,
    OPENCODE_CONFIG_DIR: path.join(p.config, 'opencode'), OPENCODE_DB: path.join(p.data, 'opencode/opencode.db'),
    OPENCODE_DISABLE_EXTERNAL_SKILLS: '1', OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: '1', OPENCODE_DISABLE_MODELS_FETCH: '1', OPENCODE_DISABLE_AUTOUPDATE: '1', PYTHONDONTWRITEBYTECODE: '1' };
  if (p.runtimeHome) {
    for (const key of ['SSH_AUTH_SOCK', 'PGPASSFILE', 'PGSERVICEFILE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGSSLCRL']) if (typeof parent[key] === 'string' && path.isAbsolute(parent[key])) env[key] = parent[key];
    for (const [key, choices] of Object.entries({ PGSSLMODE: ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'], PGCHANNELBINDING: ['disable', 'prefer', 'require'], PGGSSENCMODE: ['disable', 'prefer', 'require'] })) if (choices.includes(parent[key])) env[key] = parent[key];
  }
  return env;
}

function markdown(agent) {
  const { system, permissions, ...header } = agent;
  return ['---', ...Object.entries(header).map(([key, value]) => key + ': ' + JSON.stringify(value)), 'permissions:',
    ...permissions.flatMap(rule => ['  - action: ' + JSON.stringify(rule.action), '    resource: ' + JSON.stringify(rule.resource), '    effect: ' + rule.effect]), '---', system].join('\n');
}

export function planGeneral(root, { project, mock, plugins = [], contributions = [], runtimeHome, maintenanceModels, dormantProviders } = {}) {
  const p = generalPaths(root, project), config = path.join(p.config, 'opencode');
  assert(fs.statSync(project).isDirectory(), 'Existing project required; candidate never initializes an application');
  if (runtimeHome !== undefined) assert(typeof runtimeHome === 'string' && path.isAbsolute(runtimeHome), 'Explicit runtime identity required');
  if (mock) { const url = new URL(mock); assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password, 'Mock provider must be owned loopback'); }
  const assets = new Map(), pinned = {};
  const add = (file, desired) => { assert(!assets.has(file)); assets.set(file, Buffer.from(desired)); };
  const copy = (relative, target = path.join(config, relative)) => { const file = path.join(source, relative); noLinks(file); assert(fs.statSync(file).isFile()); add(target, fs.readFileSync(file)); };
  const tree = (relative, target, skip = new Set()) => {
    const dir = path.join(source, relative); noLinks(dir);
    for (const name of fs.readdirSync(dir).sort()) {
      if (skip.has(path.join(relative, name))) continue;
      const file = path.join(dir, name); noLinks(file);
      if (fs.statSync(file).isDirectory()) tree(path.join(relative, name), path.join(target, name), skip);
      else copy(path.join(relative, name), path.join(target, name));
    }
  };
  const rendered = spawnSync('python3', [path.join(source, 'v2/general/render.py')], { input: JSON.stringify({ config, mock: Boolean(mock) }), encoding: 'utf8', env: { PATH: '/usr/local/bin:/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' }, timeout: 10000 });
  assert(!rendered.error && rendered.status === 0, 'Canonical native agent render failed; values suppressed');
  const agents = JSON.parse(rendered.stdout);
  agents['master-dev'].permissions.push({ action: 'stack-sessions-list', resource: '*', effect: 'allow' }, { action: 'stack-sessions-clean', resource: '*', effect: 'ask' });
  for (const id of ['master-dev', 'agent-design']) agents[id].permissions.push(...['stack-layer-status', 'stack-layer-audit', 'stack-runtime-probe'].map(action => ({ action, resource: '*', effect: 'allow' })));
  agents['agent-design'].permissions.push({ action: 'stack-layer-scaffold', resource: '*', effect: 'allow' });
  for (const name of ['env-guard', 'controlled-permissions', 'planner-shell', 'agent-identity']) tree('v2/plugins/' + name, path.join(p.bundle, 'v2/plugins', name));
  copy('v2/native-history.mjs', path.join(p.bundle, 'v2/native-history.mjs'));
  copy('lib/permission-policy.ts', path.join(p.bundle, 'lib/permission-policy.ts'));
  tree('v2/general/plugins/access', path.join(p.bundle, 'v2/general/plugins/access'));
  for (const name of ['policy.mjs', 'session-tools.mjs', 'readonly-shell.py', 'audit.mjs', 'scaffold.mjs', 'skills.mjs']) copy('v2/general/' + name, path.join(p.bundle, 'v2/general', name));
  tree('skills', path.join(config, 'skills'), new Set(['skills/overlays-locales-opencode/SKILL.md']));
  copy('v2/general/assets/overlays-locales-opencode.md', path.join(config, 'skills/overlays-locales-opencode/SKILL.md'));
  tree('planner-helpers', path.join(config, 'planner-helpers'));
  const scripts = ['planner_shell.py', 'planner_doc.py', 'local_inspect.py', 'ssh_inspect.py', 'psql_readonly.py', 'find_code_pattern.sh', 'check_code_patterns.sh', 'next_code_review_path.sh', 'check_overlay_sync.sh', 'check_overlay_sync.py'];
  for (const name of scripts) copy('scripts/' + name);
  for (const name of ['PLAYBOOK-CODE-PATTERNS.md', 'PLAYBOOK-PERMISSIONS.md', 'CONTEXT7-TECH-CATALOG.md']) copy(name);
  for (const name of ['PLAYBOOK-LOCAL-OVERLAYS.md', 'LOCAL-OVERLAY-TEMPLATE.md']) copy('v2/general/assets/' + name, path.join(config, name));
  for (const name of fs.readdirSync(path.join(source, 'commands')).sort()) {
    let text = fs.readFileSync(path.join(source, 'commands', name), 'utf8').replaceAll('~/.config/opencode', config);
    if (name === 'stack-doctor.md' || name === 'check-local-overlays.md') text = '---\ndescription: Audita fuentes y registro efectivo nativos V2 sin ejecutar instaladores.\nagent: agent-design\n---\nUsá stack-layer-audit en el directorio actual. Reportá fuentes/precedencia observada, prompts retenidos, modos/modelos/visibilidad, testigos de cambios de permisos, guardas y warnings de comandos/skills locales. Revisá AGENTS y contenido público local sólo si hace falta para el pedido. No imprimas config resuelta ni credenciales. No declares aceptación de AUNE/proyectos reales ni inclusión formal de permisos por estos testigos. No ejecutar debug agents: inicia MCP en 2.2.7. La tool usa debug config con data/state/cache temporales y el registro del host ya vivo; no prueba que los archivos no cambiaron desde el arranque. Limitá el diagnóstico al perfil publicado; no modificar, sincronizar ni indexar.\n';
    if (name === 'init-project-agent-layer.md') text = '---\ndescription: Propone una capa local mínima nativa V2, sin escribir ni inicializar índices.\nagent: agent-design\n---\nInspeccioná el proyecto pedido en $ARGUMENTS; si no coincide con el directorio de esta sesión, aclaralo y no atribuyas la auditoría actual a otro repo. Leé AGENTS, manifests públicos y las guías LOCAL-OVERLAY-TEMPLATE.md/PLAYBOOK-LOCAL-OVERLAYS.md instaladas. Ejecutá stack-layer-audit para conocer el estado actual. Preferí AGENTS para dominio/entry points y el addon owner opt-in para organización. Sólo cuando cambie ejecución, usá stack-layer-scaffold con deltas de roles globales existentes: modelo, modo o permisos nativos; nunca copiar/reemplazar system, reinyectar tools V1 ni usar __replace__. Es propuesta sin writes ni aprobación semántica. Explicá cada ampliación o recorte, pedí confirmación explícita y preservá JSON/JSONC y archivos ajenos al aplicar mediante edición deliberada. Un rol nuevo necesita definición completa revisada; helpers/skills/comandos sólo si necesarios y locales. Context7 sólo con tecnologías/versiones detectadas; Jira/handoff/memoria requieren adopción explícita, no pedir ni leer .env/auth stores. CodeGraph es query-only: no init/sync/reindex ni ejecutar wrappers V1 desde este scaffolding. Validá el delta aplicado con config/registro efectivo en entorno aprobado y pedí reinicio del cliente tras cambios de configuración.\n';
    if (name === 'sessions-list.md' || name === 'sessions-clean.md') text = '---\ndescription: Mantenimiento de sesiones mediante API pública nativa V2, sin SQL.\nagent: master-dev\n---\nUsá stack-sessions-list para listar candidatos: hijos del directorio actual por defecto. Interpretá $ARGUMENTS: --all-projects, --include-root, --older-than-minutes N; si son ambiguos o desconocidos, preguntá. No leer DBs ni usar session_cleanup V1.\n' + (name === 'sessions-clean.md' ? 'Para limpieza solicitada, seleccioná IDs explícitos del listado e invocá stack-sessions-clean con el mismo alcance. La eliminación puede interrumpir sesiones y es recursiva: informá ese efecto y conservá confirmación interactiva. No borrar sesión actual/ancestros ni ampliar alcance por defecto. Reportá eliminadas, fallidas y límites reales.\n' : 'Reportá candidatos y límites; no limpiar.\n');
    add(path.join(config, 'commands', name), text);
  }
  let instructions = fs.readFileSync(path.join(source, 'AGENTS.md'), 'utf8') + '\n## Perfil general gestionado\nUsá subagent sólo para targets permitidos y contexto acotado. El host notifica el fin del hijo; esperar no es polling. No hay worktree/aislamiento automático de escrituras: no superponer writers sobre los mismos archivos sin alcance explícito. Capas organizacionales son opt-in y propias de su addon; proyectos aportan deltas nativos sin borrar prompts/guardas globales. Los addons se componen por su owner explícitamente; el plan no prueba conexiones. Helpers SSH/DB conservan sus contratos pero este HOME aislado no copia autenticación ni contexto machine-local. No operar infraestructura/GitHub por preparar un perfil.\n';
  const broker = path.join(config, 'scripts/planner_shell.py');
  const document = { $schema: 'https://opencode.ai/config.json', model: mock ? 'workshop-mock/mock' : 'openai/gpt-6.1-sol', default_agent: 'master-dev', update: 'disable', share: 'disabled', snapshots: true, compaction: { auto: true }, warming: false,
    permissions: basePermissions(), agents: { plan: { hidden: true, permissions: [{ action: 'edit', resource: '*', effect: 'deny' }, { action: 'shell', resource: '*', effect: 'deny' }, { action: 'shell', resource: 'python3 ' + broker + ' *', effect: 'allow' }] }, build: { hidden: true }, general: { disabled: true }, explore: { disabled: true } },
    experimental: { todo: true }, mcp: { servers: {} },
    policies: [{ action: 'provider.use', resource: '*', effect: 'deny' }, { action: 'provider.use', resource: mock ? 'workshop-mock' : 'openai', effect: 'allow' }, { action: 'mcp.use', resource: '*', effect: 'deny' }, { action: 'mcp.use', resource: 'stitch', effect: 'deny' }, { action: 'tool.use', resource: 'stitch_*:*', effect: 'deny' }, { action: 'tool.use', resource: 'execute:*', effect: 'deny' }, { action: 'plugin.use', resource: 'opencode.provider.ollama', effect: 'deny' }],
    plugins: [...['env-guard', 'controlled-permissions', 'planner-shell', 'agent-identity'].map(name => name === 'planner-shell' ? { package: path.join(p.bundle, 'v2/plugins', name), options: { broker } } : name === 'agent-identity' ? { package: path.join(p.bundle, 'v2/plugins', name), options: { history: 'stored' } } : path.join(p.bundle, 'v2/plugins', name)), '-opencode.provider.ollama'] };
  const relative = name => { assert(typeof name === 'string' && name && !path.isAbsolute(name) && !name.split(/[\\/]/).some(part => !part || part === '.' || part === '..' || part.startsWith('.env')), 'Confined contribution path required'); return name; };
  if (maintenanceModels !== undefined) {
    assert(maintenanceModels && typeof maintenanceModels === 'object' && !Array.isArray(maintenanceModels) && Object.keys(maintenanceModels).every(id => ['title', 'summary', 'compaction'].includes(id)), 'Only explicit native maintenance model overrides');
    for (const [id, entry] of Object.entries(maintenanceModels)) {
      assert(entry && Object.keys(entry).join(',') === 'model' && typeof entry.model === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./:-]+(?:#[a-zA-Z0-9_.-]+)?$/.test(entry.model), 'Canonical maintenance model/variant required; no copied prompt/request');
      assert(entry.model.split('/')[0] === (mock ? 'workshop-mock' : 'openai'), 'Maintenance model provider must already be reviewed by the candidate policy');
      document.agents[id] = structuredClone(entry);
    }
  }
  if (dormantProviders !== undefined) {
    validateDormantProviders(dormantProviders);
    document.providers = structuredClone(dormantProviders.providers);
    document.policies.push(...dormantProviders.disabled.map(resource => ({ action: 'provider.use', resource, effect: 'deny' })));
    for (const disabled of dormantPluginDisables(dormantProviders)) if (!document.plugins.includes(disabled)) document.plugins.push(disabled);
  }
  const ids = new Set(), managedTools = new Set(), closedTools = [], componentMetadata = {};
  const cli = { $schema: 'https://opencode.ai/v2/cli.json', session: { permissions: 'prompt', new_location: 'launch' }, tabs: { scope: 'cwd' }, keybinds: { 'agent.cycle': 'tab', 'agent.cycle.reverse': 'shift+tab', 'prompt.autocomplete.complete': 'ctrl+space' } };
  const context = {
    version: 1, kind: 'general', paths: p, config, agents, document, cli, mock: Boolean(mock),
    addConfig: (name, bytes) => add(path.join(config, relative(name)), bytes),
    readAsset: file => { noLinks(file); assert(fs.statSync(file).isFile() && (!path.basename(file).startsWith('.env') || path.basename(file) === '.env.example') && !/\.local\.(?:sh|json)$/.test(file), 'Canonical public asset required; no local configuration copied'); return fs.readFileSync(file); },
    bundlePath: (id, name = '') => { assert(/^[a-z][a-z0-9-]+$/.test(id)); return path.join(root, 'bundle', id, name ? relative(name) : ''); },
    addBundle: (id, name, bytes) => add(context.bundlePath(id, name), bytes),
    compileAgents: texts => {
      const result = spawnSync('python3', [path.join(source, 'v2/general/render.py')], { input: JSON.stringify({ config, mock: Boolean(mock), agents: texts }), encoding: 'utf8', env: { PATH: '/usr/local/bin:/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' }, timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
      assert(!result.error && result.status === 0, 'Native addon role render failed; values suppressed'); return JSON.parse(result.stdout);
    },
    appendInstructions: text => { assert(typeof text === 'string'); instructions += '\n' + text + '\n'; },
    manageTools: names => { for (const name of names) { assert(/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)); managedTools.add(name); } },
    closeTools: (pattern, names) => {
      assert(/^[A-Za-z][A-Za-z0-9_-]*\*?$/.test(pattern) && names.every(name => matches(pattern, name)), 'Explicit closed tool catalog required');
      const priorDenies = document.policies.filter(rule => rule.action === 'tool.use' && rule.effect === 'deny'
        && names.some(name => matches(rule.resource.includes(':') ? rule.resource.slice(0, rule.resource.indexOf(':')) : rule.resource, name)));
      document.policies.push({ action: 'tool.use', resource: pattern + ':*', effect: 'deny' }, ...names.map(name => ({ action: 'tool.use', resource: name + ':*', effect: 'allow' })), ...priorDenies);
      closedTools.push({ pattern, tools: [...names] }); context.manageTools(names);
    },
    metadata: componentMetadata,
  };
  const copyContributionTree = (directory, destination, emit) => {
    noLinks(directory);
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name); noLinks(file);
      if (fs.statSync(file).isDirectory()) copyContributionTree(file, path.join(destination, name), emit);
      else emit(path.join(destination, name), context.readAsset(file));
    }
  };
  context.copyConfigTree = (directory, destination, transform = (_name, bytes) => bytes) => copyContributionTree(directory, relative(destination), (name, bytes) => context.addConfig(name, transform(name, bytes)));
  context.copyBundleTree = (id, directory, destination) => copyContributionTree(directory, relative(destination), (name, bytes) => context.addBundle(id, name, bytes));
  for (const contribution of contributions) {
    assert(contribution && /^[a-z][a-z0-9-]+$/.test(contribution.id) && typeof contribution.apply === 'function' && !ids.has(contribution.id), 'Unique explicit addon contribution required');
    const priorRoles = Object.fromEntries(Object.entries(agents).map(([id, agent]) => [id, structuredClone(agent)]));
    const priorDocument = structuredClone(document);
    ids.add(contribution.id); contribution.apply(context);
    assert(context.document === document && context.agents === agents && context.cli === cli, 'Contributions extend the explicit plan, not replace its ownership');
    for (const key of ['permissions', 'policies', 'plugins']) assert(JSON.stringify(document[key].slice(0, priorDocument[key].length)) === JSON.stringify(priorDocument[key]), 'Addon must preserve earlier global guards/plugins');
    for (const [name, server] of Object.entries(priorDocument.mcp.servers)) assert(JSON.stringify(document.mcp.servers[name]) === JSON.stringify(server), 'Addon cannot replace another owner MCP');
    for (const [id, provider] of Object.entries(priorDocument.providers ?? {})) assert(JSON.stringify(document.providers?.[id]) === JSON.stringify(provider), 'Addon cannot replace a preserved dormant provider');
    for (const id of dormantProviders?.disabled ?? []) assert(effect(document.policies, 'provider.use', id) === 'deny', 'Addon cannot revive an explicitly disabled provider');
    for (const disabled of new Set(['-opencode.provider.ollama', ...(dormantProviders ? dormantPluginDisables(dormantProviders) : [])])) {
      assert(!document.plugins.some(plugin => (typeof plugin === 'string' ? plugin : plugin.package) === disabled.slice(1)), 'Addon cannot revive dormant builtin discovery');
      assert(effect(document.policies, 'plugin.use', disabled.slice(1)) === 'deny', 'Addon cannot relax dormant discovery policy');
    }
    for (const key of ['model', 'default_agent', 'share', 'update', 'snapshots', 'compaction', 'warming']) assert(JSON.stringify(document[key]) === JSON.stringify(priorDocument[key]), 'Addon cannot change general defaults implicitly');
    for (const [id, prior] of Object.entries(priorRoles)) {
      const next = agents[id];
      assert(next && next.system.includes(prior.system) && next.mode === prior.mode && next.model === prior.model, 'Addon cannot silently replace an existing role body/mode/model');
      assert(JSON.stringify(next.permissions.slice(0, prior.permissions.length)) === JSON.stringify(prior.permissions), 'Addon must preserve earlier explicit role rules');
    }
    assert(!document.plugins.some(plugin => typeof plugin === 'object' && plugin.package.endsWith('/workshop-guard/')), 'General contributions cannot import a workshop boundary');
  }
  // Native agent files load after inline declarations. Materialize our own
  // explicit builtin constraints last in the emitted role too: otherwise a
  // fallback's shell ask would contradict the inline deny and the runtime guard.
  // This is general-addon assembly only, not inheritance of project overrides.
  for (const [id, agent] of Object.entries(agents)) {
    agent.permissions.push(...structuredClone(document.agents[id]?.permissions ?? []));
    add(path.join(config, 'agents', id + '.md'), markdown(agent));
  }
  add(path.join(config, 'AGENTS.md'), instructions);
  for (const [file, bytes] of assets) if (file.startsWith(path.join(root, 'bundle') + path.sep) || file.startsWith(path.join(config, 'scripts') + path.sep) || file.startsWith(path.join(config, 'planner-helpers') + path.sep)) pinned[file] = hash(bytes);
  const readonly = Object.entries(agents).filter(([, agent]) => effect(agent.permissions, 'edit') === 'deny'
    && !agent.permissions.some(rule => rule.action === 'edit' && rule.effect === 'allow' && effect(agent.permissions, 'edit', rule.resource) === 'allow')).map(([id]) => id);
  const delegationTargets = Object.fromEntries(Object.entries(agents).map(([id, agent]) => [id, agent.permissions.filter(rule => rule.action === 'subagent' && rule.effect !== 'deny' && /^[a-z][a-z0-9-]+$/.test(rule.resource) && effect(agent.permissions, 'subagent', rule.resource) !== 'deny').map(rule => rule.resource)]));
  const toolActors = Object.fromEntries([...managedTools].map(tool => [tool, Object.entries(agents).filter(([, agent]) => ['allow', 'ask'].includes(effect([...document.permissions, ...agent.permissions], tool))).map(([id]) => id)]));
  const readOnlyShellRules = Object.fromEntries([...new Set([...readonly, 'plan'])].map(id => [id,
    [...document.permissions, ...(agents[id]?.permissions ?? []), ...(document.agents[id]?.permissions ?? [])].filter(rule => rule.action === '*' || rule.action === 'shell')]));
  // Integrity runs before planner-shell executes the broker even for --check.
  const auditBaselines = Object.fromEntries(Object.entries(agents).map(([id, agent]) => [id, { mode: agent.mode, model: agent.model ?? null, hidden: Boolean(document.agents[id]?.hidden ?? agent.hidden), permissions: [...document.permissions, ...agent.permissions].map(rule => ({ ...rule, resource: rule.resource.replace(/^~\//, p.home + '/') })) }]));
  document.plugins.splice(2, 0, { package: path.join(p.bundle, 'v2/general/plugins/access'), options: { pinned, broker, runtimeHome, profileConfig: config, runtimeProbeDir: path.join(p.cache, 'general-runtime-probes'), auditBaselines, builtinExpectations: document.agents, shellChecker: path.join(p.bundle, 'v2/general/readonly-shell.py'), readOnlyShellRules, delegationTargets, toolActors, closedTools, readOnlyRoles: [...new Set([...readonly, 'plan'])], requiredSystems: Object.fromEntries(Object.entries(agents).map(([id, agent]) => [id, agent.system.trim()])) } });
  document.plugins.push(...plugins);
  if (mock) document.providers = { ...(document.providers ?? {}), 'workshop-mock': { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: mock, apiKey: 'synthetic' }, models: { mock: { modelID: 'mock', name: 'General fixture', capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 65536, output: 4096 } } } } };
  add(path.join(config, 'opencode.json'), JSON.stringify(document, null, 2) + '\n');
  add(path.join(config, 'cli.json'), JSON.stringify(cli, null, 2) + '\n');
  return { ...p, runtimeHome, document, assets, roles: Object.keys(agents), readonly, broker, components: [...ids], componentMetadata,
    commands: [...assets.keys()].filter(file => path.dirname(file) === path.join(config, 'commands') && file.endsWith('.md')).map(file => path.basename(file, '.md')) };
}

export function prepareGeneral(root, options) {
  assertCandidateRoot(root);
  // Validate the requested plan before creating an empty target. The exclusive
  // lease then covers every ownership/drift check and write, not a racy precheck.
  planGeneral(root, options);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const release = acquireCandidateLease(root);
  try { return prepareGeneralLocked(root, options); } finally { release(); }
}

function prepareGeneralLocked(root, options) {
  assertNoProductionReaders(root);
  assertNoPendingDistribution(root);
  const distribution = releaseStorePath(root); noLinks(distribution);
  assert(!fs.existsSync(distribution), 'Versioned distribution owns this candidate; use install/update/rollback, not legacy prepare');
  const p = planGeneral(root, options), marker = path.join(root, '.general-candidate.json'); noLinks(marker);
  if (fs.existsSync(root) && !fs.existsSync(marker)) assert(fs.readdirSync(root).every(name => name === '.candidate-launch.lock'), 'Refusing unowned candidate root');
  const prior = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker)) : undefined;
  if (prior) assert(prior.owner === 'opencode-stack' && prior.kind === 'general-candidate' && prior.version === '2.2.7' && prior.schemaVersion === 1 && prior.hashes && typeof prior.hashes === 'object' && !Array.isArray(prior.hashes), 'Candidate identity differs');
  for (const file of Object.keys(prior?.hashes ?? {})) assert(p.assets.has(path.join(root, file)), 'Obsolete managed assets require explicit migration');
  for (const [file, bytes] of p.assets) {
    assert(file.startsWith(root + path.sep)); noLinks(file);
    if (fs.existsSync(file)) {
      assert(fs.statSync(file).isFile(), 'Managed asset must be regular');
      const digest = hash(fs.readFileSync(file));
      assert(digest === hash(bytes) || digest === prior?.hashes[path.relative(root, file)], 'Unknown candidate asset drift; no adoption');
    }
  }
  for (const dir of [p.home, p.config, p.data, p.state, p.cache, p.tmp]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const [file, bytes] of p.assets) {
    if (fs.existsSync(file) && fs.readFileSync(file).equals(bytes)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + '.candidate.tmp'; noLinks(temp); fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 }); fs.renameSync(temp, file);
  }
  const next = { owner: 'opencode-stack', kind: 'general-candidate', schemaVersion: 1, version: '2.2.7', hashes: Object.fromEntries([...p.assets].map(([file, bytes]) => [path.relative(root, file), hash(bytes)])) };
  const temp = marker + '.tmp'; noLinks(temp); fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); fs.renameSync(temp, marker);
  return p;
}
