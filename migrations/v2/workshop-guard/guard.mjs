import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { CONTEXT7_TOOLS, checkContext7 } from '../context7-policy.mjs';

const fileTools = new Set(['read', 'edit', 'write', 'patch']);
const direct = new Set(['read', 'edit', 'write', 'patch', 'glob', 'grep', 'shell', 'skill', 'agent_attribution', 'todowrite', 'question']);
const publicationTools = new Set(['artifact-render', 'artifact-preview', 'artifact-validate', 'artifact-fonts', 'artifact-service-flow', 'artifact-narrated-sequence', 'artifact-verify-receipt', 'excalidraw-canvas', 'subagent']);
const pathKeys = new Set(['path', 'filePath', 'from', 'to', 'filename', 'file']);

export function cleanShellEnvironment(parent = process.env) {
  const allowed = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'TERM', 'TMPDIR', 'TMP', 'TEMP', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME'];
  return { ...Object.fromEntries(allowed.filter(key => parent[key] !== undefined).map(key => [key, parent[key]])), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' };
}

function canonical(candidate) {
  let current = path.parse(candidate).root;
  for (const part of path.relative(current, candidate).split(path.sep)) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Workshop: symlinks disabled'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return candidate;
}

export function location(options, directory) {
  if (directory !== options.project || canonical(directory) !== directory) throw new Error('Workshop: unexpected location');
}

function paths(input) {
  const found = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (pathKeys.has(key) && typeof item === 'string') found.push(item);
      if (['patchText', 'patch', 'diff'].includes(key) && typeof item === 'string') {
        for (const match of item.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)) found.push(match[1]);
      }
      if (item && typeof item === 'object') visit(item);
    }
  }
  visit(input);
  return found;
}

function pinned(options) {
  for (const [file, digest] of Object.entries(options.pinned)) {
    canonical(file);
    if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== digest) throw new Error('Workshop: trusted asset changed');
  }
}

export function shell(command, cwd, options, runner = spawnSync) {
  location(options, cwd);
  pinned(options);
  if (options.commands.includes(command)) return;
  const validators = [options.helperValidator, ...(options.helperValidators ?? [])].filter(Boolean);
  for (const validator of validators) {
    const result = runner('python3', [validator, '--check-command'], { input: JSON.stringify({ command }), cwd, env: cleanShellEnvironment(), encoding: 'utf8', timeout: 10000 });
    if (!result.error && result.status === 0) return;
  }
  throw new Error('Workshop: command not in the synthetic allowlist');
}

export function check(event, options, directory) {
  location(options, directory);
  if (options.context7 && CONTEXT7_TOOLS.includes(event.tool)) { checkContext7(event.tool, event.input); return; }
  if (additionalTool(event.tool, options)) return;
  if (!direct.has(event.tool)) throw new Error('Workshop: tool unavailable in this phase');
  const input = event.input ?? {};
  const filePatterns = event.tool === 'glob' ? [input.pattern] : event.tool === 'grep' ? [input.include] : [];
  for (const pattern of filePatterns) {
    if (typeof pattern === 'string' && (path.isAbsolute(pattern) || /^(?:~|\$HOME)/.test(pattern) || pattern.replaceAll('\\', '/').split('/').includes('..'))) throw new Error('Workshop: external search patterns disabled');
  }
  if (event.tool === 'shell') {
    shell(input.command, path.resolve(directory, input.workdir ?? input.cwd ?? directory), options);
    return;
  }
  if (fileTools.has(event.tool) || ['glob', 'grep'].includes(event.tool)) {
    const candidates = paths(input);
    for (const value of candidates) {
      const file = canonical(path.resolve(directory, value));
      if (file !== directory && !file.startsWith(directory + path.sep)) {
        const publication = options.documenter;
        const resourceRead = event.tool === 'read' && publication?.readActors?.includes(event.agent)
          && publication.readRoots.some(root => file.startsWith(root + path.sep));
        if (!resourceRead) throw new Error('Workshop: file outside synthetic project');
      }
      if (['edit', 'write', 'patch'].includes(event.tool) && file !== options.editable) {
        const publication = options.documenter;
        if (!publication || event.agent !== publication.actor || !file.startsWith(publication.root + path.sep)) throw new Error('Workshop: write outside the authorized actor/project area');
      }
    }
  }
}

