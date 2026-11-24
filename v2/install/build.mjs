// Complete profile construction from reviewed owner APIs; never invokes legacy
// asset installers, rewrites user config/auth or creates replacement Knowledge DBs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planGeneral } from '../general/profile.mjs';
import * as portableReleases from '../general/releases.mjs';
import { officialRuntime } from '../general/lifecycle.mjs';
import { productionStorage } from '../general/production-storage.mjs';
import {renderEntry} from './loader.mjs';

const spec=JSON.parse(fs.readFileSync(process.argv[2]));
const {selection,root,sourceRoot}=spec,home=selection.home,config=selection.config;
assert(path.isAbsolute(root)&&path.isAbsolute(home)&&fs.realpathSync(root)===root);
assert(process.env.HOME===home,'Updater must run with the selected real HOME');
const coreRoot=path.join(sourceRoot,'opencode-stack');
process.env.OPENCODE_STACK_SOURCE_DIR=coreRoot;
process.env.OPENCODE_PRIVATE_SOURCE_ROOT=sourceRoot;
const {stagingRoot,storageRoot,profile}=selection.previousSettings;
const runtime=officialRuntime(stagingRoot);
productionStorage(storageRoot);
const project=path.join(root,'neutral-project');
fs.mkdirSync(project,{mode:0o700});
const baseOptions={project,runtimeHome:home,maintenanceModels:Object.fromEntries(['title','summary','compaction'].map(id=>[id,{model:'openai/gpt-6.1-sol'}]))};
if(profile!=='base'){
const [{generalAddons},{selectGeneralAddons},{readGeneralDefaults}]=await Promise.all([
  import('../general/addons.mjs'),import('../general/select-addons.mjs'),import('../general/defaults.mjs')]);
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
const defaults=readGeneralDefaults(config);
Object.assign(baseOptions,{maintenanceModels:defaults.maintenanceModels,dormantProviders:defaults.dormantProviders,contributions:generalAddons(selected.descriptors)});
}else assert(!spec.ownerAdapter,'A base update cannot adopt an owner');
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
settings={schemaVersion:1,nativeVersion:'2.2.7',managedContract:'managed-harness-v1',coreRoot,stagingRoot,generalRoot,generalRevision:gr.revision,storageRoot,
  ...(profile==='base'?{profile}:{}),
  ...(ownerStage?.settings??{owner:'portable-production-entry'})};
const settingsFile=path.join(root,'settings.json');fs.writeFileSync(settingsFile,JSON.stringify(settings,null,2)+'\n',{mode:0o600,flag:'wx'});
const entry=path.join(root,'entry.mjs');
const loader=renderEntry({coreRoot,home,root});
fs.writeFileSync(entry,loader,{mode:0o600,flag:'wx'});
if(owner&&!spec.prepareOnly)await owner.finalize(ownerStage);
console.log(JSON.stringify({kind:'native-update-staged',ready:!spec.prepareOnly,prepareOnly:Boolean(spec.prepareOnly),nativeVersion:'2.2.7',entry,storageRoot,generalRoot,
  startupVerified:false,needsLogin:false,sourceHistoryRewritten:false,engramCopiedIntoNewProfile:false}));
