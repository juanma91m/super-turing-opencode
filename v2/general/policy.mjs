export function matches(pattern, value) {
  return new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.') + '$').test(value);
}

export function effect(rules, action, resource = '*') {
  return rules.findLast(rule => matches(rule.action, action) && matches(rule.resource, resource))?.effect;
}

export function basePermissions() {
  return [{ action: '*', resource: '*', effect: 'deny' },
    ...['read', 'edit', 'glob', 'grep', 'skill', 'question', 'todowrite', 'agent_attribution', 'webfetch'].map(action => ({ action, resource: '*', effect: 'allow' })),
    { action: 'shell', resource: '*', effect: 'ask' }, { action: 'external_directory', resource: '*', effect: 'ask' },
    { action: 'subagent', resource: '*', effect: 'deny' }, { action: 'execute', resource: '*', effect: 'deny' }];
}

export function shellEnvironment(parent = process.env) {
  const allowed = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'TERM', 'TMPDIR', 'TMP', 'TEMP', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME'];
  return Object.fromEntries(allowed.filter(key => parent[key] !== undefined).map(key => [key, parent[key]]));
}

// Same existing libpq mechanisms as scripts/psql_readonly.py; no env sourcing,
// credential serialization or inheritance by arbitrary shell/model processes.
export function libpqEnvironment(parent = process.env) {
  const exact = new Set(['PGPASSWORD','PGPASSFILE','PGSERVICEFILE','PGCHANNELBINDING','PGGSSENCMODE','PGKRBSRVNAME']);
  return Object.fromEntries(Object.entries(parent).filter(([key,value]) => typeof value === 'string' && (exact.has(key) || key.startsWith('PGSSL'))));
}

// Public native skill-registry filter for default external-client discovery.
// This is not an OS filesystem-access boundary. Explicit owner imports should
// use their reviewed native config/project asset paths, which remain native.
export function externalClientSkill(file) {
  return typeof file === 'string' && /(?:^|\/)\.(?:agents|claude)\/skills(?:\/|$)/.test(file.replaceAll('\\', '/'));
}
