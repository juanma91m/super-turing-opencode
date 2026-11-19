import { controlledBashPermission, permissionNeedsApproval } from '../../../lib/permission-policy.ts';

const actions = new Map(['shell', 'read', 'edit', 'glob', 'grep', 'external_directory', 'skill', 'todowrite', 'webfetch'].map(action => [action, action === 'shell' ? 'bash' : action]));

function matches(pattern, value) {
  const expression = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.');
  return new RegExp(`^${expression}$`).test(value) || pattern.endsWith(' *') && value === pattern.slice(0, -2);
}

const riskyPatterns = Object.entries(controlledBashPermission()).filter(([, effect]) => effect === 'ask').map(([pattern]) => pattern);

export function requiresApproval(action, resources) {
  const legacy = actions.get(action);
  if (!legacy || !resources?.length || resources.some(resource => typeof resource !== 'string')) return true;
  if (permissionNeedsApproval(legacy, resources)) return true;
  // Preserve explicit wrapper asks as well: V1's regex-only hook did not cover
  // every risky pattern in its config transformer (notably sh/bash/zsh -c).
  return action === 'shell' && resources.some(command => riskyPatterns.some(pattern => matches(pattern, command)));
}

export function controlledRules(rules) {
  const shell = rules.filter(rule => rule.action === 'shell');
  if (!shell.length || shell.findLast(rule => rule.resource === '*')?.effect === 'deny') return rules;
  const current = Object.fromEntries(shell.map(rule => [rule.resource, rule.effect]));
  return [...rules.filter(rule => rule.action !== 'shell'), ...Object.entries(controlledBashPermission(current)).map(([resource, effect]) => ({ action: 'shell', resource, effect }))];
}

export function evaluate(event) {
  if (event.effect === 'deny' || !actions.has(event.action)) return;
  if (requiresApproval(event.action, event.resources)) {
    if (event.effect === 'allow') event.effect = 'ask';
    return;
  }
  event.effect = 'allow';
}

export async function register(ctx) {
  await ctx.permission.hook('evaluate', evaluate);
  await ctx.agent.transform(editor => {
    for (const agent of editor.list()) editor.update(agent.id, draft => { draft.permissions = controlledRules(draft.permissions); });
  });
}
