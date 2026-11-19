// Migration-only fixture boundary. This is not part of the portable agent stack.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function assertFixture(options, directory) {
  if (directory !== options.project || fs.realpathSync(directory) !== directory) throw new Error('Pilot: unexpected location');
  const file = path.join(directory, 'fixture-readme.txt');
  if (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile() || fs.realpathSync(file) !== file) throw new Error('Pilot: fixture is not a regular canonical file');
  const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (digest !== options.sha256) throw new Error('Pilot: fixture changed; blocked');
  return file;
}

export function rejectAttachments(event) {
  if (['files', 'agents', 'skills'].some(key => event.prompt[key]?.length)) throw new Error('Pilot: attachments, mentions and skills are disabled');
}

export function validateRead(event, options, directory) {
  if (event.tool !== 'read') throw new Error('Pilot: only the fixture read tool is enabled');
  const input = event.input ?? {};
  const requested = input.filePath ?? input.path;
  if (typeof requested !== 'string' || !['fixture-readme.txt', path.join(directory, 'fixture-readme.txt')].includes(requested)) {
    throw new Error('Pilot: only fixture-readme.txt may be read');
  }
  assertFixture(options, directory);
}

export async function register(ctx) {
  const options = ctx.options;
  const directory = ctx.location.directory;
  // Register even at an unexpected location: failing setup would unload the
  // guard and could leave the rest of the runtime active without these hooks.
  await ctx.session.hook('prompt', event => {
    assertFixture(options, directory);
    rejectAttachments(event);
  });
  await ctx.session.hook('context', event => {
    assertFixture(options, directory);
    if (event.agent !== 'v2-pilot' || event.model.providerID !== options.provider || event.model.id !== options.model) throw new Error('Pilot: unexpected agent/model');
    for (const name of Object.keys(event.tools)) if (name !== 'read') delete event.tools[name];
  });
  await ctx.session.hook('title', event => { event.result = 'Piloto V2'; });
  for (const kind of ['generate', 'compaction']) {
    await ctx.session.hook(kind, () => { throw new Error('Pilot: auxiliary model requests disabled'); });
  }
  await ctx.tool.hook('execute.before', event => validateRead(event, options, directory));
  await ctx.shell.hook('create.before', () => { throw new Error('Pilot: shell disabled'); });
  await ctx.skill.transform(editor => {
    for (const skill of editor.list()) editor.remove(skill.id);
  });
  // Expose native read directly, without enabling Code Mode or arbitrary code.
  await ctx.tool.transform(editor => editor.update('read', tool => {
    tool.options = { ...tool.options, codemode: false };
  }));
}
