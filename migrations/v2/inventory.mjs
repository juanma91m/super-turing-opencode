// Read-only inventory. Never resolve config interpolation, open credential
// stores, connect MCP servers, execute installers or print source/config values.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, noSymlinks } from './staging.mjs';

const assetDirs = ['agents', 'agent', 'commands', 'command', 'skills', 'skill', 'plugins', 'plugin', 'tools', 'scripts', 'lib', 'planner-helpers', 'mcp', 'artifact-studio', 'components', 'helpers', 'documents', 'canvas-runtime', 'knowledge', 'systemd', 'private', 'patches', 'roles', 'policies', 'docs', 'references', 'assets', 'config'];
const skip = new Set(['node_modules', '__pycache__', 'artifacts', 'output', 'previews']);
const textExtensions = new Set(['.md', '.json', '.jsonc', '.ts', '.tsx', '.js', '.mjs', '.py', '.sh']);
const patterns = {
  background: /\b(?:delegate|delegation_[a-z_]+|bg-tasks|bg-return|bg-apply|same_session_task_[a-z_]+)\b|super-turing-opencode-background|opencode-background|delegacion-async-opencode|PLAYBOOK-ASYNC|Background Tasks/gi,
  v1Plugin: /@opencode-ai\/(?:plugin|sdk)\b/g,
  lsp: /\blsp\b/gi,
  todo: /\btodowrite\b/g,
  v1ClientConfig: /\btui\.jsonc?\b/g,
};

export function references(text) {
  const result = {};
  for (const [name, pattern] of Object.entries(patterns)) {
    const hits = [];
    for (const [index, line] of text.split('\n').entries()) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) hits.push(index + 1);
    }
    if (hits.length) result[name] = hits;
  }
  return result;
}

export function files(root) {
  const result = [];
  function walk(relative) {
    if (path.basename(relative).startsWith('.env')) return;
    const full = path.join(root, relative);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) {
      result.push({ path: relative, kind: 'symlink' });
      return; // Do not follow links into unrelated repositories or private state.
    }
    if (stat.isDirectory()) {
      for (const item of fs.readdirSync(full).sort()) {
        if (!item.startsWith('.') && !skip.has(item)) walk(path.join(relative, item));
      }
      return;
    }
    if (!stat.isFile()) return;
    assert(result.length < 15000, 'Inventory size limit exceeded');
    const entry = { path: relative, kind: 'file', bytes: stat.size };
    const credentialStore = /^(?:auth|credentials?|tokens?|secrets?)\.(?:json|jsonc|db|sqlite)$/i.test(path.basename(full));
    const jsonConfig = ['opencode.json', 'opencode.jsonc', 'tui.json', 'tui.jsonc', 'cli.json', 'package.json'].includes(path.basename(full)) || full.endsWith('-MANIFEST.json');
    const scanText = !['.json', '.jsonc'].includes(path.extname(full)) || jsonConfig;
    if (!credentialStore && scanText && textExtensions.has(path.extname(full)) && stat.size < 1024 * 1024) {
      const refs = references(fs.readFileSync(full, 'utf8'));
      if (Object.keys(refs).length) entry.references = refs;
    }
    result.push(entry);
  }
  const documents = fs.readdirSync(root).filter(name => !name.startsWith('.') && (name.endsWith('.md') || name.endsWith('-MANIFEST.json')));
  for (const name of new Set([...assetDirs, ...documents, 'opencode.json', 'opencode.jsonc', 'tui.json', 'tui.jsonc', 'cli.json', 'package.json'])) {
    if (fs.existsSync(path.join(root, name))) walk(name);
  }
  return result;
}

// Explicit allowlist: never return headers, URLs, command arguments,
// environment values, credentials, tool output or prompt bodies.
export function configSummary(config) {
  const servers = config.mcp?.servers ?? config.mcp ?? {};
  return {
    keys: Object.keys(config).sort(),
    agents: Object.keys(config.agents ?? config.agent ?? {}).sort(),
    commands: Object.keys(config.commands ?? config.command ?? {}).sort(),
    providers: Object.keys(config.providers ?? config.provider ?? {}).sort(),
    configuredPluginCount: (config.plugins ?? config.plugin ?? []).length,
    mcp: Object.entries(servers).filter(([, entry]) => entry && typeof entry === 'object' && 'type' in entry).map(([name, entry]) => ({
      name, type: entry.type === 'local' ? 'local' : entry.type === 'remote' ? 'remote' : 'other',
      disabled: entry.disabled ?? (entry.enabled === false),
    })),
  };
}

