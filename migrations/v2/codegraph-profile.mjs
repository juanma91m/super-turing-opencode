// Non-deploying current composition, shared by CodeGraph and subsequent ports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { noSymlinks } from './staging.mjs';
import { selectTicketingProfile } from './ticketing-profile.mjs';
import { codegraphExtension } from '../../../super-turing-opencode-codegraph/v2/composition.mjs';

export function assertUnindexedDefault(p, graph) {
  for (let candidate = p.project; ; candidate = path.dirname(candidate)) {
    assert(!fs.existsSync(path.join(candidate, graph.binding.environment?.CODEGRAPH_DIR ?? '.codegraph', 'codegraph.db')), 'Workshop has an indexed ancestor; review default-root behavior before starting MCP');
    if (candidate === path.dirname(candidate)) break;
  }
}

export function selectCodeGraphProfile() {
  const selected = selectTicketingProfile();
  const { home, config, root, options } = selected;
  assert(selected.installed, 'Primero incorporar y validar Ticketing');
  const current = spawnSync('python3', [fileURLToPath(new URL('../../../super-turing-opencode-codegraph/v2/selected-runtime.py', import.meta.url))], {
    input: JSON.stringify({ home, config }), encoding: 'utf8', timeout: 10000,
    env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1', ...Object.fromEntries([
      'CODEGRAPH_DIR', 'CODEGRAPH_NO_DAEMON', 'CODEGRAPH_NO_WATCH', 'CODEGRAPH_FORCE_WATCH', 'CODEGRAPH_WATCH_DEBOUNCE_MS',
      'CODEGRAPH_CATCHUP_GATE_TIMEOUT_MS', 'CODEGRAPH_QUERY_POOL_SIZE', 'CODEGRAPH_MAX_DIR_WATCHES',
    ].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])) },
  });
  assert(!current.error && current.status === 0, 'CodeGraph actual requiere reconciliación; valores omitidos, no se inició el backend');
  const graph = JSON.parse(current.stdout), marker = path.join(root, '.codegraph-v2-enabled.json');
  noSymlinks(marker);
  const state = { owner: 'opencode-stack', addon: 'super-turing-opencode-codegraph', profile: root, increment: 'query-only' };
  const installed = fs.existsSync(marker);
  if (installed) assert(JSON.stringify(JSON.parse(fs.readFileSync(marker))) === JSON.stringify(state), 'Unexpected CodeGraph marker (values suppressed)');
  const previous = options.extend, extension = codegraphExtension({ binding: graph.binding });
  return { ...selected, graph, graphMarker: marker, graphState: state, graphInstalled: installed,
    options: { ...options, extend: context => extension({ ...context, ...previous(context) }) } };
}
