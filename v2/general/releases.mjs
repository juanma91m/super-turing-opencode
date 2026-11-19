// Machine-bound configuration releases. No HOME/state/cache/DB/runtime backup,
// installer execution, network, source adoption, project writes or global cutover.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { assertCandidateRoot, generalPaths, noLinks } from './profile.mjs';
import { releaseStorePath } from './ownership.mjs';
import { acquireCandidateLease } from './launch.mjs';
import { nativeSources } from './audit.mjs';
import { generalEnvironment } from './profile.mjs';

const portableCatalog = JSON.parse(fs.readFileSync(new URL('./distribution.json', import.meta.url)));
assert(portableCatalog.contract === 'general-native/1', 'Portable distribution contract changed');

// A separate owner may reuse the filesystem engine with its OWN admission
// catalog/store contract. The default portable API remains closed and unchanged.
export function createReleaseManager(catalog) {
assert(catalog.schemaVersion === 1 && typeof catalog.contract === 'string' && /^[a-z][a-z0-9-]*\/1$/.test(catalog.contract) && catalog.nativeVersion === '2.2.7' && Array.isArray(catalog.components) && catalog.components.every(value => /^[a-z][a-z0-9-]*$/.test(value.id) && !['background','stitch'].includes(value.id)), 'Reviewed native distribution contract required');
assert(new Set(catalog.components.map(value=>value.id)).size===catalog.components.length,'Duplicate distribution owner');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const same = (a, b) => canonical(a) === canonical(b);
const MAX_FILES = 10000, MAX_BYTES = 512 * 1024 * 1024;
const markerName = '.general-candidate.json';
const idOK = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
const emptyState = () => ({ current: null, previous: null });
function syncDirectory(directory) { const fd = fs.openSync(directory, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function syncParents(directory, boundary) { while (directory.startsWith(boundary + path.sep) || directory === boundary) { syncDirectory(directory); if (directory === boundary) break; directory = path.dirname(directory); } }
function syncTree(directory) { for (const name of fs.readdirSync(directory)) { const file = path.join(directory, name); noLinks(file); if (fs.statSync(file).isDirectory()) syncTree(file); } syncDirectory(directory); }

function assetPath(relative) {
  assert(typeof relative === 'string' && relative && path.posix.normalize(relative) === relative && !relative.includes('\\') && !path.isAbsolute(relative) && !relative.split('/').some(part => part === '..' || part === '.' || part === ''), 'Confined release path required');
  assert(relative.startsWith('home/.config/opencode/') || relative.startsWith('bundle/'), 'Release may own only configuration and public bundles, never data/state/cache/project/runtime');
  for (const part of relative.split('/')) assert(!(part.startsWith('.env') && part !== '.env.example') && !['.git', '.ssh', '.gnupg', 'node_modules', 'stitch-api-key'].includes(part) && !/^(?:auth|credentials?|tokens?|secrets?)\.(?:json|jsonc|db|sqlite)$/i.test(part) && !/\.local\.(?:sh|json)$/.test(part), 'Private/operational release path refused');
  return relative;
}
function read(file, maximum = MAX_BYTES) {
  noLinks(file); const info = fs.statSync(file);
  assert(info.isFile() && info.nlink === 1 && info.size <= maximum && !(info.mode & 0o6022), 'Unsafe release file type, links, size or write permissions');
  return fs.readFileSync(file);
}
function json(file) {
  const bytes = read(file, 4 * 1024 * 1024);
  try { return JSON.parse(bytes); } catch { throw new Error('Invalid release metadata; raw values suppressed'); }
}
function write(file, bytes, replace = false, scratch) {
  noLinks(file); fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); noLinks(path.dirname(file));
  if (!replace) assert(!fs.existsSync(file), 'Unknown release destination already exists');
  if (scratch) { noLinks(scratch); fs.mkdirSync(scratch, { recursive: true, mode: 0o700 }); }
  const temporary = scratch ? path.join(scratch, randomUUID() + '.tmp') : file + '.' + randomUUID() + '.tmp';
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file); const directory = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
const writeJSON = (file, value, replace = false, scratch) => write(file, JSON.stringify(value, null, 2) + '\n', replace, scratch);
function hashesOK(hashes) {
  assert(hashes && typeof hashes === 'object' && !Array.isArray(hashes) && Object.keys(hashes).length > 0 && Object.keys(hashes).length <= MAX_FILES, 'Bounded release hashes required');
  for (const [file, hash] of Object.entries(hashes)) { assetPath(file); assert(idOK(hash), 'Release checksum shape invalid'); }
  topology(hashes);
}
function topology(hashes) {
  const files = Object.keys(hashes).sort();
  for (let index = 1; index < files.length; index++) assert(!files[index].startsWith(files[index - 1] + '/'), 'Release file/directory topology collision');
}
function deltaPreflight(root, before, after) {
  topology({ ...before, ...after });
  for (const relative of Object.keys(after)) if (!Object.hasOwn(before, relative)) { const file = path.join(root, relative); noLinks(file); assert(!fs.existsSync(file), 'New release path collides with unmanaged content; no read or adoption'); }
}
function marker(hashes) { return { owner: 'opencode-stack', kind: 'general-candidate', schemaVersion: 1, version: '2.2.7', hashes }; }
function installed(root) {
  const file = path.join(root, markerName); noLinks(file);
  if (!fs.existsSync(file)) { assert(!fs.existsSync(root) || fs.readdirSync(root).length === 0, 'Unowned/nonempty candidate; no adoption'); return null; }
  const value = json(file);
  assert(value.owner === 'opencode-stack' && value.kind === 'general-candidate' && value.schemaVersion === 1 && value.version === '2.2.7', 'Candidate marker identity differs');
  hashesOK(value.hashes); assert(same(value, marker(value.hashes)), 'Unexpected candidate marker fields');
  return value;
}
function verifyFiles(root, hashes) {
  let total = 0; const assets = new Map();
  for (const [relative, expected] of Object.entries(hashes)) {
    const bytes = read(path.join(root, assetPath(relative))); total += bytes.length;
    assert(total <= MAX_BYTES && sha(bytes) === expected, 'Managed release integrity drift; no backup, adoption or repair'); assets.set(relative, bytes);
  }
  return assets;
}
function publicConfig(document) {
  const walk = (value, keys = []) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (/(?:api[_-]?key|password|access[_-]?token|refresh[_-]?token|authorization|client[_-]?secret)$/i.test(key) && item !== null && item !== '') {
        const fixture = keys.join('.') === 'providers.workshop-mock.settings' && key === 'apiKey' && item === 'synthetic';
        assert(fixture || typeof item === 'string' && /^\{env:[A-Z_][A-Z0-9_]*\}$/.test(item), 'Literal credentials cannot be archived in a release');
      }
      walk(item, [...keys, key]);
    }
  };
  walk(document);
}
function releaseFromPlan(plan) {
  assertCandidateRoot(plan.root);
  const canonicalPaths = generalPaths(plan.root, plan.project);
  for (const [key, value] of Object.entries(canonicalPaths)) assert(plan[key] === value, 'Canonical unbound release paths required');
  generalEnvironment(plan); // Reject unreconciled transport/password env before writes.
  assert(!plan.storageBinding && plan.assets instanceof Map && plan.assets.size > 0 && plan.assets.size <= MAX_FILES, 'Unbound canonical asset plan required');
  assert(plan.components.every(id => catalog.components.some(component => component.id === id)), 'Distribution does not absorb private or unknown owner contributions');
  const files = new Map(), hashes = {}; let total = 0;
  for (const [file, value] of plan.assets) {
    assert(file.startsWith(plan.root + path.sep), 'Release asset outside target');
    const relative = assetPath(path.relative(plan.root, file)), bytes = Buffer.from(value); total += bytes.length;
    assert(total <= MAX_BYTES); files.set(relative, bytes); hashes[relative] = sha(bytes);
  }
  let document; try { document = JSON.parse(files.get('home/.config/opencode/opencode.json')); } catch { throw new Error('Native release document invalid; values suppressed'); }
  assert(same(document, plan.document), 'Plan document and native asset differ'); publicConfig(document);
  if(plan.baseRelease)assert(typeof plan.baseRelease.root==='string'&&path.isAbsolute(plan.baseRelease.root)&&idOK(plan.baseRelease.id),'Exact parent release binding required');
  const metadata = { roles: plan.roles, commands: plan.commands, components: plan.components, componentMetadata: plan.componentMetadata, ...(plan.runtimeHome ? { runtimeHome: plan.runtimeHome } : {}),...(plan.baseRelease?{baseRelease:plan.baseRelease}:{}) };
  publicConfig(metadata);
  hashesOK(hashes);
  const header = { schemaVersion: 1, owner: 'opencode-stack', kind: 'general-configuration-release', contract: catalog.contract, nativeVersion: catalog.nativeVersion, root: plan.root, metadata, hashes };
  return { ...header, id: sha(canonical(header)), files };
}
function owner(root) { return { schemaVersion: 1, owner: 'opencode-stack', kind: 'general-release-store', root, contract: catalog.contract, nativeVersion: catalog.nativeVersion }; }
function store(root, create = false) {
  assertCandidateRoot(root); const directory = releaseStorePath(root); noLinks(directory);
  if (!fs.existsSync(directory)) {
    if (!create) return null;
    const temporary = directory + '.' + randomUUID() + '.tmp'; fs.mkdirSync(temporary, { mode: 0o700 });
    try { fs.mkdirSync(path.join(temporary, 'releases'), { mode: 0o700 }); writeJSON(path.join(temporary, 'state.json'), emptyState()); writeJSON(path.join(temporary, 'owner.json'), owner(root)); syncTree(temporary); fs.renameSync(temporary, directory); syncDirectory(path.dirname(directory)); }
    finally { if (fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true }); }
  }
  assert(same(json(path.join(directory, 'owner.json')), owner(root)), 'Unowned or incompatible release store; no adoption');
  const state = json(path.join(directory, 'state.json'));
  assert(same(Object.keys(state).sort(), ['current', 'previous']) && [state.current, state.previous].every(id => id === null || idOK(id)), 'Release state invalid');
  return { directory, state, journal: path.join(directory, 'transaction.json') };
}
function load(root, id) {
  assert(idOK(id), 'Exact revision checksum required'); const selected = store(root); assert(selected, 'Release store missing');
  const directory = path.join(selected.directory, 'releases', id), header = json(path.join(directory, 'release.json'));
  const { id: storedID, ...identity } = header;
  assert(storedID === id && sha(canonical(identity)) === id && identity.root === root && identity.owner === 'opencode-stack' && identity.kind === 'general-configuration-release' && identity.schemaVersion === 1 && identity.contract === catalog.contract && identity.nativeVersion === catalog.nativeVersion, 'Release identity, target binding or checksum differs');
  hashesOK(header.hashes);
  let entries = 0;
  const inventory = folder => { noLinks(folder); for (const name of fs.readdirSync(folder)) {
    assert(++entries < MAX_FILES * 5, 'Release inventory limit exceeded'); const file = path.join(folder, name); noLinks(file);
    if (fs.statSync(file).isDirectory()) inventory(file);
    else { const relative = path.relative(directory, file); assert(relative === 'release.json' || relative.startsWith('files/') && Object.hasOwn(header.hashes, relative.slice(6)), 'Unknown release payload; no adoption'); }
  } }; inventory(directory);
  assert(header.metadata && Array.isArray(header.metadata.roles) && Array.isArray(header.metadata.commands) && Array.isArray(header.metadata.components) && header.metadata.components.every(component => catalog.components.some(value => value.id === component)), 'Release metadata contract differs');
  const files = verifyFiles(path.join(directory, 'files'), header.hashes);
  let document; try { document = JSON.parse(files.get('home/.config/opencode/opencode.json')); } catch { throw new Error('Archived native document invalid; values suppressed'); } publicConfig(document);
  return { ...header, files };
}
function save(root, release) {
  const selected = store(root, true), target = path.join(selected.directory, 'releases', release.id); noLinks(target);
  if (fs.existsSync(target)) { assert(same(load(root, release.id).hashes, release.hashes), 'Existing release differs'); return; }
  const temporary = path.join(selected.directory, 'releases', '.stage-' + randomUUID()); fs.mkdirSync(temporary, { mode: 0o700 });
  try {
    for (const [relative, bytes] of release.files) write(path.join(temporary, 'files', relative), bytes);
    const { files, ...header } = release; writeJSON(path.join(temporary, 'release.json'), header); syncTree(temporary); fs.renameSync(temporary, target); syncDirectory(path.dirname(target));
  } finally { if (fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true }); }
  load(root, release.id); // Full published copy verification before any target edit.
}
function extraConfig(root, hashes) {
  const directory = path.join(root, 'home/.config/opencode'); if (!fs.existsSync(directory)) return;
  const walk = folder => { noLinks(folder); for (const name of fs.readdirSync(folder)) {
    const file = path.join(folder, name); noLinks(file);
    if (fs.statSync(file).isDirectory()) walk(file);
    else assert(Object.hasOwn(hashes, path.relative(root, file)), 'Unmanaged candidate configuration present; no silent preservation or deletion');
  } }; walk(directory);
}
function leaseAbsent(root) { const file = path.join(root, '.candidate-launch.lock'); noLinks(file); assert(!fs.existsSync(file), 'Active or unreconciled candidate lease; no distribution writes'); }
function consent(options, confirmation = false) {
  assert(options?.candidateOnly === true && options.clientClosed === true, 'Distribution writes require --candidate-only --client-closed');
  if (confirmation) assert(options.confirm === true, 'Restoration requires explicit --confirm');
  assert(typeof options.validate === 'function', 'Native validation callback required; no skip-check mode');
  assert(options.validate.constructor.name !== 'AsyncFunction', 'Synchronous native validator required by this filesystem protocol');
}
function validate(plan, options) { const result = options.validate(plan); assert(!result || typeof result.then !== 'function', 'Synchronous native validation must finish before commit'); }
function planOf(root, release, project) {
  const paths = generalPaths(root, project), document = JSON.parse(release.files.get('home/.config/opencode/opencode.json'));
  return { ...paths, ...release.metadata, document, assets: new Map([...release.files].map(([relative, bytes]) => [path.join(root, relative), bytes])) };
}
function journal(root, value) {
  assert(value?.schemaVersion === 1 && same(Object.keys(value).sort(), ['from', 'kind', 'owner', 'prior', 'root', 'schemaVersion', 'to']) && same(Object.keys(value.prior ?? {}).sort(), ['current', 'previous']) && value.root === root && value.kind === 'general-release-transaction' && value.owner === 'opencode-stack' && idOK(value.to) && value.from === value.prior?.current && [value.from, value.prior?.previous].every(id => id === null || idOK(id)), 'Distribution journal invalid; no automatic reconstruction');
  return value;
}
function partial(root, from, to) {
  const before = from?.hashes ?? {}, after = to.hashes;
  for (const relative of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const file = path.join(root, relative); noLinks(file);
    if (!fs.existsSync(file)) { assert(!before[relative] || !after[relative], 'Missing shared asset is not a known partial state'); continue; }
    const current = sha(read(file)); assert(current === before[relative] || current === after[relative], 'Unknown edit during pending transaction; recovery refused');
  }
  extraConfig(root, { ...before, ...after });
  const file = path.join(root, markerName);
  if (fs.existsSync(file)) { const current = json(file); assert(same(current, marker(before)) || same(current, marker(after)), 'Unknown marker during transaction; recovery refused'); }
  else assert(!from, 'Installed marker unexpectedly missing');
}
function apply(root, from, to) {
  for (const relative of ['home', 'home/.config', 'home/.local/share', 'home/.local/state', 'home/.cache', 'tmp']) { const directory = path.join(root, relative); noLinks(directory); fs.mkdirSync(directory, { recursive: true, mode: 0o700 }); syncParents(directory, root); }
  const scratch = path.join(releaseStorePath(root), 'scratch');
  const union = new Set([...Object.keys(from?.hashes ?? {}), ...Object.keys(to.hashes)]);
  for (const relative of union) {
    const file = path.join(root, relative); noLinks(file);
    if (to.files.has(relative)) { const bytes = to.files.get(relative); if (!fs.existsSync(file) || !read(file).equals(bytes)) write(file, bytes, true, scratch); }
    else if (fs.existsSync(file)) fs.unlinkSync(file); // Exact previously owned path, preflighted above.
    syncParents(path.dirname(file), root);
  }
  writeJSON(path.join(root, markerName), marker(to.hashes), true, scratch);
}
function commit(root, transaction, to, state) {
  const selected = store(root); verifyFiles(root, to.hashes); assert(same(json(path.join(root, markerName)), marker(to.hashes)), 'Installed marker failed final comparison');
  writeJSON(path.join(selected.directory, 'state.json'), state, true); fs.unlinkSync(selected.journal); syncDirectory(selected.directory);
  return { revision: to.id, previous: state.previous, configurationChanged: transaction.from !== transaction.to, hostStarted: false, storageRestored: false, dependencyRuntimesChanged: false, globalDeployment: false };
}

