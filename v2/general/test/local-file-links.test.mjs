import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { checkLocalFile, linkTarget, desktopBindings, desktopEnvironment } from '../plugins/local-file-links/links.mjs';

test('accepts absolute regular files anywhere, not unsafe or ambiguous targets', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'local-file-links-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const file = path.join(tmp, 'documento con espacios.pdf');
  fs.writeFileSync(file, 'Synthetic document', { mode: 0o644 });
  assert.equal(linkTarget(`${file}\n`), file);
  assert.equal(linkTarget(`${file} `), `${file} `);
  assert.equal(checkLocalFile(file), file);
  for (const wrong of ['./document.pdf', `${tmp}/../document.pdf`, `${tmp}/.env`, `${tmp}/keys.pem`,
    `${tmp}/opencode-private/key.txt`, `${tmp}/sample.desktop`, '/proc/self/environ',
    'https://example.invalid/asset.pdf', `file://${file}`, `${file}\n${file}`]) {
    assert.equal(linkTarget(wrong), undefined);
    assert.throws(() => checkLocalFile(wrong));
  }
  assert.equal(linkTarget(`${tmp}/.env.example`), `${tmp}/.env.example`);
  const alias = path.join(tmp, 'alias.pdf');
  fs.symlinkSync(file, alias);
  assert.equal(checkLocalFile(alias), file);
  fs.unlinkSync(alias);
  fs.symlinkSync('/proc/self/status', alias);
  assert.throws(() => checkLocalFile(alias));
  fs.chmodSync(file, 0o755);
  assert.throws(() => checkLocalFile(file));
  assert.throws(() => checkLocalFile(tmp));
  assert.throws(() => checkLocalFile(`${tmp}/missing.pdf`));
  const fifo = path.join(tmp, 'pipe.pdf');
  assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
  assert.throws(() => checkLocalFile(fifo));
});

test('opener uses desktop MIME settings, not profile or credential environment', () => {
  const parent = { XDG_CONFIG_HOME: '/desktop/config', XDG_DATA_HOME: '/desktop/data', XDG_CURRENT_DESKTOP: 'GNOME' };
  const cli = { ...desktopBindings(parent), XDG_CONFIG_HOME: '/profile/config', XDG_DATA_HOME: '/profile/data',
    HOME: '/profile/home', WAYLAND_DISPLAY: 'wayland-0', OPENCODE_PASSWORD: 'synthetic', NODE_OPTIONS: 'do-not-forward' };
  assert.deepEqual(desktopEnvironment(cli, '/desktop/home'), {
    ...parent, HOME: '/desktop/home', PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', WAYLAND_DISPLAY: 'wayland-0',
  });
});
