import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { noSymlinks } from './staging.mjs';
import { selectPlaywrightProfile } from './playwright-profile.mjs';
import { documentReaderExtension } from '../../../super-turing-opencode-documents/v2/reader/composition.mjs';

export function selectDocumentsReaderProfile() {
  const selected = selectPlaywrightProfile();
  const { root, config, options } = selected;
  assert(selected.browserInstalled, 'Primero incorporar y validar Playwright');
  const preflight = spawnSync('python3', [fileURLToPath(new URL('../../../super-turing-opencode-documents/v2/reader/preflight.py', import.meta.url))], {
    input: JSON.stringify({ config }), encoding: 'utf8', timeout: 10000, env: { PATH: '/usr/local/bin:/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert(!preflight.error && preflight.status === 0, 'Documents reader actual requiere reconciliación; valores omitidos; no se instaló ni convirtió nada');
  const current = JSON.parse(preflight.stdout), marker = path.join(root, '.documents-read-v2-enabled.json'); noSymlinks(marker);
  const state = { owner: 'opencode-stack', addon: 'super-turing-opencode-documents', increment: 'reader', profile: root };
  const installed = fs.existsSync(marker);
  if (installed) assert(JSON.stringify(JSON.parse(fs.readFileSync(marker))) === JSON.stringify(state), 'Unexpected reader marker (values suppressed)');
  const previous = options.extend, extension = documentReaderExtension();
  return { ...selected, readerCurrent: current, readerMarker: marker, readerState: state, readerInstalled: installed,
    options: { ...options, extend: context => extension({ ...context, ...previous(context) }) } };
}
