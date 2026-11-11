#!/usr/bin/env python3
"""Bounded local metadata diagnostics, never a shell or file-content reader.

Linux/GNU tools only. Read-only does not mean zero I/O, immutable access times,
or an OS sandbox. Only inspect targets relevant to the user's request.
"""
import argparse
import fnmatch
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import time

MAX_BYTES = 262144
DENIED_NAMES = ('.env*', '.ssh', '.gnupg', '.aws', '.azure', '.kube', '.pki',
                '.password-store', '.pgpass', '.netrc', 'keyrings', 'private',
                'credentials*', 'id_rsa*', 'id_ed25519*', '*.pem',
                'stitch-api-key', 'shadow', 'sudoers')
DENIED_PATHS = ('*/.config/gh/*', '*/.docker/config.json')
VIRTUAL = ('/proc', '/sys', '/dev', '/run')


def bounded_int(low, high):
    def parse(value):
        if not value.isascii() or not value.isdecimal() or not low <= int(value) <= high:
            raise argparse.ArgumentTypeError(f'Expected integer {low}..{high}')
        return int(value)
    return parse


def parser():
    cli = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    verbs = cli.add_subparsers(dest='operation', required=True)
    for operation in ('help', 'df', 'du', 'stat', 'free', 'uptime', 'uname', 'lsblk',
                      'processes', 'listeners', 'connections', 'addresses', 'routes'):
        sub = verbs.add_parser(operation, allow_abbrev=False)
        if operation in ('df', 'du', 'stat'):
            sub.add_argument('--path', required=True)
        if operation == 'df':
            sub.add_argument('--inodes', action='store_true')
        if operation == 'du':
            sub.add_argument('--depth', type=bounded_int(0, 3), default=1)
            sub.add_argument('--limit', type=bounded_int(1, 200), default=30)
            sub.add_argument('--timeout', type=bounded_int(1, 120), default=30)
    return cli


def safe_path(value):
    lexical = Path(os.path.abspath(Path(value).expanduser()))
    resolved = lexical.resolve()
    for candidate in (lexical, resolved):
        text = str(candidate)
        if any(text == root or text.startswith(root + '/') for root in VIRTUAL):
            raise ValueError('Virtual/device/runtime paths are not inspection targets')
        if (any(fnmatch.fnmatchcase(part.lower(), pattern) for part in candidate.parts for pattern in DENIED_NAMES)
                or any(fnmatch.fnmatchcase(text.lower(), pattern) for pattern in DENIED_PATHS)):
            raise ValueError('Sensitive paths are not inspection targets')
    if not resolved.exists():
        raise ValueError('Inspection target does not exist')
    return str(resolved)


def command(args):
    operation = args.operation
    # Never resolve executables from a project-controlled PATH.
    tool = {'processes': 'ps', 'listeners': 'ss', 'connections': 'ss', 'addresses': 'ip', 'routes': 'ip'}.get(operation, operation)
    binary = next((str(Path(root) / tool) for root in ('/usr/bin', '/bin', '/usr/sbin', '/sbin')
                   if (Path(root) / tool).is_file() and os.access(Path(root) / tool, os.X_OK)), None)
    if not binary:
        raise ValueError(f'{operation} is unavailable in system binary directories')
    if operation == 'df':
        return [binary, '-h', *(['--inodes'] if args.inodes else []), '--', safe_path(args.path)]
    if operation == 'du':
        path = safe_path(args.path)
        if not Path(path).is_dir():
            raise ValueError('du requires a directory; use stat for individual files')
        return [binary, '--one-file-system', '--no-dereference', '--null', '--block-size=1',
                '--max-depth=' + str(args.depth),
                *('--exclude=' + pattern for pattern in (*DENIED_NAMES, *DENIED_PATHS)), '--', path]
    if operation == 'stat':
        return [binary, '--printf=name=%n\ntype=%F\nlogical_bytes=%s\nblocks=%b\nblock_bytes=%B\nmodified=%y\n',
                '--', safe_path(args.path)]
    fixed = {'free': ['--human'], 'uptime': [], 'uname': ['--kernel-name', '--kernel-release', '--machine'],
             'lsblk': ['--json', '--bytes', '--output', 'NAME,TYPE,SIZE,FSTYPE,MOUNTPOINTS,RO'],
             'processes': ['-eo', 'pid,ppid,euid,egid,stat,comm'],
             'listeners': ['-lntu'], 'connections': ['-ntu'],
             'addresses': ['-json', 'address', 'show'], 'routes': ['-json', 'route', 'show']}
    if operation not in fixed:
        raise ValueError('Unknown diagnostic operation')
    return [binary, *fixed[operation]]


