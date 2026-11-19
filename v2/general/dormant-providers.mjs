// Closed migration of explicitly disabled local compatible declarations.
// No fetch, discovery, install, auth, interpolation or model defaults.
import assert from 'node:assert/strict';
export const COMPATIBLE_PACKAGE = '@opencode/ai/providers/openai-compatible';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const providerID = value => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value) && !['openai', 'workshop-mock', '__proto__', 'constructor', 'prototype'].includes(value);
const modelID = value => typeof value === 'string' && value.length <= 256 && /^[a-zA-Z0-9][a-zA-Z0-9_./-]*(?::[a-zA-Z0-9_.-]+)?$/.test(value) && !value.split('/').some(part => part === '.' || part === '..' || part === '');
function keys(value, allowed, message) { assert(object(value) && Object.keys(value).every(key => allowed.includes(key)), message); }
function label(value) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f\x7f<>{}]/.test(value), 'Plain public provider/model label required; values suppressed'); return value;
}
function endpoint(value) {
  let url; try { url = new URL(value); } catch { throw new Error('Dormant endpoint requires loopback reconciliation; values suppressed'); }
  assert(typeof value === 'string' && ['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) && !url.username && !url.password && !url.search && !url.hash && ['/v1', '/v1/'].includes(url.pathname), 'Dormant endpoint must be literal loopback /v1 without credentials, query or fragment');
  return value;
}
function models(value) {
  assert(object(value) && Object.keys(value).length > 0 && Object.keys(value).length <= 100, 'Bounded explicit dormant model map required');
  const result = {};
  for (const [id, definition] of Object.entries(value)) {
    assert(modelID(id), 'Unreviewed dormant model ID; no silent renaming');
    keys(definition, ['name'], 'Dormant model fields need native mapping; no silent omission/default invention');
    result[id] = definition.name === undefined ? {} : { name: label(definition.name) };
  }
  return result;
}
export function validateDormantProviders(bundle) {
  keys(bundle, ['providers', 'disabled'], 'Closed native dormant bundle required');
  assert(object(bundle.providers) && Array.isArray(bundle.disabled) && bundle.disabled.length <= 100 && new Set(bundle.disabled).size === bundle.disabled.length && bundle.disabled.every(providerID), 'Explicit non-reserved dormant provider deny list required');
  for (const [id, provider] of Object.entries(bundle.providers)) {
    assert(providerID(id) && bundle.disabled.includes(id), 'Every dormant definition requires an explicit provider deny');
    keys(provider, ['name', 'package', 'settings', 'models'], 'Unreviewed native provider declaration');
    assert(provider.package === COMPATIBLE_PACKAGE, 'Only reviewed bundled native compatible package, never arbitrary npm');
    if (provider.name !== undefined) label(provider.name);
    keys(provider.settings, ['baseURL'], 'No credentials, headers, env or arbitrary provider settings copied'); endpoint(provider.settings.baseURL); models(provider.models);
  }
  return bundle;
}
export function translateDormantProviders(document) {
  assert(object(document), 'Legacy defaults object required');
  const definitions = document.provider ?? {}, disabled = document.disabled_providers ?? [];
  assert(object(definitions) && Array.isArray(disabled), 'Legacy provider declarations need review');
  const providers = {};
  for (const [id, source] of Object.entries(definitions)) {
    assert(providerID(id) && disabled.includes(id), 'Active or reserved custom provider cannot be silently migrated as dormant');
    keys(source, ['name', 'npm', 'options', 'models'], 'Unreviewed legacy provider fields; no silent omission');
    assert(source.npm === '@ai-sdk/openai-compatible', 'Legacy runtime package requires a reviewed native mapping');
    keys(source.options, ['baseURL'], 'No provider secrets/headers/arbitrary options copied');
    providers[id] = { ...(source.name === undefined ? {} : { name: label(source.name) }), package: COMPATIBLE_PACKAGE, settings: { baseURL: endpoint(source.options.baseURL) }, models: models(source.models) };
  }
  return validateDormantProviders({ providers, disabled: [...disabled] });
}
export function dormantSummary(bundle) {
  validateDormantProviders(bundle);
  return { providers: Object.entries(bundle.providers).map(([id, provider]) => ({ id, disabled: true, modelCount: Object.keys(provider.models).length, package: provider.package, endpoint: 'loopback; value omitted' })),
    declaredModelCount: Object.values(bundle.providers).reduce((count, provider) => count + Object.keys(provider.models).length, 0), disabledDiscoveryPlugins: dormantPluginDisables(bundle), enabledByMigration: false, credentialsCopied: false, requestsIssued: 0 };
}
export function dormantPluginDisables(bundle) {
  // Empirical pin2.2.7 contract: provider.use denies catalog/inference, but the
  // builtin Ollama plugin still probes. Preserve dormant declarations without I/O.
  return bundle.disabled.includes('ollama') ? ['-opencode.provider.ollama'] : [];
}
