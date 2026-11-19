import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { readDefaults } from '../../v2/general/defaults.mjs';
try {
  assert(process.argv.length === 3 && process.argv[2] === 'plan', 'Uso: general-defaults.mjs plan (metadata only; no activation)');
  console.log(JSON.stringify(readDefaults(path.join(os.homedir(), '.config/opencode'), process.env), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
