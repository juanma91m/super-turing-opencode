import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generalPaths, planGeneral, prepareGeneral } from '../../v2/general/profile.mjs';
import { readGeneralDefaults } from '../../v2/general/defaults.mjs';
import { dormantSummary } from '../../v2/general/dormant-providers.mjs';
import { candidateStatus, checkCandidate, officialRuntime } from '../../v2/general/lifecycle.mjs';
import { launchConsent, runLiveCandidate, runCandidateTerminal } from '../../v2/general/launch.mjs';
import { releaseStorePath } from '../../v2/general/ownership.mjs';
import { installRelease, restoreRelease, recoverRelease, distributionStatus, previewDistribution, installedPlan, releaseHistory, validateReleaseSchema } from '../../v2/general/releases.mjs';
import { validateInstalledPlaywright } from '../../v2/playwright/installed-runtime.mjs';

async function main() {
  const [action, flag, project, ...tail] = process.argv.slice(2), live = ['verify-live', 'chat'].includes(action);
  const options = { candidateOnly: tail.includes('--candidate-only'), clientClosed: tail.includes('--client-closed'), reuseV2Storage: tail.includes('--reuse-v2-storage'), stagingRoot: path.join(os.homedir(), '.local/share/opencode-v2-clean') };
  const distributionWrite = ['install', 'update', 'rollback', 'recover'].includes(action);
  const expectedTail = ['install', 'update'].includes(action) ? ['--candidate-only', '--client-closed'] : action === 'rollback' ? ['--revision', tail[1], '--candidate-only', '--client-closed', '--confirm'] : action === 'recover' ? ['--to', tail[1], '--candidate-only', '--client-closed', '--confirm'] : null;
  assert(['plan', 'status', 'check', 'prepare', 'verify-live', 'chat', 'release-plan', 'release-history', 'install', 'update', 'rollback', 'recover'].includes(action) && flag === '--project' && project && (expectedTail
    ? JSON.stringify(tail) === JSON.stringify(expectedTail) && (action !== 'rollback' || /^[a-f0-9]{64}$/.test(tail[1])) && (action !== 'recover' || ['previous', 'target'].includes(tail[1])) : live
    ? JSON.stringify(tail) === JSON.stringify(['--candidate-only', '--client-closed', ...(options.reuseV2Storage ? ['--reuse-v2-storage'] : [])])
    : JSON.stringify(tail) === JSON.stringify(action === 'prepare' ? ['--client-closed'] : [])), 'Uso: general-composed.mjs plan|status|check|release-plan|release-history --project /root | prepare --project /root --client-closed | verify-live|chat --project /root --candidate-only --client-closed [--reuse-v2-storage] | install|update --project /root --candidate-only --client-closed | rollback --project /root --revision SHA256 --candidate-only --client-closed --confirm | recover --project /root --to previous|target --candidate-only --client-closed --confirm');
  if (live) launchConsent(action, options); // Before selectors, profile or stores.
  const root = path.join(os.homedir(), '.local/share/opencode-v2-clean/general-composed-candidate');
  generalPaths(root, project);
  if (action === 'release-history') { console.log(JSON.stringify(releaseHistory(root), null, 2)); return; }
  if (action === 'status' && fs.existsSync(releaseStorePath(root))) { console.log(JSON.stringify(distributionStatus(root), null, 2)); return; }
  if (action === 'rollback' || action === 'recover') {
    const runtime = officialRuntime(options.stagingRoot), restoration = { ...options, confirm: true, validate: p => validateReleaseSchema(p, runtime) };
    console.log(JSON.stringify(action === 'rollback' ? restoreRelease(root, tail[1], project, restoration) : recoverRelease(root, tail[1], project, restoration), null, 2)); return;
  }
  let selected, defaults, maintenanceModels, dormantProviders, p;
  if ((live || action === 'check') && fs.existsSync(releaseStorePath(root))) {
    p = installedPlan(root, project); // Rollback launch does not regenerate today's builders.
    if (live) validateInstalledPlaywright(p);
  } else {
    const [{ generalAddons }, { selectGeneralAddons }] = await Promise.all([import('../../v2/general/addons.mjs'), import('../../v2/general/select-addons.mjs')]);
    selected = selectGeneralAddons(os.homedir(), path.join(os.homedir(), '.config/opencode'));
    const current = readGeneralDefaults(path.join(os.homedir(), '.config/opencode'), process.env); defaults = current.report; maintenanceModels = current.maintenanceModels; dormantProviders = current.dormantProviders;
    if (action === 'prepare' || distributionWrite || live) assert(selected.descriptors.playwright.runtime.managed_root, 'Primero preparar el runtime durable con playwright-runtime.mjs prepare --client-closed; no se modificó el candidato');
    p = (action === 'prepare' ? prepareGeneral : planGeneral)(root, { project, runtimeHome: selected.runtimeHome, maintenanceModels, dormantProviders, contributions: generalAddons(selected.descriptors) });
  }
  if (action === 'release-plan') { console.log(JSON.stringify(previewDistribution(p), null, 2)); return; }
  if (action === 'install' || action === 'update') {
    const status = distributionStatus(root); assert(action !== 'update' || status.status === 'installed', 'Explicit initial install required before update');
    if (action === 'install' && status.status === 'installed') assert(status.current === previewDistribution(p).desired, 'Already installed at a different revision; use explicit update');
    const runtime = officialRuntime(options.stagingRoot);
    console.log(JSON.stringify(installRelease(p, { ...options, validate: value => validateReleaseSchema(value, runtime) }), null, 2)); return;
  }
  if (live) {
    const runtime = officialRuntime(options.stagingRoot);
    const result = await runLiveCandidate(p, runtime, action, options, async ({ active, connection, sessionID, report }) => {
      console.log(JSON.stringify(report, null, 2));
      await runCandidateTerminal(runtime, active, connection, sessionID);
    });
    if (action === 'verify-live') { console.log(JSON.stringify(result, null, 2)); if (!result.ready) process.exitCode = 1; }
    return;
  }
  if (action === 'status' || action === 'check') {
    // Diagnostics never call prepareGeneral, start services, share stores or
    // install/update assets. check validates the recorded official binary first.
    console.log(JSON.stringify(action === 'status' ? candidateStatus(p) : checkCandidate(p, officialRuntime(path.join(os.homedir(), '.local/share/opencode-v2-clean'))), null, 2)); return;
  }
  console.log(JSON.stringify({ stage: 'composed general candidate; not current/global deployment', action, profile: root, components: p.components, roles: p.roles.length,
    commands: p.commands.length, skills: [...p.assets.keys()].filter(file => file.endsWith('/SKILL.md')).length,
    helperRegistries: [...p.assets.keys()].filter(file => file.includes('/planner-helpers/')).length,
    mcpDefinitions: Object.keys(p.document.mcp.servers), mcpStarted: false, realModelRequests: 0, automaticIndexing: false,
    selectedRuntime: selected.metadata, maintenanceModels, disabledLocalProviders: defaults.providers.filter(provider => provider.disabled).map(provider => provider.id), dormantProviderDefinitionsPorted: true, dormantProviders: dormantSummary(dormantProviders),
    approvedDefaults: { compactionAuto: p.document.compaction.auto, snapshots: p.document.snapshots, externalSkillsAutoimport: false, update: p.document.update, officialPin: '2.2.7' },
    existingWorkshopChanged: false, originalStorageOpened: false, authState: 'candidate isolated; no credentials copied', globalDeployment: false }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
