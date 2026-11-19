// Bounded reproducer for the public2.2.7 plugin/CLI incompatibility. Own fixture
// only; no real stores, providers, auth, MCP, private imports or model requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { officialRuntime,checkCandidate } from '../lifecycle.mjs';
import { runProductionCLI,MANAGED_CONTRACT } from '../production-cli.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';

async function cli(binary, args, plan, env=generalEnvironment(plan)) {
  const child = spawn(binary, args, { cwd: plan.project, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { errors += bytes; });
  const timer = setTimeout(() => child.kill('SIGTERM'), 20000);
  try {
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    assert.equal(code, 0, 'Native fixture CLI failed; stdout/stderr suppressed');
    return output.trim() ? JSON.parse(output) : undefined;
  } finally { clearTimeout(timer); }
}

test('public native CLI standalone preserves its mode but does not deliver the owned history transport', async t => {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp/opencode', 'transport-compat-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'), plugin = path.join(root, 'plugin'), receipt = path.join(root, 'receipt.json');
  fs.mkdirSync(project); fs.mkdirSync(plugin);
  fs.writeFileSync(path.join(plugin, 'package.json'), '{"type":"module"}');
  const history = new URL('../../native-history.mjs', import.meta.url).pathname;
  fs.writeFileSync(path.join(plugin, 'index.ts'), `
    import fs from 'node:fs';import {Plugin} from '@opencode/plugin';
    import {nativeMessages} from ${JSON.stringify(history)};
    export default Plugin.define({id:'fixture.transport-compat',async setup(ctx){
      await ctx.command.transform(editor=>editor.add({name:'fixture-transport-compat',async execute({sessionID}){
        let success=false;try{await nativeMessages().list({sessionID,limit:1});success=true;}catch{}
        fs.writeFileSync(${JSON.stringify(receipt)},JSON.stringify({
          hasStoredMessageAPI:typeof ctx.session.message==='object',
          hasContextAPI:typeof ctx.session.context==='function',
          hasOwnedFD:process.env.OPENCODE_STACK_TRANSPORT_FD==='3',
          historyReadSucceeded:success
        }),{mode:0o600});
      }}));
    }});
  `);
  const plan = prepareGeneral(path.join(root, 'profile'), { project, mock: 'http://127.0.0.1:1/v1', plugins: [plugin] });
  const runtime = officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  const host = await startOwnedServer(runtime.binary, plan, generalEnvironment);
  try {
    const made = await host.request('POST', '/api/session', { agent: 'agent-design', title: 'Synthetic compatibility', location: { directory: project } });
    assert.equal(made.status, 200);
    const called = await host.request('POST', '/api/session/' + made.value.data.id + '/command', { name: 'fixture-transport-compat', text: '' });
    assert.equal(called.status, 204); await until(() => fs.existsSync(receipt), 'Owned fixture receipt');
    assert.deepEqual(JSON.parse(fs.readFileSync(receipt)), { hasStoredMessageAPI: false, hasContextAPI: true, hasOwnedFD: true, historyReadSucceeded: true });
  } finally { await host.close(); }
  fs.unlinkSync(receipt);
  // No --server rewriting: run the actual official native --standalone path.
  const made = await cli(runtime.binary, ['api', 'POST', '/api/session', '--data', JSON.stringify({ agent: 'agent-design', title: 'Standalone synthetic', location: { directory: project } }), '--standalone'], plan);
  await cli(runtime.binary, ['api', 'POST', '/api/session/' + made.data.id + '/command', '--data', '{"name":"fixture-transport-compat","text":""}', '--standalone'], plan);
  await until(() => fs.existsSync(receipt), 'Standalone fixture receipt');
  assert.deepEqual(JSON.parse(fs.readFileSync(receipt)), { hasStoredMessageAPI: false, hasContextAPI: true, hasOwnedFD: false, historyReadSucceeded: false });
  fs.unlinkSync(receipt);
  // Approved managed production mode: the actual native API frontend runs with
  // preserved argv against the owned host; stored history still has its fd3.
  const storageRoot=path.join(root,'production-storage'),db=path.join(storageRoot,'data/opencode/opencode.db');
  fs.mkdirSync(path.dirname(db),{recursive:true,mode:0o700});fs.mkdirSync(path.join(storageRoot,'state'),{mode:0o700});
  const copied=spawnSync('/usr/bin/python3',['-c','import sqlite3,sys; a=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); b=sqlite3.connect(sys.argv[2]); a.backup(b); b.close(); a.close()',path.join(plan.data,'opencode/opencode.db'),db],{encoding:'utf8'});assert.equal(copied.status,0);fs.chmodSync(db,0o600);
  fs.writeFileSync(path.join(storageRoot,'.production-storage.json'),JSON.stringify({schemaVersion:1,owner:'opencode-stack',kind:'production-native-storage',nativeVersion:'2.2.7',root:storageRoot,phase:'history-verified'}),{mode:0o600});
  const before=fs.statSync(path.join(plan.data,'opencode/opencode.db')).mtimeMs;
  const code=await runProductionCLI({argv:['api','POST','/api/session/'+made.data.id+'/command','--data','{"name":"fixture-transport-compat","text":""}'],cwd:project,runtime,storageRoot,managedContract:MANAGED_CONTRACT,
    select:async()=>({plan,check:()=>checkCandidate(plan,runtime),inspect:async()=>{throw Error('No model/chat inspection for explicit API command');}}),
    child:async(binary,args,{env})=>{await cli(binary,args,plan,env);return 0;}});
  assert.equal(code,0);await until(()=>fs.existsSync(receipt),'Managed production transport receipt');
  assert.deepEqual(JSON.parse(fs.readFileSync(receipt)),{hasStoredMessageAPI:false,hasContextAPI:true,hasOwnedFD:true,historyReadSucceeded:true});
  assert.equal(fs.statSync(path.join(plan.data,'opencode/opencode.db')).mtimeMs,before,'Source fixture data is not the production binding');
});
