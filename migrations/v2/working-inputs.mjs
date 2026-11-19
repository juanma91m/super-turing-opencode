// Project data is seeded, not managed as trusted executable/configuration state.
// This function validates and plans only; upgradeOwned validates the whole batch
// before creating missing seeds. Existing regular inputs are never read/replaced.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { noSymlinks } from './staging.mjs';

export function planWorkingInputs(inputs, project, protectedFiles = []) {
  assert(path.isAbsolute(project) && path.resolve(project) === project, 'Explicit canonical project path required');
  const protectedSet = new Set(protectedFiles), seen = new Set(), seeds = [];
  for (const { file, initial } of inputs) {
    assert(typeof file === 'string' && path.isAbsolute(file) && path.resolve(file) === file && file.startsWith(project + path.sep), 'Working input must stay inside the project');
    assert(!path.relative(project, file).split(path.sep).some(part => part.startsWith('.env') || ['.git', '.ssh', '.gnupg'].includes(part)), 'Sensitive working input path refused');
    assert(!seen.has(file) && !protectedSet.has(file), 'Working input conflicts with managed/protected ownership');
    assert(typeof initial === 'string' || Buffer.isBuffer(initial), 'Working input needs explicit initial bytes');
    seen.add(file); noSymlinks(file);
    if (fs.existsSync(file)) assert(fs.lstatSync(file).isFile(), 'Working input must be a regular file');
    else seeds.push({ file, desired: initial, tag: 'working-input' });
  }
  return seeds;
}
