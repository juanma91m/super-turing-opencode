#!/usr/bin/env python3
"""Fixed SSH inspection operations, not a remote shell or an OS sandbox.

Only explicit aliases in ~/.ssh/config; no credentials are read by this helper.
OpenSSH performs authentication. Never add raw commands, arbitrary formats,
paths, forwarding, sudo or mutation verbs to this interface.
"""
import argparse
import json
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
IMAGE = r'[A-Za-z0-9][A-Za-z0-9._/:@-]{0,255}'
UNIT = r'[A-Za-z0-9][A-Za-z0-9_.@-]{0,120}\.service'
PS_FORMAT = '{"Id":{{json .ID}},"Name":{{json .Names}},"Image":{{json .Image}},"CreatedAt":{{json .CreatedAt}},"Status":{{json .Status}}}'
CONTAINER_FIELDS = {
    'Id': '.Id', 'Name': '.Name', 'Image': '.Config.Image', 'ImageID': '.Image',
    'Created': '.Created', 'StartedAt': '.State.StartedAt', 'FinishedAt': '.State.FinishedAt',
    'Status': '.State.Status', 'Running': '.State.Running', 'Paused': '.State.Paused',
    'Restarting': '.State.Restarting', 'OOMKilled': '.State.OOMKilled',
    'Pid': '.State.Pid', 'ExitCode': '.State.ExitCode', 'RestartCount': '.RestartCount',
    'HealthStatus': '{{with index .State "Health"}}{{json (index . "Status")}}{{else}}null{{end}}',
    'Hostname': '.Config.Hostname', 'Networks': '.NetworkSettings.Networks',
    'Ports': '.NetworkSettings.Ports', 'NetworkMode': '.HostConfig.NetworkMode',
    'Dns': '.HostConfig.Dns', 'DnsSearch': '.HostConfig.DnsSearch',
    'ExtraHosts': '.HostConfig.ExtraHosts', 'Mounts': '.Mounts',
    'Memory': '.HostConfig.Memory', 'MemorySwap': '.HostConfig.MemorySwap',
    'NanoCpus': '.HostConfig.NanoCpus', 'CpuQuota': '.HostConfig.CpuQuota',
    'CpuPeriod': '.HostConfig.CpuPeriod', 'CpusetCpus': '.HostConfig.CpusetCpus',
    'PidsLimit': '.HostConfig.PidsLimit', 'ReadonlyRootfs': '.HostConfig.ReadonlyRootfs',
    'Privileged': '.HostConfig.Privileged', 'RestartPolicy': '.HostConfig.RestartPolicy',
}
ENDPOINT_FIELDS = ('NetworkID', 'EndpointID', 'Aliases', 'DNSNames', 'IPAddress',
                   'IPPrefixLen', 'Gateway', 'GlobalIPv6Address', 'GlobalIPv6PrefixLen',
                   'IPv6Gateway', 'MacAddress')
MOUNT_FIELDS = ('Type', 'Name', 'Source', 'Destination', 'Driver', 'RW', 'Propagation')
NETWORK_FIELDS = {'Id': '.Id', 'Name': '.Name', 'Created': '.Created', 'Driver': '.Driver',
                  'Scope': '.Scope', 'Internal': '.Internal', 'Attachable': '.Attachable',
                  'Ingress': '.Ingress', 'EnableIPv6': '.EnableIPv6',
                  'IPAM': '.IPAM.Config', 'Containers': '.Containers'}
IMAGE_FIELDS = {'Id': '.Id', 'RepoTags': '.RepoTags', 'RepoDigests': '.RepoDigests',
                'Created': '.Created', 'Size': '.Size', 'Os': '.Os',
                'Architecture': '.Architecture', 'RootFS': '.RootFS'}
VOLUME_FIELDS = {'Name': '.Name', 'Driver': '.Driver', 'Mountpoint': '.Mountpoint',
                 'CreatedAt': '.CreatedAt', 'Scope': '.Scope'}


