import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fresh import preflight, publish_new
from update import physical


class FreshTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.home = Path(temp.name)
        environment = patch.dict(os.environ, {'HOME': temp.name, 'PATH': os.environ['PATH']}, clear=True)
        environment.start()
        self.addCleanup(environment.stop)

    def test_preflight_has_no_writes(self):
        if not all(shutil.which(name) for name in ('git', 'node', 'npm')):
            self.skipTest('Fresh installation dependencies unavailable')
        _, _, entry = preflight(self.home, physical)
        self.assertEqual(entry, self.home / '.opencode/bin/opencode')
        self.assertEqual(list(self.home.iterdir()), [])

    def test_preflight_refuses_existing_open_code_paths(self):
        directory = self.home / '.config/opencode'
        directory.mkdir(parents=True)
        sentinel = directory / 'original.txt'
        sentinel.write_text('preserve')
        with self.assertRaisesRegex(ValueError, 'does not take ownership'):
            preflight(self.home, physical)
        self.assertEqual(sentinel.read_text(), 'preserve')

    def test_publish_cannot_replace_a_concurrent_entry(self):
        entry = self.home / 'opencode'
        publish_new(entry, b'first', 0o755)
        with self.assertRaises(FileExistsError):
            publish_new(entry, b'second', 0o755)
        self.assertEqual(entry.read_bytes(), b'first')
        self.assertEqual(entry.stat().st_mode & 0o777, 0o755)
