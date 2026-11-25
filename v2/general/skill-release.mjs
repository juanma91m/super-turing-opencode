// A content release never replaces the checked base, its owner pins or runtimes.
// Existing hosts retain the config directory they were started with.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { generalEnvironment, generalPaths, noLinks } from './profile.mjs';
import { nativeSources } from './audit.mjs';
import { acquireCandidateLease } from './launch.mjs';
import { createReleaseManager } from './releases.mjs';

const relativeConfig = 'home/.config/opencode';
const skillFile = /^skills\/(?:[a-z0-9-]+\/){1,6}SKILL\.md$/;
const idOK = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
const nonceOK = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
const sha = value => createHash('sha256').update(value).digest('hex');
const configDir = plan => path.join(plan.config, 'opencode');
const configAssets = plan => new Map([...plan.assets].filter(([file]) => file.startsWith(configDir(plan) + path.sep))
  .map(([file, bytes]) => [path.relative(configDir(plan), file), bytes]));
const releaseManager = plan => createReleaseManager({ schemaVersion: 1, contract: 'skill-content/1', nativeVersion: '2.2.7', components: plan.components.map(id => ({ id })) });
function store(plan) {
  const baseline = sha(JSON.stringify([...plan.assets].map(([file, bytes]) => [file, sha(bytes)]).sort(([a], [b]) => a.localeCompare(b))));
  return path.join(path.dirname(plan.root), '.' + path.basename(plan.root) + '-skill-content', baseline);
}

function privateInfo(file, directory) {
  noLinks(file);
  const info = fs.lstatSync(file);
  assert(info.uid === process.getuid() && !(info.mode & 0o077) && (directory ? info.isDirectory() : info.isFile() && info.nlink === 1 && info.size < 4096), 'Private skill release store required');
}
function pointer(root) {
  const file = path.join(root, 'current.json');
  try { privateInfo(file, false); }
  catch (error) { if (error.code === 'ENOENT') return { current: null, previous: null }; throw error; }
  privateInfo(root, true);
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('Invalid skill release pointer; values suppressed'); }
  assert(value && Object.keys(value).sort().join(',') === 'current,previous' && [value.current, value.previous].every(ref => ref === null || (ref && Object.keys(ref).sort().join(',') === 'directory,id' && nonceOK(ref.directory) && idOK(ref.id))), 'Invalid skill release pointer');
  return value;
}
function writePointer(root, value) {
  const temporary = path.join(root, randomUUID() + '.tmp');
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, path.join(root, 'current.json'));
  const folder = fs.openSync(root, 'r'); try { fs.fsyncSync(folder); } finally { fs.closeSync(folder); }
}

function checkBody(file, before, after) {
  assert(skillFile.test(file) && Buffer.isBuffer(before) && Buffer.isBuffer(after) && after.length <= 256 * 1024, 'Only bodies of existing managed skills can change');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(after);
  const original = before.toString('utf8'), boundary = original.indexOf('\n---\n', 4) + 5;
  assert(original.startsWith('---\n') && boundary > 5 && text.slice(0, boundary) === original.slice(0, boundary) && text.slice(boundary).trim() && !text.includes('\0'), 'Skill frontmatter must remain byte-identical and body nonempty');
}
function withAuditPath(document, before, after) {
  const updated = structuredClone(document);
  for (const plugin of updated?.plugins ?? []) {
    if (typeof plugin !== 'object' || !plugin.package?.endsWith('/general/plugins/access')) continue;
    assert(plugin.options?.profileConfig === before, 'Unexpected managed audit path');
    plugin.options.profileConfig = after;
  }
  return updated;
}

export function skillEnvironment(env, selected) {
  return selected ? { ...env, XDG_CONFIG_HOME: path.dirname(selected.directory), OPENCODE_CONFIG_DIR: selected.directory } : env;
}
function nativeCheck(runtime, plan, selected) {
  const env = generalEnvironment(plan), original = configDir(plan);
  const before = nativeSources(runtime.binary, plan.project, original, env).entries;
  const after = nativeSources(runtime.binary, plan.project, selected.directory, skillEnvironment(env, selected)).entries;
  const expected = before.map(entry => entry.path === original ? { ...entry, path: selected.directory }
    : entry.path === path.join(original, 'opencode.json') ? { ...entry, path: path.join(selected.directory, 'opencode.json'), info: withAuditPath(entry.info, original, selected.directory) } : entry);
  assert.deepEqual(sha(JSON.stringify(after)), sha(JSON.stringify(expected)), 'Native sources changed beyond the verified global skill config');
}

