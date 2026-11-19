import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { context7Server, CONTEXT7_TOOLS } from './policy.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
export function context7Contribution(server = context7Server()) {
  return { id: 'context7', apply(ctx) {
    assert(ctx.version === 1 && ctx.kind === 'general' && !ctx.document.mcp.servers.context7 && server.codemode === false);
    ctx.document.mcp.servers.context7 = structuredClone(server);
    ctx.document.permissions.push(...CONTEXT7_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })));
    ctx.document.policies.push({ action: 'mcp.use', resource: 'context7', effect: 'allow' });
    ctx.closeTools('context7_*', CONTEXT7_TOOLS);
    ctx.copyBundleTree('context7', path.join(root, 'plugins/access'), 'v2/context7/plugins/access');
    ctx.addBundle('context7', 'v2/context7/policy.mjs', ctx.readAsset(path.join(root, 'policy.mjs')));
    ctx.document.plugins.push(ctx.bundlePath('context7', 'v2/context7/plugins/access'));
    ctx.appendInstructions('## Context7 general V2\nSólo documentación pública; resolver library ID antes de query-docs. No enviar código privado, secretos ni datos de negocio.');
    ctx.metadata.context7 = { tools: CONTEXT7_TOOLS.length };
  } };
}
