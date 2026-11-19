import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../../../v2/general/profile.mjs';
import { officialRuntime } from '../../../v2/general/lifecycle.mjs';
import { startOwnedServer, until } from '../../../v2/general/owned-server.mjs';
import { productionStorage, bindProductionStorage } from '../../../v2/general/production-storage.mjs';

async function procedure(action, spec, flags=[]) {
  const child=spawn('/usr/bin/python3',[new URL('../cutover-storage.py',import.meta.url).pathname,action,'--spec',spec,...flags],{env:{PATH:'/usr/bin:/bin',PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
  let text='';child.stdout.on('data',part=>text+=part);child.stderr.resume();const timer=setTimeout(()=>child.kill('SIGTERM'),60000);
  try{const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});const root=JSON.parse(fs.readFileSync(spec)).runRoot;const metadata=['preparation-failure.json','evidence/native-transfer-failure.json','source-snapshot-observation.json'].filter(name=>fs.existsSync(path.join(root,name))).map(name=>JSON.parse(fs.readFileSync(path.join(root,name))));assert.equal(code,0,'Isolated final storage fixture failed; curated metadata: '+JSON.stringify(metadata));return JSON.parse(text);}finally{clearTimeout(timer);}
}

test('final procedure unions official native stores, inline media, family/archive and native auth pipe without touching sources',async t=>{
  const root=fs.mkdtempSync(path.join(process.env.TMPDIR??'/tmp/opencode','final-storage-native-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  let requests=0;
  const mock=http.createServer(async(req,res)=>{for await(const _ of req){}requests++;res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'mock',choices:[{index:0,delta:{role:'assistant',content:'SYNTHETIC_REPLY'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');});
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));t.after(()=>{mock.closeAllConnections();mock.close();});
  const project=path.join(root,'project');fs.mkdirSync(project);
  const gitEnv={PATH:'/usr/bin:/bin',HOME:root,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'};
  assert.equal(spawnSync('/usr/bin/git',['init','--quiet'],{cwd:project,env:gitEnv}).status,0);
  assert.equal(spawnSync('/usr/bin/git',['config','remote.origin.url','https://example.invalid/synthetic-storage.git'],{cwd:project,env:gitEnv}).status,0);
  const runtime=officialRuntime(path.join(os.homedir(),'.local/share/opencode-v2-clean'));
  const plans=['original','pilot'].map(name=>prepareGeneral(path.join(root,name),{project,mock:'http://127.0.0.1:'+mock.address().port+'/v1'}));
  const original=await startOwnedServer(runtime.binary,plans[0],generalEnvironment);let pilot;
  let originalID,newID,childID,archivedID,credentialID,projectID;
  try{
    const first=await original.request('POST','/api/session',{agent:'master-dev',title:'Synthetic original',location:{directory:project}});originalID=first.value.data.id;projectID=first.value.data.projectID;
    assert.equal((await original.request('POST','/api/session/'+originalID+'/prompt',{text:'Synthetic historical message',files:[{uri:'data:text/plain;base64,U1lOVEhFVElDX0ZJTEU='}]})).status,200);
    await until(async()=>(await original.request('GET','/api/session/'+originalID+'/message?type=assistant')).value.data.some(row=>row.time.completed),'Synthetic original completed');
    const data=(await original.request('GET','/api/experimental/session/'+originalID+'/export')).value.data;
    pilot=await startOwnedServer(runtime.binary,plans[1],generalEnvironment);
    assert.equal((await pilot.request('POST','/api/experimental/session/import',{...data,location:{directory:project}})).status,200);
    newID=(await pilot.request('POST','/api/session',{agent:'master-dev',title:'Synthetic pilot root',location:{directory:project}})).value.data.id;
    childID=(await pilot.request('POST','/api/session',{agent:'planner',title:'Synthetic pilot child',parentID:newID,location:{directory:project}})).value.data.id;
    archivedID=(await pilot.request('POST','/api/session',{agent:'master-dev',title:'Synthetic archived',location:{directory:project}})).value.data.id;
    // The native run --archived handler uses session.update, not a create flag.
    const spec=(await pilot.request('GET','/openapi.json')).value;
    const [updatePath,methods]=Object.entries(spec.paths).find(([,methods])=>Object.values(methods).some(operation=>operation.operationId==='session.update'));
    const updateMethod=Object.keys(methods).find(method=>methods[method].operationId==='session.update');
    assert.equal((await pilot.request(updateMethod.toUpperCase(),updatePath.replace('{sessionID}',archivedID),{archived:true})).status,204);
    const credential=await pilot.request('POST','/api/credential',{integrationID:'fixture-auth',label:'Synthetic only',value:{type:'key',key:'SYNTHETIC_NOT_A_REAL_CREDENTIAL'}});
    assert.equal(credential.status,200);credentialID=credential.value.data.id;
  }finally{await pilot?.close();await original.close();}
  const runRoot=path.join(root,'final'),spec=path.join(root,'spec.json');fs.writeFileSync(spec,JSON.stringify({schemaVersion:1,owner:'opencode-stack',kind:'final-storage-plan',originalDB:path.join(plans[0].data,'opencode/opencode.db'),pilotDB:path.join(plans[1].data,'opencode/opencode.db'),runRoot,runtime:runtime.binary,budgetSeconds:120,authTransfer:'native-pipe',projectRoots:[project]}),{mode:0o600});
  const preflight=await procedure('plan',spec);assert.equal(preflight.databaseOpened,false);assert.deepEqual(preflight.sourceUsers,[]);
  const report=await procedure('prepare',spec,['--v1-closed','--pilot-closed']);assert.equal(report.nativeTransferVerified,true);assert.equal(report.finalSessions,4);assert.equal(report.identicalDuplicates,1);assert.equal(report.importedSessions,3);
  assert.deepEqual(await procedure('resume',spec,['--v1-closed','--pilot-closed']),report,'Explicit resume verifies the same captured sources and reuses the completed native result without recapture');
  const published=await procedure('publish',spec,['--v1-closed','--pilot-closed']);assert.equal(published.entryActivated,false);
  const active=bindProductionStorage(plans[0],productionStorage(path.join(runRoot,'production-storage'))),final=await startOwnedServer(runtime.binary,active,generalEnvironment);
  try{
    const sessions=(await final.request('GET','/api/session?limit=100&project='+projectID)).value.data;assert.deepEqual(new Set(sessions.map(row=>row.id)),new Set([originalID,newID,childID,archivedID]));assert.equal(sessions.find(row=>row.id===childID).parentID,newID);assert(sessions.find(row=>row.id===archivedID).time.archived);assert(sessions.every(row=>row.projectID===projectID));
    const data=(await final.request('GET','/api/experimental/session/'+originalID+'/export')).value.data;assert(data.messages.some(row=>row.type==='user'&&row.files?.some(file=>file.data==='U1lOVEhFVElDX0ZJTEU=')));
    const credentials=(await final.request('GET','/api/credential')).value.data;assert.equal(credentials.find(row=>row.id===credentialID)?.value.key,'SYNTHETIC_NOT_A_REAL_CREDENTIAL');
    assert.equal(requests,1,'Only the explicit synthetic historical seed requested a mock reply; migration/transfer issue no model calls');
  }finally{await final.close();}
});
