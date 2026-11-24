// Base-owned offline lifecycle. Never updates the current global config/router.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

try {
  const args = process.argv.slice(2), action = args.shift();
  assert(['plan', 'prepare', 'status', 'remove'].includes(action), 'Uso: playwright-runtime.mjs plan | status | prepare --client-closed | remove --client-closed --confirm');
  assert(JSON.stringify(args) === JSON.stringify(action === 'prepare' ? ['--client-closed'] : action === 'remove' ? ['--client-closed', '--confirm'] : []), 'Runtime writes/removal require the exact client-close/confirmation flags');
  const home = os.homedir(), root = path.join(home, '.local/share/opencode-stack/runtime/playwright-mcp-0.0.85');
  const run = (script, input) => {
    const result = spawnSync('/usr/bin/python3', [fileURLToPath(new URL(script, import.meta.url))], { input: JSON.stringify(input), encoding: 'utf8', timeout: 180000,
      env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: home, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 2 * 1024 * 1024 });
    assert(!result.error && result.status === 0, result.stderr || 'Runtime operation failed; values suppressed'); return JSON.parse(result.stdout);
  };
  let value;
  if (action === 'status') value = fs.lstatSync(root,{throwIfNoEntry:false}) ? run('../../v2/playwright/managed_runtime.py', { action: 'status', root }) : { status: 'not-prepared', verified: false };
  else if (action === 'remove') value = run('../../v2/playwright/managed_runtime.py', { action, root, clientClosed: true, confirm: true });
  else {
    assert(!['PLAYWRIGHT_MCP_CLI', 'PLAYWRIGHT_MCP_STORAGE_STATE', 'PLAYWRIGHT_MCP_CDP_ENDPOINT', 'PLAYWRIGHT_MCP_CONFIG', 'PLAYWRIGHT_MCP_PROXY_SERVER'].some(key => process.env[key]), 'Inherited browser overrides require explicit reconciliation; no values copied');
    assert(!process.env.PLAYWRIGHT_MCP_PACKAGE || ['@playwright/mcp@latest', '@playwright/mcp@0.0.85'].includes(process.env.PLAYWRIGHT_MCP_PACKAGE), 'Inherited MCP package override requires explicit reconciliation');
    const selected = run('../../v2/playwright/selected-runtime.py', { home, config: path.join(home, '.config/opencode'), managed_root: root });
    value = action === 'plan' && fs.existsSync(root) ? selected : run('../../v2/playwright/managed_runtime.py', { action, root, selected });
  }
  console.log(JSON.stringify({ action, runtime: root, version: value.version ?? '0.0.85', files: value.files, bytes: value.bytes, browserBuild: value.browserBuild,
    ...(value.status ? { status:value.status } : {}),
    changed: value.changed ?? false, removed: value.removed ?? false, verified: value.verified ?? (action === 'status' || Boolean(value.managed_root)),
    networkRequests: 0, profilesCopied: false, originalCachesChanged: false, activeConfigChanged: false }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
