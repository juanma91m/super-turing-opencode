import assert from 'node:assert/strict';
import { desktopBindings } from './plugins/local-file-links/links.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { noLinks, generalEnvironment } from './profile.mjs';
import { checkCandidate, OFFICIAL_SHA256 } from './lifecycle.mjs';
import { existingV2Storage, bindV2Storage } from './storage.mjs';
import { auditEvidence, decodeList } from './audit.mjs';
import { startOwnedServer, until } from './owned-server.mjs';
import { assertNoPendingDistribution } from './ownership.mjs';
import { effect, libpqEnvironment } from './policy.mjs';
import { assertNoProductionReaders } from './production-leases.mjs';
import { pendingMcpCatalog,settleCatalogAudit } from './catalog-readiness.mjs';

export function launchConsent(action, options = {}, terminal = { input: process.stdin.isTTY, output: process.stdout.isTTY }) {
  assert(['verify-live', 'chat'].includes(action), 'Explicit live candidate action required');
  assert(options.candidateOnly === true && options.clientClosed === true, 'Live candidate requires --candidate-only and --client-closed; may start MCP/services and write native state');
  if (action === 'chat') {
    assert(terminal.input === true && terminal.output === true, 'Chat requires an interactive terminal; no credential-bearing transcript capture');
    assert(options.reuseV2Storage === true, 'Chat requires explicit --reuse-v2-storage; do not create another login or copy credentials');
  }
}

export function acquireCandidateLease(root, { productionReader = false } = {}) {
  const file = path.join(root, '.candidate-launch.lock'); noLinks(file);
  let fd; try { fd = fs.openSync(file, 'wx', 0o600); } catch { throw new Error('Candidate launch lease exists or cannot be acquired; do not remove it or stop another client automatically'); }
  try { if (!productionReader) assertNoProductionReaders(root); }
  catch (error) { fs.closeSync(fd); fs.unlinkSync(file); throw error; }
  const identity = fs.fstatSync(fd); fs.writeFileSync(fd, JSON.stringify({ owner: 'opencode-stack', kind: 'candidate-launch', pid: process.pid, nonce: randomUUID() }) + '\n');
  return () => {
    try { const current = fs.lstatSync(file); assert(current.ino === identity.ino && current.dev === identity.dev && !current.isSymbolicLink(), 'Candidate lease changed; unknown file not removed'); fs.unlinkSync(file); }
    finally { fs.closeSync(fd); }
  };
}

export function interactiveEnvironment(profile, parent = process.env) {
  const env = generalEnvironment(profile, parent);
  // Ordinary managed use follows the native public model catalog. Keep the
  // frozen catalog for offline/schema checks and isolated migration candidates.
  // This does not enable runtime upgrades or change any agent's selected model.
  if (profile.storageBinding?.kind === 'production-native-storage') delete env.OPENCODE_DISABLE_MODELS_FETCH;
  for (const key of ['DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_SESSION_TYPE', 'XAUTHORITY', 'COLORTERM', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'VTE_VERSION', 'GNOME_TERMINAL_SERVICE', 'GNOME_TERMINAL_SCREEN', 'KITTY_WINDOW_ID', 'GHOSTTY_RESOURCES_DIR', 'TMUX']) if (parent[key]) env[key] = parent[key];
  return env;
}
export function serverEnvironment(profile, parent = process.env) {
  const env=interactiveEnvironment(profile,parent);
  if(profile.runtimeHome)Object.assign(env,libpqEnvironment(parent));
  return env;
}
export function terminalEnvironment(profile, connection, parent = process.env) {
  const url = new URL(connection.url);
  assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password && typeof connection.env.OPENCODE_PASSWORD === 'string', 'Owned native connection required');
  return { ...interactiveEnvironment(profile, parent), ...desktopBindings(parent), OPENCODE_PASSWORD: connection.env.OPENCODE_PASSWORD };
}

const addonPlugins = { context7: ['opencode-stack.context7-access'], knowledge: ['opencode-knowledge.engram', 'opencode-knowledge.runtime-env'], ticketing: ['opencode-ticketing.titles'],
  codegraph: ['opencode-codegraph.access'], playwright: ['opencode-stack.playwright-access'], documents: ['opencode-documents.native'], notifier: [] };
