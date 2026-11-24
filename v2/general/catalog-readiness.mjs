// MCP connection and the native tool registry are separate readiness evidence.
// Wait only for reviewed tools of enabled, Connected servers. Never suppress a
// finding, retry authentication/business tools or convert a deadline into success.
export function pendingMcpCatalog(audit, servers, states) {
  if (audit.findings.some(item => item.severity === 'error')) return false;
  const missing = audit.findings.filter(item => item.code === 'managed-tool-missing');
  if (!missing.length) return false;
  const connected = Object.keys(servers).filter(name => !servers[name].disabled && states.some(item => item.name === name && item.status?.status === 'connected'));
  return missing.every(item => typeof item.subject === 'string' && connected.some(name => item.subject.startsWith(name + '_')));
}

export async function settleCatalogAudit(readAudit, pending, { deadline, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!Number.isFinite(deadline)) throw new Error('Bounded catalog startup deadline required');
  for (;;) {
    const audit = await readAudit();
    if (!await pending(audit)) return audit;
    const remaining = deadline - now();
    if (remaining <= 0) return audit;
    await pause(Math.min(200, remaining));
  }
}
