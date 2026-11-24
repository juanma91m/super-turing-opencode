// Native argv is preserved. No fresh-session injection, candidate consent flags,
// single-client quota, shell interpretation, or implicit fallback to another host.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { OFFICIAL_SHA256 } from './lifecycle.mjs';
import { bindProductionStorage, productionStorage } from './production-storage.mjs';
import { acquireCandidateLease, serverEnvironment, terminalEnvironment, interactiveEnvironment } from './launch.mjs';
import { publishProductionReader } from './production-leases.mjs';
import { startOwnedServer } from './owned-server.mjs';

const verbs = new Set(['upgrade', 'update', 'uninstall', 'acp', 'api', 'debug', 'auth', 'mcp', 'plugin', 'models', 'stats', 'mini', 'run', 'session', 'service', 'reload', 'pair', 'serve']);
const rootValues = new Set(['--server', '--session', '-s', '--prompt', '--log-level', '--completions']);
export const MANAGED_CONTRACT = 'managed-harness-v1';
export function invocation(argv, cwd) {
  assert(Array.isArray(argv) && argv.every(value => typeof value === 'string' && !value.includes('\0')) && path.isAbsolute(cwd));
  // Only inspect root syntax to find the directory/verb; let the official parser
  // validate flags. Never treat a run prompt or flag value as a project directory.
  let head, positional, ended = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!ended && arg === '--') { ended = true; continue; }
    if (!ended && rootValues.has(arg)) { i++; continue; }
    if (!ended && arg.startsWith('-')) continue;
    head = !ended && verbs.has(arg) ? arg : undefined;
    if (!head) positional = arg;
    break;
  }
  const valueFlags = new Set(['--server', '--session', '-s', '--prompt', '--log-level', '--completions', '--data', '-d', '--header', '-H', '--param', '--file', '-f', '--model', '-m', '--agent', '--format', '--title', '--max-count', '-n', '--directory', '--replay-limit', '--days', '--year', '--project', '--limit', '--method', '--answer', '--url', '--hostname', '--port', '--cors', '--env']);
  const flags = [], words = []; ended = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]; if (arg === '--') break;
    if (arg.startsWith('-')) { const flag = arg.split('=')[0]; flags.push(flag); if (valueFlags.has(flag) && !arg.includes('=')) i++; }
    else words.push(arg);
  }
  const subcommand = head ? words[1] : undefined;
  const informational = flags.some(arg => ['--help', '-h', '--version', '-v', '--completions'].includes(arg));
  const explicitServer = flags.includes('--server'), standalone = flags.includes('--standalone');
  const managed = !head || ['api', 'auth', 'models', 'stats', 'mini', 'run', 'session', 'reload'].includes(head)
    || head === 'debug' && ['agents', 'config', 'heap-dump'].includes(subcommand)
    || head === 'mcp' && ['list', 'auth', 'logout'].includes(subcommand)
    || head === 'plugin' && ['list', 'check', 'update'].includes(subcommand);
  return { argv: [...argv], project: path.resolve(cwd, positional ?? '.'), command: head ?? 'tui', subcommand, informational, mode: informational ? 'information' : explicitServer || standalone || !managed ? 'native-hosting' : 'managed' };
}

export function connectedArguments(argv, url) {
  // Global native flags must precede -- (which may delimit prompt/file data).
  const index = argv.indexOf('--'), at = index < 0 ? argv.length : index;
  return [...argv.slice(0, at), '--server', url, ...argv.slice(at)];
}

export async function nativeChild(binary, argv, { cwd, env }) {
  const child = spawn(binary, argv, { cwd, env, stdio: 'inherit' });
  const forward = signal => { if (child.exitCode === null && child.signalCode === null) child.kill(signal); };
  const int = () => forward('SIGINT'), term = () => forward('SIGTERM'), hup = () => forward('SIGHUP');
  process.on('SIGINT', int); process.on('SIGTERM', term); process.on('SIGHUP', hup);
  try { return await new Promise((resolve, reject) => { child.once('error', () => reject(new Error('Could not start official native CLI'))); child.once('exit', (code, signal) => resolve(code ?? ({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129 }[signal] ?? 1))); }); }
  finally { process.off('SIGINT', int); process.off('SIGTERM', term); process.off('SIGHUP', hup); }
}

export async function runProductionCLI({ argv, cwd, runtime, storageRoot, select, managedContract, child = nativeChild, host = startOwnedServer }) {
  assert(managedContract === MANAGED_CONTRACT, 'Explicit managed-harness production contract required');
  assert(runtime.version === '2.2.7' && runtime.sha256 === OFFICIAL_SHA256 && createHash('sha256').update(fs.readFileSync(runtime.binary)).digest('hex') === OFFICIAL_SHA256, 'Official production runtime pin changed');
  return dispatchProductionCLI({ argv, cwd, runtime, storageRoot, select, child, host });
}

// Separately exported orchestration permits synthetic tests without weakening
// the public entrypoint's fixed-runtime hash check.
export async function dispatchProductionCLI({ argv, cwd, runtime, storageRoot, select, child = nativeChild, host = startOwnedServer }) {
  const input = invocation(argv, cwd);
  const selected = await select(input.project, { informational: input.informational });
  if (input.informational) return child(runtime.binary, argv, { cwd, env: interactiveEnvironment(selected.plan) });
  // The user chose the working managed harness, not exact equivalence with every
  // native hosting mode. Keep every harness tool on the owned fd3 host; never
  // silently delegate unsupported modes to a host that would lose those tools.
  const pathsOnly = input.command === 'debug' && input.subcommand === 'paths';
  assert(input.mode === 'managed' || pathsOnly, 'Managed harness does not support this native hosting mode (--server/--standalone/serve/service/acp/pair or an unmanaged mutator). No flags ignored and no degraded tools; see CONTRATO-GESTIONADO.md');
  const readers = []; let server;
  try {
    for (const root of [...new Set(selected.leaseRoots ?? [selected.plan.root])].sort()) {
      const exclusive = acquireCandidateLease(root, { productionReader: true });
      try { readers.push(publishProductionReader(root)); } finally { exclusive(); }
    }
    if (selected.acquireReader) readers.push(selected.acquireReader());
    await selected.check();
    const active = bindProductionStorage(selected.plan, productionStorage(storageRoot));
    if (pathsOnly) return await child(runtime.binary, argv, { cwd, env: interactiveEnvironment(active) });
    server = await host(runtime.binary, active, serverEnvironment);
    if (['tui', 'run', 'mini'].includes(input.command)) {
      const ready = await selected.inspect(server, active);
      assert(ready.readyForChat === true, 'Production startup/auth is not ready; no login or degraded fallback');
    }
    // Auth/recovery/history commands must remain usable while integrations are
    // disconnected. Their explicit native operation still uses the checked host.
    return await child(runtime.binary, connectedArguments(argv, server.connection.url), { cwd, env: terminalEnvironment(active, server.connection) });
  } finally { try { await server?.close(); } finally { for (const release of readers.reverse()) release(); } }
}
