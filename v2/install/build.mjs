// Complete profile construction from reviewed owner APIs; never invokes legacy
// asset installers, rewrites user config/auth or creates replacement Knowledge DBs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planGeneral } from '../general/profile.mjs';
import { generalAddons } from '../general/addons.mjs';
import { selectGeneralAddons } from '../general/select-addons.mjs';
import { readGeneralDefaults } from '../general/defaults.mjs';
import * as portableReleases from '../general/releases.mjs';
import { officialRuntime } from '../general/lifecycle.mjs';
import { install,layout } from '../../migrations/v2/staging.mjs';
import {renderEntry} from './loader.mjs';

const spec=JSON.parse(fs.readFileSync(process.argv[2]));
const {selection,root,sourceRoot}=spec,home=selection.home,config=selection.config;
assert(path.isAbsolute(root)&&path.isAbsolute(home)&&fs.realpathSync(root)===root);
assert(process.env.HOME===home,'Updater must run with the selected real HOME');
const coreRoot=path.join(sourceRoot,'opencode-stack');
process.env.OPENCODE_STACK_SOURCE_DIR=coreRoot;
process.env.OPENCODE_PRIVATE_SOURCE_ROOT=sourceRoot;
const stagingRoot=path.join(home,'.local/share/opencode-v2-clean');
install(layout(stagingRoot));const runtime=officialRuntime(stagingRoot);
const studio=path.join(sourceRoot,'super-turing-opencode-documents/artifact-studio');
const dependencies=spawnSync('corepack',['pnpm','--dir',studio,'install','--frozen-lockfile'],{encoding:'utf8',timeout:600000,maxBuffer:4*1024*1024,
  env:{PATH:process.env.PATH,HOME:home,COREPACK_ENABLE_DOWNLOAD_PROMPT:'0',NPM_CONFIG_USERCONFIG:'/dev/null',NPM_CONFIG_GLOBALCONFIG:path.join(stagingRoot,'home/npm-global-empty.rc')}});
assert(!dependencies.error&&dependencies.status===0,'Locked Artifact Studio dependencies could not be prepared; no existing runtime replaced');
// Public V1 tool schema extraction needs the pinned SDK as DATA adaptation only;
// it is never loaded as a V2 plugin or installed into the user's configuration.
const metadataDeps=spawnSync('npm',['ci','--prefix',path.join(sourceRoot,'super-turing-opencode-documents/v2/documenter/schema-sdk'),'--ignore-scripts','--no-audit','--no-fund'],{encoding:'utf8',timeout:600000,maxBuffer:4*1024*1024,
  env:{PATH:process.env.PATH,HOME:home,NPM_CONFIG_USERCONFIG:'/dev/null',NPM_CONFIG_GLOBALCONFIG:path.join(stagingRoot,'home/npm-global-empty.rc')}});
