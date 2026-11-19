import fs from 'node:fs';
import path from 'node:path';

function file(input, root, writing) {
  if (typeof input !== 'string' || !input || input.includes('\0')) throw new Error('Playwright: invalid artifact path');
  if (writing && !path.isAbsolute(input)) throw new Error('Playwright: explicit artifact filenames must be absolute inside the pilot output directory');
  const target = path.resolve(root, input);
  if (target === root || !target.startsWith(root + path.sep)) throw new Error('Playwright: file outside the authorized pilot area');
  let current = path.parse(target).root;
  for (const part of path.relative(current, target).split(path.sep)) {
    if (part.startsWith('.env') || ['.git', '.ssh', '.gnupg'].includes(part)) throw new Error('Playwright: sensitive path refused');
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Playwright: symlink refused'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!writing && !fs.statSync(target).isFile()) throw new Error('Playwright: expected an existing authorized upload file');
}

export function check(tool, input, options) {
  if (!tool.startsWith('playwright_')) return;
  if (!options.tools.includes(tool)) throw new Error('Playwright: unreviewed or unsafe tool refused');
  // Cover automatically named artifacts too; explicit filenames are not the
  // only path by which the backend writes into its output directory.
  file(path.join(options.outputDir, 'guard-placeholder'), options.outputDir, true);
  if (input?.url !== undefined) {
    let url; try { url = new URL(input.url); } catch { throw new Error('Playwright: invalid navigation URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Playwright: only credential-free HTTP(S) navigation is enabled');
  }
  if (input?.filename !== undefined) file(input.filename, options.outputDir, true);
  if (input?.paths !== undefined) {
    if (!Array.isArray(input.paths)) throw new Error('Playwright: invalid upload paths');
    for (const candidate of input.paths) file(candidate, options.project, false);
  }
}

export async function register(ctx) {
  const options = { ...ctx.options, project: ctx.options.project ?? ctx.location.directory };
  await ctx.tool.hook('execute.before', event => check(event.tool, event.input ?? {}, options));
}
