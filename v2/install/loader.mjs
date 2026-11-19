import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function renderEntry({coreRoot,home,root}){
  const marker=JSON.stringify(path.join(home,'.local/state/opencode-stack/install/current.json'));
  const module=JSON.stringify(pathToFileURL(path.join(coreRoot,'v2/install/entry.mjs')).href);
  return `import fs from 'node:fs';
const s=JSON.parse(fs.readFileSync(new URL('./settings.json',import.meta.url)));
let committed=false;
try{committed=JSON.parse(fs.readFileSync(${marker})).generation===${JSON.stringify(root)}&&fs.existsSync(new URL('./complete.json',import.meta.url));}catch{}
if(!['--version','-v','--help','-h'].includes(process.argv[2])&&!committed){console.error('Update not committed; review its preserved journal.');process.exit(1);}
process.env.OPENCODE_STACK_SOURCE_DIR=s.coreRoot;
const {main}=await import(${module});
main(process.argv.slice(2),process.cwd(),s).then(code=>{process.exitCode=code;}).catch(()=>{console.error('Managed startup refused; use native auth/review installation metadata.');process.exitCode=1;});
`;
}