async function metadata(server, route) {
  const result = await server.request('GET', route);
  assert(result.status === 200, 'Native metadata query failed: ' + route);
  return decodeList(result.value);
}
async function inspectPlugins(server, plan, extraPlugins) {
  assert(Array.isArray(extraPlugins) && extraPlugins.every(id => typeof id === 'string'), 'Explicit owner plugin expectations required');
  const required = ['opencode-stack.env-guard', 'opencode-stack.controlled-permissions', 'opencode-stack.planner-shell', 'opencode-stack.agent-identity', 'opencode-stack.general', ...plan.components.flatMap(id => addonPlugins[id] ?? []), ...(plan.componentMetadata?.ticketing?.metrics ? ['opencode-ticketing.metrics'] : []), ...extraPlugins];
  const plugins = await until(async () => {
    const items = await metadata(server, '/api/plugin');
    return required.every(id => items.some(item => item.id === id)) ? items : undefined;
  }, 'Managed native plugins');
  assert(plugins.filter(item => item.source?.type !== 'builtin').every(item => required.includes(item.id)), 'Unexpected external native plugin');
  const disabledPlugins = plan.document.plugins.filter(plugin => typeof plugin === 'string' && plugin.startsWith('-')).map(plugin => plugin.slice(1));
  assert(!plugins.some(plugin => disabledPlugins.includes(plugin.id)), 'Disabled native plugin unexpectedly active');
  return { plugins, disabledPlugins };
}

// Production checks the safety contract, not service availability. Never
// query MCP/tool catalogs, create a diagnostic session, or await remote I/O
// from the launcher. The native host owns async connections and /mcps.
export async function inspectStartup(server, plan, { plugins: extraPlugins = [], expectations } = {}) {
  const { plugins } = await inspectPlugins(server, plan, extraPlugins);
  const agents = await metadata(server, '/api/agent');
  const options = plan.document.plugins.find(item => typeof item === 'object' && item.package.endsWith('/general/plugins/access'))?.options;
  assert(options?.requiredSystems && options.auditBaselines, 'Archived native guard expectations required');
  const { baselines, builtins, defaultAgent, sources = [], acceptedFinding = () => false } = expectations?.(agents) ?? {
    baselines: Object.fromEntries(Object.entries(options.auditBaselines).map(([id, baseline]) => [id, { ...baseline, system: options.requiredSystems[id] }])),
    builtins: options.builtinExpectations, defaultAgent: plan.document.default_agent,
  };
  const audit = auditEvidence({ sources, agents, plugins, baselines, builtinExpectations: builtins,
    directory: plan.project, config: path.join(plan.config, 'opencode'), managedTools: Object.keys(options.toolActors ?? {}), guards: options });
  const main = agents.find(agent => agent.id === defaultAgent);
  assert(main && ['primary', 'all'].includes(main.mode) && !main.hidden && main.model, 'Explicit visible default agent/model required');
  const blocking = audit.findings.filter(item => item.severity === 'error' || !acceptedFinding(item));
  return { readyForStartup: blocking.length === 0 };
}

