// Operator-owned workshop preference, applied AFTER addon composition. This is
// visibility only: never disable agents or rewrite role permissions/command IDs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { noSymlinks } from './staging.mjs';
import { upgradeOwned } from './owned-upgrade.mjs';

export const HIDDEN_BUILTINS = Object.freeze(['plan', 'build']);
export const visibilityFile = root => path.join(root, '.builtin-agent-visibility.json');

export function readBuiltinVisibility(root) {
  const file = visibilityFile(root); noSymlinks(file);
  if (!fs.existsSync(file)) return undefined;
  let value;
  try { value = JSON.parse(fs.readFileSync(file)); }
  catch { throw new Error('Invalid agent visibility preference (values suppressed)'); }
  assert(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 4 && value.schemaVersion === 1 && value.owner === 'opencode-stack' && value.profile === root
    && Array.isArray(value.hidden) && value.hidden.length === HIDDEN_BUILTINS.length && value.hidden.every((id, index) => id === HIDDEN_BUILTINS[index]),
  'Unexpected agent visibility preference (values suppressed)');
  return value;
}

export function hideBuiltinAgents(document) {
  assert(!HIDDEN_BUILTINS.includes(document.default_agent), 'Do not hide the selected default agent implicitly');
  const next = structuredClone(document);
  for (const id of HIDDEN_BUILTINS) {
    assert(next.agents?.[id] && typeof next.agents[id] === 'object', 'Expected the known builtin agent definitions');
    next.agents[id].hidden = true;
  }
  return next;
}

export function applyBuiltinVisibility(p) {
  if (readBuiltinVisibility(p.root)) {
    assert(HIDDEN_BUILTINS.every(id => p.document.agents[id]?.hidden === true), 'Visibility preference differs from known composition');
    return { ...p, builtinVisibilityChanged: false };
  }
  const document = hideBuiltinAgents(p.document);
  const marker = { schemaVersion: 1, owner: 'opencode-stack', profile: p.root, hidden: [...HIDDEN_BUILTINS] };
  upgradeOwned([
    { file: path.join(p.config, 'opencode/opencode.json'), desired: JSON.stringify(document, null, 2) + '\n', previous: JSON.stringify(p.document, null, 2) + '\n', backup: true, tag: 'builtin-visibility' },
    { file: visibilityFile(p.root), desired: JSON.stringify(marker, null, 2) + '\n', tag: 'builtin-visibility' },
  ]);
  return { ...p, document, builtinVisibilityChanged: true };
}

export async function inspectBuiltinVisibility(get, root) {
  const preference = readBuiltinVisibility(root);
  if (!preference) return { hiddenBuiltins: [], builtinVisibilityPreference: 'not configured' };
  const agents = await get('/api/agent');
  for (const id of HIDDEN_BUILTINS) assert(agents.some(agent => agent.id === id && agent.hidden === true), 'Builtin visibility preference not effective: ' + id);
  return { hiddenBuiltins: [...HIDDEN_BUILTINS], builtinVisibilityPreference: 'effective; agents still available for explicit command routing' };
}
