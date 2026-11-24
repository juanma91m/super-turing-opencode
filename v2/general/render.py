#!/usr/bin/env python3
"""Pure native-agent render from canonical base files; no deployment or services."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]


def scalar(value):
    if value.startswith('"'):
        result = json.loads(value)
        if not isinstance(result, str):
            raise ValueError('String scalar required')
        return result
    if value.startswith("'"):
        if not value.endswith("'"):
            raise ValueError('Incomplete scalar')
        return value[1:-1].replace("''", "'")
    if value in ('true', 'false'):
        return value == 'true'
    if re.fullmatch(r'[0-9]+', value):
        return int(value)
    if not value or value[0] in '*&!>|[{\'"' or '#' in value or ': ' in value or value in ('null', '~'):
        raise ValueError('Unreviewed scalar syntax')
    return value


def closed_frontmatter(header):
    # This is NOT a general YAML parser. Canonical V1 base agents use only
    # two-space nested maps/scalars. Reject lists, tags, aliases, merges, blocks,
    # unknown indentation and duplicates rather than silently lose permission
    # rules or introduce a new parser/runtime dependency for this adapter.
    root, stack = {}, [(-2, {})]
    stack[0] = (-2, root)
    for line in header.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if '\t' in line or line.strip().startswith(('- ', '? ', ': ')):
            raise ValueError('Tabs are not canonical frontmatter')
        indent = len(line) - len(line.lstrip(' '))
        match = re.fullmatch(r'((?:"(?:[^"\\]|\\.)*"|\'(?:[^\']|\'\')*\'|[^:]+)):\s*(.*)', line.strip())
        if not match or indent % 2:
            raise ValueError('Unreviewed mapping syntax')
        while stack[-1][0] >= indent:
            stack.pop()
        if indent != stack[-1][0] + 2:
            raise ValueError('Unreviewed mapping indentation')
        key, value = scalar(match[1]), match[2]
        if not isinstance(key, str) or key == '<<' or key in stack[-1][1]:
            raise ValueError('Duplicate/unreviewed frontmatter key')
        current = stack[-1][1]
        current[key] = scalar(value) if value else {}
        if not value:
            stack.append((indent, current[key]))
    return root


def native(text, config, mock=False):
    if not text.startswith('---\n') or '\n---\n' not in text[4:]:
        raise ValueError('Agent frontmatter required')
    header, body = text[4:].split('\n---\n', 1)
    data = closed_frontmatter(header)
    if set(data) - {'description', 'mode', 'model', 'variant', 'tools', 'permission', 'steps', 'hidden'}:
        raise ValueError('Unreviewed agent field')
    agent = {key: data[key] for key in ('description', 'mode', 'steps', 'hidden') if key in data}
    model = data.get('model')
    if model:
        agent['model'] = 'workshop-mock/mock' if mock else model + ('#' + data['variant'] if data.get('variant') else '')
    rules = []
    aliases = {'bash': 'shell', 'task': 'subagent', 'apply_patch': 'edit'}
    # False visibility flags remain denies. True MCP visibility is not a native
    # permission grant: each addon must supply its exact reviewed catalog/roles.
    for action, enabled in data.get('tools', {}).items():
        if not isinstance(enabled, bool):
            raise ValueError('Boolean visibility required')
        if not enabled:
            rules.append({'action': aliases.get(action, action), 'resource': '*', 'effect': 'deny'})
    for action, value in data.get('permission', {}).items():
        for resource, effect in (value.items() if isinstance(value, dict) else [('*', value)]):
            if effect not in ('allow', 'ask', 'deny'):
                raise ValueError('Unreviewed permission effect')
            rules.append({'action': aliases.get(action, action), 'resource': str(resource).replace('~/.config/opencode', config), 'effect': effect})
    body = body.replace('~/.config/opencode', config)
    body = body.replace('- si usás `delegate` o `delegate_isolated`, hacelo solo cuando el paralelismo agregue valor real,', '- usá subagent nativo sólo si está permitido y agrega valor; no hay worktree/aislamiento de escrituras automático,')
    body = body.replace('- si las tools `delegate` y `delegation_*` estan disponibles, puedes ser un target async adecuado para revisiones read-only largas,', '- podés recibir trabajo por subagent nativo para revisiones read-only largas, sin delegar más,')
    body = body.replace('- si las tools `delegate` y `delegation_*` estan disponibles, puedes ser un target async adecuado para inspecciones read-only largas,', '- podés recibir trabajo por subagent nativo para inspección read-only, sin delegar más,')
    body = body.replace('- si las tools `delegate` y `delegation_*` estan disponibles, puedes ser un target async adecuado para trabajo de diseño read-only,', '- podés recibir trabajo por subagent nativo para diseño read-only, sin delegar más,')
    if '`delegate`' in body or '`delegate_isolated`' in body or 'delegation_' in body:
        raise ValueError('Untranslated Background dependency')
    agent['system'], agent['permissions'] = body, rules
    return agent


def render(options):
    config = options['config']
    if not Path(config).is_absolute():
        raise ValueError('Explicit config directory required')
    if 'agents' in options:
        if not isinstance(options['agents'], dict) or any(not re.fullmatch(r'[a-z][a-z0-9-]*', name) or not isinstance(text, str) for name, text in options['agents'].items()):
            raise ValueError('Explicit canonical agent texts required')
        return {name: native(text, config, options.get('mock', False)) for name, text in options['agents'].items()}
    agents = {}
    for file in sorted((ROOT / 'agents').glob('*.md')):
        if file.is_symlink() or not file.is_file():
            raise ValueError('Canonical agents must be regular files')
        agents[file.stem] = native(file.read_text(), config, options.get('mock', False))
    return agents


if __name__ == '__main__':
    try:
        print(json.dumps(render(json.load(sys.stdin))))
    except Exception:
        print('Native base agent render failed; values suppressed', file=sys.stderr)
        raise SystemExit(2)