export async function inspectLiveCandidate(server, plan, extension = {}) {
  const get = route => metadata(server, route);
  const extraPlugins=extension.plugins??[],extraMcp=extension.mcp??{};
  assert(Array.isArray(extraPlugins)&&extraPlugins.every(id=>typeof id==='string')&&!Object.keys(extraMcp).some(name=>Object.hasOwn(plan.document.mcp.servers,name)),'Explicit non-replacing owner startup extension required');
  const expectedServers={...plan.document.mcp.servers,...extraMcp};
  const { disabledPlugins } = await inspectPlugins(server, plan, extraPlugins);
  // Respect configured native startup/catalog windows,
  // instead of declaring a slow-but-within-contract connection failed at45s.
  const startupBudget = Math.max(45000,...Object.values(expectedServers).filter(server=>!server.disabled).map(server=>(server.timeout?.startup??0)+(server.timeout?.catalog??0)));
  const startupDeadline = Date.now() + startupBudget, expectedMcp = Object.keys(expectedServers);
  let mcp = await until(async () => {
    const items = await get('/api/mcp');
    return expectedMcp.every(name => items.some(item => item.name === name && !['pending', 'connecting'].includes(item.status?.status))) ? items : undefined;
  }, 'Candidate MCP startup metadata', startupBudget);
  assert(mcp.length === expectedMcp.length, 'Unexpected native MCP server; no normalization');
  const agents = await get('/api/agent');
  const specResult = await server.request('GET', '/openapi.json'); assert(specResult.status === 200, 'Native public API schema required');
  const dormantIDs = Object.keys(plan.document.providers ?? {}).filter(id => effect(plan.document.policies, 'provider.use', id) === 'deny');
  if (dormantIDs.length) {
    const entry = Object.entries(specResult.value.paths).find(([, methods]) => methods.get?.operationId === 'model.list');
    assert(entry, 'Native usable model catalog metadata required');
    const available = await get(entry[0]); assert(!available.some(model => dormantIDs.includes(model.providerID)), 'Dormant provider unexpectedly present in usable catalog; no partial chat');
  }
  const audit = await probeLiveAudit(server, plan, specResult.value, {
    deadline: startupDeadline,
    pending: async audit => {
      mcp = await get('/api/mcp');
      assert(mcp.length === expectedMcp.length && expectedMcp.every(name => mcp.some(item => item.name === name)), 'Native MCP set changed during catalog startup; no normalization');
      return pendingMcpCatalog(audit, expectedServers, mcp);
    },
  });
  const main = agents.find(agent => agent.id === plan.document.default_agent);
  assert(main && ['primary', 'all'].includes(main.mode) && !main.hidden && main.model, 'Explicit visible candidate primary/model required');
  const integrations = await get('/api/integration'), provider = main.model.providerID;
  const providerConnected = provider === 'openai' ? Boolean(integrations.find(item => item.id === provider)?.connections?.length) : undefined;
  const mcpStates = mcp.map(item => ({ name: item.name, status: item.status?.status }));
  const ready = audit.status === 'pass' && mcpStates.every(item => expectedServers[item.name].disabled || item.status === 'connected');
  return { public: { ready, readyForChat: ready && providerConnected !== false, auditStatus: audit.status, findings: audit.findings, roles: plan.roles.length, commands: plan.commands.length,
    registeredSkills: audit.skillIDs.length, registeredTools: audit.toolIDs.length, ...(audit.status!=='pass'?{registeredToolIDs:audit.toolIDs}:{}), mcp: mcpStates, providerConnected: providerConnected ?? 'custom configured provider; not a credential validity check',
    dormantProvidersChecked: dormantIDs, disabledDiscoveryPluginsChecked: disabledPlugins, diagnosticSessionRemoved: true, actualHierarchyAcceptance: false, modelRequestsIssuedByLauncher: 0, businessToolCallsIssuedByLauncher: 0 }, agent: main, audit };
}

async function probeLiveAudit(server, plan, spec, catalog) {
  const directory = path.join(plan.cache, 'general-runtime-probes');
  const agent = 'agent-design'; let sessionID;
  const operation = async (id, body) => {
    for (const [route, methods] of Object.entries(spec.paths)) for (const [method, value] of Object.entries(methods)) if (value.operationId === id) return server.request(method.toUpperCase(), route.replace('{sessionID}', sessionID), body);
    throw new Error('Required native metadata operation missing: ' + id);
  };
  try {
    const created = await server.request('POST', '/api/session', { agent, title: 'Candidate startup metadata probe', location: { directory: plan.project } });
    assert(created.status === 200 && /^ses_[A-Za-z0-9]+$/.test(created.value?.data?.id), 'Could not create owned diagnostic session'); sessionID = created.value.data.id;
    return await settleCatalogAudit(async () => {
      const nonce = randomUUID(), file = path.join(directory, nonce + '.json'); let receiptOwned = false;
      try {
        const invoked = await operation('session.command', { name: 'stack-runtime-probe', text: nonce });
        assert(invoked.status >= 200 && invoked.status < 300, 'Native metadata command failed; no model fallback');
        await until(() => fs.existsSync(file), 'Native runtime metadata receipt', 15000); noLinks(file);
        assert(fs.statSync(file).isFile() && fs.statSync(file).size < 1024 * 1024, 'Invalid runtime metadata receipt');
        let report; try { report = JSON.parse(fs.readFileSync(file)); } catch { throw new Error('Runtime metadata receipt invalid; raw values suppressed'); }
        assert(report.owner === 'opencode-stack' && report.kind === 'native-runtime-probe' && report.version === 1 && report.nonce === nonce && Array.isArray(report.audit?.toolIDs), 'Unexpected diagnostic receipt identity; unknown file retained'); receiptOwned = true;
        return report.audit;
      } finally {
        if (receiptOwned && fs.existsSync(file)) { noLinks(file); fs.unlinkSync(file); }
      }
    }, catalog.pending, { deadline: catalog.deadline });
  } finally {
    if (sessionID) { const removed = await operation('session.remove'); assert(removed.status >= 200 && removed.status < 300, 'Owned diagnostic session cleanup failed; no other session was removed'); }
  }
}