assert(!metadataDeps.error&&metadataDeps.status===0,'Locked metadata-only Documents SDK could not be prepared');
const selected=selectGeneralAddons(home,config,process.env,{sourceUpdate:true});
const memoryEnvironment=selected.descriptors.knowledge.server.environment??{};
assert(path.join(memoryEnvironment.ENGRAM_DATA_DIR??path.join(home,'.engram'),'engram.db')===selection.engram,'Selected Engram backup and runtime binding differ; no backend started');
assert((selected.descriptors.knowledge.environment.QDRANT_LOCAL_PATH??path.join(selected.descriptors.knowledge.environment.OPENCODE_KNOWLEDGE_HOME??path.join(home,'.local/share/super-turing-opencode-knowledge'),'qdrant'))===selection.qdrant,'Selected corpus backup and runtime binding differ; no backend started');
assert(selected.descriptors.playwright.runtime.managed_root,'Existing pinned durable Playwright runtime required; no implicit latest-version download');
const defaults=readGeneralDefaults(config),project=path.join(root,'neutral-project');
fs.mkdirSync(project,{mode:0o700});
const baseOptions={project,runtimeHome:home,maintenanceModels:defaults.maintenanceModels,dormantProviders:defaults.dormantProviders,contributions:generalAddons(selected.descriptors)};
const generalRoot=path.join(root,'profiles/general');fs.mkdirSync(path.dirname(generalRoot),{recursive:true,mode:0o700});
const general=planGeneral(generalRoot,baseOptions);
const consent={candidateOnly:true,clientClosed:true};
const gr=portableReleases.installRelease(general,{...consent,validate:p=>portableReleases.validateReleaseSchema(p,runtime)});
let settings,owner,ownerStage;
if(spec.ownerAdapter){
  const adapter=path.join(sourceRoot,spec.ownerAdapter.directory,spec.ownerAdapter.module);
  owner=await import(pathToFileURL(adapter));
  ownerStage=await owner.prepare({selection,root,sourceRoot,runtime,baseOptions,generalRoot,generalRevision:gr.revision});
}else assert(!selection.previousSettings?.products?.length,'Existing owner/project cohort requires its explicit owner source lock; no portable-only downgrade');
const storageRoot=path.join(root,'production-storage');
// Official migration worker receives a copy of history and an empty native donor,
// not the user's original DB/config/auth. No SQL conversion or transcript export.
const work=path.join(root,'native-work');
for(const dir of ['backups/history','production-storage/data/opencode','production-storage/state','pilot-working','evidence'])fs.mkdirSync(path.join(work,dir),{recursive:true,mode:0o700});
const script=String.raw`
import importlib.util,json,os,shutil,sqlite3,sys
from pathlib import Path
core,root,source,runtime=sys.argv[1:];work=Path(root)/'native-work'
def load(name,file):
 s=importlib.util.spec_from_file_location(name,Path(core)/'migrations/v2'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
backup=load('native_backup','cutover-backup.py');storage=load('native_storage','cutover-storage.py')
backup.sqlite_backup(Path(root)/'backup/opencode'/Path(source).name,work/'production-storage/data/opencode/opencode.db')
db=sqlite3.connect(work/'pilot-working/opencode.db');db.close();(work/'pilot-working/opencode.db').chmod(0o600)
backup.write_json(work/'evidence/worker-spec.json',{'budgetSeconds':3600,'authTransfer':'none'})
storage.sandbox({'runtime':runtime,'projectRoots':[],'budgetSeconds':3600},work)
evidence=json.loads((work/'evidence/native-transfer.json').read_text())
if evidence.get('migrationCompleted') is not True or evidence.get('nativeTransferVerified') is not True:raise ValueError('Native migration not verified')
receipt=json.loads((Path(root)/'backup/backup.json').read_text())
for name in receipt.get('historyAssets',{}):
 if name not in ['snapshot','repos']:raise ValueError('Unknown OpenCode asset directory')
 shutil.copytree(Path(root)/'backup/opencode'/name,work/'production-storage/data/opencode'/name)
os.rename(work/'production-storage',Path(root)/'production-storage')
backup.write_json(Path(root)/'production-storage/.production-storage.json',{'schemaVersion':1,'owner':'opencode-stack','kind':'production-native-storage','nativeVersion':'2.2.7','root':str(Path(root)/'production-storage'),'phase':'history-verified'})
`;
const moved=spawnSync('/usr/bin/python3',['-I','-B','-c',script,coreRoot,root,selection.history,runtime.binary],{encoding:'utf8',timeout:3620000,maxBuffer:1024*1024,env:{PATH:'/usr/bin:/bin',PYTHONDONTWRITEBYTECODE:'1'}});
assert(!moved.error&&moved.status===0,'Official migration on the isolated history copy failed; original retained');
settings={schemaVersion:1,nativeVersion:'2.2.7',managedContract:'managed-harness-v1',coreRoot,stagingRoot,generalRoot,generalRevision:gr.revision,storageRoot,
  ...(ownerStage?.settings??{owner:'portable-production-entry'})};
const settingsFile=path.join(root,'settings.json');fs.writeFileSync(settingsFile,JSON.stringify(settings,null,2)+'\n',{mode:0o600,flag:'wx'});
const entry=path.join(root,'entry.mjs');
const loader=renderEntry({coreRoot,home,root});
fs.writeFileSync(entry,loader,{mode:0o600,flag:'wx'});
if(owner&&!spec.prepareOnly)await owner.finalize(ownerStage);
console.log(JSON.stringify({kind:'native-update-staged',ready:!spec.prepareOnly,prepareOnly:Boolean(spec.prepareOnly),nativeVersion:'2.2.7',entry,storageRoot,generalRoot,
  startupVerified:false,needsLogin:true,sourceHistoryRewritten:false,engramCopiedIntoNewProfile:false,
  limitation:'Schema/assets/native history verified. Existing qualified runtimes only; provider login and live startup are separate.'}));
