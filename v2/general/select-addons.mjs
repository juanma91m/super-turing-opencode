// Select non-secret current wiring only. Never source env, read auth/DB or start
// backends. Selectors remain owner-owned; no dependency on a workshop composition.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { context7Server, CONTEXT7_URL } from '../context7/policy.mjs';
import { translateEngram } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { rovoServer, ROVO_ROLES } from '../../../super-turing-opencode-ticketing/v2/config.mjs';
import { dcrLoopbackServer, rovoDiscoveryServer } from '../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs';
import { selectDocumenter } from '../../../super-turing-opencode-documents/v2/documenter/preflight.mjs';

const script = relative => fileURLToPath(new URL(relative, import.meta.url));
export function selectGeneralAddons(home, config, parent = process.env, { sourceUpdate = false } = {}) {
  assert(path.isAbsolute(home) && path.isAbsolute(config), 'Explicit runtime identity required');
  const env = { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: home, PYTHONDONTWRITEBYTECODE: '1' };
  for (const [key, value] of Object.entries(parent)) {
    if (['OPENCODE_CODEGRAPH_STATE_DIR', 'OPENCODE_CODEGRAPH_REGISTRY'].includes(key)) env[key] = value;
    if (/^(?:XDG_(?:CONFIG|DATA|STATE|CACHE)_HOME|OPENCODE_KNOWLEDGE_|QDRANT_|ENGRAM_|CODEGRAPH_|PLAYWRIGHT_)/.test(key)) env[key] = /(?:TOKEN|PASSWORD|SECRET|API_KEY)/.test(key) ? 'configured' : value;
  }
  const probe = (file, args = [], input) => {
    const result = spawnSync('/usr/bin/python3', [file, ...args], { ...(input ? { input: JSON.stringify(input) } : {}), env, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
    assert(!result.error && result.status === 0, 'Current addon wiring requires explicit reconciliation; values suppressed; nothing installed or started');
    return JSON.parse(result.stdout);
  };
  const knowledge = probe(script('../../../super-turing-opencode-knowledge/v2/selected-runtime.py'), [], { home, config });
  const graph = probe(script('../../../super-turing-opencode-codegraph/v2/selected-runtime.py'), [], { home, config });
  const managedBrowserRoot = path.join(home, '.local/share/opencode-stack/runtime/playwright-mcp-0.0.85');
  const browser = probe(script('../playwright/selected-runtime.py'), [], { home, config, managed_root: managedBrowserRoot });
  const ticketing = probe(script('../../../super-turing-opencode-ticketing/v2/preflight.py'), [path.join(config, 'opencode.json')]);
  assert(ticketing.serverPresent && ticketing.canonicalEndpoint && ticketing.canonicalOAuthRequest && ticketing.globallyHidden && ticketing.unsupportedServerFields === 0, 'Rovo current configuration differs; no normalization');
  assert.deepEqual(ticketing.roleReads, ROVO_ROLES, 'Rovo current role exposure requires reconciliation');
  let current, document;
  try { document = JSON.parse(fs.readFileSync(path.join(config, 'opencode.json'))); current = document.mcp?.context7; }
  catch { throw new Error('Current Context7 wiring unavailable; values suppressed'); }
  const extraContextFields = Object.keys(current ?? {}).filter(key => !['type', 'url', 'enabled', 'timeout', 'command'].includes(key));
  assert(['local', 'remote'].includes(current?.type) && extraContextFields.length === 0, 'Context7 overrides require reconciliation; extra field names only: ' + extraContextFields.join(', '));
  if (current.type === 'remote' || current.url !== undefined) assert(current.url === CONTEXT7_URL, 'Unreviewed Context7 endpoint; values suppressed');
  if (current.type === 'local') assert(current.command !== undefined, 'Canonical local Context7 command required');
  if (current.command !== undefined) assert(JSON.stringify(current.command) === JSON.stringify(['npx', '-y', '@upstash/context7-mcp@latest']), 'Unreviewed legacy Context7 command; values suppressed');
  const context7 = { ...context7Server(), disabled: current.enabled === false };
  if (current.timeout !== undefined) { assert(Number.isSafeInteger(current.timeout) && current.timeout > 0); context7.timeout.execution = current.timeout; }
  // Metadata only. A provisioned key opts into local stdio; a missing/broken
  // companion runtime is reported by Context7 rather than blocking startup.
  const credentialFile = path.join(home, '.config/opencode-private/context7/api-key');
  if (fs.lstatSync(credentialFile, { throwIfNoEntry: false })) {
    context7.privateBinding = { credentialFile, runtimeRoot: path.join(home, '.local/share/opencode-stack/runtime/context7-mcp-4.8.0') };
  }
  return { runtimeHome: home, descriptors: { context7,
    knowledge: { runtimeHome: home, runtimeConfig: config, environment: knowledge.environment, server: translateEngram(knowledge.server), permissions: knowledge.permissions },
    ticketing: { server: { ...rovoDiscoveryServer(dcrLoopbackServer(rovoServer())), disabled: !ticketing.enabled } },
      codegraph: { binding: graph.binding, maintenanceRegistry: graph.maintenanceRegistry }, playwright: { runtime: browser }, documents: { binding: selectDocumenter(home, config, { sourceUpdate }) }, notifier: { configPath: path.join(config, 'notify.json') } },
    metadata: { selection: 'owner preflights; no backend started', context7SourceTransport: current.type, context7TargetTransport: context7.privateBinding ? 'private preprovisioned stdio' : 'approved native public remote; no npx download', context7LegacyCommandOmitted: current.command !== undefined, rovoScope: 'resource-metadata; native V2 compatibility', browserPin: browser.version,
      browserDurability: browser.managed_root ? 'managed snapshot verified' : 'prepare offline managed snapshot before candidate activation', credentialsCopied: false } };
}