function configAt(root) {
  const file = path.join(root, 'opencode.json');
  if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) return null;
  try { return configSummary(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch { return { needsParserReview: true }; } // No raw parse errors/values.
}

function summary(entries) {
  const count = expression => entries.filter(entry => expression.test(entry.path)).length;
  return {
    assets: entries.length,
    agents: count(/^(?:\.opencode\/)?agents?\/[^/]+\.md$/),
    commands: count(/^(?:\.opencode\/)?commands?\/.*\.md$/),
    skills: count(/^(?:\.opencode\/)?skills?\/.*\/SKILL\.md$/),
    pluginFiles: count(/^(?:\.opencode\/)?plugins?\//),
    backgroundReferenceFiles: entries.filter(entry => entry.references?.background).length,
    symlinks: entries.filter(entry => entry.kind === 'symlink').length,
  };
}

function layer(root) {
  const entries = files(root);
  const nested = path.join(root, '.opencode');
  if (fs.existsSync(nested) && !fs.lstatSync(nested).isSymbolicLink()) {
    entries.push(...files(nested).map(entry => ({ ...entry, path: path.join('.opencode', entry.path) })));
  }
  return { root, summary: summary(entries), config: configAt(root), entries };
}

export function inventory({ home, sources, overlayRoot }) {
  const components = fs.readdirSync(sources).filter(name => name === 'opencode-stack' || name.startsWith('super-turing-opencode-')).sort().map(name => {
    if (name === 'super-turing-opencode-background') return { name, excluded: true, reason: 'Background deferred until after V2 production cutover' };
    return { name, ...layer(path.join(sources, name)) };
  });
  const installed = layer(path.join(home, '.config/opencode'));
  const externalSkills = ['.agents/skills', '.claude/skills'].map(relative => {
    const root = path.join(home, relative);
    return { root, present: fs.existsSync(root), directories: fs.existsSync(root) ? fs.readdirSync(root).filter(name => !name.startsWith('.')).sort() : [] };
  });
  const overlays = [];
  if (overlayRoot) {
    for (const name of fs.readdirSync(overlayRoot).filter(name => name.startsWith('super-turing-opencode-')).sort()) {
      const target = path.join(overlayRoot, name.replace(/^super-turing-opencode-/, ''));
      const canonical = path.join(overlayRoot, name);
      if (!fs.existsSync(path.join(canonical, '.opencode'))) continue;
      overlays.push({ canonical: layer(canonical), target: fs.existsSync(target) ? layer(target) : { root: target, missing: true } });
    }
  }
  return { schemaVersion: 1, createdAt: new Date().toISOString(), components, installed, externalSkills, overlays };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const save = args.includes('--save');
    if (save) args.splice(args.indexOf('--save'), 1);
    assert(args.length === 0 || args.length === 2 && args[0] === '--overlay-root', 'Usage: node inventory.mjs [--overlay-root /absolute/path] [--save]');
    if (args.length) assert(path.isAbsolute(args[1]));
    const home = os.homedir();
    const result = inventory({ home, sources: path.join(home, '.local/src'), overlayRoot: args[1] });
    if (save) {
      const p = layout(path.join(home, '.local/share/opencode-v2-clean'));
      noSymlinks(p.marker);
      const marker = JSON.parse(fs.readFileSync(p.marker, 'utf8'));
      assert(marker.owner === 'opencode-stack' && marker.kind === 'v2-clean-staging');
      const output = path.join(p.root, 'inventory.json');
      noSymlinks(output);
      fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
      console.log(JSON.stringify({ output, components: result.components.map(({ name, excluded, summary }) => ({ name, excluded, summary })), installed: result.installed.summary, mcp: result.installed.config?.mcp, overlayCount: result.overlays.length }, null, 2));
    } else console.log(JSON.stringify(result, null, 2));
  } catch { console.error('Inventory failed; check paths, formats and file limits (no source values logged).'); process.exitCode = 1; }
}
