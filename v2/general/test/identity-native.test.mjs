// V1-equivalent stored attribution, not a migration test or access to real DBs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { officialRuntime } from '../lifecycle.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';
import { codegraphContribution } from '../../../../super-turing-opencode-codegraph/v2/general.mjs';

const unpack=value=>{if(typeof value==='string'){try{return unpack(JSON.parse(value));}catch{return value;}}if(Array.isArray(value))return unpack(value[0]);if(value?.text!==undefined)return unpack(value.text);if(value?.content!==undefined&&!value.error)return unpack(value.content);return value;};

for(const order of ['attribution-first','benchmark-first']) test('official stored attribution survives compaction and shares transport with benchmark: '+order,async t=>{
  const root=fs.mkdtempSync('/tmp/opencode/identity-native-');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const project=path.join(root,'project'), control=path.join(root,'control'), runtimeHome=path.join(root,'runtime');for(const dir of [project,control,runtimeHome])fs.mkdirSync(dir);
  fs.writeFileSync(path.join(control,'package.json'),' {"type":"module"}');
  fs.writeFileSync(path.join(control,'index.ts'),'import {Plugin} from "@opencode/plugin";export default Plugin.define({id:"fixture.identity",async setup(ctx){await ctx.session.hook("title",e=>{e.result="Identity fixture"});await ctx.session.hook("compaction",e=>{e.result={summary:"PRIVATE_COMPACTION_SUMMARY",tokens:{input:5,output:2,reasoning:0,cache:{read:0,write:0}}}})}});');
  const traces=new Map();let requests=0,failure,server;
  const mock=http.createServer(async(request,response)=>{
    try{
      let raw='';for await(const part of request)raw+=part;
      const body=JSON.parse(raw),kind=JSON.stringify(body.messages.filter(message=>message.role==='user').at(-1)).match(/ICASE_([A-Z_]+)/)?.[1];assert(kind);requests++;
      const outputs=body.messages.filter(message=>message.role==='tool'&&message.tool_call_id?.startsWith(kind+'_'));
      let call;
      if(!outputs.length&&kind.includes('ATTR'))call=['agent_attribution',{}];
      if(!outputs.length&&kind==='BENCH')call=['codegraph-benchmark',{action:'history',since:'2026-01-01',until:'2027-12-31'}];
      if(outputs.length){const results=outputs.map(row=>unpack(row.content));assert(!/PRIVATE_USER|PRIVATE_ASSISTANT|PRIVATE_COMPACTION|PRIVATE_NATIVE/.test(JSON.stringify(results)));traces.set(kind,results);}
      else if(!call)traces.set(kind,[]);
      response.writeHead(200,{'Content-Type':'text/event-stream'});
      const emit=(delta,finish_reason=null)=>response.write('data: '+JSON.stringify({id:'identity-fixture',object:'chat.completion.chunk',created:1,model:'mock',choices:[{index:0,delta,finish_reason}]})+'\n\n');
      emit(call?{role:'assistant',tool_calls:[{index:0,id:kind+'_call',type:'function',function:{name:call[0],arguments:JSON.stringify(call[1])}}]}:{role:'assistant',content:'PRIVATE_ASSISTANT_BODY'});emit({},call?'tool_calls':'stop');response.end('data: [DONE]\n\n');
    }catch{failure='Synthetic identity provider failed; bodies suppressed';response.writeHead(500);response.end('Fixture failure');}
  });
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
  try{
    const p=prepareGeneral(path.join(root,'profile'),{project,mock:'http://127.0.0.1:'+mock.address().port+'/v1',plugins:[control],contributions:[codegraphContribution({binding:{runtime_home:runtimeHome,runtime_bin:'/fixture/not-used'},server:{type:'local',command:['/fixture/not-started'],disabled:true,codemode:false}})]});
    const definition=p.document.plugins.find(item=>typeof item==='object'&&item.package.endsWith('/agent-identity'));assert.equal(definition.options.history,'stored');definition.options.pageSize=2;
    fs.writeFileSync(path.join(p.config,'opencode/opencode.json'),JSON.stringify(p.document));
    server=await startOwnedServer(officialRuntime(path.join(os.homedir(),'.local/share/opencode-v2-clean')).binary,p,generalEnvironment);
    const create=async(agent='master-dev',permissions=[])=>{const result=await server.request('POST','/api/session',{agent,title:'Synthetic attribution',location:{directory:project},model:{providerID:'workshop-mock',id:'mock'},permissions});assert.equal(result.status,200);return result.value.data.id;};
    const execute=async(id,kind)=>{
      const result=await server.request('POST','/api/session/'+id+'/prompt',{text:'ICASE_'+kind+' PRIVATE_USER_BODY'});assert.equal(result.status,200);
      await until(async()=>{if(failure)throw new Error(failure);return traces.has(kind)&&(await server.request('GET','/api/session/'+id+'/context')).value.data.at(-1)?.type==='idle';},kind,30000);return traces.get(kind);
    };
    const seed=await create();await execute(seed,'FIRST');
    const spec=(await server.request('GET','/openapi.json')).value;
    const [switchPath,switchMethods]=Object.entries(spec.paths).find(([,methods])=>Object.values(methods).some(method=>method.operationId==='session.switchAgent'));
    const switchMethod=Object.keys(switchMethods).find(method=>switchMethods[method].operationId==='session.switchAgent');
    assert.equal((await server.request(switchMethod.toUpperCase(),switchPath.replace('{sessionID}',seed),{agent:'planner'})).status,204);
    await execute(seed,'SECOND');
    const before=(await server.request('GET','/api/session/'+seed+'/message?type=assistant&order=asc')).value.data;
    assert.deepEqual(before.map(row=>row.agent),['master-dev','planner']);
    assert.equal((await server.request('POST','/api/session/'+seed+'/compact',{})).status,200);
    await until(async()=>(await server.request('GET','/api/session/'+seed+'/message?type=compaction')).value.data.some(row=>row.status==='completed'),'Compaction');
    const visible=(await server.request('GET','/api/session/'+seed+'/context')).value.data;
    assert(!visible.some(row=>row.id===before[0].id),'Fixture must actually lose pre-compaction assistant from model context');
    const operator=await create('master-dev',[{action:'codegraph-benchmark-read',resource:'*',effect:'allow'}]);
    let attribution;
    for(const action of order==='attribution-first'?['ATTR','BENCH']:['BENCH','ATTR']){
      const result=(await execute(action==='ATTR'?seed:operator,action))[0];assert(!result.error,action+': '+result.error?.message);
      if(action==='ATTR')attribution=result;else assert.equal(result.families,1);
    }
    assert.equal(attribution.completeHistory,true);assert.equal(attribution.scope,'stored-session-history');
    assert(attribution.messages.some(row=>row.type==='assistant'&&row.agent==='master-dev'));
    assert(attribution.messages.some(row=>row.type==='assistant'&&row.agent==='planner'));
    assert(attribution.messages.some(row=>row.type==='compaction'));
    assert(attribution.messages.filter(row=>row.type==='assistant').every(row=>row.model.providerID==='workshop-mock'&&row.model.id==='mock'));
    const fork=(await server.request('POST','/api/session/'+seed+'/fork',{}));assert.equal(fork.status,200);
    const forkAttr=(await execute(fork.value.data.id,'FORK_ATTR'))[0];assert(!forkAttr.error);assert(forkAttr.messages.some(row=>row.type==='assistant'&&row.agent==='master-dev'));
    const denied=await create('planner',[{action:'agent_attribution',resource:'*',effect:'deny'}]);
    assert((await execute(denied,'DENIED_ATTR'))[0].error,'Native session deny must still block attribution');
    assert.equal(requests,10,'Only explicit fixture turns, no attribution/benchmark inference of its own');
  }finally{await server?.close();mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));}
});
