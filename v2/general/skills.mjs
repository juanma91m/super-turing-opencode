import assert from 'node:assert/strict';
import { externalClientSkill } from './policy.mjs';

function list(value) {
  const entries = Array.isArray(value) ? value : value?.data;
  assert(Array.isArray(entries), 'Native skill source metadata required');
  return entries;
}
export async function registerSkillIsolation(ctx) {
  // Pin 2.2.7 registers file sources AFTER plugin setup transforms. A setup-time
  // skill.transform sees only builtins, so it cannot filter those later sources.
  // Register the source filter once the location is ready, before prompt/skill
  // resolution. This is a native registry transform, not a private skill loader.
  let denied = new Set(), registration, pending;
  const selected = async () => list(await ctx.skill.list()).filter(skill => externalClientSkill(skill.path));
  const refresh = async () => {
    if (pending) return pending;
    pending = (async () => {
      if (!registration) registration = await ctx.skill.transform(editor => {
        const blocked = editor.list().filter(skill => externalClientSkill(skill.path));
        denied = new Set(blocked.map(skill => skill.id));
        for (const skill of blocked) editor.remove(skill.id);
      });
      else await ctx.skill.reload();
    })();
    try { await pending; } finally { pending = undefined; }
  };
  await ctx.session.hook('prompt', refresh);
  await ctx.permission.hook('evaluate', async event => {
    if (event.action !== 'skill' || event.effect === 'deny') return;
    const blocked = new Set([...denied, ...(await selected()).map(skill => skill.id)]);
    if (event.resources.some(id => blocked.has(id))) {
      event.effect = 'deny'; event.message = 'External-client skill is not an approved native owner import';
    }
  });
}
