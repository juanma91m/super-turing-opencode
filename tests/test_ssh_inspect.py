"""Synthetic config/process fixtures only: never connect to SSH or read real keys."""
import argparse
from contextlib import redirect_stdout, redirect_stderr
import importlib.util
import io
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


inspect = load('ssh_inspect', 'scripts/ssh_inspect.py')
broker = load('planner_shell', 'scripts/planner_shell.py')


class SSHInspectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        (self.home / '.ssh').mkdir()
        self.config = self.home / '.ssh/config'
        self.config.write_text('Host fixture-one fixture-two\n HostName server.invalid\n User fixture\n IdentityFile ~/.ssh/never-read\nHost * !excluded\n ServerAliveInterval 10\n')

    def command(self, *argv):
        args = inspect.parser().parse_args(argv)
        with patch.object(inspect.shutil, 'which', return_value='/usr/bin/ssh'):
            return inspect.ssh_argv(args, self.config)

    def test_only_literal_declared_aliases_not_transport_values(self):
        self.assertEqual(inspect.aliases(self.config), {'fixture-one': 'fixture-one', 'fixture-two': 'fixture-two'})
        self.assertFalse((self.home / '.ssh/never-read').exists())
        self.assertIn('fixture-one', self.command('containers', 'FIXTURE-ONE'))
        for host in ('unknown', 'server.invalid', '192.0.2.1', 'user@fixture-one', '-oProxyCommand=bad',
                     'fixture-one;id', 'fixture-one\nid', '../config', '*.example'):
            with self.subTest(host=host), redirect_stderr(io.StringIO()), self.assertRaises((ValueError, SystemExit)):
                self.command('containers', host)

    def test_inventory_never_invokes_ssh_or_opens_keys(self):
        with patch.object(inspect.subprocess, 'Popen', side_effect=AssertionError('No subprocess discovery')):
            self.assertEqual(len(inspect.aliases(self.config)), 2)

    def test_config_assignment_comments_and_quoted_aliases(self):
        self.config.write_text('host="literal" two # comment\nHOST other\nHostName irrelevant\n')
        self.assertEqual(set(inspect.aliases(self.config)), {'literal', 'two', 'other'})

    def test_config_executables_and_includes_fail_before_any_process(self):
        for directive in ('Match exec "touch /tmp/nope"', 'Match !exec "id"', 'Include config.d/*.conf',
                          'ProxyCommand ssh other touch bad', 'RemoteCommand touch bad',
                          'LocalCommand touch bad', 'KnownHostsCommand bad'):
            self.config.write_text('Host fixture-one\n' + directive + '\n')
            with self.subTest(directive=directive), patch.object(inspect.subprocess, 'Popen') as process:
                with self.assertRaises(ValueError):
                    self.command('containers', 'fixture-one')
                process.assert_not_called()

    def test_config_limit_missing_and_empty_inventory_fail_closed(self):
        self.config.write_text('x' * 131073)
        with self.assertRaises(ValueError): inspect.aliases(self.config)
        self.config.unlink()
        with self.assertRaises(OSError): self.command('containers', 'fixture-one')
        self.config.write_text('Host *\n')
        with self.assertRaises(ValueError): self.command('containers', 'fixture-one')

    def test_ssh_transport_is_noninteractive_and_does_not_relax_known_hosts(self):
        command = self.command('containers', 'fixture-one')
        self.assertEqual(command[:5], ['/usr/bin/ssh', '-F', str(self.config), '-n', '-T'])
        for option in ('BatchMode=yes', 'StrictHostKeyChecking=yes', 'UpdateHostKeys=no',
                       'ClearAllForwardings=yes', 'ForwardAgent=no', 'ForwardX11=no',
                       'PermitLocalCommand=no', 'RemoteCommand=none', 'KnownHostsCommand=none',
                       'ControlMaster=no', 'ControlPath=none', 'ControlPersist=no', 'RequestTTY=no'):
            self.assertIn(option, command)
        self.assertEqual(command[-3:-1], ['--', 'fixture-one'])

    def test_exact_remote_allowlist_and_quoting(self):
        cases = [(['containers', 'fixture-one'], ['docker', 'container', 'ls']),
                 (['container', 'fixture-one', 'app-1'], ['docker', 'container', 'inspect']),
                 (['logs', 'fixture-one', 'app-1'], ['docker', 'container', 'logs']),
                 (['services', 'fixture-one'], ['systemctl', 'list-units']),
                 (['service', 'fixture-one', 'app.service'], ['systemctl', 'show']),
                 (['service-logs', 'fixture-one', 'app.service'], ['journalctl'])]
        for args, prefix in cases:
            with self.subTest(args=args):
                remote = shlex.split(self.command(*args)[-1])
                self.assertEqual(remote[:len(prefix)], prefix)
                self.assertFalse({'sh', 'bash', 'sudo', 'exec', 'restart', 'start', 'stop'} & set(remote))
                if '--format' in remote:
                    self.assertNotIn('.Config.Env', remote[remote.index('--format') + 1])
        self.assertNotIn('ExecStart', inspect.SERVICE_PROPERTIES)
        self.assertNotIn('Environment', inspect.SERVICE_PROPERTIES)
        self.assertIn('Created', inspect.INSPECT_FORMAT)
        self.assertIn('StartedAt', inspect.INSPECT_FORMAT)

    def test_installed_openssh_accepts_options_with_synthetic_config_no_connection(self):
        binary = shutil.which('ssh')
        if not binary:
            self.skipTest('OpenSSH unavailable; no installation attempted')
        command = self.command('containers', 'fixture-one')
        # -G against ONLY our synthetic config; never real config or Match exec.
        done = subprocess.run([binary, '-G', *command[1:]], capture_output=True, text=True, timeout=5)
        self.assertEqual(done.returncode, 0, 'Fixed OpenSSH options rejected; output suppressed')
        self.assertIn('batchmode yes', done.stdout)

    def test_targets_cannot_be_options_paths_shell_or_patterns(self):
        for target in ('-x', '--help', '/tmp/x', '../x', 'x;id', '$(id)', '`id`', 'x\nid', '*', 'x|cat'):
            for operation in ('container', 'logs', 'service', 'service-logs'):
                # argparse itself rejects leading option syntax; otherwise helper does.
                with self.subTest(target=target, operation=operation), redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                    with self.assertRaises((ValueError, SystemExit)):
                        self.command(operation, 'fixture-one', target)
        with self.assertRaises(ValueError): self.command('service', 'fixture-one', 'not-a-unit')

    def test_mutating_and_freeform_interfaces_do_not_exist(self):
        for args in (['exec', 'fixture-one', 'id'], ['restart', 'fixture-one'], ['scp', 'file'],
                     ['containers', 'fixture-one', '--command', 'id'],
                     ['container', 'fixture-one', 'app', '--format', '{{json .}}'],
                     ['logs', 'fixture-one', 'app', '--follow'],
                     ['logs', 'fixture-one', 'app', '--output', 'file']):
            with self.subTest(args=args), redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                inspect.parser().parse_args(args)

    def test_logs_are_bounded_by_lines_and_time_without_flag_abbreviations(self):
        args = inspect.parser().parse_args(['logs', 'fixture-one', 'app'])
        self.assertEqual((args.tail, args.since), (100, '24h'))
        self.command('logs', 'fixture-one', 'app', '--tail', '500', '--since', '7d')
        for flags in (['--tail', '0'], ['--tail', '-1'], ['--tail', '501'], ['--tail', 'all'],
                      ['--since', '0h'], ['--since', '8d'], ['--since', '999999h'],
                      ['--since', '24h;id'], ['--tai', '1']):
            with self.subTest(flags=flags), redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                inspect.parser().parse_args(['logs', 'fixture-one', 'app', *flags])

    def test_journal_since_is_literal_and_no_pager(self):
        remote = shlex.split(self.command('service-logs', 'fixture-one', 'app.service', '--since', '7d')[-1])
        self.assertIn('--since=7 days ago', remote)
        self.assertIn('--lines=100', remote)
        self.assertIn('--no-pager', remote)

    def test_sensitive_log_lines_and_private_blocks_are_filtered(self):
        raw = 'normal\npassword=synthetic\n{"access_token":"synthetic"}\nAuthorization: Bearer synthetic\n<private>\nhidden\n</private>\n-----BEGIN OPENSSH PRIVATE KEY-----\nsynthetic-key\n-----END OPENSSH PRIVATE KEY-----\nnormal-again\n'
        filtered = inspect.redact(raw)
        for secret in ('synthetic', 'hidden', '<private>', 'PRIVATE KEY'):
            self.assertNotIn(secret, filtered)
        self.assertIn('normal-again', filtered)
        self.assertIn('REDACTED', filtered)
        self.assertNotIn('\x1b', inspect.redact('\x1b[31muntrusted'))

    def test_local_synthetic_process_output_is_capped(self):
        output, code, reason = inspect.bounded_output([sys.executable, '-c', 'print("x" * 10000)'], limit=512)
        self.assertLessEqual(len(output.encode()), 512)
        self.assertEqual(code, 3)
        self.assertIn('incomplete', reason)

    def test_local_synthetic_process_timeout_and_exit_are_not_success(self):
        output, code, reason = inspect.bounded_output([sys.executable, '-c', 'import time; time.sleep(10)'], timeout=0.05)
        self.assertEqual(code, 3)
        self.assertIn('timeout', reason)
        output, code, reason = inspect.bounded_output([sys.executable, '-c', 'raise SystemExit(7)'])
        self.assertEqual(code, 7)
        self.assertIsNone(reason)

    def test_cli_help_and_hosts_do_not_connect(self):
        with patch.object(inspect.Path, 'home', return_value=self.home), patch.object(inspect, 'bounded_output') as run:
            with redirect_stdout(io.StringIO()):
                self.assertEqual(inspect.main(['help']), 0)
                self.assertEqual(inspect.main(['hosts']), 0)
            run.assert_not_called()

    def test_registered_helper_uses_existing_boundary_and_denies_raw_ssh(self):
        for args in (['ssh-inspect', 'containers', 'fixture-one'], ['ssh-inspect', 'container', 'fixture-one', 'app'],
                     ['ssh-inspect', 'logs', 'fixture-one', 'app', '--tail', '100', '--since', '24h'],
                     ['ssh-inspect', 'service-logs', 'fixture-one', 'app.service']):
            command, env = broker.helper_command(args, ROOT, ROOT)
            self.assertEqual(command[1], str(ROOT / 'scripts/ssh_inspect.py'))
            self.assertEqual(command[2:], args[1:])
        for command in ('ssh fixture-one id', 'scp file fixture-one:/tmp/file',
                        f'python3 {broker.BROKER} helper ssh-inspect exec fixture-one id',
                        f'python3 {broker.BROKER} helper ssh-inspect containers fixture-one; ssh fixture-one id'):
            with self.subTest(command=command), self.assertRaises(ValueError):
                broker.check_invocation(command, ROOT)
        for args in (['ssh-inspect', 'logs', 'fixture-one', 'app', '--follow'],
                     ['ssh-inspect', 'container', 'fixture-one', 'app;id'],
                     ['ssh-inspect', 'container', 'fixture-one', 'app', '--format', '{{json .}}']):
            with self.subTest(args=args), self.assertRaises(ValueError):
                broker.helper_command(args, ROOT, ROOT)

    def test_helper_is_managed_and_not_copied_from_an_untrusted_project(self):
        managed = json.loads((ROOT / 'STACK-MANIFEST.json').read_text())['managedFiles']
        for path in ('scripts/ssh_inspect.py', 'planner-helpers/core-ssh.json'):
            self.assertIn(path, managed)
        for body in ('agents/planner.md',):
            self.assertIn('helper ssh-inspect help', (ROOT / body).read_text())


if __name__ == '__main__':
    unittest.main()
