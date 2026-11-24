import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const VERSION = '2.2.7';
const here = path.dirname(fileURLToPath(import.meta.url));
const owner = { schemaVersion: 1, owner: 'opencode-stack', kind: 'v2-clean-staging', version: VERSION };
const runtimeOwner = { ...owner, kind: 'official-native-runtime' };

export function layout(root) {
  assert(path.isAbsolute(root));
  return {
    root, home: path.join(root, 'home'), config: path.join(root, 'home/.config'),
    data: path.join(root, 'home/.local/share'), state: path.join(root, 'home/.local/state'),
    cache: path.join(root, 'home/.cache'), tmp: path.join(root, 'tmp'),
    project: path.join(root, 'home/project'), prefix: path.join(root, 'npm'),
    marker: path.join(root, path.basename(root) === 'opencode-runtime' ? '.stack-runtime.json' : '.stack-v2-migration.json'),
    runtime: path.join(root, 'runtime.json'),
    binary: path.join(root, 'npm/bin/opencode'),
  };
}

// Reject symlinked ancestors before writes. Package-managed binary symlinks are
// checked separately through realpath and must resolve within this prefix.
export function noSymlinks(target) {
  let current = path.parse(target).root;
  for (const segment of path.relative(current, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try { assert(!fs.lstatSync(current).isSymbolicLink(), `Symlink refused: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export function environment(p) {
  return {
    HOME: p.home, USER: os.userInfo().username, LOGNAME: os.userInfo().username,
    PATH: [path.dirname(process.execPath), '/usr/local/bin', '/usr/bin', '/bin'].join(':'),
    LANG: 'C.UTF-8', TERM: 'xterm-256color',
    XDG_CONFIG_HOME: p.config, XDG_DATA_HOME: p.data,
    XDG_STATE_HOME: p.state, XDG_CACHE_HOME: p.cache,
    TMPDIR: p.tmp, TMP: p.tmp, TEMP: p.tmp,
    OPENCODE_CONFIG_DIR: path.join(p.config, 'opencode'),
    OPENCODE_DB: path.join(p.data, 'opencode/opencode.db'),
    OPENCODE_DISABLE_PROJECT_CONFIG: '1',
    OPENCODE_DISABLE_EXTERNAL_SKILLS: '1',
    OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: '1',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    // npm rejects loading the same path twice as user and global config.
    NPM_CONFIG_USERCONFIG: '/dev/null',
    NPM_CONFIG_GLOBALCONFIG: path.join(p.home, 'npm-global-empty.rc'),
    NPM_CONFIG_CACHE: path.join(p.cache, 'npm'),
    NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  };
}

function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeNew(file, content) {
  noSymlinks(file);
  try { fs.writeFileSync(file, content, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}

export function prepare(p) {
  const identity = path.basename(p.root) === 'opencode-runtime' ? runtimeOwner : owner;
  noSymlinks(p.root);
  if (fs.existsSync(p.root) && !fs.existsSync(p.marker)) {
    assert.equal(fs.readdirSync(p.root).length, 0, 'Refusing unowned nonempty root');
  }
  if (fs.existsSync(p.marker)) {
    noSymlinks(p.marker);
    assert.deepEqual(json(p.marker), identity, 'Runtime owner/version mismatch');
  }
  fs.mkdirSync(p.root, { recursive: true, mode: 0o700 });
  writeNew(p.marker, JSON.stringify(identity, null, 2) + '\n');
  for (const dir of [p.home, p.config, p.data, p.state, p.cache, p.tmp, p.project, p.prefix, path.join(p.config, 'opencode')]) {
    noSymlinks(dir);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  for (const name of ['opencode.json', 'cli.json']) {
    writeNew(path.join(p.config, 'opencode', name), fs.readFileSync(path.join(here, 'config', name)));
  }
  writeNew(path.join(p.home, 'npm-global-empty.rc'), '');
  return p;
}

function run(p, command, args) {
  const result = spawnSync(command, args, {
    cwd: p.project, env: environment(p), encoding: 'utf8',
    timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Could not start ${path.basename(command)}: ${result.error.code}`);
  // Do not dump plugin output or config: later phases may include secrets.
  assert.equal(result.status, 0, `${path.basename(command)} ${args[0]} failed (status ${result.status})`);
  return result.stdout;
}

export function runtime(p) {
  const actual = fs.realpathSync(p.binary);
  assert(actual.startsWith(p.prefix + path.sep), 'Binary escapes npm prefix');
  const version = run(p, p.binary, ['--version']).trim();
  assert.equal(version, `opencode v${VERSION}`, 'Official version mismatch');
  return {
    package: `@opencode/cli@${VERSION}`, version,
    binary: actual, sha256: createHash('sha256').update(fs.readFileSync(actual)).digest('hex'),
  };
}

export function install(p) {
  prepare(p);
  noSymlinks(p.prefix);
  if (fs.existsSync(p.binary)) {
    assert.deepEqual(runtime(p), json(p.runtime), 'Existing install differs from recorded official runtime');
    return json(p.runtime);
  }
  run(p, 'npm', ['install', '--global', '--prefix', p.prefix, '--no-audit', '--no-fund', `@opencode/cli@${VERSION}`]);
  const record = runtime(p);
  writeNew(p.runtime, JSON.stringify(record, null, 2) + '\n');
  return record;
}

export function verify(p) {
  prepare(p);
  const record = runtime(p);
  noSymlinks(p.runtime);
  assert.deepEqual(record, json(p.runtime), 'Runtime changed since install');
  const paths = parsePaths(run(p, p.binary, ['debug', 'paths']));
  const config = JSON.parse(run(p, p.binary, ['debug', 'config', '--standalone']));
  // Every filesystem path reported by the runtime must stay under this root.
  for (const value of Object.values(paths)) {
    if (typeof value === 'string' && path.isAbsolute(value)) {
      assert(value.startsWith(p.root + path.sep), 'Runtime path escapes staging');
    }
  }
  assert.equal(paths.home, p.home);
  assert.equal(paths.db, environment(p).OPENCODE_DB);
  assert(Array.isArray(config), 'Expected config discovery records');
  for (const entry of config) {
    assert(typeof entry.path === 'string' && entry.path.startsWith(p.root + path.sep), 'Foreign config source discovered');
  }
  const documents = config.filter(entry => entry.type === 'document');
  assert.equal(documents.length, 1, 'Unexpected config document');
  const info = documents[0].info;
  assert.deepEqual(info.permissions, [{ action: '*', resource: '*', effect: 'deny' }]);
  assert(info.policies.some(rule => rule.action === 'provider.use' && rule.resource === '*' && rule.effect === 'deny'));
  assert.deepEqual(info.plugins, []);
  return { ...record, paths, configSources: config.map(({ type, path }) => ({ type, path })), configKeys: Object.keys(info).sort() };
}

export function parsePaths(output) {
  const paths = {};
  for (const line of output.trim().split('\n')) {
    const match = /^(\S+)\s+(.+)$/.exec(line);
    assert(match, 'Unexpected debug paths output');
    assert(!Object.hasOwn(paths, match[1]), 'Duplicate runtime path');
    paths[match[1]] = match[2];
  }
  for (const name of ['home', 'data', 'cache', 'config', 'state', 'tmp', 'db']) {
    assert(path.isAbsolute(paths[name] ?? ''), `Missing absolute runtime path: ${name}`);
  }
  return paths;
}
