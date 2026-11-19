import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, storedAttribution } from '../../plugins/agent-identity/identity.mjs';
import { nativeMessages } from '../../native-history.mjs';
import { nativeMessages as graphMessages } from '../../../../super-turing-opencode-codegraph/v2/plugins/access/native-messages.mjs';

test('CodeGraph source wrapper reexports the canonical base transport', () => {
  assert.equal(nativeMessages, graphMessages);
});

test('stored attribution exhausts ascending pages and projects historical agent/model/variant only', async () => {
  const calls=[];
  const api={async list(input) { calls.push(input); return calls.length===1
    ? {data:[{id:'m1',type:'user',text:'PRIVATE_USER'},{id:'m2',type:'assistant',agent:'planner',model:{providerID:'fixture',id:'old',variant:'low'},content:[{text:'PRIVATE_BODY'}],native:'PRIVATE_NATIVE'}],cursor:{next:'opaque-next'}}
    : {data:[{id:'m3',type:'compaction',model:{providerID:'fixture',id:'summary'},summary:'PRIVATE_SUMMARY'},{id:'m4',type:'assistant',agent:'master-dev',model:{providerID:'fixture',id:'new'},content:'PRIVATE_TOOL'},{id:'m5',type:'assistant'}],cursor:{next:null}}; }};
  const result=await storedAttribution('ses_fixture',api,undefined,2);
  assert.equal(result.scope,'stored-session-history'); assert.equal(result.completeHistory,true);
  assert.deepEqual(result.messages.map(row=>row.index),[1,2,3,4,5]);
  assert.equal(result.messages[1].agent,'planner'); assert.equal(result.messages[1].model.variant,'low');
  assert.deepEqual(result.messages[2],{index:3,type:'compaction',model:{providerID:'fixture',id:'summary'}});
  assert.equal(result.messages[3].agent,'master-dev'); assert.equal(result.messages[4].agent,'unknown-agent');
  assert.equal(result.messages[4].model.id,'unknown-model');
  assert.deepEqual(calls,[{sessionID:'ses_fixture',limit:2,order:'asc'},{sessionID:'ses_fixture',limit:2,cursor:'opaque-next'}]);
  assert(!JSON.stringify(result).includes('PRIVATE')); assert(result.coverage.includes('Not a V1 history migration guarantee'));
});

test('stored mode does not silently return a partial/context result on pagination, transport or cancellation failure', async () => {
  const row={id:'same',type:'assistant'};
  await assert.rejects(storedAttribution('ses_fixture',{list:async()=>({data:[row],cursor:{next:'again'}})}),/Duplicate/);
  let id=0;
  await assert.rejects(storedAttribution('ses_fixture',{list:async()=>({data:[{id:String(++id),type:'user'}],cursor:{next:'again'}})}),/cursor repeated/);
  await assert.rejects(storedAttribution('ses_fixture',{list:async()=>({data:[]})}),/pagination/);
  await assert.rejects(storedAttribution('ses_fixture',{list:async()=>{throw new Error('Unavailable');}}),/Unavailable/);
  const controller=new AbortController(); controller.abort(); let read=false;
  await assert.rejects(storedAttribution('ses_fixture',{list:async()=>{read=true;}},controller.signal),/abort/i); assert.equal(read,false);
  assert.equal((await storedAttribution('ses_empty',{list:async()=>({data:[],cursor:{}})})).messages.length,0);
});

test('stored tool keeps existing permission before any read, current-session-only input and no context fallback', async () => {
  let tool, hook, reads=0, contextReads=0, deny=false;
  const ctx={options:{history:'stored',pageSize:1},session:{async hook(_,fn){hook=fn;},async context(){contextReads++;return[];}},
    permission:{async assert(input){assert.equal(input.action,'agent_attribution'); assert.equal(input.sessionID,'ses_current');if(deny)throw new Error('denied');}},
    tool:{async transform(fn){fn({add(value){tool=value;}});}}};
  await register(ctx,{async list(input){reads++;assert.equal(input.sessionID,'ses_current');return{data:[{id:'m1',type:'assistant',agent:'planner',model:{providerID:'mock',id:'model'}}],cursor:{}};}});
  const event={agent:'planner',system:[]};hook(event);assert(event.system[0].text.includes('planner'));
  assert.deepEqual(tool.input.properties,{});assert.equal(tool.input.additionalProperties,false);
  deny=true;await assert.rejects(tool.execute({}, {sessionID:'ses_current',agent:'planner'}),/denied/);assert.equal(reads,0);
  deny=false;const result=JSON.parse((await tool.execute({}, {sessionID:'ses_current',agent:'planner'})).content);assert.equal(result.completeHistory,true);assert.equal(reads,1);assert.equal(contextReads,0);
  await register(ctx,{async list(){throw new Error('Owned transport missing');}});
  await assert.rejects(tool.execute({}, {sessionID:'ses_current',agent:'planner'}),/Owned transport missing/);assert.equal(contextReads,0);
});