def docker_format(fields):
    # Docker's inspect formatter uses strict missing-key maps. index handles
    # optional leaf fields (e.g. Health/PidsLimit) across Engine versions.
    def expression(path):
        if path.startswith('{{'): return path
        keys = ' '.join(json.dumps(key) for key in path.lstrip('.').split('.'))
        return '{{json (index . ' + keys + ')}}'
    return '{' + ','.join(json.dumps(key) + ':' + expression(path) for key, path in fields.items()) + '}'


INSPECT_FORMAT = docker_format(CONTAINER_FIELDS)
METADATA_FIELDS = {'container': CONTAINER_FIELDS, 'network': NETWORK_FIELDS,
                   'image': IMAGE_FIELDS, 'volume': VOLUME_FIELDS}
METADATA_FORMATS = {name: docker_format(fields) for name, fields in METADATA_FIELDS.items()}
NETWORK_LIST_FORMAT = '{"Id":{{json .ID}},"Name":{{json .Name}},"Driver":{{json .Driver}},"Scope":{{json .Scope}}}'
IMAGE_LIST_FORMAT = '{"Id":{{json .ID}},"Repository":{{json .Repository}},"Tag":{{json .Tag}},"Size":{{json .Size}}}'
VOLUME_LIST_FORMAT = '{"Name":{{json .Name}},"Driver":{{json .Driver}}}'
STATS_FORMAT = '{"Name":{{json .Name}},"Id":{{json .ID}},"CPU":{{json .CPUPerc}},"Memory":{{json .MemUsage}},"MemoryPercent":{{json .MemPerc}},"NetworkIO":{{json .NetIO}},"BlockIO":{{json .BlockIO}},"Pids":{{json .PIDs}}}'
HOST_READS = {
    'system-info': ['uname', '-srmo'], 'disk': ['df', '-h'],
    'memory': ['free', '-h'], 'uptime': ['uptime'],
    'host-processes': ['ps', '-eo', 'pid,ppid,euid,egid,stat,comm'],
    'listeners': ['ss', '-lntu'], 'connections': ['ss', '-ntu'],
    'addresses': ['ip', '-json', 'address', 'show'], 'routes': ['ip', '-json', 'route', 'show'],
}
TARGET_OPERATIONS = {'container', 'logs', 'network', 'image', 'volume', 'stats', 'processes', 'service', 'service-logs'}
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
    for name in ('help', 'hosts', 'containers', 'container', 'logs', 'networks', 'network',
                 'images', 'image', 'volumes', 'volume', 'stats', 'processes',
                 'services', 'service', 'service-logs', *HOST_READS):
        command = commands.add_parser(name, allow_abbrev=False)
        if name in ('help', 'hosts'):
            continue
        command.add_argument('host')
        if name in TARGET_OPERATIONS:
            command.add_argument('target')
        if name in ('logs', 'service-logs'):
            command.add_argument('--tail', type=positive_tail, default=100)
            command.add_argument('--since', type=duration, default='24h')
    return root


def remote_argv(args):
    op = args.operation
    if op in ('container', 'logs', 'network', 'volume', 'stats', 'processes') and not re.fullmatch(CONTAINER, args.target):
        raise ValueError('Invalid resource identifier')
    if op == 'image' and not re.fullmatch(IMAGE, args.target):
        raise ValueError('Invalid image identifier')
    if op in ('service', 'service-logs') and not re.fullmatch(UNIT, args.target):
        raise ValueError('Expected a literal .service unit, not a path or pattern')
    if op == 'containers':
        return ['docker', 'container', 'ls', '--all', '--no-trunc', '--format', PS_FORMAT]
    if op in METADATA_FORMATS:
        return ['docker', op, 'inspect', '--format', METADATA_FORMATS[op], '--', args.target]
    if op == 'networks':
        return ['docker', 'network', 'ls', '--no-trunc', '--format', NETWORK_LIST_FORMAT]
    if op == 'images':
        return ['docker', 'image', 'ls', '--no-trunc', '--format', IMAGE_LIST_FORMAT]
    if op == 'volumes':
        return ['docker', 'volume', 'ls', '--format', VOLUME_LIST_FORMAT]
    if op == 'stats':
        return ['docker', 'container', 'stats', '--no-stream', '--no-trunc', '--format', STATS_FORMAT, '--', args.target]
    if op == 'processes':
        return ['docker', 'container', 'top', args.target, '-eo', 'pid,ppid,user,stat,comm']
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
    if op in HOST_READS:
        return list(HOST_READS[op])
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


