import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYWRIGHT_ROLES, PLAYWRIGHT_TOOLS, enablePlaywright } from './config.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));

export function playwrightContribution({ runtime, server }) {
  return { id: 'playwright', apply(ctx) {
    assert(ctx.version === 1 && runtime.version === '0.0.85', 'Reviewed native browser runtime required');
    for (const role of PLAYWRIGHT_ROLES) {
      const agent = ctx.agents[role]; assert(agent);
      if (!agent.permissions.some(rule => rule.action.startsWith('playwright_'))) agent.permissions.push({ action: 'playwright_*', resource: '*', effect: 'deny' },
        ...PLAYWRIGHT_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })), { action: 'playwright_browser_run_code_unsafe', resource: '*', effect: 'deny' });
    }
    const outputDir = path.join(ctx.paths.cache, 'playwright-output');
    for (const file of ['playwright_mode_router.py']) ctx.addConfig('scripts/' + file, ctx.readAsset(path.join(root, 'scripts', file)));
    ctx.addConfig('scripts/playwright_runtime.py', ctx.readAsset(path.join(root, 'v2/playwright/managed_dispatcher.py')));
    ctx.addConfig('scripts/playwright_cache_runtime.py', ctx.readAsset(path.join(root, 'v2/playwright/runtime.py')));
    ctx.addConfig('scripts/managed_runtime.py', ctx.readAsset(path.join(root, 'v2/playwright/managed_runtime.py')));
    ctx.addConfig('scripts/playwright-runtime.json', JSON.stringify({ home: runtime.home, cli: runtime.cli, browser: runtime.browser, version: runtime.version, output_dir: outputDir,
      ...(runtime.managed_root ? { managed_root: runtime.managed_root } : {}) }, null, 2) + '\n');
    Object.assign(ctx.document, enablePlaywright(ctx.document, server ?? { type: 'local', command: ['/usr/bin/python3', path.join(ctx.config, 'scripts/playwright_runtime.py')], codemode: false }));
    ctx.copyBundleTree('playwright', path.join(root, 'v2/playwright/plugins/access'), 'v2/playwright/plugins/access');
    ctx.document.plugins.push({ package: ctx.bundlePath('playwright', 'v2/playwright/plugins/access'), options: { tools: PLAYWRIGHT_TOOLS, outputDir } });
    ctx.closeTools('playwright_*', PLAYWRIGHT_TOOLS);
    ctx.appendInstructions('## Playwright general V2\nUn navegador MCP aislado por perfil. Headless por defecto, visible sólo por pedido explícito; no resetear login/takeover ni superponer workflows. Seleccionar modo antes de operar; cambiarlo pierde sesión. Artefactos nombrados explícitamente sólo por ruta absoluta del output-dir del perfil; uploads sólo del proyecto autorizado sin secretos/symlinks. No browser_run_code_unsafe, perfiles personales, CDP o credenciales copiadas. No autoriza mutaciones remotas por tener una tool permitida.');
    ctx.metadata.playwright = { roles: PLAYWRIGHT_ROLES.length, tools: PLAYWRIGHT_TOOLS.length, unsafe: false, runtime: runtime.managed_root ? 'verified offline managed snapshot' : 'existing cache; durable runtime must be prepared before activation' };
  } };
}