function distributionStatus(root) {
  assertCandidateRoot(root); const selected = store(root);
  if (!selected) return { status: 'not-distributed', hostStarted: false, writesPerformed: 0 };
  if (fs.existsSync(selected.journal)) { const pending = journal(root, json(selected.journal)); return { status: 'recovery-required', from: pending.from, to: pending.to, hostStarted: false, writesPerformed: 0 }; }
  const current = selected.state.current ? load(root, selected.state.current) : null;
  if (selected.state.previous) load(root, selected.state.previous);
  if (current) { const value = installed(root); assert(value && same(value.hashes, current.hashes), 'Installed release marker and state differ'); verifyFiles(root, current.hashes); extraConfig(root, current.hashes); }
  return { status: current ? 'installed' : 'not-installed', current: selected.state.current, previous: selected.state.previous, hostStarted: false, writesPerformed: 0 };
}
function previewDistribution(plan) {
  const release = releaseFromPlan(plan); let status = distributionStatus(plan.root), before = {};
  if (status.status === 'installed') before = load(plan.root, status.current).hashes;
  else if (status.status === 'not-distributed' && fs.existsSync(plan.root)) {
    const legacy = installed(plan.root);
    if (legacy) { verifyFiles(plan.root, legacy.hashes); extraConfig(plan.root, legacy.hashes); before = legacy.hashes; status = { ...status, status: same(before, release.hashes) ? 'legacy-ready-to-adopt' : 'legacy-reconciliation-required' }; }
  }
  const delta = { added: Object.keys(release.hashes).filter(file => !Object.hasOwn(before, file)).length, changed: Object.keys(release.hashes).filter(file => before[file] && before[file] !== release.hashes[file]).length, removed: Object.keys(before).filter(file => !Object.hasOwn(release.hashes, file)).length };
  return { ...status, desired: release.id, delta, managedFiles: release.files.size, machineBound: true, contract: catalog.contract, globalDeployment: false };
}
function releaseHistory(root) {
  const selected = store(root); if (!selected) return { revisions: [], stagedDirectories: 0, hostStarted: false, writesPerformed: 0 };
  const names = fs.readdirSync(path.join(selected.directory, 'releases')).sort();
  const revisions = names.filter(idOK).map(id => { const release = load(root, id); return { id, current: id === selected.state.current, previous: id === selected.state.previous, nativeVersion: release.nativeVersion, managedFiles: release.files.size, components: release.metadata.components }; });
  assert(names.every(name => idOK(name) || name.startsWith('.stage-')), 'Unknown release inventory entry; no adoption or pruning');
  return { revisions, stagedDirectories: names.filter(name => name.startsWith('.stage-')).length, pending: fs.existsSync(selected.journal), hostStarted: false, writesPerformed: 0 };
}
function installRelease(plan, options) {
  consent(options); const desired = releaseFromPlan(plan), root = plan.root;
  leaseAbsent(root); const selected = store(root); assert(!selected || !fs.existsSync(selected.journal), 'Pending distribution transaction; recover explicitly');
  const observedState = selected?.state ?? emptyState();
  let from = null;
  if (selected?.state.current) { from = load(root, selected.state.current); const value = installed(root); assert(value && same(value.hashes, from.hashes), 'Installed state differs'); verifyFiles(root, from.hashes); extraConfig(root, from.hashes); }
  else {
    const legacy = installed(root);
    if (legacy) { assert(same(legacy.hashes, desired.hashes), 'Legacy candidate differs from this exact plan; no implicit baseline adoption'); verifyFiles(root, legacy.hashes); extraConfig(root, legacy.hashes); from = desired; }
  }
  deltaPreflight(root, from?.hashes ?? {}, desired.hashes); partial(root, from, desired);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 }); const releaseLease = acquireCandidateLease(root);
  try {
    const activeStore = store(root, true);
    assert(same(activeStore.state, observedState) && !fs.existsSync(activeStore.journal), 'Distribution changed before lease acquisition; retry explicit planning');
    if (from) { assert(same(installed(root)?.hashes, from.hashes), 'Candidate changed before lease acquisition'); verifyFiles(root, from.hashes); }
    partial(root, from, desired);
    if (from) save(root, from); save(root, desired);
    if (from?.id === desired.id) {
      validate(plan, options);
      writeJSON(path.join(activeStore.directory, 'state.json'), { current: desired.id, previous: activeStore.state.previous }, true);
      return { revision: desired.id, previous: activeStore.state.previous, configurationChanged: false, hostStarted: false, storageRestored: false, dependencyRuntimesChanged: false, globalDeployment: false };
    }
    const transaction = { schemaVersion: 1, owner: 'opencode-stack', kind: 'general-release-transaction', root, from: from?.id ?? null, to: desired.id, prior: { current: from?.id ?? null, previous: activeStore.state.previous } };
    writeJSON(activeStore.journal, transaction);
    partial(root, from, desired); apply(root, from, desired); validate(plan, options);
    return commit(root, transaction, desired, { current: desired.id, previous: from?.id ?? null });
  } finally { releaseLease(); }
}
function restoreRelease(root, id, project, options) {
  consent(options, true); generalPaths(root, project); leaseAbsent(root); const selected = store(root); assert(selected?.state.current && !fs.existsSync(selected.journal), 'Installed clean distribution required; recover a pending transaction first');
  const from = load(root, selected.state.current), to = load(root, id); const value = installed(root);
  generalEnvironment(planOf(root, to, project));
  assert(value && same(value.hashes, from.hashes), 'Installed state differs'); verifyFiles(root, from.hashes); extraConfig(root, from.hashes);
  deltaPreflight(root, from.hashes, to.hashes); partial(root, from, to);
  const releaseLease = acquireCandidateLease(root);
  try {
    const current = store(root); assert(same(current.state, selected.state) && !fs.existsSync(current.journal), 'Distribution changed before lease acquisition; retry restoration');
    verifyFiles(root, from.hashes); partial(root, from, to);
    if (from.id === to.id) { validate(planOf(root, to, project), options); return { revision: to.id, previous: selected.state.previous, configurationChanged: false, hostStarted: false, storageRestored: false, dependencyRuntimesChanged: false, globalDeployment: false }; }
    const transaction = { schemaVersion: 1, owner: 'opencode-stack', kind: 'general-release-transaction', root, from: from.id, to: to.id, prior: selected.state };
    writeJSON(selected.journal, transaction); partial(root, from, to); apply(root, from, to); validate(planOf(root, to, project), options);
    return commit(root, transaction, to, { current: to.id, previous: from.id });
  } finally { releaseLease(); }
}
function recoverRelease(root, direction, project, options) {
  consent(options, true); generalPaths(root, project); assert(['previous', 'target'].includes(direction), 'Choose previous or target explicitly'); leaseAbsent(root);
  const selected = store(root); assert(selected && fs.existsSync(selected.journal), 'No pending distribution transaction');
  const transaction = journal(root, json(selected.journal)), from = transaction.from ? load(root, transaction.from) : null, to = load(root, transaction.to);
  assert(direction !== 'previous' || from, 'First install has no previous revision; explicit target completion required');
  partial(root, from, to); const destination = direction === 'previous' ? from : to, releaseLease = acquireCandidateLease(root);
  try {
    assert(fs.existsSync(selected.journal) && same(json(selected.journal), transaction), 'Pending operation changed before lease acquisition'); partial(root, from, to);
    generalEnvironment(planOf(root, destination, project));
    // apply uses the union for both directions; all partial bytes were verified.
    apply(root, direction === 'previous' ? to : from, destination); validate(planOf(root, destination, project), options);
    return commit(root, transaction, destination, direction === 'previous' ? transaction.prior : { current: to.id, previous: from?.id ?? null });
  } finally { releaseLease(); }
}
function installedPlan(root, project) {
  const status = distributionStatus(root); assert(status.status === 'installed', 'Clean installed revision required; no implicit prepare or recovery');
  const release = load(root, status.current); return planOf(root, release, project);
}
function validateReleaseSchema(plan, runtime) {
  fs.mkdirSync(plan.tmp, { recursive: true, mode: 0o700 }); noLinks(plan.tmp);
  const directory = fs.mkdtempSync(path.join(plan.tmp, 'release-schema-'));
  try { nativeSources(runtime.binary, directory, path.join(plan.config, 'opencode'), generalEnvironment(plan)); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
function releasePlan(root,id,project) { return planOf(root,load(root,id),project); }
return {distributionStatus,previewDistribution,releaseHistory,installRelease,restoreRelease,recoverRelease,installedPlan,releasePlan,validateReleaseSchema};
}
export const {distributionStatus,previewDistribution,releaseHistory,installRelease,restoreRelease,recoverRelease,installedPlan,releasePlan,validateReleaseSchema}=createReleaseManager(portableCatalog);
