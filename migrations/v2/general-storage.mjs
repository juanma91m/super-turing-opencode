// Readiness only: no launch, DB reads, credential checks, binding or writes.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { existingV2Storage } from '../../v2/general/storage.mjs';
try {
  assert(process.argv.length === 3 && process.argv[2] === 'plan', 'Uso: general-storage.mjs plan (metadata only; no activation)');
  const selected = existingV2Storage(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
  console.log(JSON.stringify({ status: 'existing V2 pilot storage paths/ownership ready for explicit opt-in', sourceRoot: selected.sourceRoot,
    dataStateReuse: 'proposed only; no copy, symlink, binding or launch performed', homeConfigCacheTmp: 'remain candidate-owned', credentialState: selected.credentialState,
    databaseContentRead: false, realStorageOpenedByHost: false, writesPerformed: 0, v1StorageSelected: false,
    activationRequires: ['explicit storage reuse consent in future launcher; no activation command is exposed here', 'clients using the shared V2 store closed by operator', 'validated official runtime and candidate composition', 'real general → organization → project gates before global cutover'],
    limitations: ['Reusing native storage is not an independent backup or V1 history migration', 'Native runtime may write migrations, locks, sessions or OAuth refresh state when later launched', 'No credential validity or current login was queried; do not start another login by initiative'] }, null, 2));
} catch { console.error('Native V2 storage readiness failed; check public markers and expected paths. No stores opened or changed.'); process.exitCode = 1; }
