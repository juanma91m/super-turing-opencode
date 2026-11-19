import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { boundedNativeEdit, nativeAllows, nativeActor } from '../plugins/access/native-contract.mjs';

test('native role metadata, not per-session approvals or static target snapshots, authorizes targets and managed tools', async()=>{
  const role={permissions:[{action:'*',resource:'*',effect:'deny'},{action:'subagent',resource:'local-specialist',effect:'allow'},{action:'mcp_read',resource:'*',effect:'ask'}]};
  const ctx={agent:{get:async()=>({data:role})}};
  assert.equal(await nativeActor(ctx,'coordinator'),role);assert(nativeAllows(role,'subagent','local-specialist'));assert(nativeAllows(role,'mcp_read'));
  assert(!nativeAllows(role,'subagent','writer-not-declared'));assert(!nativeAllows(role,'mcp_write'));
  await assert.rejects(()=>nativeActor({agent:{get:async()=>({data:{}})}},'missing'));
});

test('read-only edits honor bounded native paths while preserving deny default, canonical root and symlink guards',t=>{
  const root=fs.mkdtempSync('/tmp/opencode/native-contract-');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const projectRoot=path.join(root,'project'),outside=path.join(root,'outside');fs.mkdirSync(projectRoot);fs.mkdirSync(outside);fs.mkdirSync(path.join(projectRoot,'nested'));
  const role={permissions:[{action:'edit',resource:'*',effect:'deny'},{action:'edit',resource:'tmp/*/code-review/**',effect:'allow'},{action:'edit',resource:'tmp/SECRET-1/code-review/**',effect:'deny'}]};
  const check=(input,tool='write',directory=projectRoot,actor=role)=>boundedNativeEdit(actor,{tool,input},{directory,projectRoot,home:root});
  assert(check({path:'tmp/FIXTURE-1/code-review/report.md'}));assert(check({path:'../tmp/FIXTURE-1/code-review/report.md'},'write',path.join(projectRoot,'nested')));
  assert(!check({path:'src/application.js'}));assert(!check({path:'tmp/FIXTURE-1/code-review/../../../application.js'}));assert(!check({path:'tmp/SECRET-1/code-review/report.md'}));
  assert(!check({path:path.join(outside,'tmp/FIXTURE-1/code-review/report.md')}));
  assert(check({patch:'*** Begin Patch\n*** Add File: tmp/FIXTURE-1/code-review/report.md\n+report\n*** End Patch'},'patch'));
  assert(!check({patch:'*** Begin Patch\n*** Update File: tmp/FIXTURE-1/code-review/report.md\n*** Move to: src/escape.js\n*** End Patch'},'patch'));
  assert(!check({patch:'unknown format'},'patch'));
  fs.symlinkSync(outside,path.join(projectRoot,'tmp'));assert(!check({path:'tmp/FIXTURE-1/code-review/report.md'}));
  const broad={permissions:[...role.permissions,{action:'edit',resource:'*',effect:'allow'}]};assert(!check({path:'tmp/FIXTURE-1/code-review/report.md'},'write',projectRoot,broad));
});
