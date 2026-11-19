"""Real filesystem and broker fixtures only; no application, Jira, env or LLM work."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PlannerDocumentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir='/tmp/opencode', prefix='planner-doc-test-')
        self.addCleanup(self.temporary.cleanup)
        self.fixture = Path(self.temporary.name)
        self.project, self.home = (self.fixture / name for name in ('project', 'home'))
        for path in (self.project, self.home):
            path.mkdir(parents=True)
        installed = os.environ.get('OPENCODE_ANALYSIS_DOC_CONFIG')
        self.config = Path(installed) if installed else self.fixture / 'config'
        if installed:
            self.assertTrue(self.config.is_absolute())
            self.assertTrue((self.config / 'planner-helpers/core-analysis-doc.json').is_file())
        else:
            (self.config / 'scripts').mkdir(parents=True)
            (self.config / 'planner-helpers').mkdir()
            for name in ('planner_shell.py', 'planner_doc.py'):
                shutil.copyfile(ROOT / 'scripts' / name, self.config / 'scripts' / name)
            shutil.copyfile(ROOT / 'planner-helpers/core-analysis-doc.json', self.config / 'planner-helpers/core-analysis-doc.json')
        self.broker = self.config / 'scripts/planner_shell.py'
        self.env = {**os.environ, 'HOME': str(self.home), 'PYTHONDONTWRITEBYTECODE': '1',
                    'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull}
        for key in tuple(self.env):
            if key.startswith('JIRA_'):
                del self.env[key]
        subprocess.run(['git', 'init', '-q'], cwd=self.project, env=self.env, check=True)

    def run_helper(self, *args, cwd=None):
        return subprocess.run(['python3', str(self.broker), 'helper', 'analysis-doc', *args],
                              cwd=cwd or self.project, env=self.env, capture_output=True, text=True, timeout=15)

    def write(self, path='tmp/tsa/habilitar-apis.md', content='# Synthetic diagnosis\n', digest=None):
        return self.run_helper('write', '--path', path, '--content', content,
                               *(['--expected-sha256', digest] if digest is not None else []))

    def test_requested_document_without_ticket_is_written_literally_and_restricted(self):
        content = "# Diagnosis\nO'Brien; $(touch injected) `literal`\nNo operation performed.\n"
        result = self.write(content=content)
        self.assertEqual(result.returncode, 0, result.stderr)
        path = self.project / 'tmp/tsa/habilitar-apis.md'
        self.assertEqual(path.read_text(), content)
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(json.loads(result.stdout)['sha256'], hashlib.sha256(content.encode()).hexdigest())
        self.assertFalse((self.project / 'injected').exists())
        self.assertFalse((self.project / 'tmp/tsa/verdict.md').exists())
        self.assertFalse((self.project / '.git/index').exists())

    def test_subdirectory_call_still_uses_git_root(self):
        sub = self.project / 'backend'
        sub.mkdir()
        result = self.run_helper('write', '--path', 'tmp/tsa/diagnosis.md', '--content', '# fixture', cwd=sub)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.project / 'tmp/tsa/diagnosis.md').is_file())
        self.assertFalse((sub / 'tmp').exists())

    def test_inspect_is_readonly_and_replace_requires_current_digest(self):
        result = self.run_helper('inspect', '--path', 'tmp/tsa/habilitar-apis.md')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(json.loads(result.stdout)['exists'])
        self.assertFalse((self.project / 'tmp').exists())
        first = self.write()
        self.assertEqual(first.returncode, 0, first.stderr)
        digest = json.loads(first.stdout)['sha256']
        self.assertNotEqual(self.write(content='# changed').returncode, 0)
        self.assertNotEqual(self.write(content='# changed', digest='0' * 64).returncode, 0)
        self.assertEqual(self.write(content='# changed', digest=digest).returncode, 0)
        self.assertNotEqual(self.write(content='# stale', digest=digest).returncode, 0)
        self.assertEqual((self.project / 'tmp/tsa/habilitar-apis.md').read_text(), '# changed')

    def test_no_writes_outside_markdown_tmp_or_reserved_workflows(self):
        for path in ('app.py', 'README.md', '../escape.md', '/tmp/escape.md', 'tmp/../escape.md',
                     'tmp//doc.md', 'tmp/.env.md', 'tmp/.git/doc.md', 'tmp/doc.py',
                     'tmp/tsa/verdict.md', 'tmp/tsa/result-dev.md', 'tmp/tsa/code-review/review.md'):
            with self.subTest(path=path):
                self.assertNotEqual(self.write(path).returncode, 0)
        self.assertFalse((self.project / 'tmp').exists())

    def test_symlinks_are_rejected_at_tmp_nested_directory_and_leaf(self):
        outside = self.fixture / 'outside'
        outside.mkdir()
        (self.project / 'tmp').symlink_to(outside, target_is_directory=True)
        self.assertNotEqual(self.write().returncode, 0)
        (self.project / 'tmp').unlink()
        (self.project / 'tmp').mkdir()
        (self.project / 'tmp/tsa').symlink_to(outside, target_is_directory=True)
        self.assertNotEqual(self.write().returncode, 0)
        (self.project / 'tmp/tsa').unlink()
        (self.project / 'tmp/tsa').mkdir()
        target = outside / 'keep.md'
        target.write_text('unchanged')
        (self.project / 'tmp/tsa/habilitar-apis.md').symlink_to(target)
        self.assertNotEqual(self.write().returncode, 0)
        self.assertEqual(target.read_text(), 'unchanged')
        self.assertEqual(list(outside.iterdir()), [target])

    def test_tracked_executable_hardlinked_and_large_destinations_are_not_edited(self):
        self.assertEqual(self.write().returncode, 0)
        target = self.project / 'tmp/tsa/habilitar-apis.md'
        subprocess.run(['git', 'add', '-f', 'tmp/tsa/habilitar-apis.md'], cwd=self.project, env=self.env, check=True)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        self.assertNotEqual(self.write(content='# overwrite', digest=digest).returncode, 0)
        for name, mode, content in (('executable.md', 0o700, '# shell'), ('large.md', 0o600, 'x' * 65537)):
            file = target.with_name(name)
            file.write_text(content)
            file.chmod(mode)
            self.assertNotEqual(self.run_helper('inspect', '--path', 'tmp/tsa/' + name).returncode, 0)
        alias = target.with_name('alias.md')
        os.link(target, alias)
        self.assertNotEqual(self.run_helper('inspect', '--path', 'tmp/tsa/alias.md').returncode, 0)
        self.assertEqual(target.read_text(), '# Synthetic diagnosis\n')

    def test_private_empty_and_oversized_content_fail_before_creating_directories(self):
        for content in ('', ' \n', '<private>synthetic</private>', 'x' * 65537):
            with self.subTest(length=len(content)):
                self.assertNotEqual(self.write(content=content).returncode, 0)
        self.assertFalse((self.project / 'tmp').exists())

    def test_concurrent_replacements_with_same_digest_have_one_winner(self):
        first = self.write()
        digest = json.loads(first.stdout)['sha256']
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda n: self.write(content=f'# revision {n}', digest=digest), range(2)))
        self.assertEqual(sorted(result.returncode for result in results), [0, 2])
        self.assertFalse(list((self.project / 'tmp/tsa').glob('.planner-doc-*')))

    def test_help_and_invalid_flags_do_not_write(self):
        self.assertEqual(self.run_helper('help').returncode, 0)
        for args in (('write', '--path', 'tmp/a.md'), ('write', '--path', 'tmp/a.md', '--content', 'x', '--append'),
                     ('delete', '--path', 'tmp/a.md')):
            self.assertNotEqual(self.run_helper(*args).returncode, 0)
        self.assertFalse((self.project / 'tmp').exists())


if __name__ == '__main__':
    unittest.main()
