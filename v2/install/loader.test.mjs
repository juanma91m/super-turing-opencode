import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';import {test} from 'node:test';
import {renderEntry} from './loader.mjs';
test('generated entry parses with quoted paths and gates chat until marker and completion agree',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'update-loader-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'entry.mjs');fs.writeFileSync(file,renderEntry({coreRoot:root+'/quoted "core"',home:root,root}));
  assert.equal(spawnSync(process.execPath,['--check',file],{encoding:'utf8'}).status,0);
  fs.writeFileSync(path.join(root,'settings.json'),'{}');
  const failed=spawnSync(process.execPath,[file],{encoding:'utf8'});assert.equal(failed.status,1);assert.match(failed.stderr,/Update not committed/);
});
