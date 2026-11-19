// Synthetic PTY fixture only. Public descriptor has paths/mock URL, no tokens or
// auth material. The official host creates fresh native fixture storage itself.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planGeneral } from '../profile.mjs';
import { officialRuntime } from '../lifecycle.mjs';
import { runLiveCandidate, runCandidateTerminal } from '../launch.mjs';

const options = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const plan = planGeneral(options.target, options.plan), runtime = officialRuntime(options.officialRoot);
let opened = false;
try {
  await runLiveCandidate(plan, runtime, 'chat', { candidateOnly: true, clientClosed: true, reuseV2Storage: true, stagingRoot: options.syntheticStaging }, async ({ active, connection, sessionID, report }) => {
    assert.equal(report.readyForChat, true); assert.equal(active.storageBinding.sourceRoot, options.syntheticStaging + '/pilot');
    const response = await fetch(new URL('/api/session/' + sessionID, connection.url), { headers: { Authorization: 'Basic ' + Buffer.from('opencode:' + connection.env.OPENCODE_PASSWORD).toString('base64') } });
    const created = (await response.json()).data; assert.equal(created.agent, 'master-dev'); assert.equal(created.model.providerID, 'workshop-mock');
    assert(sessionID !== options.existingSessionID); opened = true;
    await runCandidateTerminal(runtime, active, connection, sessionID);
  });
} catch (error) {
  // No terminal transcript, endpoint, environment or native error bodies.
  if (!opened) process.stdout.write('\nFIXTURE_PRELAUNCH_FAILED\n');
  if (error.message.includes('startup/auth metadata is not ready')) process.stdout.write('\nFIXTURE_AUTH_NOT_READY\n');
  process.exitCode = 1;
} finally { process.stdout.write('\nFIXTURE_WORKER_CLOSED\n'); }
