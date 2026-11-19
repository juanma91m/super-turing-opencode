import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { planGeneral, prepareGeneral } from '../../v2/general/profile.mjs';

try {
  const [action, flag, project, acknowledgment, ...rest] = process.argv.slice(2);
  assert(['plan', 'prepare'].includes(action) && flag === '--project' && project && !rest.length && (action === 'plan' ? acknowledgment === undefined : acknowledgment === '--client-closed'), 'Uso: general.mjs plan --project /root/absoluto | prepare --project /root/absoluto --client-closed');
  const root = path.join(os.homedir(), '.local/share/opencode-v2-clean/general-candidate');
  const p = (action === 'plan' ? planGeneral : prepareGeneral)(root, { project });
  console.log(JSON.stringify({ stage: 'general base candidate, not final distribution', action, profile: p.root, roles: p.roles.length, baseCommands: p.commands.length, baseHelperRegistries: 4,
    projectDiscovery: 'native; no private compositor', defaultAgent: p.document.default_agent, hiddenBuiltins: ['plan', 'build'], backgroundAddon: false,
    addons: 'not composed in this increment; existing workshop unchanged', copiedCredentials: false, mcpStarted: false, realModelRequests: 0, globalDeployment: false }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
