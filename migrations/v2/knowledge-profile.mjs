// Common, non-deploying selection of the already validated Knowledge profile.
// Used by opt-in addon launchers; never returns/resolves provider credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { layout, noSymlinks, verify } from './staging.mjs';
import { knowledgeExtension } from '../../../super-turing-opencode-knowledge/v2/composition.mjs';
import { translateEngram } from '../../../super-turing-opencode-knowledge/v2/engram-config.mjs';

const addon = fileURLToPath(new URL('../../../super-turing-opencode-knowledge/', import.meta.url));
const desktopPackage = fileURLToPath(new URL('../../../super-turing-opencode-notifier/v2/desktop/', import.meta.url)).replace(/\/$/, '');

export function selectKnowledgeProfile() {
  const home = os.homedir(), config = path.join(home, '.config/opencode');
  const base = layout(path.join(home, '.local/share/opencode-v2-clean'));
  verify(base);
  const first = layout(path.join(base.root, 'pilot'));
  noSymlinks(first.marker);
  assert.equal(JSON.parse(fs.readFileSync(first.marker, 'utf8')).owner, 'opencode-stack');
  const keys = ['HOME', 'PATH', 'LANG', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME',
    'OPENCODE_KNOWLEDGE_HOME', 'OPENCODE_KNOWLEDGE_VENV', 'QDRANT_LOCAL_PATH', 'OPENCODE_KNOWLEDGE_COLLECTION', 'OPENCODE_KNOWLEDGE_SCOPE', 'OPENCODE_KNOWLEDGE_PROJECT',
    'OPENCODE_KNOWLEDGE_EMBEDDING_BACKEND', 'OPENCODE_KNOWLEDGE_EMBEDDING_MODEL', 'OPENCODE_KNOWLEDGE_OLLAMA_BASE_URL', 'OPENCODE_KNOWLEDGE_OLLAMA_BATCH_SIZE', 'OPENCODE_KNOWLEDGE_OLLAMA_TIMEOUT_SECONDS',
    'ENGRAM_DATA_DIR', 'ENGRAM_PROJECT', 'ENGRAM_CLOUD_AUTOSYNC', 'ENGRAM_CLOUD_SERVER'];
  const env = Object.fromEntries(keys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  if (process.env.ENGRAM_CLOUD_TOKEN) env.ENGRAM_CLOUD_TOKEN = 'configured';
  const selected = spawnSync('python3', [path.join(addon, 'v2/selected-runtime.py')], {
    input: JSON.stringify({ home, config }), encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
    env: { ...env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert(!selected.error && selected.status === 0, 'No se pudo seleccionar el wiring actual sin copiar secretos; no se modificó el workshop');
  const runtime = JSON.parse(selected.stdout);
  const root = path.join(base.root, 'workshop');
  return { base, root, home, config, runtime, marker: path.join(root, '.knowledge-v2-enabled.json'),
    options: { shared: first, context7: true, approvedTuiPackage: desktopPackage,
      extend: knowledgeExtension({ runtimeHome: home, runtimeConfig: config, environment: runtime.environment,
        server: translateEngram(runtime.server), permissions: runtime.permissions }) } };
}