export async function runLiveCandidate(plan, runtime, action, options, callback) {
  launchConsent(action, options);
  assertNoPendingDistribution(plan.root);
  assert(!plan.storageBinding && plan.data === path.join(plan.home, '.local/share') && plan.state === path.join(plan.home, '.local/state'), 'Unbound candidate data/state required; storage reuse must be authorized by this invocation');
  if (action === 'chat') assert(typeof callback === 'function', 'Owned terminal callback required before candidate launch');
  assert(path.isAbsolute(runtime.binary) && runtime.version === '2.2.7' && runtime.sha256 === OFFICIAL_SHA256 && createHash('sha256').update(fs.readFileSync(runtime.binary)).digest('hex') === OFFICIAL_SHA256, 'Validated official native runtime required');
  checkCandidate(plan, runtime, { generalOnly: true });
  const release = acquireCandidateLease(plan.root); let server;
  try {
    // A distribution writer could have completed between preflight and lease.
    // Recheck the selected revision under the common lease before opening stores.
    assertNoPendingDistribution(plan.root); checkCandidate(plan, runtime, { generalOnly: true });
    const active = options.reuseV2Storage ? bindV2Storage(plan, existingV2Storage(options.stagingRoot), options) : plan;
    // All consent, integrity, source and snapshot checks precede native DB/MCP work.
    // MCP/OAuth desktop transport belongs on the server too, not only its TUI.
    server = await startOwnedServer(runtime.binary, active, serverEnvironment);
    const inspected = await inspectLiveCandidate(server, active);
    const report = { ...inspected.public, hostStarted: true, mcpStarted: Object.values(plan.document.mcp.servers).some(server => !server.disabled), storage: options.reuseV2Storage ? 'existing-native-v2-data-state' : 'candidate-isolated', globalDeployment: false };
    if (action === 'verify-live') return report;
    assert(report.readyForChat, 'Candidate startup/auth metadata is not ready; no automatic login, fallback or partial chat');
    const created = await server.request('POST', '/api/session', { agent: inspected.agent.id, model: inspected.agent.model, location: { directory: active.project } });
    assert(created.status === 200 && /^ses_[A-Za-z0-9]+$/.test(created.value?.data?.id), 'Could not create a fresh native candidate session');
    await callback({ active, connection: server.connection, sessionID: created.value.data.id, report });
    return report;
  } finally { try { await server?.close(); } finally { release(); } }
}

export async function runCandidateTerminal(runtime, active, connection, sessionID) {
  assert(process.stdin.isTTY && process.stdout.isTTY, 'Interactive candidate terminal required');
  assert(/^ses_[A-Za-z0-9]+$/.test(sessionID), 'Fresh native session ID required');
  const child = spawn(runtime.binary, ['--server', connection.url, '--session', sessionID], { cwd: active.project, env: terminalEnvironment(active, connection), stdio: 'inherit' });
  const forward = signal => { if (child.exitCode === null && child.signalCode === null) child.kill(signal); };
  const interrupt = () => forward('SIGINT'), terminate = () => forward('SIGTERM');
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  try { await new Promise((resolve, reject) => { child.once('error', () => reject(new Error('Could not start owned candidate terminal'))); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Candidate terminal closed without a clean exit'))); }); }
  finally { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); }
}
