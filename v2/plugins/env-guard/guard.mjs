// V2 adapter for the stack's existing secret-safe file-access contract.
// This is a lexical guard, not an OS sandbox or shell interpreter.
const fileTools = new Set(['read', 'edit', 'write', 'patch', 'apply_patch', 'multiedit']);
const pathKeys = new Set(['filePath', 'path', 'from', 'to', 'filename', 'file', 'oldPath', 'newPath']);
const blocked = 'Access to sensitive .env* paths is blocked by the stack guard; only .env.example is allowed. Use an approved secret-safe workflow.';

export function protectedPath(value) {
  const parts = value.replace(/\\/g, '/').replace(/^['"]|['"]$/g, '').split('/');
  return parts.some((part, index) => /^\.env/i.test(part) && !(index === parts.length - 1 && /^\.env\.example$/i.test(part)));
}

export function protectedShellReference(command) {
  const normalized = command.replace(/\\/g, '/');
  const pattern = /(?:^|[\s'"`/=])(?<file>\.env[^\s'"`/;&|()]*)/gi;
  for (const match of normalized.matchAll(pattern)) {
    const end = match.index + match[0].length;
    if (!/^\.env\.example$/i.test(match.groups.file) || normalized[end] === '/') return true;
  }
  return false;
}

export function candidatePaths(input) {
  const paths = [];
  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object') return;
    if (depth > 12) throw new Error('Stack guard input nesting limit exceeded; blocked');
    for (const [key, child] of Object.entries(value)) {
      if (pathKeys.has(key) && typeof child === 'string') paths.push(child);
      if (key === 'files' && Array.isArray(child)) paths.push(...child.filter(item => typeof item === 'string'));
      if (['patchText', 'patch', 'diff'].includes(key) && typeof child === 'string') {
        for (const line of child.split('\n')) {
          const match = /^(?:\*\*\* (?:Add File|Update File|Delete File|Move to): |(?:---|\+\+\+) (?:[ab]\/)?)(.+)$/.exec(line);
          if (match) paths.push(match[1]);
        }
      }
      if (typeof child === 'object' && child) visit(child, depth + 1);
    }
  }
  visit(input);
  return paths;
}

export function check(event) {
  if (event.tool === 'shell' || event.tool === 'bash') {
    if (typeof event.input?.command === 'string' && protectedShellReference(event.input.command)) throw new Error(blocked);
    return;
  }
  if (!fileTools.has(event.tool)) return;
  if (candidatePaths(event.input).some(protectedPath)) throw new Error(blocked);
}

export async function register(ctx) {
  await ctx.tool.hook('execute.before', check);
}
