import { CONTEXT7_TOOLS, context7Server } from '../../v2/context7/policy.mjs';
export { CONTEXT7_URL, CONTEXT7_TOOLS, context7Server, checkContext7 } from '../../v2/context7/policy.mjs';

export function enableContext7(base, server = context7Server()) {
  const document = structuredClone(base);
  document.mcp.servers.context7 = server;
  document.permissions.push(...CONTEXT7_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })));
  document.policies.push({ action: 'mcp.use', resource: 'context7', effect: 'allow' }, ...CONTEXT7_TOOLS.map(name => ({ action: 'tool.use', resource: `${name}:*`, effect: 'allow' })));
  document.plugins.at(-1).options.context7 = true;
  return document;
}
