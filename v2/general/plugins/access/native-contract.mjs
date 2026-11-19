// Effective native AGENT rules are the project contract. Session approvals are
// deliberately not consulted here: they cannot turn a read-only role into a
// writer, add a delegation target or grant a managed tool to a different actor.
import fs from 'node:fs';
import path from 'node:path';
import { effect, matches } from '../../policy.mjs';
import { candidatePaths } from '../../../plugins/env-guard/guard.mjs';

export async function nativeActor(ctx, id) {
  const { data } = await ctx.agent.get({ agentID: id });
  if (!data || !Array.isArray(data.permissions)) throw new Error('Effective native actor contract is unavailable');
  return data;
}

export const nativeAllows = (agent, action, resource = '*') => ['allow', 'ask'].includes(effect(agent.permissions, action, resource));

function expand(value, home) {
  return value.startsWith('~/') ? path.join(home, value.slice(2)) : value;
}

function noLinks(file) {
  let current = path.parse(file).root;
  for (const part of path.relative(current, file).split(path.sep)) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) return false; }
    catch (error) { if (error.code !== 'ENOENT') return false; }
  }
  return true;
}

export function boundedNativeEdit(agent, event, { directory, projectRoot = directory, home }) {
  // Keep the global read-only default. Only explicit path exceptions in the
  // native role may pass; a broad edit allow (including a session allow) is not
  // a replacement for the role's read-only responsibility.
  if (effect(agent.permissions, 'edit', '*') !== 'deny') return false;
  const paths = candidatePaths(event.input).filter(value => !(event.tool === 'patch' && value === '/dev/null'));
  if (!paths.length) return false;
  const rules = agent.permissions.filter(rule => matches(rule.action, 'edit')).map(rule => ({ ...rule,
    resource: rule.resource === '*' ? '*' : path.resolve(projectRoot, expand(rule.resource, home)) }));
  return paths.every(value => {
    const absolute = path.resolve(directory, expand(value, home));
    // Both lexical traversal and symlink traversal must remain in the same
    // physical project. Native tool permission/confirmation still runs too.
    const relative = path.relative(projectRoot, absolute);
    return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)
      && noLinks(absolute) && ['allow', 'ask'].includes(effect(rules, 'edit', absolute));
  });
}
