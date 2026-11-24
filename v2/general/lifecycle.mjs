// Candidate-only, non-deploying lifecycle: no prepare on status/check, no PATH
// runtime fallback, no MCP/model/session/auth startup or original storage access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { noLinks, generalEnvironment } from './profile.mjs';
import { nativeSources } from './audit.mjs';
import { assertNoPendingDistribution } from './ownership.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const OFFICIAL_SHA256 = '589253d36810f21217edd51545cd435b328cdc3cf4f451fbe0cce6f88afcf5e1';
export function officialRuntime(root) {
  const existing = path.basename(root) === 'opencode-v2-clean';
  assert(path.isAbsolute(root) && path.resolve(root) === root && (existing || path.basename(root) === 'opencode-runtime'), 'Explicit official runtime root required');
  // Existing V2 settings keep their recorded runtime identity; no marker rewrite.
  const marker = path.join(root, existing ? '.stack-v2-migration.json' : '.stack-runtime.json'), recordFile = path.join(root, 'runtime.json'); noLinks(marker); noLinks(recordFile);
  let owner, record;
  try { owner = JSON.parse(fs.readFileSync(marker)); record = JSON.parse(fs.readFileSync(recordFile)); } catch { throw new Error('Official runtime metadata invalid; values suppressed'); }
  assert(owner?.owner === 'opencode-stack' && owner.kind === (existing ? 'v2-clean-staging' : 'official-native-runtime') && owner.schemaVersion === 1 && owner.version === '2.2.7', 'Official runtime identity differs');
  assert(record?.package === '@opencode/cli@2.2.7' && record.version === 'opencode v2.2.7' && record.sha256 === OFFICIAL_SHA256 && typeof record.binary === 'string' && path.isAbsolute(record.binary), 'Official runtime pin differs; no update/download attempted');
  const prefix = path.join(root, 'npm'); noLinks(prefix);
  const actual = fs.realpathSync(path.join(prefix, 'bin/opencode'));
  assert(actual === record.binary && actual.startsWith(prefix + path.sep), 'Runtime entrypoint escaped the selected official installation'); noLinks(actual);
  assert(fs.statSync(actual).isFile() && digest(fs.readFileSync(actual)) === OFFICIAL_SHA256, 'Official runtime bytes changed; no adoption or repair');
  return { binary: actual, version: '2.2.7', sha256: OFFICIAL_SHA256 };
}

export function candidateStatus(plan) {
  const marker = path.join(plan.root, '.general-candidate.json'); noLinks(marker);
  const lease = path.join(plan.root, '.candidate-launch.lock'); noLinks(lease);
  if (!fs.existsSync(marker)) {
    assert(!fs.existsSync(plan.root) || fs.readdirSync(plan.root).length === 0, 'Unowned candidate directory; no adoption');
    return { status: 'not-prepared', managedAssets: plan.assets.size, writesPerformed: 0, hostStarted: false };
  }
  let prior;
  try { prior = JSON.parse(fs.readFileSync(marker)); } catch { throw new Error('Candidate marker invalid; raw values suppressed'); }
  assert(prior?.owner === 'opencode-stack' && prior.kind === 'general-candidate' && prior.schemaVersion === 1 && prior.version === '2.2.7' && prior.hashes && typeof prior.hashes === 'object' && !Array.isArray(prior.hashes), 'Candidate identity differs');
  const allowed = new Map([...plan.assets].map(([file, bytes]) => [path.relative(plan.root, file), digest(bytes)]));
  let drifted = 0, missing = 0, outdated = 0;
  for (const [relative, expected] of allowed) {
    const file = path.join(plan.root, relative); noLinks(file);
    if (!fs.existsSync(file)) { missing++; continue; }
    assert(fs.statSync(file).isFile(), 'Managed candidate asset is not regular');
    const actual = digest(fs.readFileSync(file));
    if (actual !== expected) { if (actual === prior.hashes[relative]) outdated++; else drifted++; }
    else if (prior.hashes[relative] !== expected) outdated++;
  }
  const obsolete = Object.keys(prior.hashes).filter(relative => !allowed.has(relative)).length;
  // Never read unknown files (including dotenv); names/types only. Global
  // candidate customization belongs to the managed plan, project deltas to repo.
  let unknownConfigFiles = 0;
  const config = path.join(plan.config, 'opencode');
  const walk = directory => {
    noLinks(directory);
    for (const name of fs.readdirSync(directory)) {
      const file = path.join(directory, name), info = fs.lstatSync(file);
      assert(!info.isSymbolicLink(), 'Unreviewed candidate configuration symlink');
      if (name === 'node_modules') { unknownConfigFiles++; continue; }
      if (info.isDirectory()) walk(file);
      else if (!allowed.has(path.relative(plan.root, file))) unknownConfigFiles++;
    }
  };
  if (fs.existsSync(config)) walk(config);
  return { status: drifted || missing || obsolete || unknownConfigFiles ? 'drift' : outdated ? 'needs-prepare' : 'ready-assets',
    managedAssets: allowed.size, drifted, missing, obsolete, unknownConfigFiles, outdated, launchLeasePresent: fs.existsSync(lease), writesPerformed: 0, hostStarted: false };
}

