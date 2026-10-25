import importlib.util
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('planner_shell', ROOT / 'scripts/planner_shell.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class PlannerShellTests(unittest.TestCase):
    def test_read_only_git_and_branch_listing(self):
        for args in (['status', '--short'], ['diff', '--stat'], ['log', '--oneline', '-n', '5'],
                     ['show', '--stat', 'HEAD'], ['rev-parse', '--show-toplevel'],
                     ['merge-base', 'main', 'HEAD'], ['ls-files', '--stage'], ['branch', '--show-current']):
            with self.subTest(args=args):
                cmd = guard.git_command(args)
                self.assertIn('--no-optional-locks', cmd)
                self.assertIn('core.fsmonitor=false', cmd)

    def test_git_mutations_and_external_execution_are_denied(self):
        for args in (['commit'], ['push'], ['reset', '--hard'], ['checkout', 'main'],
                     ['branch', 'new'], ['branch', '--list', '-D', 'main'], ['diff', '--output=app.py'],
                     ['diff', '--ext-diff'], ['show', '--textconv'], ['log', '--output', 'app.py'],
                     ['-c', 'alias.x=!evil', 'x'], ['show', 'HEAD:.env'], ['show', 'HEAD:.aws/credentials']):
            with self.subTest(args=args), self.assertRaises(ValueError): guard.git_command(args)

    def test_raw_shell_interpreters_formatters_and_composition_are_denied(self):
        commands = ['./gradlew spotlessApply', 'npm run format:fix', 'python3 -c "open(\"app\",\"w\")"',
                    'node -e "evil()"', 'git status', 'touch app.py',
                    f'python3 {guard.BROKER} git status > app.py',
                    f'python3 {guard.BROKER} git status; touch app.py',
                    f'python3 {guard.BROKER} git status && true',
                    f'python3 {guard.BROKER} git log "$(touch app.py)"',
                    f'python3 {guard.BROKER} git log `touch app.py`',
                    f'python3 {guard.BROKER} git status\ntouch app.py']
        for command in commands:
            with self.subTest(command=command), self.assertRaises(ValueError):
                guard.check_invocation(command, ROOT)

    def test_valid_broker_invocation_and_repo_boundary(self):
        guard.check_invocation(f'python3 {guard.BROKER} git status --short', ROOT, ROOT)
        with self.assertRaises(ValueError):
            guard.check_invocation(f'python3 {guard.BROKER} git status', ROOT.parent, ROOT)

    def test_single_quoted_metadata_is_literal(self):
        payload = "O'Brien; `literal` $(not-executed)\n# markdown"
        command = ' '.join(shlex.quote(x) for x in ('python3', str(guard.BROKER), 'helper', 'test', payload))
        self.assertEqual(guard.literal_argv(command)[-1], payload)

    def test_registry_owns_helpers_not_arbitrary_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'planner-helpers').mkdir()
            (root / 'scripts').mkdir()
            (root / 'scripts/demo.sh').write_text('# trusted fixture\n')
            (root / 'planner-helpers/test.json').write_text(json.dumps({'demo': {
                'path': 'scripts/demo.sh', 'positionals': [], 'options': {'--query': 'text'}, 'required': ['--query']}}))
            command, _ = guard.helper_command(['demo', '--query', 'literal'], root, root)
            self.assertEqual(command[-2:], ['--query', 'literal'])
            for args in (['unknown'], ['demo', '--out', 'app.py'], ['demo'], ['demo', '--query', 'a', 'extra']):
                with self.subTest(args=args), self.assertRaises(ValueError): guard.helper_command(args, root, root)

    def test_metadata_paths_cannot_escape_or_redirect_tmp(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for value in ('../src/app.py', '/src/app.py', '.env'):
                with self.subTest(value=value), self.assertRaises(ValueError): guard.check_value(value, 'relative', root)
            with self.assertRaises(ValueError): guard.check_value('src/app.py', 'tmp-path', root)

    def test_git_status_does_not_write_application_or_index(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            app = root / 'app.txt'
            app.write_text('unchanged\n')
            command, cwd, env = guard.prepare(['git', 'status', '--short'], root)
            done = subprocess.run(command, cwd=cwd, env=env, capture_output=True)
            self.assertEqual(done.returncode, 0)
            self.assertEqual(app.read_text(), 'unchanged\n')
            self.assertFalse((root / '.git/index').exists())

    def test_claude_hook_fails_closed_without_auto_approval(self):
        for payload in ({}, {'tool_input': {'command': './gradlew spotlessApply'}},
                        {'tool_input': {'command': None}}, {'tool_input': {'command': 'echo hi'}}):
            done = subprocess.run([sys.executable, str(guard.BROKER), '--claude-hook'],
                                  input=json.dumps(payload), capture_output=True, text=True)
            self.assertEqual(done.returncode, 2)
        good = {'cwd': str(ROOT), 'tool_input': {'command': f'python3 {guard.BROKER} git status --short'}}
        done = subprocess.run([sys.executable, str(guard.BROKER), '--claude-hook'],
                              input=json.dumps(good), capture_output=True, text=True)
        self.assertEqual(done.returncode, 0)
        self.assertEqual(done.stdout, '')

    def test_registered_jira_writes_only_metadata_with_literal_content(self):
        addon = ROOT.parent / 'super-turing-opencode-ticketing'
        if not addon.exists(): self.skipTest('Optional Ticketing checkout is absent')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            config, project = root / 'config', root / 'project'
            (config / 'scripts').mkdir(parents=True)
            (config / 'planner-helpers').mkdir()
            project.mkdir()
            for filename in ('jira_helper.sh', 'jira_api_read.py'):
                shutil.copy2(addon / 'scripts' / filename, config / 'scripts' / filename)
            shutil.copy2(addon / 'planner-helpers/ticketing.json', config / 'planner-helpers/ticketing.json')
            app = project / 'app.py'
            app.write_text('unchanged\n')
            (root / 'missing.example').write_text('')  # Synthetic, empty config; no real .env is read.
            with patch.dict(os.environ, {'JIRA_ENV_FILE': str(root / 'missing.example'),
                                        'JIRA_BASE_URL': 'https://jira.invalid', 'JIRA_EMAIL': 'synthetic@example.invalid',
                                        'JIRA_API_TOKEN': 'synthetic'}):
                command, cwd, env = guard.prepare(['helper', 'jira', 'verdict', 'TEST-1', '--content',
                                                    'Literal `$()`; no shell execution'], project, config)
                result = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('Literal `$()`', (project / 'tmp/TEST-1/verdict.md').read_text())
            self.assertEqual(app.read_text(), 'unchanged\n')
            for args in (['helper', 'jira', 'write', 'TEST-1', '--file', '../../app.py', '--content', 'bad'],
                         ['helper', 'jira', 'dump', 'TEST-1', '--out', 'app.py'],
                         ['helper', 'jira', 'attachment-get', 'https://other.invalid', '--out', 'tmp/a']):
                with self.subTest(args=args), self.assertRaises(ValueError): guard.prepare(args, project, config)
            (project / 'tmp').rename(project / 'old-tmp')
            (project / 'tmp').symlink_to(project, target_is_directory=True)
            with self.assertRaises(ValueError):
                guard.prepare(['helper', 'jira', 'verdict', 'TEST-1', '--content', 'bad'], project, config)


if __name__ == '__main__': unittest.main()
