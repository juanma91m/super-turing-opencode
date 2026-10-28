#!/usr/bin/env python3
"""Fixed SSH inspection operations, not a remote shell or an OS sandbox.

Only explicit aliases in ~/.ssh/config; no credentials are read by this helper.
OpenSSH performs authentication. Never add raw commands, arbitrary formats,
paths, forwarding, sudo or mutation verbs to this interface.
"""
import argparse
import os
from pathlib import Path
import re
import selectors
import shlex
import shutil
import signal
import subprocess
import sys
import time

MAX_BYTES = 65536
MAX_SECONDS = 30
ALIAS = r'[A-Za-z0-9][A-Za-z0-9_.-]{0,252}'
CONTAINER = r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}'
UNIT = r'[A-Za-z0-9][A-Za-z0-9_.@-]{0,120}\.service'
PS_FORMAT = '{"Id":{{json .ID}},"Name":{{json .Names}},"Image":{{json .Image}},"CreatedAt":{{json .CreatedAt}},"Status":{{json .Status}}}'
INSPECT_FORMAT = '{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Config.Image}},"Created":{{json .Created}},"StartedAt":{{json .State.StartedAt}},"FinishedAt":{{json .State.FinishedAt}},"Status":{{json .State.Status}},"RestartCount":{{json .RestartCount}}}'
SERVICE_PROPERTIES = 'Id,LoadState,ActiveState,SubState,ActiveEnterTimestamp,InactiveEnterTimestamp,ExecMainStartTimestamp,ExecMainExitTimestamp,MainPID,ExecMainStatus'
SSH_OPTIONS = (
    'BatchMode=yes', 'StrictHostKeyChecking=yes', 'UpdateHostKeys=no',
    'ConnectTimeout=10', 'ConnectionAttempts=1', 'ServerAliveInterval=5',
    'ServerAliveCountMax=1', 'ClearAllForwardings=yes', 'ForwardAgent=no',
    'ForwardX11=no', 'PermitLocalCommand=no', 'RemoteCommand=none',
    'KnownHostsCommand=none', 'ControlMaster=no', 'ControlPath=none',
    'ControlPersist=no', 'RequestTTY=no', 'SessionType=default',
    'ForkAfterAuthentication=no', 'EscapeChar=none', 'LogLevel=ERROR',
)


def aliases(config):
    """Static inventory: never ssh -G, which can execute Match exec locally.

    Includes/executable config need a separately audited policy, not a fallback
    to executing a shell to discover hosts. Wildcards do not declare inventory.
    """
    with config.open(encoding='utf-8') as stream:
        text = stream.read(131073)
    if len(text) > 131072:
        raise ValueError('SSH config exceeds the inspection inventory limit')
    result = {}
    for line in text.splitlines():
        match = re.match(r'^\s*([A-Za-z][A-Za-z0-9]*)\s*(?:=\s*|\s+)(.*)$', line)
        if not match:
            continue
        key = match[1].lower()
        values = shlex.split(match[2], comments=True)
        if key == 'include':
            raise ValueError('SSH Include requires a separately audited inventory; no config expansion is executed')
        if key == 'match' and any(value.lower().lstrip('!') == 'exec' for value in values):
            raise ValueError('SSH Match exec is not permitted by the inspection helper')
        if key in ('proxycommand', 'knownhostscommand', 'localcommand', 'remotecommand') and values != ['none']:
            raise ValueError('Executable SSH config directives are not permitted by the inspection helper')
        if key == 'host':
            for value in values:
                if re.fullmatch(ALIAS, value):
                    result.setdefault(value.lower(), value)
    return result


def positive_tail(value):
    if not re.fullmatch(r'[0-9]+', value) or not 1 <= int(value) <= 500:
        raise argparse.ArgumentTypeError('tail must be 1..500')
    return int(value)


def duration(value):
    match = re.fullmatch(r'([1-9][0-9]{0,5})([smhd])', value)
    if not match or int(match[1]) * {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}[match[2]] > 604800:
        raise argparse.ArgumentTypeError('since must be a positive duration of at most 7d, e.g. 24h')
    return value


def parser():
    root = argparse.ArgumentParser(description='Read-only SSH inspection; no shell, exec, files, sudo or remote writes.', allow_abbrev=False)
    commands = root.add_subparsers(dest='operation', required=True)
    for name in ('help', 'hosts', 'containers', 'container', 'logs', 'services', 'service', 'service-logs'):
        command = commands.add_parser(name, allow_abbrev=False)
        if name in ('help', 'hosts'):
            continue
        command.add_argument('host')
        if name in ('container', 'logs', 'service', 'service-logs'):
            command.add_argument('target')
        if name in ('logs', 'service-logs'):
            command.add_argument('--tail', type=positive_tail, default=100)
            command.add_argument('--since', type=duration, default='24h')
    return root


