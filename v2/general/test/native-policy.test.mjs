import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { layout } from '../../../v2/runtime/staging.mjs';
import { startServer, until } from '../../../v2/testing/private-server.mjs';
import { getApiList } from '../../../v2/testing/api-list.mjs';

function sse(response, { text, call, inputTokens = 100 }) {
  response.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const emit = (delta, finish_reason = null, usage) => response.write('data: ' + JSON.stringify({ id: 'native-policy', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }], ...(usage ? { usage } : {}) }) + '\n\n');
  if (call) emit({ role: 'assistant', tool_calls: [{ index: 0, id: call.id, type: 'function', function: { name: call.name ?? 'write', arguments: JSON.stringify(call.input) } }] });
  else emit({ role: 'assistant', content: text });
  emit({}, call ? 'tool_calls' : 'stop', { prompt_tokens: inputTokens, completion_tokens: 100, total_tokens: inputTokens + 100 });
  response.end('data: [DONE]\n\n');
}
async function fixture(t, handler) {
  const root = fs.mkdtempSync('/tmp/opencode/native-policy-');
  const repo = path.join(root, 'repo'), project = path.join(repo, 'app'), control = path.join(root, 'control'), observations = path.join(root, 'compaction.json');
  fs.mkdirSync(project, { recursive: true }); fs.mkdirSync(control);
  fs.writeFileSync(path.join(control, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(control, 'index.ts'), 'import {Plugin} from "@opencode/plugin";import fs from "node:fs";export default Plugin.define({id:"fixture.policy",async setup(ctx){await ctx.session.hook("title",e=>{e.result="Policy fixture"});await ctx.session.hook("compaction",e=>{let rows=[];try{rows=JSON.parse(fs.readFileSync(' + JSON.stringify(observations) + ',"utf8"))}catch{}rows.push({model:e.model});fs.writeFileSync(' + JSON.stringify(observations) + ',JSON.stringify(rows));e.system.push({type:"text",text:"AUTOMATIC_COMPACTION_FIXTURE"})})}});');
  let error;
  const provider = http.createServer(async (request, response) => {
    try { let raw = ''; for await (const chunk of request) { raw += chunk; assert(raw.length < 8 * 1024 * 1024); } handler(JSON.parse(raw), response); }
    catch (failure) { error = failure.message?.startsWith('Fixture:') ? failure.message : 'Synthetic policy provider failed; content suppressed'; response.writeHead(500); response.end('Fixture failure'); }
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve)); let server;
  t.after(async () => { await server?.close(); provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
  const profile = prepareGeneral(path.join(root, 'profile'), { project, mock: 'http://127.0.0.1:' + provider.address().port + '/v1', plugins: [control], maintenanceModels: { compaction: { model: 'workshop-mock/mock#medium' } } });
  for (const relative of ['.agents/skills/external-agents-fixture', '.claude/skills/external-claude-fixture']) {
    const folder = path.join(profile.home, relative); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'SKILL.md'), '---\nname: ' + path.basename(folder) + '\ndescription: EXTERNAL_DESCRIPTION_MUST_NOT_ADVERTISE\n---\nEXTERNAL_BODY_MUST_NOT_LOAD\n');
  }
  const launch = async (permissions) => {
    server = await startServer(layout(path.join(os.homedir(), '.local/share/opencode-v2-clean')).binary, profile, undefined, { environment: generalEnvironment });
    const skills = await until(async () => { const entries = await getApiList(server.request, '/api/skill'); return entries.some(skill => skill.id === 'overlays-locales-opencode') ? entries : undefined; }, 'Native skills without external autoimport');
    assert(skills.some(skill => skill.id === 'external-agents-fixture'), 'Pin still discovers .agents sources: the native guard, not an ignored env flag, must enforce policy');
    const spec = (await server.request('GET', '/openapi.json')).value;
    const operation = async (id, sessionID, body) => {
      for (const [route, methods] of Object.entries(spec.paths)) for (const [method, metadata] of Object.entries(methods)) if (metadata.operationId === id) return server.request(method.toUpperCase(), route.replace('{sessionID}', sessionID), body);
      throw new Error('Required native operation missing: ' + id);
    };
    const created = await server.request('POST', '/api/session', { agent: 'master-dev', location: { directory: project }, model: { providerID: 'workshop-mock', id: 'mock' }, ...(permissions ? { permissions } : {}) }); assert.equal(created.status, 200);
    return { server, id: created.value.data.id, operation };
  };
  const check = () => { if (error) throw new Error(error); };
  return { root, repo, project, profile, observations, launch, check };
}

test('native snapshots stage undo, cancel redo and commit without changing index or unrelated/ignored/outside files', async t => {
  let finished = false;
  const f = await fixture(t, (body, response) => {
    assert(!JSON.stringify(body).includes('EXTERNAL_DESCRIPTION_MUST_NOT_ADVERTISE'));
    const results = body.messages.filter(message => message.role === 'tool');
    if (!results.length) return sse(response, { call: { id: 'write_existing', input: { path: 'app.txt', content: 'ASSISTANT_VERSION\n' } } });
    if (results.length === 1) return sse(response, { call: { id: 'write_created', input: { path: 'created.txt', content: 'ASSISTANT_CREATED\n' } } });
    finished = true; sse(response, { text: 'SNAPSHOT_FIXTURE_DONE' });
  });
  const git = args => {
    const result = spawnSync('/usr/bin/git', args, { cwd: f.repo, env: { PATH: '/usr/bin:/bin', HOME: f.root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8' }); assert.equal(result.status, 0); return result.stdout;
  };
  git(['init', '--quiet']);
  fs.writeFileSync(path.join(f.repo, '.gitignore'), 'app/ignored/\n'); fs.writeFileSync(path.join(f.project, 'app.txt'), 'ORIGINAL\n'); fs.writeFileSync(path.join(f.repo, 'outside.txt'), 'OUTSIDE\n');
  fs.mkdirSync(path.join(f.project, 'ignored')); fs.writeFileSync(path.join(f.project, 'ignored/only.txt'), 'IGNORED\n');
  git(['add', '--', '.gitignore', 'app/app.txt', 'outside.txt']);
  const beforeIndex = fs.readFileSync(path.join(f.repo, '.git/index'));
  const { server, id, operation } = await f.launch();
  assert.equal((await server.request('POST', '/api/session/' + id + '/prompt', { text: 'Write the two synthetic files only.' })).status, 200);
  const context = await until(async () => { f.check(); const result = await server.request('GET', '/api/session/' + id + '/context'); return finished && result.value?.data?.at(-1)?.type === 'idle' ? result.value.data : undefined; }, 'Native snapshot completion', 30000);
  assert.equal(fs.readFileSync(path.join(f.project, 'app.txt'), 'utf8'), 'ASSISTANT_VERSION\n');
  const boundary = context.find(message => message.type === 'user')?.id; assert(boundary);
  fs.writeFileSync(path.join(f.project, 'manual.txt'), 'USER_UNRELATED\n');
  fs.writeFileSync(path.join(f.project, 'ignored/only.txt'), 'USER_IGNORED\n'); fs.writeFileSync(path.join(f.repo, 'outside.txt'), 'USER_OUTSIDE\n');
  assert.equal((await operation('session.revert.stage', id, { messageID: boundary, files: true })).status, 200);
  assert.equal(fs.readFileSync(path.join(f.project, 'app.txt'), 'utf8'), 'ORIGINAL\n'); assert(!fs.existsSync(path.join(f.project, 'created.txt')));
  assert.equal((await operation('session.revert.clear', id)).status, 204);
  assert.equal(fs.readFileSync(path.join(f.project, 'app.txt'), 'utf8'), 'ASSISTANT_VERSION\n'); assert(fs.existsSync(path.join(f.project, 'created.txt')));
  assert.equal((await operation('session.revert.stage', id, { messageID: boundary, files: true })).status, 200);
  const committed = await operation('session.revert.commit', id, {}); assert(committed.status >= 200 && committed.status < 300);
  assert.equal(fs.readFileSync(path.join(f.project, 'app.txt'), 'utf8'), 'ORIGINAL\n'); assert(!fs.existsSync(path.join(f.project, 'created.txt')));
  for (const [file, expected] of [['app/manual.txt', 'USER_UNRELATED\n'], ['app/ignored/only.txt', 'USER_IGNORED\n'], ['outside.txt', 'USER_OUTSIDE\n']]) assert.equal(fs.readFileSync(path.join(f.repo, file), 'utf8'), expected);
  assert(fs.readFileSync(path.join(f.repo, '.git/index')).equals(beforeIndex), 'Snapshots must not modify the application index');
  assert(!fs.existsSync(path.join(f.repo, '.git/refs/heads/master')) && !fs.existsSync(path.join(f.repo, '.git/refs/heads/main')), 'No application commit or branch was created');
});

test('automatic native compaction triggers from high usage without calling the manual compact API', async t => {
  let normal = 0, summaries = 0;
  const f = await fixture(t, (body, response) => {
    assert(!JSON.stringify(body).includes('EXTERNAL_DESCRIPTION_MUST_NOT_ADVERTISE'));
    if (JSON.stringify(body.messages.filter(message => message.role === 'system')).includes('AUTOMATIC_COMPACTION_FIXTURE')) { summaries++; return sse(response, { text: '## Objective\nContinue the synthetic fixture.\n## Next Move\nAnswer its second prompt.' }); }
    normal++; assert(normal < 6, 'Unexpected fixture retry loop');
    sse(response, { text: normal === 1 ? 'FIRST_FIXTURE_DONE' : 'SECOND_FIXTURE_DONE', inputTokens: normal === 1 ? 60000 : 100 });
  });
  const { server, id } = await f.launch();
  await server.request('POST', '/api/session/' + id + '/prompt', { text: 'First short synthetic prompt; provider usage deliberately approaches the fixture model limit.' });
  await until(async () => { f.check(); const result = await server.request('GET', '/api/session/' + id + '/context'); return normal >= 1 && result.value?.data?.at(-1)?.type === 'idle'; }, 'First high-usage native turn');
  await server.request('POST', '/api/session/' + id + '/prompt', { text: 'Second synthetic prompt. Continue after native automatic compaction if needed.' });
  await until(async () => { f.check(); const result = await server.request('GET', '/api/session/' + id + '/context'); return summaries >= 1 && normal >= 2 && result.value?.data?.at(-1)?.type === 'idle'; }, 'Automatic compaction and resumed turn', 30000);
  const observed = JSON.parse(fs.readFileSync(f.observations)); assert(observed.length >= 1); assert(observed.every(row => row.model.variant === 'medium'));
  assert.equal(f.profile.document.compaction.auto, true);
});

test('native snapshot exclusions protect tracked and untracked sensitive updates while ordinary undo remains available', async t => {
  let finished=false;
  const f=await fixture(t, (body,response)=>{
    const results=body.messages.filter(message=>message.role==='tool');
    if(!results.length)return sse(response,{call:{id:'ordinary_edit',input:{path:'app.txt',content:'ORDINARY_EDIT\n'}}});
    finished=true;sse(response,{text:'EXCLUSION_FIXTURE_DONE'});
  });
  const git=(args,cwd=f.repo,input)=>spawnSync('/usr/bin/git',args,{cwd,env:{PATH:'/usr/bin:/bin',HOME:f.root,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'},encoding:'utf8',input});
  assert.equal(git(['init','--quiet']).status,0);
  fs.writeFileSync(path.join(f.project,'app.txt'),'ORDINARY_ORIGINAL\n');
  fs.writeFileSync(path.join(f.project,'tracked.key'),'SYNTHETIC_TRACKED_ORIGINAL\n');
  assert.equal(git(['add','--','app/app.txt','app/tracked.key']).status,0);
  const index=fs.readFileSync(path.join(f.repo,'.git/index'));
  const originalOID=git(['rev-parse',':app/tracked.key']).stdout.trim();
  fs.appendFileSync(path.join(f.repo,'.git/info/exclude'),'\n*.key\n');
  fs.writeFileSync(path.join(f.project,'untracked.key'),'SYNTHETIC_UNTRACKED\n');
  const {server,id,operation}=await f.launch();
  assert.equal((await server.request('POST','/api/session/'+id+'/prompt',{text:'Edit only app.txt.'})).status,200);
  const context=await until(async()=>{f.check();const result=await server.request('GET','/api/session/'+id+'/context');return finished&&result.value?.data?.at(-1)?.type==='idle'?result.value.data:undefined;},'Native excluded tracked fixture',30000);
  const stores=[],walk=folder=>{if(fs.existsSync(path.join(folder,'HEAD'))&&fs.existsSync(path.join(folder,'index'))){stores.push(folder);return;}for(const entry of fs.readdirSync(folder,{withFileTypes:true}))if(entry.isDirectory())walk(path.join(folder,entry.name));};
  walk(path.join(f.profile.data,'opencode/snapshot'));assert.equal(stores.length,1);
  const store=stores[0],listed=git(['--git-dir',store,'ls-files','-z']).stdout.split('\0');
  // Native2.2.7 seeds the source index: unchanged tracked files can remain as
  // references to existing source Git objects. Exclusion is NOT history erasure.
  assert(listed.includes('app/tracked.key'));
  assert(!listed.includes('app/untracked.key'));
  assert(!fs.existsSync(path.join(store,'objects',originalOID.slice(0,2),originalOID.slice(2))),'Original sensitive blob must not be copied into new snapshot objects');
  const boundary=context.find(message=>message.type==='user')?.id;assert(boundary);
  fs.writeFileSync(path.join(f.project,'tracked.key'),'SYNTHETIC_TRACKED_CHANGED\n');
  assert.equal((await operation('session.revert.stage',id,{messageID:boundary,files:true})).status,200);
  assert.equal(fs.readFileSync(path.join(f.project,'app.txt'),'utf8'),'ORDINARY_ORIGINAL\n');
  assert.equal(fs.readFileSync(path.join(f.project,'tracked.key'),'utf8'),'SYNTHETIC_TRACKED_CHANGED\n');
  assert.equal(fs.readFileSync(path.join(f.project,'untracked.key'),'utf8'),'SYNTHETIC_UNTRACKED\n');
  const copied=path.join(f.root,'snapshot-inspection');fs.cpSync(store,copied,{recursive:true});fs.unlinkSync(path.join(copied,'objects/info/alternates'));
  assert.notEqual(git(['--git-dir',copied,'cat-file','-e',originalOID]).status,0,'Sensitive original object stays only in original fixture Git history');
  for(const value of ['SYNTHETIC_TRACKED_CHANGED\n','SYNTHETIC_UNTRACKED\n']){const oid=git(['hash-object','--stdin'],f.repo,value).stdout.trim();assert(/^[a-f0-9]{40}$/.test(oid));assert.notEqual(git(['--git-dir',copied,'cat-file','-e',oid]).status,0,'Excluded new payload not materialized into native snapshot objects');}
  assert(fs.readFileSync(path.join(f.repo,'.git/index')).equals(index),'App index remains byte-identical');
});

test('external-client skill cannot load even with a session allow; an explicit native project skill remains usable', async t => {
  let finished = false;
  const f = await fixture(t, (body, response) => {
    const results = body.messages.filter(message => message.role === 'tool');
    assert(!JSON.stringify(body).includes('EXTERNAL_DESCRIPTION_MUST_NOT_ADVERTISE'), 'Fixture: external description reached model with session allow'); assert(!JSON.stringify(body).includes('EXTERNAL_BODY_MUST_NOT_LOAD'), 'Fixture: external body loaded');
    if (!results.length) return sse(response, { call: { id: 'external', name: 'skill', input: { id: 'external-agents-fixture' } } });
    if (results.length === 1) { const refused = JSON.parse(results[0].content); assert.equal(refused.error?.type, 'tool.execution', 'Fixture: unexpected refusal shape'); assert.deepEqual(refused.content, []); return sse(response, { call: { id: 'owned', name: 'skill', input: { id: 'project-owned-fixture' } } }); }
    assert(JSON.stringify(results[1]).includes('NATIVE_OWNER_CONTENT'), 'Fixture: native project skill did not load'); finished = true; sse(response, { text: 'Skill policy fixture complete' });
  });
  const folder = path.join(f.project, '.opencode/skills/project-owned-fixture'); fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'SKILL.md'), '---\nname: project-owned-fixture\ndescription: Explicit native project skill\n---\nNATIVE_OWNER_CONTENT\n');
  const { server, id } = await f.launch([{ action: 'skill', resource: '*', effect: 'allow' }]);
  await server.request('POST', '/api/session/' + id + '/prompt', { text: 'Synthetic guard test: attempt the named fixture skill then its explicit native project equivalent.' });
  await until(() => { f.check(); return finished; }, 'Source-aware native skill denial and owner import', 30000);
});
