// Non-deploying current browser composition shared with subsequent increments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { noSymlinks } from './staging.mjs';
import { selectCodeGraphProfile } from './codegraph-profile.mjs';
import { playwrightExtension } from '../../v2/playwright/composition.mjs';

export function selectPlaywrightProfile() {
  const selected = selectCodeGraphProfile();
  assert(selected.graphInstalled, 'Primero incorporar y validar CodeGraph');
  const { home, config, root, options } = selected;
  const probe = spawnSync('python3', [fileURLToPath(new URL('../../v2/playwright/selected-runtime.py', import.meta.url))], {
    input: JSON.stringify({ home, config }), encoding: 'utf8', timeout: 10000, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1',
      ...(process.env.PLAYWRIGHT_MCP_PACKAGE ? { PLAYWRIGHT_MCP_PACKAGE: process.env.PLAYWRIGHT_MCP_PACKAGE } : {}),
      ...Object.fromEntries(['PLAYWRIGHT_MCP_CLI', 'PLAYWRIGHT_MCP_STORAGE_STATE', 'PLAYWRIGHT_MCP_CDP_ENDPOINT', 'PLAYWRIGHT_MCP_CONFIG', 'PLAYWRIGHT_MCP_PROXY_SERVER'].filter(key => process.env[key]).map(key => [key, 'configured'])),
    },
  });
  assert(!probe.error && probe.status === 0, 'Playwright actual requiere reconciliación; valores omitidos; no se descargó ni abrió un navegador');
  const browser = JSON.parse(probe.stdout), marker = path.join(root, '.playwright-v2-enabled.json');
  noSymlinks(marker);
  const state = { owner: 'opencode-stack', component: 'playwright', profile: root, version: browser.version };
  const installed = fs.existsSync(marker);
  if (installed) assert(JSON.stringify(JSON.parse(fs.readFileSync(marker))) === JSON.stringify(state), 'Unexpected Playwright marker (values suppressed)');
  const previous = options.extend, extension = playwrightExtension({ runtime: browser });
  return { ...selected, browser, browserMarker: marker, browserState: state, browserInstalled: installed,
    options: { ...options, extend: context => extension({ ...context, ...previous(context) }) } };
}