function openVariant(plan, root, ref) {
  const target = path.join(root, ref.directory); privateInfo(target, true);
  const manager = releaseManager(plan), variant = manager.installedPlan(target, plan.project);
  assert(manager.distributionStatus(target).current === ref.id, 'Skill release pointer and archive differ');
  const before = configAssets(plan), after = configAssets(variant), directory = configDir(variant);
  assert(variant.assets.size === after.size && before.size === after.size, 'Skill release cannot add/remove config or bundle files');
  for (const key of ['roles', 'commands', 'components', 'componentMetadata', 'runtimeHome', 'baseRelease']) assert.deepEqual(variant[key], plan[key], 'Skill release metadata changed: ' + key);
  assert.deepEqual(sha(JSON.stringify(variant.document)), sha(JSON.stringify(withAuditPath(plan.document, configDir(plan), directory))), 'Skill release native config changed outside the audit path');
  for (const [file, bytes] of before) {
    assert(after.has(file), 'Managed config omitted from skill release');
    if (file !== 'opencode.json' && !after.get(file).equals(bytes)) checkBody(file, bytes, after.get(file));
  }
  const selected = { id: ref.id, directory, verify: (runtime, checkedPlan) => nativeCheck(runtime, checkedPlan, selected) };
  return selected;
}

export function selectSkills(plan) {
  if (!(plan.assets instanceof Map)) return null;
  const root = store(plan), ref = pointer(root).current;
  return ref ? openVariant(plan, root, ref) : null;
}

export function publishSkills(plan, changes, validate) {
  assert(changes instanceof Map && changes.size > 0 && typeof validate === 'function' && validate.constructor.name !== 'AsyncFunction', 'Explicit skill changes and offline native validation required');
  const original = configAssets(plan);
  for (const [file, bytes] of changes) checkBody(file, original.get(file), bytes);
  const root = store(plan); noLinks(root); fs.mkdirSync(root, { recursive: true, mode: 0o700 }); privateInfo(root, true);
  const release = acquireCandidateLease(root);
  try {
    const { current } = pointer(root), directory = randomUUID(), target = path.join(root, directory);
    const paths = generalPaths(target, plan.project), next = { ...plan, ...paths, assets: new Map() };
    const prior = current ? openVariant(plan, root, current) : null;
    for (const [file, bytes] of original) {
      const priorBytes = prior && skillFile.test(file) ? fs.readFileSync(path.join(prior.directory, file)) : bytes;
      next.assets.set(path.join(target, relativeConfig, file), changes.get(file) ?? priorBytes);
    }
    next.document = withAuditPath(plan.document, configDir(plan), configDir(next));
    next.assets.set(path.join(target, relativeConfig, 'opencode.json'), Buffer.from(JSON.stringify(next.document, null, 2) + '\n'));
    const manager = releaseManager(plan);
    const installed = manager.installRelease(next, { candidateOnly: true, clientClosed: true, validate: () => validate({ directory: configDir(next), verify: (runtime, checkedPlan) => nativeCheck(runtime, checkedPlan, { directory: configDir(next) }) }) });
    const ref = { directory, id: installed.revision }; openVariant(plan, root, ref);
    writePointer(root, { current: ref, previous: current });
    return ref.id;
  } finally { release(); }
}

export function rollbackSkills(plan, expected) {
  const root = store(plan), release = acquireCandidateLease(root);
  try {
    const { current, previous } = pointer(root);
    assert(current && current.id === expected, 'Skill release advanced; no blind rollback');
    if (previous) openVariant(plan, root, previous);
    writePointer(root, { current: previous, previous: current });
  } finally { release(); }
}
