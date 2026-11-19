import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { auditEvidence, decodeList } from '../audit.mjs';
import { scaffoldProposal } from '../scaffold.mjs';

const baseline = { reviewer: { system: 'GLOBAL SAFE PROMPT', mode: 'subagent', model: 'fixture/model#medium', permissions: [{ action: '*', resource: '*', effect: 'deny' }, { action: 'read', resource: '*', effect: 'allow' }] } };
function evidence(t, extra = {}) {
  const root = fs.mkdtempSync('/tmp/opencode/layer-audit-unit-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'project'), config = path.join(root, 'global'); fs.mkdirSync(directory); fs.mkdirSync(config);
  return auditEvidence({ sources: [], agents: [{ id: 'reviewer', ...structuredClone(baseline.reviewer) }], baselines: baseline, directory, config, ...extra });
}
test('baseline passes without returning prompts or resource values; model object is normalized', t => {
  const report = evidence(t, { agents: [{ id: 'reviewer', ...baseline.reviewer, model: { providerID: 'fixture', id: 'model', variant: 'medium' } }] });
  assert.equal(report.status, 'pass'); assert(!JSON.stringify(report).includes('GLOBAL SAFE PROMPT'));
  assert.equal(report.coverage.actualHierarchyAcceptance, false);
  assert.deepEqual(decodeList({ data: [1] }), [1]); assert.throws(() => decodeList({ results: [] }));
});
test('lost prompt, missing role, mode/model/visibility and broader authority are visible', t => {
  const changed = evidence(t, { agents: [{ id: 'reviewer', system: 'REPLACED', model: 'fixture/other', mode: 'primary', hidden: true, permissions: [{ action: '*', resource: '*', effect: 'allow' }] }] });
  for (const code of ['global-prompt-lost', 'mode-changed', 'model-changed', 'visibility-changed', 'permission-broader']) assert(changed.findings.some(f => f.code === code), code);
  assert.equal(changed.status, 'error'); assert.equal(evidence(t, { agents: [] }).findings[0].code, 'missing-global-role');
});
test('native declarations and local file inventory flag review; symlinks are not traversed', t => {
  const root = fs.mkdtempSync('/tmp/opencode/layer-files-'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'project'), config = path.join(root, 'global'), local = path.join(directory, '.opencode');
  fs.mkdirSync(path.join(local, 'agents'), { recursive: true }); fs.mkdirSync(path.join(local, 'commands'));
  fs.writeFileSync(path.join(local, 'agents/reviewer.md'), 'PRIVATE CONTENT MUST NOT BE READ');
  fs.writeFileSync(path.join(local, 'commands/local.md'), 'PRIVATE CONTENT MUST NOT BE READ');
  fs.symlinkSync(root, path.join(local, 'agents/loop'));
  fs.symlinkSync(local, path.join(root, 'linked-source'));
  const report = auditEvidence({ sources: [{ type: 'document', path: path.join(local, 'opencode.json'), info: { agents: { reviewer: { system: 'DO NOT ECHO' }, unknown: {} } } }, { type: 'directory', path: local }, { type: 'directory', path: path.join(root, 'linked-source') }], agents: [{ id: 'reviewer', ...baseline.reviewer }], baselines: baseline, directory, config, runtimeOverridesPresent: true });
  for (const code of ['source-symlink', 'whole-agent-file', 'local-command-override', 'system-replacement-declared', 'unbacked-agent-delta', 'runtime-config-override']) assert(report.findings.some(f => f.code === code), code);
  assert(!JSON.stringify(report).includes('DO NOT ECHO')); assert(!JSON.stringify(report).includes('PRIVATE CONTENT'));
  assert.equal(report.files.length, 2); assert.equal(report.findings.filter(f => f.code === 'source-symlink').length, 2);
});
test('scaffold is proposal-only and all changes require explicit review, including denies', () => {
  const result = scaffoldProposal({ reviewer: { model: 'fixture/model#high', mode: 'all', permissions: [{ action: 'read', resource: '*', effect: 'deny' }] } }, baseline);
  assert.equal(result.writesPerformed, 0); assert.equal(result.review.length, 3); assert(result.review.every(r => r.requiresExplicitApproval));
  assert.equal(result.nativeConfig.agents.reviewer.system, undefined);
});
test('scaffold rejects unknown roles, V1/system fields, malformed rules and private material', () => {
  for (const deltas of [{ unknown: {} }, { reviewer: { system: 'replacement' } }, { reviewer: { tools: {} } }, { reviewer: { permission: {} } }, { reviewer: { model: 'provider/model\nPRIVATE' } }, { reviewer: { permissions: [{ action: 'read', resource: 'password=PRIVATE', effect: 'allow' }] } }, { reviewer: { permissions: [{ action: '*', resource: '*', effect: 'yes' }] } }, JSON.parse('{"__proto__":{}}')]) assert.throws(() => scaffoldProposal(deltas, baseline));
});
test('builtin visibility/disabled drift and missing managed catalog entries do not pass', t => {
  const report = evidence(t, { builtinExpectations: { plan: { hidden: true }, explore: { disabled: true } }, agents: [{ id: 'reviewer', ...baseline.reviewer }, { id: 'plan', hidden: false, permissions: [] }, { id: 'explore', permissions: [] }], tools: [{ id: 'read' }], managedTools: ['engram_mem_search'] });
  assert.equal(report.status, 'error'); assert.equal(report.findings.filter(f => f.code === 'builtin-state-changed').length, 2);
  assert(report.findings.some(f => f.code === 'managed-tool-missing'));
});