export function snapshotReadiness(directory) {
  assert(path.isAbsolute(directory), 'Explicit snapshot scope required'); noLinks(directory);
  const env = { PATH: '/usr/bin:/bin', HOME: '/tmp/opencode', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const run = (args,input) => spawnSync('/usr/bin/git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: directory, env, input, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  const root = run(['rev-parse', '--show-toplevel']);
  if (root.status !== 0) {
    assert(!root.error, 'Git snapshot scope probe failed; cannot certify readiness');
    let ancestor = directory;
    while (ancestor !== path.dirname(ancestor)) {
      assert(!fs.existsSync(path.join(ancestor, '.git')), 'Existing Git metadata could not be validated; do not treat it as a non-Git directory');
      ancestor = path.dirname(ancestor);
    }
    return { gitWorktree: false, fileUndoAvailable: false, sensitiveCandidates: 0, metadataOnly: true, limitation: 'Conversation rollback only outside Git; no filesystem snapshot guarantee' };
  }
  // Tracked files plus non-ignored untracked files in this active directory.
  // No contents, diff filters, hooks, credential lookups or network operations.
  const files = run(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.']);
  assert(!files.error && files.status === 0, 'Snapshot candidate inventory failed; raw output suppressed');
  const sensitive = [];
  for (const file of files.stdout.split('\0').filter(Boolean)) {
    const parts = file.split('/'), name = parts.at(-1);
    if (name.startsWith('.env') && name !== '.env.example' || parts.some(part => ['.ssh', '.gnupg'].includes(part)) || /^(?:auth|credentials?|tokens?|secrets?)\.(?:json|jsonc|db|sqlite)$/i.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name)) sensitive.push(file);
  }
  // Official2.2.7 Git.index.ignored uses --no-index: explicit source exclusions
  // protect tracked updates too. Do not invent a private capture filter or read
  // these files to classify certificates/keys. Non-excluded candidates still block.
  const ignored=new Set();
  if(sensitive.length){const checked=run(['check-ignore','--no-index','--stdin','-z'],sensitive.join('\0')+'\0');assert(!checked.error&&[0,1].includes(checked.status),'Snapshot exclusion metadata probe failed; cannot certify readiness');for(const file of checked.stdout.split('\0').filter(Boolean)){assert(sensitive.includes(file),'Unexpected snapshot exclusion output');ignored.add(file);}}
  return { gitWorktree: true, fileUndoAvailable: true, sensitiveCandidates:sensitive.filter(file=>!ignored.has(file)).length, ignoredSensitiveCandidates:ignored.size, sensitiveInventoryCandidates:sensitive.length, metadataOnly: true,
    limitation: 'Filename screening and native Git exclusions only, not secret detection, history erasure or a snapshot sandbox. Seeded snapshots may reference existing source Git objects; excluded working-tree updates are not captured.' };
}

export function runtimeOnlyPrefix(directory, home) {
  if(!home||directory!==path.join(home,'.opencode'))return false;
  noLinks(directory);
  // CLI installation prefix is not a project overlay. These exact housekeeping
  // names are not native config/autoload surfaces; any other entry still fails.
  return fs.readdirSync(directory).every(name=>{
    if(!['bin','.gitignore','.opencode-background-addon.json'].includes(name))return false;
    const info=fs.lstatSync(path.join(directory,name));return !info.isSymbolicLink()&&(name==='bin'?info.isDirectory():info.isFile());
  });
}
export function checkCandidate(plan, runtime, { generalOnly = false, sourceGuard } = {}) {
  assertNoPendingDistribution(plan.root);
  const status = candidateStatus(plan); assert(status.status === 'ready-assets', 'Prepare the candidate explicitly after client closure; offline check never reconciles it');
  assert(!sourceGuard||typeof sourceGuard==='function'&&sourceGuard.constructor.name!=='AsyncFunction'&&!generalOnly,'Synchronous owner source guard is separate from the unchanged general-only contract');
  if(sourceGuard){const before=sourceGuard({phase:'before',plan});assert(!before||typeof before.then!=='function','Source preflight must finish before native parsing');}
  if (generalOnly) {
    // Reject local config by names/types BEFORE invoking the native parser:
    // unreviewed JSON could contain file interpolation, not just a plugin.
    let directory = plan.project;
    while (true) {
      for (const name of ['opencode.json', 'opencode.jsonc']) assert(!fs.existsSync(path.join(directory, name)), 'Unreviewed executable configuration layer; port its native owner before general-only launch');
      const local = path.join(directory, '.opencode');
      if (fs.existsSync(local)) {
        noLinks(local); assert(fs.statSync(local).isDirectory(), 'Local configuration directory requires review');
        assert(runtimeOnlyPrefix(local,plan.runtimeHome)||fs.readdirSync(local).every(name => name === 'AGENTS.md'), 'Unreviewed local executable assets; native discovery remains enabled');
        if (fs.existsSync(path.join(local, 'AGENTS.md'))) noLinks(path.join(local, 'AGENTS.md'));
      }
      if (directory === path.dirname(directory)) break;
      directory = path.dirname(directory);
    }
  }
  const snapshots = snapshotReadiness(plan.project);
  assert(snapshots.sensitiveCandidates === 0, 'Potential sensitive snapshot candidates; reconcile tracked/ignore policy before native launch. No file contents read');
  const discovered = nativeSources(runtime.binary, plan.project, path.join(plan.config, 'opencode'), generalEnvironment(plan));
  const ownerSources=sourceGuard?sourceGuard({phase:'after',plan,sources:discovered}):undefined;
  assert(!ownerSources||typeof ownerSources.then!=='function','Source review must finish synchronously');
  if (generalOnly) {
    const config = path.join(plan.config, 'opencode');
    for (const source of discovered.entries) {
      if (source.type === 'document') assert(source.path === path.join(config, 'opencode.json'), 'Unreviewed executable configuration layer; port and validate its native owner first. Project discovery was not disabled');
      if (source.type === 'directory' && source.path !== config && fs.existsSync(source.path)) {
        noLinks(source.path);
        assert(runtimeOnlyPrefix(source.path,plan.runtimeHome)||fs.readdirSync(source.path).every(name => name === 'AGENTS.md'), 'Unreviewed local executable assets; this launcher currently validates the general candidate only, not AUNE/project layers');
      }
    }
  }
  return { ...status, check: 'offline native schema/source discovery plus managed integrity', version: runtime.version,
    sourceCount: discovered.entries.length, inlineOverridesForwarded: false, mcpStarted: false, modelRequests: 0, applicationStorageOpened: false,
    snapshots, generalSourcesOnly: generalOnly, ...(ownerSources?{ownerSources}:{}), effectiveRegistryVerified: false, actualHierarchyAcceptance: false,
    limitation: 'Temporary storage for CLI discovery; not startup/MCP/auth/semantic approval. Current source files may differ from a running client.' };
}
