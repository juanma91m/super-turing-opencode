import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const spec=JSON.parse(fs.readFileSync(process.argv[2]));
process.env.OPENCODE_STACK_SOURCE_DIR=path.join(spec.sourceRoot,'opencode-stack');
process.env.OPENCODE_PRIVATE_SOURCE_ROOT=spec.sourceRoot;
const owner=await import(pathToFileURL(path.join(spec.sourceRoot,spec.ownerAdapter.directory,spec.ownerAdapter.module)));
await owner.rollback(spec.root);
console.log(JSON.stringify({kind:'owner-cohort-restored',databasesRestored:false}));
