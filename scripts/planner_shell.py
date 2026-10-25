#!/usr/bin/env python3
"""Small planner shell boundary. Trusted helper contracts remain addon-owned.

This is a command allowlist, not an OS sandbox for compromised trusted programs.
No arbitrary interpreters, shell composition, formatters, builds or app writes.
"""
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[1]
BROKER = Path(__file__).resolve()
SAFE_GIT = {
    'status': {'--short', '-s', '--branch', '-b', '--porcelain', '--porcelain=v1', '--porcelain=v2', '--untracked-files=no', '--untracked-files=normal', '--untracked-files=all'},
    'diff': {'--stat', '--numstat', '--shortstat', '--name-only', '--name-status', '--check', '--cached', '--staged', '--no-color', '--color=never', '--no-renames', '--summary', '--exit-code', '--quiet', '--binary', '--patch', '-p', '--'},
    'log': {'--oneline', '--stat', '--numstat', '--name-only', '--name-status', '--no-color', '--color=never', '--no-patch', '--patch', '-p', '--all', '--decorate', '--graph', '--first-parent', '--max-count', '-n', '--'},
    'show': {'--stat', '--numstat', '--name-only', '--name-status', '--no-color', '--color=never', '--no-patch', '--patch', '-p', '--format=fuller', '--'},
    'rev-parse': {'--show-toplevel', '--show-prefix', '--git-dir', '--is-inside-work-tree', '--abbrev-ref', '--symbolic-full-name', '--verify', '--short'},
    'merge-base': {'--all', '-a', '--is-ancestor', '--fork-point', '--independent'},
    'ls-files': {'--stage', '-s', '--cached', '--others', '--exclude-standard', '--modified', '--deleted', '--error-unmatch', '--'},
    'branch': {'--show-current', '--list', '--all', '-a', '--remotes', '-r', '--no-color'},
}
SENSITIVE = re.compile(r'(^|[/\\:])(?:\.env(?:[./\\]|$)|\.ssh(?:[/\\]|$)|\.gnupg(?:[/\\]|$)|\.aws[/\\](?:credentials|config)|\.config[/\\]gh[/\\]hosts\.yml|private\.pem$|credentials(?:\.json)?$|id_(?:rsa|ed25519)$|etc[/\\](?:shadow|sudoers))|stitch-api-key', re.I)


def literal_argv(command):
    """Reject shell syntax, but permit literal Markdown within single quotes."""
    quote, escaped = None, False
    for char in command:
        if quote == "'":
            if char == "'":
                quote = None
            continue
        if escaped:
            if char in '\r\n':
                raise ValueError('Shell line continuations are not allowed')
            escaped = False
            continue
        if char == '\\':
            escaped = True
        elif quote == '"':
            if char == '"':
                quote = None
            elif char in '$`':
                raise ValueError('Shell expansion is not allowed; use literal quoted content')
        elif char in "'\"":
            quote = char
        elif char in ';|&<>()$`\r\n*?[]{}#':
            raise ValueError('Shell composition, redirection and expansion are not allowed')
    if quote or escaped:
        raise ValueError('Incomplete shell quoting')
    return shlex.split(command, posix=True)