def execute(argv, timeout, limit=MAX_BYTES):
    """Bound time and combined stdout/stderr; kill/reap the whole child group."""
    streams, reason = {'stdout': bytearray(), 'stderr': bytearray()}, None
    reaped = False
    deadline = time.monotonic() + timeout
    env = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'LANG': 'C'}
    with subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, env=env, start_new_session=True) as process:
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ, 'stdout')
                selector.register(process.stderr, selectors.EVENT_READ, 'stderr')
                while selector.get_map():
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        reason = 'timeout; evidence incomplete'
                        break
                    for key, _ in selector.select(remaining):
                        size = sum(map(len, streams.values()))
                        chunk = os.read(key.fileobj.fileno(), min(4096, limit + 1 - size))
                        if not chunk:
                            selector.unregister(key.fileobj)
                            continue
                        streams[key.data].extend(chunk[:limit - size])
                        if size + len(chunk) > limit:
                            reason = 'output limit; evidence incomplete'
                            break
                    if reason:
                        break
            if not reason:
                try:
                    process.wait(timeout=max(.001, deadline - time.monotonic()))
                    reaped = True
                except subprocess.TimeoutExpired:
                    reason = 'timeout; evidence incomplete'
        finally:
            # Before reaping: PID cannot be reused for an unrelated process group.
            # Also terminates descendants holding pipes open after parent exit.
            if not reaped:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            process.wait()
    return bytes(streams['stdout']), bytes(streams['stderr']), 3 if reason else process.returncode, reason


def du_report(data, limit):
    rows = []
    for record in data.split(b'\0'):
        if not record:
            continue
        size, path = record.split(b'\t', 1)
        rows.append({'bytes': int(size), 'path': os.fsdecode(path)})
    rows.sort(key=lambda row: (-row['bytes'], row['path']))
    return {'entries': rows[:limit], 'measured_entries': len(rows), 'listing_truncated': len(rows) > limit,
            'scope': 'allocated bytes, one filesystem, no recursive symlink following',
            'excluded_patterns': [*DENIED_NAMES, *DENIED_PATHS]}


def safe_text(data):
    return ''.join(char if char.isprintable() or char in '\n\t' else f'\\u{ord(char):04x}'
                   for char in data.decode('utf-8', errors='replace'))


def main(argv):
    cli = parser()
    args = cli.parse_args(argv)
    if args.operation == 'help':
        cli.print_help()
        print('df/stat: --path PATH; df: optional --inodes. du: --path DIR [--depth 0..3] [--limit 1..200] [--timeout 1..120].')
        print('du defaults: depth=1, limit=30, timeout=30s; other operations: 10s. Captured output <=256 KiB.')
        print('du excludes sensitive names: totals are not a complete disk inventory. No contents, writes, sudo or shell.')
        print('processes excludes command arguments/env; listeners/connections/addresses/routes only query network state.')
        return 0
    try:
        stdout, stderr, code, reason = execute(command(args), getattr(args, 'timeout', 10))
        if args.operation == 'du':
            # Truncated byte streams may end in the middle of a NUL record.
            if reason:
                stdout = stdout[:stdout.rfind(b'\0') + 1]
            report = du_report(stdout, args.limit)
            report.update(measurement_complete=code == 0, error=reason or ('command failed; evidence incomplete' if code else None))
            output = json.dumps(report, ensure_ascii=True, indent=2) + '\n'
        else:
            output = safe_text(stdout)
        if len(output.encode()) > MAX_BYTES:
            print('Formatted output limit; evidence incomplete', file=sys.stderr)
            return 3
        sys.stdout.write(output)
        if stderr:
            sys.stderr.write(safe_text(stderr))
        if reason or code:
            print(reason or 'Command failed; evidence incomplete', file=sys.stderr)
        return code
    except (ValueError, OSError) as error:
        print('Local inspection blocked: ' + safe_text(str(error).encode()), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
