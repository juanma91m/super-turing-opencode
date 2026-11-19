import importlib.util
from pathlib import Path
import json
import os
import sqlite3
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('cutover_backup', Path(__file__).parents[1] / 'cutover-backup.py')
backup = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR', '/tmp/opencode'))
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)

    def test_online_sqlite_backup_keeps_uncommitted_wal_out_and_does_not_replace(self):
        source = self.root / 'opencode.db'
        with sqlite3.connect(source) as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE fixture (value TEXT)')
            db.execute('INSERT INTO fixture VALUES (?)', ('committed',)); db.commit()
            db.execute('INSERT INTO fixture VALUES (?)', ('not-committed',))
            target = self.root / 'backup'; target.mkdir(mode=0o700)
            report = backup.sqlite_backup(source, target / 'opencode.db')
            self.assertEqual(report['integrity'], 'ok'); self.assertFalse(report['finalCutoverBackup'])
            with sqlite3.connect(target / 'opencode.db') as restored:
                self.assertEqual(restored.execute('SELECT value FROM fixture').fetchall(), [('committed',)])
            with self.assertRaises(ValueError): backup.sqlite_backup(source, target / 'opencode.db')

    def fixture(self):
        home = self.root / 'home'; install = home / '.opencode'; historic = home / '.local/state/opencode-addons/opencode-background-tasks/backups/old'
        for tree in [install, historic]:
            (tree / 'bin').mkdir(parents=True)
            for name in ['opencode', 'engram', 'semgrep']:
                (tree / 'bin' / name).write_text(('CURRENT' if tree == install else 'OLD') + name)
        marker = {'mode': 'managed-local-install', 'backupPath': str(historic), 'checkoutVersion': '1.19.4'}
        (install / '.opencode-background-addon.json').write_text(json.dumps(marker))
        state = historic.parent.parent / 'state.json'
        state.write_text(json.dumps({'mode': 'managed-local-install', 'managedLocalInstall': marker, 'plugins': [], 'assets': []}))
        (home / '.env').write_text('DO_NOT_COPY')
        return home, install, historic

    def test_install_rollback_preserves_current_auxiliaries_and_historical_backup_without_env_or_db(self):
        home, install, historic = self.fixture(); target = self.root / 'rollback'
        report = backup.prepare_install(home, target)
        self.assertFalse(report['activeInstallChanged']); self.assertFalse(report['databaseOpened'])
        self.assertEqual(len(report['files']), 8)
        self.assertEqual((target / 'files/.opencode/bin/engram').read_text(), 'CURRENTengram')
        self.assertEqual((install / 'bin/engram').read_text(), 'CURRENTengram')
        self.assertTrue(historic.exists()); self.assertFalse((target / 'files/.env').exists())
        for record in report['files']:
            self.assertEqual(Path(record['backup']).stat().st_mode & 0o777, 0o600)
        with self.assertRaises(FileExistsError): backup.prepare_install(home, target)

    def test_unknown_install_entry_or_symlink_is_not_copied(self):
        home, install, _ = self.fixture()
        (install / '.env').write_text('DO_NOT_COPY')
        with self.assertRaises(ValueError): backup.prepare_install(home, self.root / 'no-copy')
        self.assertFalse((self.root / 'no-copy').exists())
        (install / '.env').unlink(); (install / 'bin/engram').unlink(); (install / 'bin/engram').symlink_to('/never-follow')
        with self.assertRaises(ValueError): backup.prepare_install(home, self.root / 'no-copy')

    def test_actual_background_lifecycle_consumption_is_recoverable_from_preimages(self):
        home, install, historic = self.fixture()
        library = Path(__file__).parents[4] / 'super-turing-opencode-background/lib'
        if not library.is_dir(): self.skipTest('Background source owner unavailable')
        plugin = home / '.config/opencode/plugins/background-agents.ts'
        prior = home / '.config/opencode/.stack-sync-backups/synthetic/before-plugin.ts'
        for file, content in [(plugin, 'CURRENT_PLUGIN'), (prior, 'BEFORE_PLUGIN')]:
            file.parent.mkdir(parents=True, exist_ok=True); file.write_text(content)
        runtime = install / 'bin/opencode-managed-runtime'; runtime.write_text('SYNTHETIC_RUNTIME'); runtime.chmod(0o755)
        state = historic.parent.parent / 'state.json'
        saved = json.loads(state.read_text()); saved['plugins'] = [{'installedPath': str(plugin), 'backupPath': str(prior)}]; state.write_text(json.dumps(saved))
        target = self.root / 'rollback'; report = backup.prepare_install(home, target)
        script = '''
          const {restoreManagedLocalInstall}=await import(process.argv[1]);
          const {removeManagedFile}=await import(process.argv[2]);
          await restoreManagedLocalInstall({installRoot:process.argv[3],backupPath:process.argv[4]});
          await removeManagedFile(process.argv[5],process.argv[5],{plugin:{backupPath:process.argv[6]}});
        '''
        subprocess.run(['node', '--input-type=module', '-e', script, (library / 'local-install.mjs').as_uri(), (library / 'plugin.mjs').as_uri(), str(install), str(historic), str(plugin), str(prior)], check=True, capture_output=True)
        self.assertFalse(historic.exists()); self.assertFalse(prior.exists())
        self.assertEqual(plugin.read_text(), 'BEFORE_PLUGIN')
        self.assertEqual((install / 'bin/engram').read_text(), 'OLDengram')
        # Reconstruct exact preimages only in this synthetic fixture; no real
        # rollback command, adoption, original DB or production files are used.
        for record in report['files']:
            source = Path(record['source']); source.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(record['backup'], source); source.chmod(record['sourceMode'])
            self.assertEqual(backup.digest(source), record['sha256'])
        self.assertEqual((install / 'bin/engram').read_text(), 'CURRENTengram')
        self.assertEqual(runtime.stat().st_mode & 0o777, 0o755)
        self.assertEqual(prior.read_text(), 'BEFORE_PLUGIN'); self.assertTrue(historic.exists())

    def test_historical_npm_tree_preserves_internal_links_and_rejects_private_entries(self):
        home, _, historic = self.fixture()
        modules = historic / 'node_modules'; (modules / 'example/bin').mkdir(parents=True)
        (modules / 'example/bin/cli.js').write_text('PUBLIC_SYNTHETIC')
        (modules / '.bin').mkdir(); (modules / '.bin/example').symlink_to('../example/bin/cli.js')
        report = backup.prepare_install(home, self.root / 'with-npm')
        record = next(item for item in report['files'] if item.get('kind') == 'symlink')
        self.assertEqual(os.readlink(record['backup']), '../example/bin/cli.js')
        (modules / 'example/.env').write_text('DO_NOT_COPY')
        with self.assertRaises(ValueError): backup.prepare_install(home, self.root / 'must-not-exist')
        self.assertFalse((self.root / 'must-not-exist').exists())

    def test_enumeration_failure_or_non_directory_modules_never_publishes_success(self):
        home, _, historic = self.fixture(); modules = historic / 'node_modules'; modules.mkdir()
        destination = self.root / 'failed-enumeration'
        scan = os.scandir
        def fail_modules(file):
            if Path(file) == modules: raise PermissionError('SYNTHETIC_UNREADABLE_DIRECTORY')
            return scan(file)
        with patch.object(os, 'scandir', side_effect=fail_modules):
            with self.assertRaisesRegex(ValueError, 'enumeration failed'): backup.prepare_install(home, destination)
        self.assertFalse(destination.exists())
        modules.rmdir(); modules.write_text('NOT_A_DIRECTORY')
        with self.assertRaisesRegex(ValueError, 'must be a directory'): backup.prepare_install(home, destination)
        self.assertFalse(destination.exists())


if __name__ == '__main__': unittest.main()
