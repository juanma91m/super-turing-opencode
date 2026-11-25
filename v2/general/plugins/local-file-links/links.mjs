import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

const preferences = ['XDG_CONFIG_HOME', 'XDG_CONFIG_DIRS', 'XDG_DATA_HOME', 'XDG_DATA_DIRS', 'XDG_CURRENT_DESKTOP'];
const endpoints = ['DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_SESSION_TYPE', 'XAUTHORITY'];
const restricted = new Set(['.ssh', '.gnupg', '.aws', '.kube', 'opencode-private', '.netrc', '.npmrc', '.pypirc',
  'auth.json', 'credentials.json', 'api-key', 'id_rsa', 'id_ed25519', 'shadow', 'gshadow', 'opencode.db']);
const launchers = /\.(?:desktop|lnk|url|webloc|appimage|exe|msi|com|bat|cmd|command|run|scr|ps1)$/iu;

// Keep the CLI profile isolated; only the opener reconstructs desktop XDG
// resolution from this explicit binding, never from the profile's HOME.
export function desktopBindings(parent) {
  return Object.fromEntries(preferences.filter(key => parent[key]).map(key => [`OPENCODE_STACK_DESKTOP_${key}`, parent[key]]));
}

export function desktopEnvironment(parent, home = os.userInfo().homedir) {
  const env = { HOME: home, PATH: '/usr/bin:/bin', LANG: parent.LANG || 'C.UTF-8' };
  for (const key of endpoints) if (parent[key]) env[key] = parent[key];
  for (const key of preferences) if (parent[`OPENCODE_STACK_DESKTOP_${key}`]) env[key] = parent[`OPENCODE_STACK_DESKTOP_${key}`];
  return env;
}

export function eligiblePath(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.normalize(file) !== file ||
      file.endsWith('/') || /[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u.test(file)) return false;
  if (/^\/(?:(?:proc|sys|dev)(?:\/|$)|run\/credentials(?:\/|$))/u.test(file)) return false;
  const parts = file.toLowerCase().split('/');
  const last = parts.at(-1);
  return !parts.some((part, index) => restricted.has(part) ||
    (part.startsWith('.env') && !(index === parts.length - 1 && part === '.env.example'))) &&
    !launchers.test(last) && !/\.(?:pem|key|p12|pfx|kdbx)$/iu.test(last);
}

export function linkTarget(text) {
  // Markdown may retain one structural newline. Don't trim actual filename characters.
  const file = typeof text === 'string' ? text.replace(/\r?\n$/u, '') : undefined;
  return eligiblePath(file) ? file : undefined;
}

export function checkLocalFile(file) {
  if (!eligiblePath(file)) throw new Error('Not an eligible local path');
  const target = fs.realpathSync(file);
  if (!eligiblePath(target)) throw new Error('Not an eligible local target');
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || (stat.mode & 0o111)) {
    throw new Error('Not an ordinary non-executable file');
  }
  return target;
}

export async function openLocalFile(file) {
  const target = checkLocalFile(file);
  const env = desktopEnvironment(process.env);
  // GIO selects the actual per-user MIME handler. Never use a shell or
  // inherit OpenCode server credentials, and never read the file in TUI.
  await new Promise((resolve, reject) => {
    execFile('/usr/bin/gio', ['open', '--', target], { cwd: env.HOME, env, timeout: 15000 }, error => {
      if (error) reject(new Error('Desktop handler unavailable'));
      else resolve();
    });
  });
}
