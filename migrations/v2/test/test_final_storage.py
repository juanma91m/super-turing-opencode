import copy
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / file); result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result


transfer = load('transfer', 'native-transfer.py'); storage = load('storage', 'cutover-storage.py'); rollback = load('rollback', 'cutover-rollback.py')


class FakeHost:
    def __init__(self, rows): self.rows = copy.deepcopy(rows); self.imports = []
    def request(self, method, route, data=None):
        if route.startswith('/api/session?'): return {'data': [row['info'] for row in self.rows.values()]}
        if '/message?' in route: return {'data': self.rows[route.split('/')[3]]['messages']}
        if route.endswith('/export'): return {'data': copy.deepcopy(self.rows[route.split('/')[4]])}
        if method == 'POST' and route.endswith('/import'):
            sid = data['info']['id']; self.rows[sid] = {'info': copy.deepcopy(data['info']), 'messages': data['messages']}; self.imports.append(sid); return {'data': self.rows[sid]['info']}
        raise AssertionError('Unexpected synthetic API request')


def session(sid, parent=None):
    return {'info': {'id': sid, 'parentID': parent, 'title': 'SYNTHETIC', 'location': {'directory': '/fixture/project'}, 'time': {'created': '2026-01-01T00:00:00Z'}}, 'messages': [{'id': 'msg_' + sid, 'type': 'user', 'text': 'SYNTHETIC'}]}


class TransferTests(unittest.TestCase):
    def test_public_migration_wait_handles_running_and_stops_on_native_error(self):
        class Migration:
            def __init__(self, statuses): self.statuses = iter(statuses); self.requests = 0
            def request(self, method, route):
                self.requests += 1; self.assertion = (method, route); return {'status': next(self.statuses)}
            def remaining(self): return .001
        native = Migration(['running', 'completed']); transfer.migration(native)
        self.assertEqual(native.requests, 2); self.assertEqual(native.assertion, ('GET', '/api/experimental/migration/v1'))
        failed = Migration(['error'])
        with self.assertRaisesRegex(RuntimeError, 'migration_not_completed'): transfer.migration(failed)
        self.assertEqual(failed.requests, 1)

    def test_request_deadline_failure_releases_singleflight_without_retries(self):
        host = transfer.NativeHost.__new__(transfer.NativeHost); host.request_lock = threading.Lock(); host.port = 1
        def expired(): raise RuntimeError('absolute_native_budget_exceeded')
        host.remaining = expired
        with self.assertRaisesRegex(RuntimeError, 'absolute_native_budget'): host.request('GET', '/api/session')
        self.assertFalse(host.request_lock.locked()); self.assertIsNone(host.pending_since)
        host.request_lock.acquire()
        try:
            with self.assertRaisesRegex(RuntimeError, 'overlapping'): host.request('GET', '/api/session')
        finally: host.request_lock.release()

    def test_native_union_handles_children_and_exact_duplicates_without_transforming_messages(self):
        root = session('ses_root'); source = FakeHost({'ses_child': session('ses_child', 'ses_root'), 'ses_root': root}); target = FakeHost({'ses_root': root})
        report = transfer.transfer(source, target)
        self.assertEqual(target.imports, ['ses_child']); self.assertEqual(report['finalSessions'], 2); self.assertEqual(report['identicalDuplicates'], 1)
        self.assertEqual(source.rows['ses_child']['messages'], target.rows['ses_child']['messages'])

    def test_divergence_and_missing_parent_refuse_instead_of_merging_or_replacing(self):
        row = session('ses_root'); changed = copy.deepcopy(row); changed['messages'][0]['text'] = 'DIFFERENT'
        target = FakeHost({'ses_root': row})
        with self.assertRaisesRegex(RuntimeError, 'no_native_merge'): transfer.transfer(FakeHost({'ses_root': changed}), target)
        self.assertEqual(target.imports, [])
        with self.assertRaisesRegex(RuntimeError, 'missing_parent'): transfer.transfer(FakeHost({'ses_child': session('ses_child', 'ses_unknown')}), FakeHost({}))

    def test_unsettled_export_and_repeated_cursor_are_not_accepted(self):
        host = FakeHost({'ses_root': session('ses_root')}); request = host.request
        def excludes(method, route, data=None):
            result = request(method, route, data)
            if route.endswith('/export'): result['data']['messages'] = []
            return result
        host.request = excludes
        with self.assertRaisesRegex(RuntimeError, 'unsettled'): transfer.exported(host, 'ses_root')
        class Repeated:
            def request(self, *_): return {'data': [], 'cursor': {'next': 'same'}}
        with self.assertRaisesRegex(RuntimeError, 'cursor_repeated'): list(transfer.pages(Repeated(), '/api/session'))


class RollbackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR', '/tmp/opencode')); self.addCleanup(self.temp.cleanup); self.root = Path(self.temp.name)
    def fixture(self):
        home = self.root / 'home'; install = home / '.opencode'; old = home / '.local/state/opencode-addons/opencode-background-tasks/backups/old'
        for directory in [install, old]:
            (directory / 'bin').mkdir(parents=True); (directory / 'bin/opencode').write_text('OLD_WRAPPER'); (directory / 'bin/engram').write_text('CURRENT_AUX'); (directory / 'bin/opencode').chmod(0o755)
        marker = {'mode': 'managed-local-install', 'backupPath': str(old), 'checkoutVersion': '1.19.4'}
        (install / '.opencode-background-addon.json').write_text(json.dumps(marker)); state = old.parent.parent / 'state.json'; state.write_text(json.dumps({'mode': 'managed-local-install', 'managedLocalInstall': marker, 'plugins': [], 'assets': []}))
        saved = self.root / 'preimages'; storage.backup.prepare_install(home, saved)
        (install / 'bin/opencode').write_text('V2_STAGED_WRAPPER'); (install / '.opencode-background-addon.json').unlink(); state.unlink()
        dbs = [self.root / 'original/opencode.db', self.root / 'production/opencode.db']
        return saved / 'install-rollback.json', install, dbs

    def test_exact_rollback_restores_ownership_modes_and_keeps_v2_postimages(self):
        receipt, install, dbs = self.fixture(); seal = self.root / 'post'
        rollback.seal(receipt, seal, dbs, confirmed=True)
        report = rollback.restore(seal / 'postimages.json', confirmed=True)
        self.assertTrue(report['productionDataPreserved']); self.assertFalse(report['databaseRestored'])
        self.assertEqual((install / 'bin/opencode').read_text(), 'OLD_WRAPPER'); self.assertEqual((install / 'bin/opencode').stat().st_mode & 0o777, 0o755)
        self.assertEqual((seal / 'files/.opencode/bin/opencode').read_text(), 'V2_STAGED_WRAPPER'); self.assertTrue((install / '.opencode-background-addon.json').exists())

    def test_drift_is_rejected_before_writes_and_explicit_recovery_accepts_only_known_mixed_images(self):
        receipt, install, dbs = self.fixture(); seal = self.root / 'post'; rollback.seal(receipt, seal, dbs, confirmed=True)
        (install / 'bin/opencode').write_text('UNKNOWN')
        with self.assertRaisesRegex(ValueError, 'drift'): rollback.restore(seal / 'postimages.json', confirmed=True)
        self.assertFalse((install / '.opencode-background-addon.json').exists())
        (install / 'bin/opencode').write_text('V2_STAGED_WRAPPER')
        original = rollback.apply_image; count = [0]
        def interrupted(*args):
            original(*args); count[0] += 1
            if count[0] == 1: raise RuntimeError('SYNTHETIC_INTERRUPTION')
        with patch.object(rollback, 'apply_image', side_effect=interrupted):
            with self.assertRaisesRegex(RuntimeError, 'INTERRUPTION'): rollback.restore(seal / 'postimages.json', confirmed=True)
        self.assertTrue((seal / 'rollback-started.json').exists())
        rollback.restore(seal / 'postimages.json', confirmed=True, recover='before')
        self.assertEqual((install / 'bin/opencode').read_text(), 'OLD_WRAPPER')

    def test_live_source_and_wal_advancement_are_observable_gates(self):
        with self.assertRaisesRegex(ValueError, 'closure'): storage.prepare({}, closed=False)
        with self.assertRaisesRegex(ValueError, 'closure'): storage.publish({}, closed=False)
        folder = self.root / 'original'; folder.mkdir(); db = folder / 'opencode.db'
        with sqlite3.connect(db) as connection:
            connection.execute('PRAGMA journal_mode=WAL'); connection.execute('CREATE TABLE fixture(id INTEGER)'); connection.commit()
            self.assertTrue(storage.users_of([db]))
            first = storage.unchanged(db); connection.execute('INSERT INTO fixture VALUES (1)'); connection.commit()
            self.assertNotEqual(storage.unchanged(db), first)
            with self.assertRaisesRegex(ValueError, 'in use'): rollback.closure([db, self.root / 'production/opencode.db'], True)

    def test_empty_wal_and_shm_coordination_are_not_treated_as_new_committed_messages(self):
        db = self.root / 'opencode.db'; db.write_bytes(b'SYNTHETIC_NOT_SQLITE')
        before = storage.capture_fingerprint(db)
        Path(str(db)+'-wal').write_bytes(b''); Path(str(db)+'-shm').write_bytes(b'SYNTHETIC_COORDINATION')
        self.assertEqual(storage.capture_fingerprint(db), before)
        Path(str(db)+'-wal').write_bytes(b'SYNTHETIC_NONEMPTY_WAL')
        self.assertNotEqual(storage.capture_fingerprint(db), before)

    def test_before_cutover_verification_refuses_unknown_install_entries_without_reading_them(self):
        receipt, install, _ = self.fixture()
        for source, row in rollback.preimages(receipt).items(): rollback.apply_image(source, row['image'], row['payload'])
        self.assertGreater(rollback.verify_current(receipt)['entries'], 0)
        (install / 'bin/unknown-new-entry').write_text('DO_NOT_ADOPT')
        with self.assertRaisesRegex(ValueError, 'Unknown installation entry'): rollback.verify_current(receipt)

    def test_auxiliary_reconciliation_is_narrow_and_refuses_unknown_binaries(self):
        receipt, install, dbs = self.fixture()
        report = rollback.json_read(receipt)
        current = install / 'bin/engram'; historic = Path(report['historicalInstall']) / 'bin/engram'
        # Fixture's historical bytes are amended before taking a new exact receipt.
        historic.write_text('HISTORICAL_AUX')
        marker = install / '.opencode-background-addon.json'; marker.write_text(json.dumps({'mode': 'managed-local-install', 'backupPath': report['historicalInstall'], 'checkoutVersion': '1.19.4'}))
        state = Path(report['historicalInstall']).parent.parent / 'state.json'; state.write_text(json.dumps({'mode': 'managed-local-install', 'managedLocalInstall': {'backupPath': report['historicalInstall']}, 'plugins': [], 'assets': []}))
        target = self.root / 'aux-preimages'; storage.backup.prepare_install(Path(report['home']), target); receipt = target / 'install-rollback.json'
        marker.unlink(); current.write_text('UNKNOWN')
        with self.assertRaisesRegex(ValueError, 'drift'): rollback.auxiliaries(receipt, dbs, confirmed=True)
        self.assertEqual(current.read_text(), 'UNKNOWN')
        current.write_text('HISTORICAL_AUX'); outcome = rollback.auxiliaries(receipt, dbs, confirmed=True)
        self.assertEqual(outcome['filesChanged'], 1); self.assertEqual(current.read_text(), 'CURRENT_AUX')


if __name__ == '__main__': unittest.main()
