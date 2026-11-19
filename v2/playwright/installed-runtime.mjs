// Owner preflight for an archived native binding, independent of V1 selectors.
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
export function validateInstalledPlaywright(plan) {
  if (!plan.components.includes('playwright')) return;
  const config = path.join(plan.config, 'opencode'), file = path.join(config, 'scripts/playwright-runtime.json');
  let binding; try { binding = JSON.parse(plan.assets.get(file)); } catch { throw new Error('Archived browser binding invalid; values suppressed'); }
  assert(typeof binding.managed_root === 'string' && binding.version === '0.0.85', 'Archived launch requires durable browser snapshot, not cache fallback');
  const result = spawnSync('/usr/bin/python3', [path.join(config, 'scripts/managed_runtime.py')], { input: JSON.stringify({ action: 'status', root: binding.managed_root }), encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024,
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: plan.home, PYTHONDONTWRITEBYTECODE: '1' } });
  assert(!result.error && result.status === 0, 'Archived browser runtime integrity failed; no repair/download attempted');
  let actual; try { actual = JSON.parse(result.stdout); } catch { throw new Error('Browser status format invalid; raw values suppressed'); }
  assert(['home', 'cli', 'browser', 'version', 'managed_root'].every(key => actual[key] === binding[key]), 'Archived browser selection differs from verified runtime');
}