def remote_argv(args):
    op = args.operation
    if op in ('container', 'logs') and not re.fullmatch(CONTAINER, args.target):
        raise ValueError('Invalid container identifier')
    if op in ('service', 'service-logs') and not re.fullmatch(UNIT, args.target):
        raise ValueError('Expected a literal .service unit, not a path or pattern')
    if op == 'containers':
        return ['docker', 'container', 'ls', '--all', '--no-trunc', '--format', PS_FORMAT]
    if op == 'container':
        return ['docker', 'container', 'inspect', '--format', INSPECT_FORMAT, '--', args.target]
    if op == 'logs':
        return ['docker', 'container', 'logs', '--timestamps', '--tail', str(args.tail), '--since', args.since, '--', args.target]
    if op == 'services':
        return ['systemctl', 'list-units', '--type=service', '--all', '--no-pager', '--plain', '--no-legend']
    if op == 'service':
        return ['systemctl', 'show', '--no-pager', '--property=' + SERVICE_PROPERTIES, '--', args.target]
    if op == 'service-logs':
        amount, unit = int(args.since[:-1]), args.since[-1]
        units = {'s': 'seconds', 'm': 'minutes', 'h': 'hours', 'd': 'days'}
        return ['journalctl', '--no-pager', '--output=short-iso-precise', '--lines=' + str(args.tail),
                '--since=' + f'{amount} {units[unit]} ago', '--unit=' + args.target]
    raise ValueError('Unsupported inspection operation')


def ssh_argv(args, config):
    if not re.fullmatch(ALIAS, args.host):
        raise ValueError('Expected an explicit SSH alias, not a user, address option or path')
    inventory = aliases(config)
    if args.host.lower() not in inventory:
        raise ValueError('Alias is not explicitly declared in ~/.ssh/config')
    remote = remote_argv(args)
    binary = shutil.which('ssh')
    if not binary:
        raise ValueError('OpenSSH is unavailable')
    command = [binary, '-F', str(config), '-n', '-T']
    for option in SSH_OPTIONS:
        command.extend(['-o', option])
    # One fixed remote argv, quoted exactly once; no user command/format/env.
    return command + ['--', inventory[args.host.lower()], shlex.join(remote)]


def redact(text):
    """Best effort, NOT a guarantee that arbitrary logs contain no secrets/PII."""
    output, private, key = [], False, False
    sensitive = re.compile(r'''(?i)(?:authorization|proxy-authorization|password|passwd|(?:access[_-]?|refresh[_-]?)?token|api[_-]?key|client[_-]?secret|secret[_-]?key)["']?\s*[:=]|\bBearer\s+\S+''')
    for line in text.splitlines():
        if '<private>' in line:
            private = True
        if re.search(r'-----BEGIN [A-Z ]*PRIVATE KEY-----', line):
            key = True
        hide = private or key or sensitive.search(line)
        if '</private>' in line:
            private = False
        if re.search(r'-----END [A-Z ]*PRIVATE KEY-----', line):
            key = False
        if hide:
            output.append('[REDACTED: potentially sensitive log content]')
        else:
            output.append(''.join(char if char >= ' ' or char == '\t' else f'\\x{ord(char):02x}' for char in line))
    return '\n'.join(output)


def bounded_output(command, timeout=MAX_SECONDS, limit=MAX_BYTES):
    env = dict(os.environ)
    for key in ('BASH_ENV', 'ENV', 'PYTHONPATH', 'PYTHONSTARTUP', 'SSH_ASKPASS', 'SSH_ASKPASS_REQUIRE'):
        env.pop(key, None)
    data = bytearray()
    reason = None
    deadline = time.monotonic() + timeout
    with subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, env=env, start_new_session=True) as process:
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        reason = 'timeout; inspection incomplete'
                        break
                    if not selector.select(remaining):
                        continue
                    chunk = os.read(process.stdout.fileno(), min(4096, limit + 1 - len(data)))
                    if not chunk:
                        break
                    data.extend(chunk)
                    if len(data) > limit:
                        del data[limit:]
                        reason = 'output truncated at byte limit; inspection incomplete'
                        break
            if not reason:
                try:
                    process.wait(timeout=max(0.001, deadline - time.monotonic()))
                except subprocess.TimeoutExpired:
                    reason = 'timeout; inspection incomplete'
        finally:
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()
        filtered = redact(data.decode('utf-8', errors='replace')).encode('utf-8')
        if len(filtered) > limit:
            filtered = filtered[:limit]
            reason = reason or 'output truncated at byte limit; inspection incomplete'
        return filtered.decode('utf-8', errors='ignore'), 3 if reason else process.returncode, reason


def main(argv):
    cli = parser()
    args = cli.parse_args(argv)
    if args.operation == 'help':
        cli.print_help()
        print('logs/service-logs: --tail 1..500 (default 100), --since duration <=7d (default 24h). Output <=64 KiB/30s.')
        return 0
    try:
        config = Path.home() / '.ssh/config'
        if args.operation == 'hosts':
            print('\n'.join(sorted(aliases(config).values())))
            return 0
        output, code, reason = bounded_output(ssh_argv(args, config))
        if output:
            print(output)
        if reason:
            print('SSH inspection: ' + reason, file=sys.stderr)
        return code
    except (ValueError, OSError) as error:
        print('SSH inspection blocked: ' + str(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
