import fs from 'node:fs';
import assert from 'node:assert/strict';

export const WIRE_TOOLS = JSON.parse(fs.readFileSync(new URL('./tools.json', import.meta.url)));
export const PLAYWRIGHT_TOOLS = WIRE_TOOLS.filter(name => name !== 'browser_run_code_unsafe').map(name => 'playwright_' + name);
export const PLAYWRIGHT_ROLES = ['master-dev', 'planner', 'frontend-web-developer', 'ui-web-designer', 'dev-test'];

export function enablePlaywright(base, server) {
  assert(!Object.hasOwn(base.mcp?.servers ?? {}, 'playwright'), 'Existing Playwright needs explicit reconciliation');
  assert(server?.type === 'local' && server.codemode === false, 'Reviewed direct local browser MCP required');
  const next = structuredClone(base);
  next.mcp.servers.playwright = structuredClone(server);
  next.permissions.push({ action: 'playwright_*', resource: '*', effect: 'deny' });
  next.policies.push({ action: 'mcp.use', resource: 'playwright', effect: 'allow' },
    ...PLAYWRIGHT_TOOLS.map(name => ({ action: 'tool.use', resource: `${name}:*`, effect: 'allow' })));
  return next;
}
