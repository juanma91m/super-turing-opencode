import assert from 'node:assert/strict';
import { installedPlan } from '../general/releases.mjs';
import { checkCandidate,officialRuntime } from '../general/lifecycle.mjs';
import { inspectLiveCandidate } from '../general/launch.mjs';
import { validateInstalledPlaywright } from '../playwright/installed-runtime.mjs';
import { runProductionCLI } from '../general/production-cli.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export async function main(argv,cwd,settings){
  if(settings.ownerEntry){
    const owner=await import(pathToFileURL(settings.ownerEntry));
    return owner.main(argv,cwd,settings);
  }
  assert(settings.owner==='portable-production-entry'&&settings.nativeVersion==='2.2.7');
  const runtime=officialRuntime(settings.stagingRoot);
  return runProductionCLI({argv,cwd,runtime,storageRoot:settings.storageRoot,managedContract:settings.managedContract,
    select:async directory=>{const plan=installedPlan(settings.generalRoot,directory);return{plan,
      check:()=>{validateInstalledPlaywright(plan);return checkCandidate(plan,runtime,{generalOnly:true});},
      inspect:(server,active)=>inspectLiveCandidate(server,active).then(result=>result.public)};}});
}
