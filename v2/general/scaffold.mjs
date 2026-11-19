// Proposal only. Native deltas never copy a global system prompt or auto-grant
// workspace access. Application remains an explicitly approved agent-design edit.
import assert from 'node:assert/strict';
export function scaffoldProposal(deltas, baselines) {
  assert(deltas && typeof deltas === 'object' && !Array.isArray(deltas) && Object.keys(deltas).length <= 50, 'Bounded native role deltas required');
  const agents = {}, review = [];
  for (const [id, delta] of Object.entries(deltas)) {
    assert(Object.hasOwn(baselines, id) && /^[a-z][a-z0-9-]*$/.test(id), 'Inherited delta requires an existing global role; new roles need full deliberate definitions');
    assert(delta && typeof delta === 'object' && !Array.isArray(delta) && Object.keys(delta).every(key => ['model', 'mode', 'permissions'].includes(key)), 'Only native model/mode/permission deltas; no system/prompt/tools copied');
    if (delta.model !== undefined) { assert(typeof delta.model === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+(?:#[a-zA-Z0-9_.-]+)?$/.test(delta.model), 'Canonical model/variant identifier required'); review.push({ role: id, kind: 'model-change', requiresExplicitApproval: true }); }
    if (delta.mode !== undefined) { assert(['primary', 'subagent', 'all'].includes(delta.mode)); review.push({ role: id, kind: 'mode-change', requiresExplicitApproval: true }); }
    if (delta.permissions !== undefined) {
      assert(Array.isArray(delta.permissions) && delta.permissions.length <= 200, 'Bounded native permission list required');
      for (const rule of delta.permissions) {
        assert(rule && Object.keys(rule).sort().join(',') === 'action,effect,resource' && typeof rule.action === 'string' && /^[A-Za-z0-9_?*-]+$/.test(rule.action) && typeof rule.resource === 'string' && rule.resource.length <= 4096 && !/[\r\n\0]/.test(rule.resource) && ['allow', 'ask', 'deny'].includes(rule.effect), 'Native permission rule required');
        assert(!/<\/?private\b|(?:password|api[_-]?key|bearer|--token)\s*[=: ]/i.test(rule.resource), 'No private/credential material in permission proposal');
        review.push({ role: id, kind: 'permission-change', action: rule.action, effect: rule.effect, requiresExplicitApproval: true });
      }
    }
    agents[id] = structuredClone(delta);
  }
  return { proposalOnly: true, writesPerformed: 0, nativeConfig: { $schema: 'https://opencode.ai/config.json', agents }, review,
    instructions: 'Keep organization context in its opt-in owner; project lenses in AGENTS. Review existing JSON/JSONC and preserve unrelated fields. Ask explicit confirmation before applying; no automatic sync, inherited workspace grant, index or credential setup.' };
}
