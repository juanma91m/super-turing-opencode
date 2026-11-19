import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { planGeneral, prepareGeneral } from '../profile.mjs';
import { candidateStatus, checkCandidate, officialRuntime } from '../lifecycle.mjs';
import { acquireCandidateLease, runLiveCandidate } from '../launch.mjs';
import { releaseStorePath, assertNoPendingDistribution } from '../ownership.mjs';
import { installRelease, restoreRelease, recoverRelease, distributionStatus, previewDistribution, installedPlan, validateReleaseSchema } from '../releases.mjs';
import { nativeAddonFixture } from '../../../migrations/v2/fixtures/general-addon-stack.mjs';
import { playwrightContribution } from '../../playwright/general.mjs';
import { validateInstalledPlaywright } from '../../playwright/installed-runtime.mjs';
import { translateDormantProviders } from '../dormant-providers.mjs';
import { dormantFixture } from './dormant-fixture.mjs';

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/general-release-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'), target = path.join(root, 'candidate'); fs.mkdirSync(project); fs.writeFileSync(path.join(project, 'application.txt'), 'USER_APPLICATION\n');
  const options = { project, mock: 'http://127.0.0.1:1/v1' };
  const plan = () => planGeneral(target, options);
  const revised = () => {
    const p = planGeneral(target, { ...options, maintenanceModels: { title: { model: 'workshop-mock/mock#low' } } });
    const removed = path.join(p.config, 'opencode/PLAYBOOK-CODE-PATTERNS.md'); p.assets.delete(removed);
    p.assets.set(path.join(p.config, 'opencode/REVISION-NOTE.md'), Buffer.from('PUBLIC_NEW_REVISION\n')); return p;
  };
  return { root, project, target, options, plan, revised };
}
const consent = { candidateOnly: true, clientClosed: true, confirm: true, validate: () => {} };
test('bound release install/update/rollback preserve non-managed state and can load the old plan without current builder equality', t => {
  const f = fixture(t), p = f.plan();
  const preview = previewDistribution(p); assert.equal(preview.status, 'not-distributed'); assert(!fs.existsSync(f.target)); assert(!fs.existsSync(releaseStorePath(f.target)));
  const first = installRelease(p, consent); assert.equal(first.revision, preview.desired); assert.equal(candidateStatus(installedPlan(f.target, f.project)).status, 'ready-assets');
  assert.equal(installRelease(p, consent).configurationChanged, false);
  for (const relative of ['home/.local/share/SYNTHETIC-DATA', 'home/.local/state/SYNTHETIC-STATE', 'home/.cache/SYNTHETIC-CACHE']) fs.writeFileSync(path.join(f.target, relative), 'MUST_NOT_BACKUP_OR_RESTORE\n');
  const next = f.revised(), second = installRelease(next, consent); assert.notEqual(first.revision, second.revision); assert.equal(second.previous, first.revision);
  assert(!fs.existsSync(path.join(p.config, 'opencode/PLAYBOOK-CODE-PATTERNS.md'))); assert(fs.existsSync(path.join(p.config, 'opencode/REVISION-NOTE.md')));
  const restored = restoreRelease(f.target, first.revision, f.project, consent); assert.equal(restored.revision, first.revision);
  assert(fs.existsSync(path.join(p.config, 'opencode/PLAYBOOK-CODE-PATTERNS.md'))); assert(!fs.existsSync(path.join(p.config, 'opencode/REVISION-NOTE.md')));
  assert.equal(candidateStatus(next).status, 'drift'); assert.equal(candidateStatus(installedPlan(f.target, f.project)).status, 'ready-assets');
  for (const relative of ['home/.local/share/SYNTHETIC-DATA', 'home/.local/state/SYNTHETIC-STATE', 'home/.cache/SYNTHETIC-CACHE']) assert.equal(fs.readFileSync(path.join(f.target, relative), 'utf8'), 'MUST_NOT_BACKUP_OR_RESTORE\n');
  assert.equal(fs.readFileSync(path.join(f.project, 'application.txt'), 'utf8'), 'USER_APPLICATION\n');
  assert.equal(restoreRelease(f.target, first.revision, f.project, consent).configurationChanged, false);
  assert.throws(() => prepareGeneral(f.target, f.options), /Versioned distribution/);
});
test('failed validation leaves an explicit recoverable journal; launch/prepare block and recovery restores exact prior config', t => {
  const f = fixture(t), first = installRelease(f.plan(), consent);
  assert.throws(() => installRelease(f.revised(), { ...consent, validate: () => { throw new Error('SYNTHETIC_VALIDATION_FAILURE'); } }), /SYNTHETIC_VALIDATION_FAILURE/);
  assert.equal(distributionStatus(f.target).status, 'recovery-required'); assert.throws(() => assertNoPendingDistribution(f.target), /recovery/);
  assert.throws(() => prepareGeneral(f.target, f.options), /recovery/); assert(!fs.existsSync(path.join(f.target, '.candidate-launch.lock')));
  assert.throws(() => installedPlan(f.target, f.project), /Clean installed/);
  const recovered = recoverRelease(f.target, 'previous', f.project, consent); assert.equal(recovered.revision, first.revision); assert.equal(distributionStatus(f.target).status, 'installed');
  assert.equal(candidateStatus(installedPlan(f.target, f.project)).status, 'ready-assets');
});
test('interrupted first install can only complete its exact archived target, never invent a previous baseline', t => {
  const f = fixture(t);
  assert.throws(() => installRelease(f.plan(), { ...consent, validate: () => { throw new Error('SYNTHETIC_INTERRUPTION'); } }), /SYNTHETIC_INTERRUPTION/);
  assert.throws(() => recoverRelease(f.target, 'previous', f.project, consent), /no previous/);
  const recovered = recoverRelease(f.target, 'target', f.project, consent); assert.equal(distributionStatus(f.target).current, recovered.revision);
});
test('unknown drift is refused rather than archived as a new baseline', t => {
  const f = fixture(t), p = f.plan(); installRelease(p, consent);
  const file = path.join(p.config, 'opencode/agents/reviewer.md'); fs.appendFileSync(file, '\nUNKNOWN_USER_EDIT\n');
  assert.throws(() => installRelease(f.revised(), consent), /integrity drift/); assert.throws(() => distributionStatus(f.target), /integrity drift/);
});
test('literal credentials, private asset paths, source path rebinding and unmanaged collisions are rejected before target writes', t => {
  const f = fixture(t), p = f.plan(), config = path.join(p.config, 'opencode/opencode.json');
  const secret = structuredClone(p.document); secret.providers['workshop-mock'].settings.apiKey = 'SYNTHETIC_MUST_NOT_ARCHIVE';
  assert.throws(() => previewDistribution({ ...p, document: secret, assets: new Map([...p.assets, [config, Buffer.from(JSON.stringify(secret))]]) }), /Literal credentials/);
  assert(!fs.existsSync(f.target)); assert(!fs.existsSync(releaseStorePath(f.target)));
  assert.throws(() => installRelease({ ...p, data: '/MUST_NOT_TOUCH' }, consent), /Canonical unbound/);
  const privatePath = new Map(p.assets); privatePath.set(path.join(p.config, 'opencode/scripts/.env.synthetic'), Buffer.from('MUST_NOT_ARCHIVE'));
  assert.throws(() => previewDistribution({ ...p, assets: privatePath }), /Private/);
  installRelease(p, consent);
  const next = f.revised(); fs.writeFileSync(path.join(next.config, 'opencode/REVISION-NOTE.md'), 'UNMANAGED_USER_CONTENT');
  assert.throws(() => installRelease(next, consent), /Unmanaged candidate configuration|collides/);
  assert.equal(fs.readFileSync(path.join(next.config, 'opencode/REVISION-NOTE.md'), 'utf8'), 'UNMANAGED_USER_CONTENT');
  assert(!fs.existsSync(path.join(releaseStorePath(f.target), 'transaction.json')));
});
test('partial old/new/absent states recover, but unknown pending edits and corrupt archived payloads never do', t => {
  const f = fixture(t), old = f.plan(), first = installRelease(old, consent), next = f.revised();
  assert.throws(() => installRelease(next, { ...consent, validate: () => { throw new Error('SYNTHETIC_CRASH'); } }));
  // Reproduce a crash midway through per-file publication: mixed known states.
  const shared = path.join(old.config, 'opencode/opencode.json'); fs.writeFileSync(shared, old.assets.get(shared));
  fs.unlinkSync(path.join(old.config, 'opencode/REVISION-NOTE.md'));
  fs.writeFileSync(path.join(old.config, 'opencode/PLAYBOOK-CODE-PATTERNS.md'), old.assets.get(path.join(old.config, 'opencode/PLAYBOOK-CODE-PATTERNS.md')), { mode: 0o600 });
  assert.equal(recoverRelease(f.target, 'previous', f.project, consent).revision, first.revision);
  assert.throws(() => installRelease(next, { ...consent, validate: () => { throw new Error('SYNTHETIC_CRASH'); } }));
  const script = path.join(old.config, 'opencode/scripts/planner_doc.py'), bytes = fs.readFileSync(script); fs.appendFileSync(script, '\nUNKNOWN_PENDING_EDIT\n');
  assert.throws(() => recoverRelease(f.target, 'previous', f.project, consent), /Unknown edit/); assert.equal(distributionStatus(f.target).status, 'recovery-required');
  fs.writeFileSync(script, bytes);
  const archive = path.join(releaseStorePath(f.target), 'releases', first.revision, 'files/home/.config/opencode/scripts/planner_doc.py'); fs.appendFileSync(archive, '\nCORRUPT_ARCHIVE\n');
  assert.throws(() => recoverRelease(f.target, 'previous', f.project, consent), /integrity drift/);
});
test('consent, legacy adoption, lease, symlinks and target binding are enforced without global paths or state backups', t => {
  const f = fixture(t), p = f.plan();
  for (const options of [{}, { ...consent, clientClosed: false }, { ...consent, validate: undefined }, { ...consent, validate: async () => {} }]) assert.throws(() => installRelease(p, options));
  prepareGeneral(f.target, f.options); const lease = acquireCandidateLease(f.target);
  assert.throws(() => installRelease(p, consent), /lease/); lease();
  const first = installRelease(p, consent); assert.equal(first.configurationChanged, false, 'Only an exact prepared baseline can be adopted');
  assert.throws(() => restoreRelease(f.target, first.revision, f.project, { ...consent, confirm: false }), /confirm/);
  assert.throws(() => restoreRelease(f.target, '../MUST_NOT_READ', f.project, consent), /checksum/);
  assert.throws(() => restoreRelease(path.join(os.homedir(), '.config/opencode'), first.revision, f.project, consent), /Active install/);
  const file = path.join(p.config, 'opencode/agents/reviewer.md'); fs.renameSync(file, file + '.owned'); fs.symlinkSync(file + '.owned', file);
  assert.throws(() => installRelease(p, consent), /symlink/i);
});
test('legacy adoption requires exact current plan and archived revisions cannot be rebound to another target', t => {
  const f = fixture(t); prepareGeneral(f.target, f.options);
  assert.equal(previewDistribution(f.revised()).status, 'legacy-reconciliation-required');
  assert.throws(() => installRelease(f.revised(), consent), /Legacy candidate differs/); assert(!fs.existsSync(releaseStorePath(f.target)));
  const first = installRelease(f.plan(), consent), other = path.join(f.root, 'other');
  const second = installRelease(planGeneral(other, f.options), consent);
  fs.cpSync(path.join(releaseStorePath(f.target), 'releases', first.revision), path.join(releaseStorePath(other), 'releases', first.revision), { recursive: true });
  assert.throws(() => restoreRelease(other, first.revision, f.project, consent), /identity, target binding/);
  assert.equal(distributionStatus(other).current, second.revision);
});
test('native official schema accepts restored configuration after a real update and rollback, without starting application storage', t => {
  const f = fixture(t), runtime = officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  const native = { ...consent, validate: p => validateReleaseSchema(p, runtime) };
  const first = installRelease(f.plan(), native); installRelease(f.revised(), native); restoreRelease(f.target, first.revision, f.project, native);
  const restored = installedPlan(f.target, f.project); assert.equal(checkCandidate(restored, runtime).status, 'ready-assets');
  assert(!fs.existsSync(path.join(restored.data, 'opencode/opencode.db')));
});
test('restored native release can verify-live independently of a newer desired build', async t => {
  const f = fixture(t), first = installRelease(f.plan(), consent); installRelease(f.revised(), consent); restoreRelease(f.target, first.revision, f.project, consent);
  const report = await runLiveCandidate(installedPlan(f.target, f.project), officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')), 'verify-live', { candidateOnly: true, clientClosed: true });
  assert.equal(report.ready, true); assert.equal(report.diagnosticSessionRemoved, true); assert.equal(report.modelRequestsIssuedByLauncher, 0);
});
test('composed22-role releases retain the five owner MCP catalogs after update and rollback', async t => {
  const f = fixture(t), owners = nativeAddonFixture(f.root);
  const firstPlan = planGeneral(f.target, { ...f.options, contributions: owners.contributions, runtimeHome: owners.runtimeHome });
  const first = installRelease(firstPlan, consent);
  const next = planGeneral(f.target, { ...f.options, contributions: owners.contributions, runtimeHome: owners.runtimeHome, maintenanceModels: { title: { model: 'workshop-mock/mock#low' } } });
  installRelease(next, consent); restoreRelease(f.target, first.revision, f.project, consent);
  const report = await runLiveCandidate(installedPlan(f.target, f.project), officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')), 'verify-live', { candidateOnly: true, clientClosed: true });
  assert.equal(report.ready, true); assert.equal(report.roles, 22); assert.equal(report.mcp.length, 5); assert(report.mcp.every(item => item.status === 'connected'));
  for (const name of ['engram', 'context7', 'rovo', 'graph', 'browser']) assert(!fs.existsSync(path.join(f.root, name + '-calls.jsonl')));
});
test('candidate CLI status/rollback/check/live boot use archived assets without reading missing V1 configuration or rerendering owners', t => {
  const f = fixture(t), home = path.join(f.root, 'machine'), officialRoot = path.join(home, '.local/share/opencode-v2-clean'), target = path.join(officialRoot, 'general-composed-candidate');
  fs.mkdirSync(path.join(officialRoot, 'npm/bin'), { recursive: true });
  const original = officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean')), binary = path.join(officialRoot, 'npm/bin/opencode');
  fs.copyFileSync(original.binary, binary, fs.constants.COPYFILE_FICLONE); fs.chmodSync(binary, 0o755);
  fs.writeFileSync(path.join(officialRoot, '.stack-v2-migration.json'), JSON.stringify({ schemaVersion: 1, owner: 'opencode-stack', kind: 'v2-clean-staging', version: '2.2.7' }), { mode: 0o600 });
  fs.writeFileSync(path.join(officialRoot, 'runtime.json'), JSON.stringify({ package: '@opencode/cli@2.2.7', version: 'opencode v2.2.7', binary, sha256: original.sha256 }), { mode: 0o600 });
  const base = planGeneral(target, f.options), first = installRelease(base, consent);
  const next = planGeneral(target, { ...f.options, maintenanceModels: { title: { model: 'workshop-mock/mock#low' } } }); installRelease(next, consent);
  assert(!fs.existsSync(path.join(home, '.config/opencode')));
  const cli = new URL('../../../migrations/v2/general-composed.mjs', import.meta.url).pathname;
  const run = args => { const result = spawnSync(process.execPath, [cli, ...args], { env: { HOME: home, PATH: '/usr/local/bin:/usr/bin:/bin' }, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 }); assert.equal(result.status, 0, 'Owned CLI fixture failed: ' + result.stderr); return JSON.parse(result.stdout); };
  assert.equal(run(['status', '--project', f.project]).current, distributionStatus(target).current);
  assert.equal(run(['rollback', '--project', f.project, '--revision', first.revision, '--candidate-only', '--client-closed', '--confirm']).revision, first.revision);
  assert.throws(() => installRelease(next, { ...consent, validate: () => { throw new Error('SYNTHETIC_INTERRUPTION'); } }));
  assert.equal(run(['status', '--project', f.project]).status, 'recovery-required');
  assert.equal(run(['recover', '--project', f.project, '--to', 'previous', '--candidate-only', '--client-closed', '--confirm']).revision, first.revision);
  assert.equal(run(['check', '--project', f.project]).status, 'ready-assets');
  assert.equal(run(['verify-live', '--project', f.project, '--candidate-only', '--client-closed']).ready, true);
  assert(!fs.existsSync(path.join(home, '.config/opencode'))); assert.equal(run(['release-history', '--project', f.project]).revisions.length, 2);
});
test('archived browser owner preflight verifies its durable copy without V1/cache selectors and refuses runtime drift', t => {
  const f = fixture(t), home = path.join(f.root, 'runtime-home'), modules = path.join(home, '.npm/_npx/public/node_modules');
  const cli = path.join(modules, '@playwright/mcp/cli.js'), browser = path.join(home, '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');
  fs.mkdirSync(path.dirname(cli), { recursive: true }); fs.mkdirSync(path.join(modules, 'playwright-core')); fs.mkdirSync(path.dirname(browser), { recursive: true });
  fs.writeFileSync(cli, '/* public synthetic MCP */'); fs.writeFileSync(path.join(path.dirname(cli), 'package.json'), JSON.stringify({ name: '@playwright/mcp', version: '0.0.85' }));
  fs.writeFileSync(path.join(modules, 'playwright-core/package.json'), JSON.stringify({ name: 'playwright-core', version: '1.66.0-alpha-2026-11-09' }));
  fs.writeFileSync(browser, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const managed = path.join(f.root, 'playwright-mcp-0.0.85');
  const prepared = spawnSync('/usr/bin/python3', [new URL('../../playwright/managed_runtime.py', import.meta.url).pathname], { input: JSON.stringify({ action: 'prepare', root: managed, selected: { home, cli, browser, version: '0.0.85' } }), env: { PATH: '/usr/bin:/bin', HOME: home, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8' });
  assert.equal(prepared.status, 0, 'Owned public browser fixture preparation failed; values suppressed');
  const runtime = JSON.parse(prepared.stdout);
  const p = planGeneral(f.target, { ...f.options, contributions: [playwrightContribution({ runtime, server: { type: 'local', command: ['/fixture/not-started'], disabled: true, codemode: false } })] });
  installRelease(p, consent); fs.rmSync(path.join(home, '.npm'), { recursive: true }); fs.rmSync(path.join(home, '.cache'), { recursive: true });
  const restored = installedPlan(f.target, f.project); assert.doesNotThrow(() => validateInstalledPlaywright(restored));
  fs.appendFileSync(path.join(managed, 'node_modules/@playwright/mcp/cli.js'), 'UNKNOWN_RUNTIME_DRIFT');
  assert.throws(() => validateInstalledPlaywright(restored), /runtime integrity failed/);
});
test('configuration releases retain dormant provider declarations and discovery/use denies across update and rollback', t => {
  const f = fixture(t), legacy = dormantFixture(), dormantProviders = translateDormantProviders(legacy);
  const before = planGeneral(f.target, { ...f.options, dormantProviders }), first = installRelease(before, consent);
  const next = planGeneral(f.target, { ...f.options, dormantProviders, maintenanceModels: { title: { model: 'workshop-mock/mock#low' } } }); installRelease(next, consent);
  restoreRelease(f.target, first.revision, f.project, consent);
  const restored = installedPlan(f.target, f.project);
  assert.deepEqual(restored.document.providers.ollama.models, legacy.provider.ollama.models);
  assert(restored.document.plugins.includes('-opencode.provider.ollama'));
  assert(restored.document.policies.some(rule => rule.action === 'provider.use' && rule.resource === 'ollama' && rule.effect === 'deny'));
});