def project_metadata(operation, text):
    """Keep structured output valid, compatible with optional Engine fields and
    free of env/labels/commands/driver options/health-log payloads. No raw inspect.
    """
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError('Expected a single metadata object')
    result = {key: data[key] for key in METADATA_FIELDS[operation] if key in data}
    if operation == 'container':
        networks = result.get('Networks')
        if networks is None: networks = {}
        if not isinstance(networks, dict): raise ValueError('Invalid network metadata')
        result['Networks'] = {}
        for name, endpoint in networks.items():
            if not isinstance(endpoint, dict): raise ValueError('Invalid endpoint metadata')
            result['Networks'][name] = {key: endpoint[key] for key in ENDPOINT_FIELDS if key in endpoint}
        mounts = result.get('Mounts')
        if mounts is None: mounts = []
        if not isinstance(mounts, list) or not all(isinstance(mount, dict) for mount in mounts):
            raise ValueError('Invalid mount metadata')
        result['Mounts'] = [{key: mount[key] for key in MOUNT_FIELDS if key in mount} for mount in mounts]
    if operation == 'network':
        containers = result.get('Containers')
        if containers is None: containers = {}
        if not isinstance(containers, dict): raise ValueError('Invalid network membership')
        fields = ('Name', 'EndpointID', 'MacAddress', 'IPv4Address', 'IPv6Address')
        result['Containers'] = {}
        for name, endpoint in containers.items():
            if not isinstance(endpoint, dict): raise ValueError('Invalid network endpoint')
            result['Containers'][name] = {key: endpoint[key] for key in fields if key in endpoint}

    def filtered(value):
        if isinstance(value, str): return redact(value)
        if isinstance(value, list): return [filtered(item) for item in value]
        if isinstance(value, dict): return {redact(key): filtered(item) for key, item in value.items()}
        return value
    return json.dumps(filtered(result), ensure_ascii=True, indent=2)


def bounded_output(command, timeout=MAX_SECONDS, limit=MAX_BYTES, projection=None):
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
        text = data.decode('utf-8', errors='replace')
        if projection and process.returncode != 0 and not reason:
            # Docker templates can emit a partial object before failing. Never
            # leak those unprojected fields while attempting to show diagnostics.
            filtered = f'Structured inspection failed (exit {process.returncode}); raw output suppressed, evidence incomplete'.encode()
        elif projection:
            try:
                filtered = projection(text).encode('utf-8')
            except (ValueError, TypeError):
                filtered = b'Structured metadata unavailable; inspection incomplete'
                reason = reason or 'invalid or incomplete metadata; raw output suppressed'
        else:
            filtered = redact(text).encode('utf-8')
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
        print('container includes networks/aliases/DNS, ports, mount metadata, health/state and resource limits; no env/credentials.')
        print('networks/network, images/image, volumes/volume, stats/processes and host diagnostics are reads, never exec or changes.')
        return 0
    try:
        config = Path.home() / '.ssh/config'
        if args.operation == 'hosts':
            print('\n'.join(sorted(aliases(config).values())))
            return 0
        projection = (lambda text: project_metadata(args.operation, text)) if args.operation in METADATA_FORMATS else None
        output, code, reason = bounded_output(ssh_argv(args, config), projection=projection)
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
