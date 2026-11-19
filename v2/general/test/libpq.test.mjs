import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { libpqEnvironment,shellEnvironment } from '../policy.mjs';
import { generalEnvironment,prepareGeneral } from '../profile.mjs';
import { serverEnvironment,terminalEnvironment } from '../launch.mjs';
import { officialRuntime } from '../lifecycle.mjs';
import { startOwnedServer,until } from '../owned-server.mjs';

test('existing V1 libpq mechanisms stay ephemeral and scoped to the owned runtime server, not offline or terminal environments',()=>{
  const parent={PGPASSWORD:'synthetic-libpq-only',PGSSLNEGOTIATION:'direct',PGKRBSRVNAME:'fixture',PGSERVICEFILE:'/fixture/service',PGOPTIONS:'MUST_NOT_FORWARD',OPENAI_API_KEY:'MUST_NOT_FORWARD'};
  assert.deepEqual(libpqEnvironment(parent),{PGPASSWORD:'synthetic-libpq-only',PGSSLNEGOTIATION:'direct',PGKRBSRVNAME:'fixture',PGSERVICEFILE:'/fixture/service'});
  const p={root:'/tmp/opencode/fixture',home:'/tmp/opencode/fixture/home',config:'/tmp/opencode/fixture/home/.config',data:'/tmp/opencode/fixture/home/.local/share',state:'/tmp/opencode/fixture/home/.local/state',cache:'/tmp/opencode/fixture/home/.cache',tmp:'/tmp/opencode/fixture/tmp',runtimeHome:'/fixture-runtime'};
  assert.equal(generalEnvironment(p,parent).PGPASSWORD,undefined);assert.equal(serverEnvironment(p,parent).PGPASSWORD,parent.PGPASSWORD);
  assert.equal(serverEnvironment({...p,runtimeHome:undefined},parent).PGPASSWORD,undefined);
  assert.equal(terminalEnvironment(p,{url:'http://127.0.0.1:12345',env:{OPENCODE_PASSWORD:'owned-fixture'}},parent).PGPASSWORD,undefined);
  assert.equal(shellEnvironment(serverEnvironment(p,parent)).PGPASSWORD,undefined);
});

test('official native literal psql helper retains libpq auth/SSL/Kerberos while generic shell and model receive no credentials',async t=>{
  const root=fs.mkdtempSync('/tmp/opencode/libpq-native-');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const project=path.join(root,'project'),runtimeHome=path.join(root,'runtime'),bin=path.join(root,'bin');for(const dir of [project,runtimeHome,bin])fs.mkdirSync(dir);
  assert.equal(spawnSync('/usr/bin/git',['init','--quiet'],{cwd:project,env:{PATH:'/usr/bin:/bin',HOME:root,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}).status,0);
  fs.writeFileSync(path.join(bin,'psql'),'#!/usr/bin/python3\nimport os,sys\nok=os.environ.get("PGPASSWORD")=="synthetic-libpq-only" and os.environ.get("PGSSLNEGOTIATION")=="direct" and os.environ.get("PGKRBSRVNAME")=="fixture" and "OPENCODE_PASSWORD" not in os.environ and "--no-password" in sys.argv and any("BEGIN READ ONLY" in x for x in sys.argv)\nprint("LIBPQ_AUTH_OK" if ok else "LIBPQ_AUTH_MISSING")\n');fs.chmodSync(path.join(bin,'psql'),0o700);
  let broker,server,failure;const outputs=new Map();
  const mock=http.createServer(async(request,response)=>{try{
    let raw='';for await(const chunk of request)raw+=chunk;assert(!raw.includes('synthetic-libpq-only'),'libpq password reached model');const body=JSON.parse(raw),kind=JSON.stringify(body.messages.filter(row=>row.role==='user').at(-1)).match(/PGCASE_([A-Z]+)/)?.[1];assert(kind);
    const results=body.messages.filter(row=>row.role==='tool'&&row.tool_call_id?.startsWith(kind+'_'));if(results.length)outputs.set(kind,JSON.stringify(results.map(row=>row.content)));
    const command=kind==='PSQL'?'python3 '+broker+' helper psql-readonly query --host fixture --database fixture --user fixture --sql "SELECT 1"':'python3 -c \'import os; print("GENERIC_CLEAN" if "PGPASSWORD" not in os.environ and "OPENCODE_PASSWORD" not in os.environ else "GENERIC_LEAK")\'';
    response.writeHead(200,{'Content-Type':'text/event-stream'});const emit=(delta,finish_reason=null)=>response.write('data: '+JSON.stringify({id:'libpq-fixture',object:'chat.completion.chunk',created:1,model:'mock',choices:[{index:0,delta,finish_reason}]})+'\n\n');
    emit(results.length?{role:'assistant',content:'Fixture done'}:{role:'assistant',tool_calls:[{index:0,id:kind+'_call',type:'function',function:{name:'shell',arguments:JSON.stringify({command})}}]});emit({},results.length?'stop':'tool_calls');response.end('data: [DONE]\n\n');
  }catch{failure='Synthetic libpq provider failed';response.writeHead(500);response.end('Fixture failure');}});
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
  try{
    const p=prepareGeneral(path.join(root,'profile'),{project,runtimeHome,mock:'http://127.0.0.1:'+mock.address().port+'/v1'});broker=p.broker;
    server=await startOwnedServer(officialRuntime(path.join(os.homedir(),'.local/share/opencode-v2-clean')).binary,p,profile=>{const env=serverEnvironment(profile,{PGPASSWORD:'synthetic-libpq-only',PGSSLNEGOTIATION:'direct',PGKRBSRVNAME:'fixture'});env.PATH=bin+':'+env.PATH;return env;});
    const approvals=new Set();
    for(const [kind,agent]of [['PSQL','planner'],['GENERIC','master-dev']]){
      const made=await server.request('POST','/api/session',{agent,title:'Synthetic libpq '+kind,location:{directory:project},model:{providerID:'workshop-mock',id:'mock'}});assert.equal(made.status,200);const id=made.value.data.id;
      await server.request('POST','/api/session/'+id+'/prompt',{text:'PGCASE_'+kind});await until(async()=>{if(failure)throw new Error(failure);const pending=(await server.request('GET','/api/session/'+id+'/permission')).value.data;for(const permission of pending??[]){assert.equal(permission.action,'shell');if(!approvals.has(permission.id)){approvals.add(permission.id);const replied=await server.request('POST','/api/session/'+id+'/permission/'+permission.id+'/reply',{decision:'once',message:'Synthetic wrapper permission; no actual database access'});assert(replied.status>=200&&replied.status<300);}}return outputs.has(kind)&&(await server.request('GET','/api/session/'+id+'/context')).value.data.at(-1)?.type==='idle';},kind,30000);
    }
    assert(outputs.get('PSQL').includes('LIBPQ_AUTH_OK'),'Original psql helper must retain selected libpq mechanisms without real database access');assert(outputs.get('GENERIC').includes('GENERIC_CLEAN'));assert(!outputs.get('GENERIC').includes('GENERIC_LEAK'));
  }finally{await server?.close();mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));}
});
