import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PLAYWRIGHT_ROLES, PLAYWRIGHT_TOOLS, enablePlaywright } from './config.mjs';

const base = fileURLToPath(new URL('../../', import.meta.url));
const access = fileURLToPath(new URL('./plugins/access/', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');

export function playwrightExtension({ runtime, server } = {}) {
  assert(runtime?.version === '0.0.85', 'Reviewed Playwright runtime required');
  return context => {
    const { document, instructions, assets, config, paths } = context;
    const outputDir = path.join(paths.cache, 'playwright-output');
    const binding = { home: runtime.home, cli: runtime.cli, browser: runtime.browser, version: runtime.version, output_dir: outputDir };
    const combined = new Map(assets.map(asset => [asset.file, asset]));
    const add = (relative, desired, previous) => combined.set(path.join(config, relative), { file: path.join(config, relative), desired,
      ...(previous === undefined ? {} : { previous, backup: true }), tag: 'playwright' });
    for (const role of PLAYWRIGHT_ROLES) {
      const file = path.join(config, 'agents', role + '.md'), prior = combined.get(file);
      assert(prior, 'Expected the existing browser actors');
      const text = Buffer.from(prior.desired).toString('utf8'), end = text.indexOf('\n---\n', 4);
      assert(end > 0 && /^permission:\s*$/m.test(text.slice(0, end)), 'Expected explicit actor permissions');
      // Convert the legacy visibility flag rather than accidentally importing a
      // wildcard allow alongside native permissions (including unsafe/new tools).
      const header = text.slice(0, end).replace(/^  ["']?playwright_\*["']?:\s*(?:true|false)\s*\n/gm, '');
      assert(!/^  ["']?playwright_browser_run_code_unsafe["']?:\s*allow\s*$/m.test(header), 'Explicit unsafe browser access needs separate reconciliation');
      let desired = header + text.slice(end);
      // Never defeat caller-owned browser-specific permissions.
      const guarded = /^  ["']?playwright_[^\n:]*["']?:/m.test(header);
      if (!guarded) desired = desired.replace(/^permission:\s*$/m, 'permission:\n  "playwright_*": deny\n' + PLAYWRIGHT_TOOLS.map(name => '  ' + name + ': allow').join('\n') + '\n  playwright_browser_run_code_unsafe: deny');
      if (desired !== text) add('agents/' + role + '.md', desired, prior.desired);
    }
    add('scripts/playwright_mode_router.py', fs.readFileSync(path.join(base, 'scripts/playwright_mode_router.py')));
    add('scripts/playwright_runtime.py', fs.readFileSync(new URL('./runtime.py', import.meta.url)));
    add('scripts/playwright-runtime.json', JSON.stringify(binding, null, 2) + '\n');
    const next = enablePlaywright(document, server ?? { type: 'local', command: ['/usr/bin/python3', path.join(config, 'scripts/playwright_runtime.py')], codemode: false });
    next.plugins.push({ package: access, options: { tools: PLAYWRIGHT_TOOLS, project: paths.project, outputDir } });
    const boundary = next.plugins.find(plugin => typeof plugin === 'object' && plugin.package.endsWith('/workshop-guard/'));
    assert(boundary, 'Expected additive pilot boundary');
    boundary.options.additionalTools = [...(boundary.options.additionalTools ?? []), ...PLAYWRIGHT_TOOLS];
    for (const asset of combined.values()) boundary.options.pinned[asset.file] = digest(asset.desired);
    return { ...context, document: next, assets: [...combined.values()], tag: 'playwright',
      previousDocument: JSON.stringify(document, null, 2) + '\n', previousInstructions: instructions,
      instructions: instructions + `\n## Playwright V2\nUsar la skill playwright-ui-opencode. Un solo MCP/browser por perfil, aislado del navegador personal. Seleccionar headless por defecto mediante playwright_browser_set_mode antes del workflow; visible sólo por pedido explícito. Cambiar modo reinicia el browser y pierde sesión; no superponer workflows ni resetear un takeover/login en curso. No navegar sitios internos/autenticados ni efectuar acciones de negocio sin alcance autorizado. No hay shell irrestricto vía browser_run_code_unsafe: está denegado en este perfil. Artefactos con nombre explícito sólo por path absoluto bajo ${outputDir}; uploads sólo del proyecto sintético y nunca secretos. Navegación HTTP(S), sin reutilizar perfiles personales, cookies o CDP. Estas guardas no son un sandbox OS/red ni autorización para leer credenciales desde respuestas de red.\n` };
  };
}
