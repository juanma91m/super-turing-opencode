import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {inspectLiveCandidate,inspectStartup} from '../launch.mjs';
import {pendingMcpCatalog,settleCatalogAudit} from '../catalog-readiness.mjs';

test('catalog deadline retains the final missing-tool finding; failed/disabled/unknown servers and permission errors are not retried',async()=>{
  const audit={status:'warning',findings:[{severity:'warning',code:'managed-tool-missing',subject:'rovo_read'}]},servers={rovo:{}},connected=[{name:'rovo',status:{status:'connected'}}];
  assert(pendingMcpCatalog(audit,servers,connected));
  assert(!pendingMcpCatalog(audit,{rovo:{disabled:true}},connected));
  assert(!pendingMcpCatalog(audit,servers,[{name:'rovo',status:{status:'failed'}}]));
  assert(!pendingMcpCatalog(audit,{different:{}},connected));
  assert(!pendingMcpCatalog({...audit,findings:[...audit.findings,{severity:'error',code:'global-prompt-lost'}]},servers,connected));
  let time=0,samples=0;
  const result=await settleCatalogAudit(async()=>{samples++;return audit;},r=>pendingMcpCatalog(r,servers,connected),{deadline:400,now:()=>time,pause:async ms=>{time+=ms;}});
  assert.equal(time,400);assert.equal(samples,3);assert.equal(result,audit);assert.equal(result.status,'warning');
  await assert.rejects(()=>settleCatalogAudit(async()=>{throw Error('SYNTHETIC_NATIVE_FAILURE');},()=>true,{deadline:500}),/SYNTHETIC_NATIVE_FAILURE/);
});

test('Connected MCP is not sufficient: startup waits for its reviewed tool registry and cleans only one owned session',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'catalog-readiness-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const cache=path.join(root,'cache'),directory=path.join(cache,'general-runtime-probes');fs.mkdirSync(directory,{recursive:true});
  const plan={cache,project:root,roles:[],commands:[],components:[],document:{default_agent:'master-dev',plugins:[],mcp:{servers:{'atlassian-rovo':{type:'remote',url:'https://example.invalid/mcp'}}}}};
  const ids=['env-guard','controlled-permissions','planner-shell','agent-identity','general'].map(x=>'opencode-stack.'+x);
  let created=0,removed=0,samples=0;
  const server={request:async(method,route,body)=>{
    if(route==='/api/plugin')return{status:200,value:ids.map(id=>({id,source:{type:'file'}}))};
    if(route==='/api/mcp')return{status:200,value:[{name:'atlassian-rovo',status:{status:'connected'}}]};
    if(route==='/api/agent')return{status:200,value:[{id:'master-dev',mode:'primary',model:{providerID:'fixture'}}]};
    if(route==='/api/integration')return{status:200,value:[]};
    if(route==='/openapi.json')return{status:200,value:{paths:{'/api/session/{sessionID}/command':{post:{operationId:'session.command'}},'/api/session/{sessionID}':{delete:{operationId:'session.remove'}}}}};
    if(method==='POST'&&route==='/api/session'){created++;return{status:200,value:{data:{id:'ses_fixture'}}};}
    if(method==='DELETE'&&route==='/api/session/ses_fixture'){removed++;return{status:204};}
    if(method==='POST'&&route==='/api/session/ses_fixture/command'){
      samples++;
      const findings=samples===1?[{severity:'warning',code:'managed-tool-missing',subject:'atlassian-rovo_getJiraIssue'}]:[];
      fs.writeFileSync(path.join(directory,body.text+'.json'),JSON.stringify({owner:'opencode-stack',kind:'native-runtime-probe',version:1,nonce:body.text,audit:{status:findings.length?'warning':'pass',findings,toolIDs:samples===1?[]:['atlassian-rovo_getJiraIssue'],skillIDs:[]}}),{flag:'wx',mode:0o600});
      return{status:200};
    }
    throw Error('Unexpected fixture operation: '+method+' '+route);
  }};
  const result=await inspectLiveCandidate(server,plan);
  assert.equal(result.public.ready,true);
  assert.equal(samples,2);
  assert.equal(created,1);assert.equal(removed,1);
  assert.deepEqual(fs.readdirSync(directory),[]);
});

test('production startup never requests MCP health or catalogs, but rejects missing prompts or unexpected plugins',async()=>{
  const role={id:'master-dev',mode:'primary',model:'fixture/model',system:'required baseline',permissions:[]};
  const options={auditBaselines:{'master-dev':role},requiredSystems:{'master-dev':role.system}};
  const plan={project:'/fixture/project',config:'/fixture/config',components:[],document:{default_agent:role.id,
    plugins:[{package:'/fixture/general/plugins/access',options}],mcp:{servers:{slow:{timeout:{startup:60000}}}}}};
  const ids=['env-guard','controlled-permissions','planner-shell','agent-identity','general'].map(x=>'opencode-stack.'+x);
  const server=(effectiveRole=role,extra=[])=>({request:async(method,route)=>{
    assert.equal(method,'GET');
    assert(['/api/plugin','/api/agent'].includes(route),'unexpected startup query '+route);
    return{status:200,value:route==='/api/agent'?[effectiveRole]:[...ids,...extra].map(id=>({id,source:{type:'file'}}))};
  }});
  assert.deepEqual(await inspectStartup(server(),plan),{readyForStartup:true});
  assert.deepEqual(await inspectStartup(server({...role,system:'missing'}),plan),{readyForStartup:false});
  await assert.rejects(inspectStartup(server(role,['unreviewed.plugin']),plan),/Unexpected external native plugin/);
});
