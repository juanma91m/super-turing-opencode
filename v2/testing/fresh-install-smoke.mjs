// Assert first startup using only the disposable installation's native storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { officialRuntime, checkCandidate } from '../general/lifecycle.mjs';
import { installedPlan } from '../general/releases.mjs';
import { bindProductionStorage, productionStorage } from '../general/production-storage.mjs';
import { inspectLiveCandidate, serverEnvironment } from '../general/launch.mjs';
import { startOwnedServer } from '../general/owned-server.mjs';

const [root, project] = process.argv.slice(2);
const home = fs.realpathSync(process.env.HOME), temporary = fs.realpathSync(process.env.TMPDIR);
assert(home === path.join(temporary, 'home') && project === path.join(temporary, 'project'));
assert(fs.realpathSync(root) === root && path.dirname(root) === path.join(home, '.local/share/opencode-stack/installs'));
const settings = JSON.parse(fs.readFileSync(path.join(root, 'settings.json')));
assert(settings.profile === 'base' && settings.generalRoot === path.join(root, 'general') && settings.storageRoot === path.join(root, 'production-storage') && settings.stagingRoot === path.join(root, 'opencode-runtime'));
const runtime = officialRuntime(settings.stagingRoot), plan = installedPlan(settings.generalRoot, project);
assert.deepEqual(plan.components, []);
checkCandidate(plan, runtime, { generalOnly: true });
const active = bindProductionStorage(plan, productionStorage(settings.storageRoot));
const host = await startOwnedServer(runtime.binary, active, profile => ({ ...serverEnvironment(profile), OPENCODE_DISABLE_MODELS_FETCH: '1' }));
try {
  const { public: report, agent } = await inspectLiveCandidate(host, active);
  assert(report.ready && report.auditStatus === 'pass' && report.findings.length === 0,
    'Unexpected effective profile or guard policy');
  assert.equal(agent.id, 'master-dev');
  assert(report.roles > 0 && report.commands > 0 && report.registeredSkills > 0 && report.registeredTools > 0);
  assert.deepEqual(report.mcp, []);
  assert.equal(report.providerConnected, false);
  assert.equal(report.readyForChat, false);
  assert.equal(report.diagnosticSessionRemoved, true);
  console.log(JSON.stringify({ startupAudit: report.auditStatus, defaultAgent: agent.id, roles: report.roles,
    commands: report.commands, skills: report.registeredSkills, tools: report.registeredTools,
    providerConnected: report.providerConnected, modelRequests: report.modelRequestsIssuedByLauncher }));
} finally { await host.close(); }