def clean_env():
    env = dict(os.environ)
    for key in ('BASH_ENV', 'ENV', 'PYTHONPATH', 'PYTHONSTARTUP', 'GIT_EXTERNAL_DIFF',
                'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT'):
        env.pop(key, None)
    env.update(GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0', GIT_PAGER='cat')
    return env


def git_command(args):
    if not args or args[0] not in SAFE_GIT:
        raise ValueError('Only declared read-only Git operations are allowed')
    operation, values = args[0], args[1:]
    if operation == 'branch' and (not values or not any(v in ('--show-current', '--list', '--all', '-a', '--remotes', '-r') for v in values)):
        raise ValueError('Branch creation or modification is not allowed')
    for value in values:
        if SENSITIVE.search(value):
            raise ValueError('Sensitive paths are not planner shell inputs')
        if value.startswith('-') and value not in SAFE_GIT[operation]:
            if operation in ('diff', 'log', 'show') and re.fullmatch(r'(?:-U\d+|-n\d+|--unified=\d+|--max-count=\d+|--format=[^\r\n]+|--pretty=[^\r\n]+|--diff-filter=[A-Za-z*]+)', value):
                continue
            raise ValueError('Git option is not in the read-only allowlist')
        if operation == 'branch' and not value.startswith('-') and '--list' not in values:
            raise ValueError('Branch names require --list')
    binary = shutil.which('git')
    if not binary:
        raise ValueError('Git is unavailable')
    fixed = [binary, '--no-optional-locks', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', operation]
    if operation in ('diff', 'log', 'show'):
        fixed += ['--no-ext-diff', '--no-textconv']
    return fixed + values


def project_root(cwd):
    result = subprocess.run(git_command(['rev-parse', '--show-toplevel']), cwd=cwd,
                            env=clean_env(), capture_output=True, text=True, timeout=10)
    return Path(result.stdout.strip()).resolve() if result.returncode == 0 else Path(cwd).resolve()


def declarations(config):
    helpers = {}
    for file in sorted((config / 'planner-helpers').glob('*.json')):
        for name, entry in json.loads(file.read_text()).items():
            if name in helpers:
                raise ValueError('Duplicate helper declaration')
            helpers[name] = entry
    return helpers


def check_value(value, rule, cwd):
    if isinstance(rule, dict):
        if not re.fullmatch(rule['pattern'], value):
            raise ValueError('Helper identifier does not match its declared format')
    elif rule == 'int' and not re.fullmatch(r'\d+', value):
        raise ValueError('Expected a nonnegative integer')
    elif rule == 'float':
        try:
            float(value)
        except ValueError:
            raise ValueError('Expected a numeric score') from None
    elif rule in ('relative', 'tmp-path'):
        p = Path(value)
        if p.is_absolute() or '..' in p.parts or SENSITIVE.search(value):
            raise ValueError('Helper output must be a safe metadata path')
        if rule == 'tmp-path' and not (cwd / p).resolve().is_relative_to(cwd / 'tmp'):
            raise ValueError('Helper output must stay under project tmp')


def helper_command(args, cwd, config):
    available = declarations(config)
    if not args or args[0] not in available:
        raise ValueError('Helper is not registered by an installed addon')
    entry, rest = available[args[0]], args[1:]
    if 'verbs' in entry:
        if not rest or rest[0] not in entry['verbs']:
            raise ValueError('Helper operation is not approved for planner')
        schema, rest = entry['verbs'][rest[0]], rest[1:]
    else:
        schema = entry
    options, positional, seen, index = schema.get('options', {}), [], set(), 0
    while index < len(rest):
        value = rest[index]
        if value.startswith('-'):
            key, sep, inline = value.partition('=')
            if key not in options:
                raise ValueError('Helper option is not approved')
            rule = options[key]
            if rule == 'flag':
                if sep:
                    raise ValueError('Flag does not accept a value')
            else:
                if not sep:
                    index += 1
                    if index == len(rest):
                        raise ValueError('Missing helper option value')
                    inline = rest[index]
                check_value(inline, rule, cwd)
            seen.add(key)
        else:
            positional.append(value)
        index += 1
    required = schema.get('positionals', [])
    if len(positional) != len(required):
        raise ValueError('Unexpected helper positional arguments')
    for value, rule in zip(positional, required):
        check_value(value, rule, cwd)
    if not set(schema.get('required', [])).issubset(seen):
        raise ValueError('Required helper option missing')
    if entry.get('metadata_scope') == 'tmp' and (cwd / 'tmp').resolve() != cwd / 'tmp':
        raise ValueError('Project tmp must not redirect to application files')
    path = (config / entry['path']).resolve()
    if not path.is_relative_to((config / 'scripts').resolve()) or not path.is_file():
        raise ValueError('Registered helper must be an installed trusted script')
    interpreter = entry.get('interpreter', 'bash')
    if interpreter not in ('bash', 'python3'):
        raise ValueError('Unsupported trusted helper interpreter')
    env = clean_env()
    for key, relative in entry.get('project_env_files', {}).items():
        candidate = cwd / relative
        if key not in env and candidate.is_file() and candidate.resolve().is_relative_to(cwd):
            env[key] = str(candidate)
    return [shutil.which(interpreter) or interpreter, str(path), *args[1:]], env


def prepare(args, cwd, config=CONFIG):
    if args and args[0] == 'git':
        return git_command(args[1:]), Path(cwd).resolve(), clean_env()
    if args and args[0] == 'helper':
        root = project_root(cwd)
        command, env = helper_command(args[1:], root, config)
        return command, root, env
    if args == ['--help']:
        return None, Path(cwd), clean_env()
    raise ValueError('Use planner_shell.py git <read-only operation> or helper <registered id>')


def check_invocation(command, cwd, project=None, config=CONFIG, broker=BROKER):
    tokens = literal_argv(command)
    if len(tokens) < 3 or tokens[0] != 'python3' or Path(tokens[1]).expanduser().resolve() != broker:
        raise ValueError('Planner Bash only accepts python3 ~/.config/opencode/scripts/planner_shell.py ...')
    where = Path(cwd).resolve()
    if project and not where.is_relative_to(Path(project).resolve()):
        raise ValueError('Planner shell cannot switch to a different repository')
    prepare(tokens[2:], where, config)


def main(args):
    try:
        if args in (['--check'], ['--claude-hook']):
            payload = json.load(sys.stdin)
            tool = payload.get('tool_input', payload)
            if tool.get('dangerouslyDisableSandbox'):
                raise ValueError('Planner cannot disable the runtime sandbox')
            cwd = payload.get('cwd', os.getcwd())
            check_invocation(tool['command'], cwd, payload.get('project_root'))
            return 0  # Never auto-approve or override other permission/secret guards.
        command, cwd, env = prepare(args, Path.cwd())
        if command is None:
            print('Planner shell: git <read-only operation> | helper <addon id> <args>. Other reads: Read/Grep/Glob.')
            print('Registered helpers: ' + ', '.join(sorted(declarations(CONFIG))))
            return 0
        return subprocess.run(command, cwd=cwd, env=env).returncode
    except (ValueError, KeyError, TypeError, IndexError, OSError) as error:
        print(f'Planner shell blocked: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
