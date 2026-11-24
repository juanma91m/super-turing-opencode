import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('safe_update',Path(__file__).with_name('update.py'))
up=importlib.util.module_from_spec(spec);spec.loader.exec_module(up)


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'));self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.home=self.root/'home';self.home.mkdir()
        self.storage=self.home/'production-storage';self.history=self.storage/'data/opencode/opencode.db';self.memory=self.home/'.engram/engram.db';self.corpus=self.home/'.local/share/super-turing-opencode-knowledge/qdrant'
        for file in [self.history,self.memory]:
            file.parent.mkdir(parents=True,exist_ok=True);db=sqlite3.connect(file);db.execute('CREATE TABLE preserved(value TEXT)');db.execute('INSERT INTO preserved VALUES (?)',('SYNTHETIC_HISTORY' if file==self.history else 'SYNTHETIC_MEMORY',));db.commit();db.close()
        self.corpus.mkdir(parents=True);(self.corpus/'segments').write_text('SYNTHETIC_CORPUS')
        self.entry=self.home/'.opencode/bin/opencode';self.entry.parent.mkdir(parents=True);self.entry.write_text('#!/bin/sh\nexit 0\n');self.entry.chmod(0o755)
        self.settings=self.home/'.config/opencode/production-v2/settings.json';self.settings.parent.mkdir(parents=True)
        self.settings.write_text(json.dumps({'owner':'portable-production-entry','nativeVersion':'2.2.7','managedContract':'managed-harness-v1','storageRoot':str(self.storage)}))
        self.selected=up.discover(self.home);self.originals={str(p):up.digest(p) for p in [self.history,self.memory,self.corpus/'segments',self.entry]}
        self.generation=self.root/'generation'
        self.no_users=patch.object(up,'users',return_value=[]);self.no_users.start();self.addCleanup(self.no_users.stop)
        def fake_sources(lock,dest,runner,**kwargs):dest.mkdir();return {'repositories':[]}
        self.clone=patch.object(up,'sources',side_effect=fake_sources);self.clone.start();self.addCleanup(self.clone.stop)

    def runner(self,argv,**kwargs):
        root=Path(argv[-1]).parent
        settings=json.loads(self.settings.read_text())
        (root/'settings.json').write_text(json.dumps(settings));(root/'entry.mjs').write_text('// SYNTHETIC_ENTRY')
        return json.dumps({'kind':'native-update-staged','ready':True,'nativeVersion':'2.2.7','entry':str(root/'entry.mjs'),'storageRoot':str(self.storage),'needsLogin':False})

    def assert_data(self):
        for p in [self.history,self.memory,self.corpus/'segments']:self.assertEqual(up.digest(p),self.originals[str(p)])

    def test_backup_update_and_rollback_never_replace_local_stores(self):
        result=up.update(self.selected,self.generation,closed=True,runner=self.runner)
        self.assertEqual(result['kind'],'data-preserving-update-complete');self.assert_data();up.verify_backup(self.generation/'backup')
        selected=up.discover(self.home);self.assertEqual(selected['history'],str(self.history))
        db=sqlite3.connect(selected['history']);db.execute('INSERT INTO preserved VALUES ("NEW_V2_HISTORY")');db.commit();db.close()
        rollback=up.rollback(self.generation,closed=True);self.assertTrue(rollback['newHistoryPreserved'])
        self.assertEqual(up.digest(self.entry),self.originals[str(self.entry)])
        db=sqlite3.connect(selected['history']);self.assertEqual(db.execute('SELECT count(*) FROM preserved').fetchone()[0],2);db.close()
        self.assertEqual(up.discover(self.home)['history'],str(self.history))

    def test_second_update_and_rollback_keep_the_active_native_storage(self):
        up.update(self.selected,self.generation,closed=True,runner=self.runner)
        next_selection=up.discover(self.home);self.assertEqual(next_selection['history'],str(self.history))
        second=self.root/'generation2'
        up.update(next_selection,second,closed=True,runner=self.runner);self.assertEqual(up.discover(self.home)['history'],str(self.history))
        up.rollback(second,closed=True);self.assertEqual(up.discover(self.home)['history'],next_selection['history']);self.assert_data()

    def test_missing_confirmation_open_store_or_background_owner_refuses_before_data_capture(self):
        with self.assertRaisesRegex(ValueError,'clients-closed'):up.update(self.selected,self.generation,runner=self.runner)
        with patch.object(up,'users',return_value=[123]):
            with self.assertRaisesRegex(ValueError,'still in use'):up.update(self.selected,self.generation,closed=True,runner=self.runner)
        marker=self.home/'.opencode/.opencode-background-addon.json';marker.write_text('{"mode":"managed-local-install"}')
        with self.assertRaisesRegex(ValueError,'Conflicting runtime ownership'):up.update(self.selected,self.generation,closed=True,runner=self.runner)
        self.assertFalse(self.generation.exists());self.assert_data()

    def test_missing_v2_store_is_never_initialized_by_update(self):
        self.history.unlink()
        with self.assertRaisesRegex(ValueError,'Published V2 history missing'):up.discover(self.home)
        self.assertFalse(self.history.exists())

    def test_base_updates_do_not_select_or_back_up_addon_data(self):
        settings=json.loads(self.settings.read_text());settings['profile']='base';self.settings.write_text(json.dumps(settings))
        selected=up.discover(self.home);self.assertNotIn('engram',selected)
        up.update(selected,self.generation,closed=True,runner=self.runner)
        backup=up.verify_backup(self.generation/'backup');self.assertNotIn('engram',backup);self.assertNotIn('qdrant',backup)
        self.assertEqual(up.discover(self.home)['history'],str(self.history))

    def test_refuses_a_builder_that_switches_the_active_store(self):
        def unexpected(argv,**kwargs):
            result=json.loads(self.runner(argv,**kwargs));result['storageRoot']=str(self.generation/'production-storage');return json.dumps(result)
        with self.assertRaisesRegex(ValueError,'Complete native stage not verified'):
            up.update(self.selected,self.generation,closed=True,runner=unexpected)
        self.assert_data();self.assertEqual(up.digest(self.entry),self.originals[str(self.entry)])

    def test_stage_failure_retains_verified_backups_and_original_command(self):
        def fail(*args,**kwargs):raise ValueError('SYNTHETIC_NATIVE_FAILURE')
        with self.assertRaisesRegex(ValueError,'SYNTHETIC'):up.update(self.selected,self.generation,closed=True,runner=fail)
        self.assert_data();self.assertEqual(up.digest(self.entry),self.originals[str(self.entry)]);up.verify_backup(self.generation/'backup')
        self.assertEqual(up.read(self.generation/'failure.json')['phase'],'native-stage')
        with self.assertRaisesRegex(ValueError,'Previous attempt'):up.update(self.selected,self.generation,closed=True,runner=self.runner)

    def test_checksum_failure_and_unknown_entry_drift_prevent_rollback(self):
        up.update(self.selected,self.generation,closed=True,runner=self.runner)
        self.entry.write_text('USER_REPLACEMENT')
        with self.assertRaisesRegex(ValueError,'Unknown entry'):up.rollback(self.generation,closed=True)
        self.assertEqual(self.entry.read_text(),'USER_REPLACEMENT')
        (self.generation/'backup/qdrant/segments').write_text('CORRUPTED_BACKUP')
        with self.assertRaisesRegex(ValueError,'checksum'):up.verify_backup(self.generation/'backup')

    def test_corpus_lock_symlinks_and_ambiguous_memory_are_not_ignored(self):
        with up.corpus_lock(self.corpus):
            with self.assertRaisesRegex(ValueError,'in use'):
                with up.corpus_lock(self.corpus):pass
        (self.corpus/'unsafe').symlink_to(self.history)
        with self.assertRaisesRegex(ValueError,'Symlink'):up.capture(self.selected,self.root/'bad-backup')
        other=self.home/'.local/share/engram/engram.db';other.parent.mkdir(parents=True);shutil.copyfile(self.memory,other)
        with self.assertRaisesRegex(ValueError,'ambiguous'):up.discover(self.home)

    def test_installer_lease_and_marker_drift_are_not_adopted(self):
        with up.install_lease(self.home):
            with self.assertRaises(FileExistsError):
                with up.install_lease(self.home):pass
        up.update(self.selected,self.generation,closed=True,runner=self.runner);self.entry.write_text('FOREIGN_ENTRY')
        with self.assertRaisesRegex(ValueError,'marker/active'):up.discover(self.home)

    def test_remote_lock_rejects_unpinned_or_untrusted_repositories(self):
        lock=self.root/'source-lock.json';required=['opencode-stack']+['super-turing-opencode-'+x for x in ['knowledge','ticketing','codegraph','documents','notifier']]
        data={'schemaVersion':1,'nativeVersion':'2.2.7','repositories':[{'directory':x,'repository':'juanma91m/'+('super-turing-opencode' if x=='opencode-stack' else x),'commit':'a'*40} for x in required]}
        lock.write_text(json.dumps(data));self.assertEqual(len(up.lock_manifest(lock)['repositories']),6)
        data['repositories'][0]['commit']='main';lock.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError,'Unreviewed'):up.lock_manifest(lock)

    def test_snapshots_are_verified_and_reserved_without_copying_auth_files(self):
        snapshots=self.history.parent/'snapshot';snapshots.mkdir();(snapshots/'fixture').write_text('SYNTHETIC_SNAPSHOT')
        (self.history.parent/'auth.json').write_text('SYNTHETIC_AUTH_NOT_TO_COPY')
        selected=up.discover(self.home);backup=self.root/'snapshot-backup';up.capture(selected,backup);up.verify_backup(backup)
        self.assertEqual((backup/'opencode/snapshot/fixture').read_text(),'SYNTHETIC_SNAPSHOT')
        self.assertFalse((backup/'opencode/auth.json').exists())
        (backup/'opencode/snapshot/fixture').write_text('CORRUPTED')
        with self.assertRaisesRegex(ValueError,'snapshot/repository'):up.verify_backup(backup)

    def test_marker_publication_failure_recovers_previous_entry_even_after_complete_receipt(self):
        original=up.atomic
        def fail_marker(file,*args,**kwargs):
            if file.name=='current.json':raise OSError('SYNTHETIC_MARKER_FAILURE')
            return original(file,*args,**kwargs)
        with patch.object(up,'atomic',side_effect=fail_marker):
            with self.assertRaises(OSError):up.update(self.selected,self.generation,closed=True,runner=self.runner)
        self.assertEqual(up.digest(self.entry),self.originals[str(self.entry)]);self.assert_data()
        self.assertEqual(up.discover(self.home)['history'],str(self.history))


if __name__=='__main__':unittest.main()
