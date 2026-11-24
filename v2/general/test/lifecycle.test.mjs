import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { candidateStatus, checkCandidate, officialRuntime, snapshotReadiness, OFFICIAL_SHA256 } from '../lifecycle.mjs';
import { planGeneral, prepareGeneral } from '../profile.mjs';

function fixture(t) {
  const root = fs.mkdtempSync('/tmp/opencode/candidate-lifecycle-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'), target = path.join(root, 'candidate'); fs.mkdirSync(project);
  const options = { project, mock: 'http://127.0.0.1:1/v1' };
  return { root, target, project, options };
}
test('status is read-only, never prepares, and distinguishes known upgrade from unknown drift or extra config', t => {
  const { target, options } = fixture(t), absent = planGeneral(target, options);
  assert.equal(candidateStatus(absent).status, 'not-prepared'); assert(!fs.existsSync(target));
  const p = prepareGeneral(target, options); assert.equal(candidateStatus(p).status, 'ready-assets');
  const next = planGeneral(target, { ...options, maintenanceModels: { title: { model: 'workshop-mock/mock#low' } } });
  assert.equal(candidateStatus(next).status, 'needs-prepare');
  const script = path.join(p.config, 'opencode/scripts/planner_doc.py'), original = fs.readFileSync(script); fs.appendFileSync(script, '\n# Unknown fixture drift\n');
  assert.equal(candidateStatus(p).status, 'drift'); assert(fs.readFileSync(script, 'utf8').endsWith('# Unknown fixture drift\n'));
  fs.writeFileSync(script, original);
  const unowned = path.join(p.config, 'opencode/opencode.jsonc'); fs.writeFileSync(unowned, '{}');
  assert.equal(candidateStatus(p).unknownConfigFiles, 1); assert.equal(candidateStatus(p).status, 'drift'); assert(fs.existsSync(unowned));
});
test('offline check validates official runtime and native config without a provider, MCP or application-store launch', t => {
  const { target, options } = fixture(t), p = prepareGeneral(target, options);
  const runtime = officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  assert.equal(runtime.sha256, OFFICIAL_SHA256);
  const report = checkCandidate(p, runtime);
  assert.equal(report.status, 'ready-assets'); assert.equal(report.mcpStarted, false); assert.equal(report.modelRequests, 0);
  assert.equal(report.applicationStorageOpened, false); assert.equal(report.effectiveRegistryVerified, false);
  assert.equal(report.snapshots.fileUndoAvailable, false, 'Outside Git no filesystem rollback is promised');
  assert(!fs.existsSync(path.join(p.data, 'opencode/opencode.db')), 'Schema/source check must not create the application DB');
});
test('owner source review is synchronous and runs before native parsing, without weakening general-only', t=>{
  const {target,project,options}=fixture(t),plan=prepareGeneral(target,options),runtime=officialRuntime(path.join(os.homedir(),'.local/share/opencode-v2-clean')),phases=[];
  assert.throws(()=>checkCandidate(plan,{...runtime,binary:'/MUST_NOT_EXECUTE'},{sourceGuard:()=>{throw new Error('fixture owner rejection');}}),/owner rejection/);
  assert.throws(()=>checkCandidate(plan,runtime,{sourceGuard:async()=>{}}),/Synchronous/);
  assert.throws(()=>checkCandidate(plan,runtime,{sourceGuard:()=>Promise.resolve({})}),/finish before native parsing/);
  assert.throws(()=>checkCandidate(plan,runtime,{generalOnly:true,sourceGuard:()=>({})}),/separate/);
  const report=checkCandidate(plan,runtime,{sourceGuard:({phase,sources})=>{phases.push(phase);if(phase==='after'){assert(sources.entries.length);return {scope:'fixture-owner',root:project};}}});assert.deepEqual(phases,['before','after']);assert.equal(report.ownerSources.scope,'fixture-owner');assert.equal(report.applicationStorageOpened,false);
});
test('official runtime rejects unreviewed pins before executing anything or adopting bytes', t => {
  const { root } = fixture(t), staging = path.join(root, 'opencode-v2-clean'); fs.mkdirSync(staging);
  fs.writeFileSync(path.join(staging, '.stack-v2-migration.json'), JSON.stringify({ schemaVersion: 1, owner: 'opencode-stack', kind: 'v2-clean-staging', version: '2.2.7' }));
  fs.writeFileSync(path.join(staging, 'runtime.json'), JSON.stringify({ package: '@opencode/cli@2.2.7', version: 'opencode v2.2.7', sha256: 'UNREVIEWED', binary: '/MUST_NOT_EXECUTE' }));
  assert.throws(() => officialRuntime(staging), /pin differs/);
});
test('snapshot preflight inventories tracked and non-ignored paths without reading sensitive file contents', t => {
  const { root, project, target, options } = fixture(t);
  const git = args => { const result = spawnSync('/usr/bin/git', args, { cwd: project, env: { PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8' }); assert.equal(result.status, 0); };
  git(['init', '--quiet']); fs.writeFileSync(path.join(project, '.gitignore'), 'ignored/\n'); fs.mkdirSync(path.join(project, 'ignored'));
  fs.writeFileSync(path.join(project, 'ignored/secret.key'), 'SYNTHETIC_MUST_NOT_READ'); fs.writeFileSync(path.join(project, '.env.example'), 'PUBLIC_EXAMPLE');
  assert.equal(snapshotReadiness(project).sensitiveCandidates, 0);
  fs.writeFileSync(path.join(project, '.env.synthetic'), 'SYNTHETIC_MUST_NOT_READ'); git(['add', '--', '.env.synthetic']);
  fs.writeFileSync(path.join(project, 'auth.json'), 'SYNTHETIC_MUST_NOT_READ');
  const index = fs.readFileSync(path.join(project, '.git/index')), report = snapshotReadiness(project);
  assert.equal(report.sensitiveCandidates, 2); assert(!JSON.stringify(report).includes('SYNTHETIC_MUST_NOT_READ'));
  assert(fs.readFileSync(path.join(project, '.git/index')).equals(index));
  const p = prepareGeneral(target, options);
  assert.throws(() => checkCandidate(p, { binary: '/MUST_NOT_EXECUTE', version: '2.2.7' }), /sensitive snapshot candidates/);
  fs.appendFileSync(path.join(project,'.git/info/exclude'),'\n.env.synthetic\nauth.json\n');
  const excluded=snapshotReadiness(project);assert.equal(excluded.sensitiveCandidates,0);assert.equal(excluded.ignoredSensitiveCandidates,1);assert.equal(excluded.sensitiveInventoryCandidates,1);assert(fs.readFileSync(path.join(project,'.git/index')).equals(index));
  fs.writeFileSync(path.join(project,'unignored.key'),'SYNTHETIC_STILL_BLOCKED');
  assert.equal(snapshotReadiness(project).sensitiveCandidates,1);assert.throws(()=>checkCandidate(p,{binary:'/MUST_NOT_EXECUTE',version:'2.2.7'}),/sensitive snapshot candidates/);
});
test('candidate CLI rejects missing live consent or misplaced reuse flags before selecting runtime or stores', () => {
  const cli = new URL('../../../v2/tools/general-composed.mjs', import.meta.url).pathname;
  assert.equal(spawnSync(process.execPath, ['--check', cli], { encoding: 'utf8' }).status, 0);
  for (const args of [['prepare', '--project', '/tmp/opencode'], ['chat', '--project', '/tmp/opencode'], ['status', '--project', '/tmp/opencode', '--reuse-v2-storage']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { env: { HOME: '/tmp/opencode/not-an-installed-home', PATH: '/usr/bin:/bin' }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert(result.stderr.includes('Uso:')); assert(!result.stderr.includes('ENOENT'));
  }
  const chat = spawnSync(process.execPath, [cli, 'chat', '--project', '/tmp/opencode', '--candidate-only', '--client-closed', '--reuse-v2-storage'], { env: { HOME: '/tmp/opencode/not-an-installed-home', PATH: '/usr/bin:/bin' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(chat.status, 1); assert(chat.stderr.includes('interactive terminal')); assert(!chat.stderr.includes('ENOENT'));
});
test('absent durable browser reports not-prepared rather than unowned drift and never creates directories', t => {
  const {root}=fixture(t),cli=new URL('../../../v2/tools/playwright-runtime.mjs',import.meta.url).pathname;
  const result=spawnSync(process.execPath,[cli,'status'],{env:{HOME:root,PATH:'/usr/bin:/bin'},encoding:'utf8',timeout:10000});
  assert.equal(result.status,0);const value=JSON.parse(result.stdout);assert.equal(value.status,'not-prepared');assert.equal(value.verified,false);assert.equal(value.changed,false);assert(!fs.existsSync(path.join(root,'.local')));
  const runtime=path.join(root,'.local/share/opencode-stack/runtime/playwright-mcp-0.0.85');fs.mkdirSync(runtime,{recursive:true});
  const unowned=spawnSync(process.execPath,[cli,'status'],{env:{HOME:root,PATH:'/usr/bin:/bin'},encoding:'utf8',timeout:10000});assert.notEqual(unowned.status,0,'Existing unowned tree must still fail, never be adopted');assert.deepEqual(fs.readdirSync(runtime),[]);
});
test('user CLI install prefix is not mistaken for an ancestor project overlay; autoload surfaces remain blocked',t=>{
  const {root,target,options}=fixture(t),prefix=path.join(root,'.opencode');fs.mkdirSync(path.join(prefix,'bin'),{recursive:true});fs.writeFileSync(path.join(prefix,'.gitignore'),'bin/\n');fs.writeFileSync(path.join(prefix,'.opencode-background-addon.json'),'{}');
  const p=prepareGeneral(target,{...options,runtimeHome:root}),runtime=officialRuntime(path.join(os.homedir(),'.local/share/opencode-v2-clean'));
  assert.equal(checkCandidate(p,runtime,{generalOnly:true}).status,'ready-assets');
  fs.mkdirSync(path.join(prefix,'plugins'));fs.writeFileSync(path.join(prefix,'plugins/unreviewed.js'),'throw new Error("MUST_NOT_RUN")');
  assert.throws(()=>checkCandidate(p,runtime,{generalOnly:true}),/Unreviewed local executable assets/);
});
