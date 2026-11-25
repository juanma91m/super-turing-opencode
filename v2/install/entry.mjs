import assert from 'node:assert/strict';
import { installedPlan } from '../general/releases.mjs';
import { checkCandidate } from '../general/lifecycle.mjs';
import { npmRuntime } from '../general/npm-runtime.mjs';
import { inspectStartup } from '../general/launch.mjs';
import { validateInstalledPlaywright } from '../playwright/installed-runtime.mjs';
import { runProductionCLI } from '../general/production-cli.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export async function main(argv,cwd,settings){
  if(settings.ownerEntry){
    const owner=await import(pathToFileURL(settings.ownerEntry));
    return owner.main(argv,cwd,settings);
  }
  assert(settings.owner==='portable-production-entry');
  const runtime=npmRuntime(settings.stagingRoot);
  return runProductionCLI({argv,cwd,stagingRoot:settings.stagingRoot,storageRoot:settings.storageRoot,managedContract:settings.managedContract,
    select:async directory=>{const plan=installedPlan(settings.generalRoot,directory);return{plan,
      check:()=>{validateInstalledPlaywright(plan);return checkCandidate(plan,runtime,{generalOnly:true});},
      inspectStartup:(server,active)=>inspectStartup(server,active)};}});
}
