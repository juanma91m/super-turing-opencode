// Production uses the operator-owned npm installation. There is no release
// allowlist or binary hash ledger in the stack; npm owns upgrades and integrity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { noLinks } from './profile.mjs';

export function npmRuntime(root) {
  const existing = path.basename(root) === 'opencode-v2-clean';
  assert(path.isAbsolute(root) && path.normalize(root) === root && (existing || path.basename(root) === 'opencode-runtime'), 'Explicit official runtime root required');
  const marker = path.join(root, existing ? '.stack-v2-migration.json' : '.stack-runtime.json');
  const prefix = path.join(root, 'npm');
  function owned(file, isDirectory) {
    noLinks(file);
    const info = fs.statSync(file);
    assert((isDirectory ? info.isDirectory() : info.isFile()) && info.uid === process.getuid(), 'Unexpected npm installation owner or type');
    return info;
  }
  const prefixInfo = owned(prefix, true);
  assert(!(prefixInfo.mode & 0o077), 'Production npm prefix must be user-private');
  owned(marker, false);
  const globalConfig = path.join(root, 'home/npm-global-empty.rc');
  assert(owned(globalConfig, false).size === 0, 'Expected empty managed npm config');
  const owner = JSON.parse(fs.readFileSync(marker, 'utf8'));
  assert(owner.schemaVersion === 1 && owner.owner === 'opencode-stack' && owner.kind === (existing ? 'v2-clean-staging' : 'official-native-runtime'), 'Explicit official runtime ownership required');
  const pkg = path.join(prefix, 'lib/node_modules/@opencode/cli');
  const manifest = path.join(pkg, 'package.json');
  owned(manifest, false);
  const { name, bin, version } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert(name === '@opencode/cli' && typeof bin?.opencode === 'string', 'Expected npm package @opencode/cli');
  const binary = path.resolve(pkg, bin.opencode);
  assert(binary.startsWith(pkg + path.sep), 'npm executable escaped its package');
  const binDir = path.join(prefix, 'bin');
  owned(binDir, true);
  assert(fs.realpathSync(path.join(binDir, 'opencode')) === binary, 'npm entrypoint escaped the selected package');
  owned(binary, false);
  fs.accessSync(binary, fs.constants.X_OK);
  return { binary, version, prefix, globalConfig };
}

export function npmUpdateEnvironment(env, runtime) {
  const { OPENCODE_DISABLE_AUTOUPDATE: ignored, ...rest } = env;
  return { ...rest, PATH: path.join(runtime.prefix, 'bin') + ':' + rest.PATH,
    NPM_CONFIG_PREFIX: runtime.prefix, NPM_CONFIG_USERCONFIG: '/dev/null', NPM_CONFIG_GLOBALCONFIG: runtime.globalConfig,
    NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/', NPM_CONFIG_CACHE: path.join(rest.XDG_CACHE_HOME, 'npm-runtime') };
}
