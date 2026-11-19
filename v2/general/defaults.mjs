// Metadata-only V1 defaults inventory. Never resolve variables, import provider
// packages, contact a model or copy arbitrary provider/settings/agent bodies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translateDormantProviders } from './dormant-providers.mjs';

const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.-]+$/.test(value);
const model = value => value === undefined ? null : typeof value === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./:-]+(?:#[a-zA-Z0-9_.-]+)?$/.test(value) ? value : 'configured-unreviewed';
const choice = (value, allowed) => value === undefined ? 'unset' : allowed.includes(value) ? value : 'configured-unreviewed';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const providerFields = ['id', 'name', 'npm', 'options', 'models', 'api', 'env', 'whitelist', 'blacklist'];
const modelFields = ['id', 'name', 'family', 'release_date', 'attachment', 'reasoning', 'temperature', 'tool_call', 'interleaved', 'cost', 'limit', 'modalities', 'options', 'headers', 'variants', 'status', 'experimental'];
function fieldShape(value, known) {
  if (!object(value)) return { type: value === undefined ? 'unset' : typeof value };
  return { fields: Object.keys(value).filter(key => known.includes(key)).sort(), unknownFields: Object.keys(value).filter(key => !known.includes(key)).length };
}
function dormantShape(provider) {
  const grouped = new Map();
  for (const definition of Object.values(provider?.models ?? {})) {
    const shape = { ...fieldShape(definition, modelFields), limit: fieldShape(definition?.limit, ['context', 'input', 'output']), modalities: fieldShape(definition?.modalities, ['input', 'output']), options: fieldShape(definition?.options, ['num_ctx', 'num_predict', 'temperature', 'top_p', 'top_k', 'repeat_penalty', 'seed']) };
    const key = JSON.stringify(shape); grouped.set(key, { count: (grouped.get(key)?.count ?? 0) + 1, shape });
  }
  return { provider: fieldShape(provider, providerFields), options: fieldShape(provider?.options, ['baseURL', 'apiKey', 'headers', 'timeout']), modelShapes: [...grouped.values()] };
}

export function maintenanceDefaults(report) {
  assert(report.schemaVersion === 1 && report.mainModel === 'openai/gpt-6.1-sol' && report.defaultAgent === 'master-dev', 'Main defaults differ from reviewed canonical roles; explicit reconciliation required');
  assert(report.smallModel === null || report.smallModel === report.mainModel, 'Different V1 small_model needs a deliberate native mapping, not silent omission');
  assert(!report.unreviewedDisabledProviders && !report.disabledProviders.includes('openai') && report.providers.every(provider => provider.disabled), 'Provider enable/disable selection requires explicit reconciliation; no active custom provider silently omitted');
  const agents = {};
  for (const id of ['title', 'summary', 'compaction']) {
    const entry = report.auxiliary[id];
    assert(entry.configured && !entry.hasOtherOverrides && entry.model === report.mainModel && ['unset', 'low', 'medium', 'high', 'xhigh'].includes(entry.variant), 'Auxiliary overrides need explicit review; no prompt/request settings copied');
    agents[id] = { model: entry.model + (entry.variant === 'unset' ? '' : '#' + entry.variant) };
  }
  return agents;
}

export function inspectDefaults(document, parent = {}) {
  assert(object(document), 'Configuration object required; values suppressed');
  const providers = Object.entries(document.provider ?? {}).map(([id, provider]) => {
    const options = object(provider?.options) ? provider.options : {};
    let endpoint = options.baseURL === undefined ? 'unset' : 'configured-unreviewed';
    try {
      const url = new URL(options.baseURL);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) endpoint = 'loopback';
    } catch {}
    return { id: identifier(id) ? id : 'unreviewed-provider-id', disabled: Array.isArray(document.disabled_providers) && document.disabled_providers.includes(id),
      packageFamily: ['@ai-sdk/openai-compatible', '@ai-sdk/openai', 'ollama-ai-provider', 'ollama-ai-provider-v2'].includes(provider?.npm) ? provider.npm : provider?.npm === undefined ? 'unset' : 'configured-unreviewed',
      endpoint, configuredModelCount: Object.keys(provider?.models ?? {}).length, modelIDsOmitted: true,
      sensitiveOrExtraOptionsPresent: Object.keys(options).some(key => key !== 'baseURL'), fieldShape: dormantShape(provider) };
  });
  const auxiliary = Object.fromEntries(['title', 'summary', 'compaction'].map(id => {
    const agent = document.agent?.[id];
    return [id, { configured: agent !== undefined, model: model(agent?.model), variant: choice(agent?.variant, ['low', 'medium', 'high', 'xhigh']),
      hasOtherOverrides: object(agent) && Object.keys(agent).some(key => !['model', 'variant'].includes(key)) }];
  }));
  const compaction = document.compaction;
  return { schemaVersion: 1, source: 'V1 JSON metadata only; no interpolation or effective-default inference', writesPerformed: 0,
    mainModel: model(document.model), smallModel: model(document.small_model), defaultAgent: document.default_agent === undefined ? null : identifier(document.default_agent) ? document.default_agent : 'configured-unreviewed',
    snapshots: choice(document.snapshot, [true, false]), autoUpdate: choice(document.autoupdate, [true, false, 'notify']),
    compaction: { configured: compaction !== undefined, auto: choice(compaction?.auto, [true, false]), prune: choice(compaction?.prune, [true, false]), hasOtherFields: object(compaction) && Object.keys(compaction).some(key => !['auto', 'prune'].includes(key)) },
    auxiliary, providers, disabledProviderCount: Array.isArray(document.disabled_providers) ? document.disabled_providers.length : 0,
    disabledProviders: Array.isArray(document.disabled_providers) ? document.disabled_providers.filter(identifier) : [],
    unreviewedDisabledProviders: document.disabled_providers !== undefined && (!Array.isArray(document.disabled_providers) || document.disabled_providers.some(value => !identifier(value))),
    externalSkillPathsConfigured: Boolean(document.skills),
    inheritedOverrideNames: ['OPENCODE_CONFIG', 'OPENCODE_CONFIG_CONTENT', 'OPENCODE_MODEL', 'OPENCODE_SMALL_MODEL', 'OPENCODE_DISABLE_AUTOUPDATE', 'OPENCODE_DISABLE_SNAPSHOT', 'OPENCODE_DISABLE_EXTERNAL_SKILLS', 'OPENCODE_DISABLE_CLAUDE_CODE_SKILLS'].filter(key => parent[key] !== undefined),
    limitations: ['Unset V1 fields do not establish matching V2 defaults', 'small_model and V1 provider packages are not native V2 config', 'No credential status or model reachability was queried', 'External skills discovery and auxiliary request costs need explicit activation decisions'] };
}

function readDocument(config) {
  assert(path.isAbsolute(config), 'Absolute configuration path required');
  const file = path.join(config, 'opencode.json');
  let ancestor = file;
  while (ancestor !== path.dirname(ancestor)) { assert(!fs.lstatSync(ancestor).isSymbolicLink(), 'Configuration symlink requires review'); ancestor = path.dirname(ancestor); }
  let document;
  try { document = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('Could not inspect V1 defaults; raw configuration values suppressed'); }
  return document;
}
export function readDefaults(config, parent = {}) { return inspectDefaults(readDocument(config), parent); }
export function readGeneralDefaults(config, parent = {}) {
  const document = readDocument(config), report = inspectDefaults(document, parent);
  return { report, maintenanceModels: maintenanceDefaults(report), dormantProviders: translateDormantProviders(document) };
}
