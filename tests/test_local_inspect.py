import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('local_inspect', ROOT / 'scripts/local_inspect.py')
inspect = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspect)


class LocalInspectTests(unittest.TestCase):
    def test_process_and_network_reads_have_no_user_command_or_options(self):
        expected = {'processes':('ps',['-eo','pid,ppid,euid,egid,stat,comm']),
                    'listeners':('ss',['-lntu']),'connections':('ss',['-ntu']),
                    'addresses':('ip',['-json','address','show']),'routes':('ip',['-json','route','show'])}
        with patch.object(inspect.Path,'is_file',return_value=True), patch.object(inspect.os,'access',return_value=True):
            for name,(tool,args) in expected.items():
                with self.subTest(operation=name):
                    argv = inspect.command(self.args(name))
                    self.assertEqual(Path(argv[0]).name,tool)
                    self.assertEqual(argv[1:],args)
        for values in (('processes','--args'),('listeners','--kill'),('addresses','add'),('routes','flush')):
            with self.subTest(values=values), patch('sys.stderr'), self.assertRaises(SystemExit):
                self.args(*values)

    def args(self, *values):
        return inspect.parser().parse_args(values)

    def test_fixed_commands_use_system_binaries_and_closed_options(self):
        for operation in ('df', 'du', 'stat', 'free', 'uptime', 'uname', 'lsblk'):
            values = [operation, '--path', str(ROOT)] if operation in ('df', 'du', 'stat') else [operation]
            with self.subTest(operation=operation):
                command = inspect.command(self.args(*values))
                self.assertIn(str(Path(command[0]).parent), ('/usr/bin', '/bin'))
        du = inspect.command(self.args('du', '--path', str(ROOT), '--depth', '1'))
        for value in ('--one-file-system', '--no-dereference', '--null', '--block-size=1', '--max-depth=1'):
            self.assertIn(value, du)
        self.assertEqual(du[-2:], ['--', str(ROOT)])

    def test_arbitrary_commands_options_and_out_of_range_limits_are_denied(self):
        for values in (('rm',), ('df', '--path', '/tmp', '--output', 'file'), ('du', '--path', '/tmp', '--dereference'),
                       ('du', '--depth', '4'), ('du', '--depth', '-1'), ('du', '--limit', '0'),
                       ('du', '--limit', '201'), ('du', '--timeout', '121'),
                       ('stat', '--path', '/tmp', '--format', '%n'), ('free', '--path', '/home'),
                       ('df', '--pa', '/home')):
            with self.subTest(values=values), patch('sys.stderr'), self.assertRaises(SystemExit):
                self.args(*values)

    def test_sensitive_virtual_and_symlinked_sensitive_paths_are_denied(self):
        for path in ('/proc', '/sys', '/dev', '/run', '/home/a/.ssh', '/home/a/.env',
                     '/home/a/.aws', '/home/a/.pgpass', '/etc/shadow',
                     '/home/a/.config/gh/hosts.yml', '/home/a/private/key',
                     '/home/a/stitch-api-key', '/home/a/.docker/config.json'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                inspect.safe_path(path)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / '.ssh').mkdir()
            (root / 'innocent').symlink_to(root / '.ssh', target_is_directory=True)
            with self.assertRaises(ValueError):
                inspect.safe_path(str(root / 'innocent'))

    def test_paths_with_spaces_and_option_like_names_remain_literal(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / '--output=some file; $(literal)'
            path.mkdir()
            command = inspect.command(self.args('stat', '--path', str(path)))
            self.assertEqual(command[-2:], ['--', str(path)])
            result = subprocess.run(command, capture_output=True)
            self.assertEqual(result.returncode, 0)

    def test_du_sorts_without_shell_and_reports_listing_limit(self):
        data = b'10\t/tmp/small\0' + b'90\t/tmp/big\0' + b'100\t/tmp\0'
        report = inspect.du_report(data, 2)
        self.assertEqual([row['bytes'] for row in report['entries']], [100, 90])
        self.assertTrue(report['listing_truncated'])
        self.assertEqual(report['measured_entries'], 3)

    def test_bounded_execution_reports_timeout_and_output_limit(self):
        # Synthetic subprocesses exercise the runner, never the public allowlist.
        orphan = 'import os,subprocess,sys; subprocess.Popen([sys.executable,"-c","import time; time.sleep(5)"]); os._exit(0)'
        for command, timeout, limit in (([sys.executable, '-c', 'import time; time.sleep(5)'], .05, 100),
                                        ([sys.executable, '-c', 'print("x" * 1000)'], 5, 100),
                                        ([sys.executable, '-c', orphan], .2, 100)):
            stdout, stderr, code, reason = inspect.execute(command, timeout, limit)
            self.assertEqual(code, 3)
            self.assertIsNotNone(reason)
            self.assertLessEqual(len(stdout) + len(stderr), limit)

    def test_nonzero_exit_is_preserved_and_environment_is_minimal(self):
        stdout, stderr, code, reason = inspect.execute(
            [sys.executable, '-c', 'import sys; print("partial"); sys.stderr.write("error"); sys.exit(7)'], 5)
        self.assertEqual((stdout, stderr, code, reason), (b'partial\n', b'error', 7, None))
        with patch.dict(os.environ, {'LD_PRELOAD': '/untrusted', 'DU_BLOCK_SIZE': '1000', 'PAGER': 'evil'}):
            stdout, _, code, _ = inspect.execute(
                [sys.executable, '-c', 'import os; print(sorted(os.environ))'], 5)
        self.assertEqual(code, 0)
        self.assertNotIn(b'LD_PRELOAD', stdout)
        self.assertNotIn(b'DU_BLOCK_SIZE', stdout)
        self.assertNotIn(b'PAGER', stdout)

    def test_real_du_uses_metadata_without_following_links_or_sensitive_dirs(self):
        with tempfile.TemporaryDirectory() as temp, tempfile.TemporaryDirectory() as outside:
            root = Path(temp)
            (root / 'normal').mkdir()
            (root / 'normal/data').write_bytes(b'x' * 8192)
            (root / '.ssh').mkdir()
            (root / '.ssh/fixture').write_bytes(b'x' * 8192)
            (Path(outside) / 'outside').write_bytes(b'x' * 8192)
            (root / 'link').symlink_to(outside, target_is_directory=True)
            before = (root / 'normal/data').stat()
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/local_inspect.py'),
                                     'du', '--path', str(root), '--depth', '2'],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            names = [row['path'] for row in report['entries']]
            self.assertIn(str(root / 'normal'), names)
            self.assertNotIn(str(root / '.ssh'), names)
            self.assertFalse(any('outside' in path for path in names))
            after = (root / 'normal/data').stat()
            self.assertEqual((before.st_size, before.st_mtime_ns), (after.st_size, after.st_mtime_ns))


if __name__ == '__main__':
    unittest.main()