function additionalTool(name, options) {
  // Migration fixtures/composition supply exact reviewed addon tool names.
  // This is not a permission grant: native policies and actor/session rules
  // still apply. Never interpret '*' as a tool wildcard here.
  return typeof name === 'string' && !direct.has(name)
    && (/^[A-Za-z][A-Za-z0-9-]*_[A-Za-z0-9_-]+$/.test(name) || options.documenter && publicationTools.has(name))
    && Array.isArray(options.additionalTools) && options.additionalTools.includes(name);
}

export function exposeDirectTools(editor) {
  for (const name of direct) {
    // Already direct in native 2.2.7. Re-registering its options through the
    // Promise editor breaks interactive form delivery; keep its native handler.
    if (name === 'question') continue;
    editor.update(name, tool => { tool.options = { ...tool.options, codemode: false }; });
  }
}

export async function register(ctx) {
  const options = ctx.options;
  const directory = ctx.location.directory;
  await ctx.session.hook('prompt', event => {
    location(options, directory);
    if (['files', 'agents', 'skills'].some(key => event.prompt[key]?.length)) throw new Error('Workshop: explicit attachments/mentions disabled');
  });
  await ctx.session.hook('context', event => {
    location(options, directory);
    if (!options.agents.includes(event.agent) || event.model.providerID !== options.provider || event.model.id !== options.model) throw new Error('Workshop: unexpected actor/model');
    for (const name of Object.keys(event.tools)) if (!direct.has(name) && !(options.context7 && CONTEXT7_TOOLS.includes(name)) && !additionalTool(name, options)) delete event.tools[name];
    const documenter = options.documenter && event.agent === options.documenter.actor;
    event.system.push({ type: 'text', text: 'Workshop: sólo proyecto sintético. ' + (options.context7 ? 'Context7 sólo para documentación pública; resolver library ID antes de query-docs. No enviar código privado ni secretos. ' : '') + (options.additionalTools?.length ? 'Integración addon explícita, sujeta a permisos del rol y sesión. ' : 'Sin memoria ni otros MCP de addons. ') + (options.ticketing ? 'Ticketing habilitado: Jira/Confluence sólo lecturas permitidas por rol; handoff local opt-in por broker. Sin mutaciones remotas en Jira/Confluence. ' : 'No hay Jira ni acceso remoto a negocio. ') + (documenter ? 'Sólo Documenter puede lanzar sus especialistas documentales por subagent nativo, sin delegación anidada. Sus fuentes/artefactos editables sólo están bajo artifact-studio/ de este proyecto. ' : 'No hay delegación disponible para este rol. Sólo app/message.txt es editable para roles implementadores; metadata local sólo por helpers aprobados. ') + 'No amplíes permisos ni inventes herramientas. El checker no ejecuta código editado.' });
  });
  await ctx.session.hook('title', async event => {
    event.result = options.preserveTitles ? (await ctx.session.get({ sessionID: event.sessionID })).title ?? 'New session' : 'Base V2 — piloto 2';
  });
  for (const kind of ['generate', 'compaction']) await ctx.session.hook(kind, () => { throw new Error('Workshop: auxiliary requests disabled'); });
  await ctx.tool.hook('execute.before', event => check(event, options, directory));
  await ctx.shell.hook('create.before', event => {
    shell(event.command, event.cwd, options);
    // Do not let a tool-supplied environment turn a trusted checker into a
    // preload/interpreter escape. Build from the already allowlisted server env.
    event.env = cleanShellEnvironment();
  });
  await ctx.tool.transform(exposeDirectTools);
}
