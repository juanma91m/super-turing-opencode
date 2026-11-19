import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location('activation',Path(__file__).parents[1]/'cutover-activate.py')
activation=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(activation)


class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.scratch=tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR','/tmp/opencode'));self.addCleanup(self.scratch.cleanup)
        self.root=Path(self.scratch.name);self.home=self.root/'home';self.install=self.home/'.opencode'
        self.historic=self.home/'.local/state/opencode-addons/opencode-background-tasks/backups/old'
        for directory in [self.install,self.historic]:
            (directory/'bin').mkdir(parents=True)
            for name in ['opencode','engram','semgrep']:
                file=directory/'bin'/name;file.write_text(('CURRENT' if directory==self.install else 'OLD')+name);file.chmod(0o755)
        (self.install/'bin/opencode-managed-runtime').write_text('CURRENT_RUNTIME')
        marker={'mode':'managed-local-install','backupPath':str(self.historic),'checkoutVersion':'1.19.4'}
        (self.install/'.opencode-background-addon.json').write_text(json.dumps(marker))
        self.state=self.historic.parent.parent/'state.json';self.state.write_text(json.dumps({'mode':'managed-local-install','managedLocalInstall':marker,'plugins':[],'assets':[]}))
        (self.historic/'package.json').write_text('{"name":"PUBLIC_FIXTURE"}')
        (self.historic/'node_modules/example').mkdir(parents=True);(self.historic/'node_modules/example/index.js').write_text('PUBLIC_FIXTURE')
        (self.historic/'node_modules/.bin').mkdir();(self.historic/'node_modules/.bin/example').symlink_to('../example/index.js')
        self.prepared=self.root/'prepared';activation.backup.prepare_install(self.home,self.prepared)
        self.aune=self.root/'aune';self.background=self.root/'background';self.node=self.root/'node'
        for file in [self.aune/'v2/production.mjs',self.aune/'v2/production-check.mjs',self.background/'scripts/restore-local-install.mjs',self.node]:
            file.parent.mkdir(parents=True,exist_ok=True);file.write_text('PUBLIC_FIXTURE');file.chmod(0o755)
        self.run=self.root/'run';self.production=self.run/'production-storage'
        for path in [self.production/'data/opencode',self.production/'state',self.run/'evidence',self.root/'original',self.root/'pilot']:
            path.mkdir(parents=True,mode=0o700,exist_ok=True)
        self.original=self.root/'original/opencode.db';self.pilot=self.root/'pilot/opencode.db';self.target=self.production/'data/opencode/opencode.db'
        for file in [self.original,self.pilot,self.target]:
            db=sqlite3.connect(file);db.execute('CREATE TABLE fixture(value TEXT)');db.execute('INSERT INTO fixture VALUES ("SYNTHETIC")');db.commit();db.close();file.chmod(0o600)
        self.original_hash=activation.backup.digest(self.original)
        self.spec={'runRoot':str(self.run),'originalDB':str(self.original),'pilotDB':str(self.pilot)}
        settings={'managedContract':activation.CONTRACT,'coreRoot':str(Path(__file__).parents[3]),'storageRoot':str(self.production),'products':['demo']}
        activation.backup.write_json(self.prepared/'production-entry.prepared.json',settings)
        activation.backup.write_json(self.prepared/'final-storage.prepared.json',{'synthetic':True})
        activation.backup.write_json(self.run/'evidence/native-transfer.json',{'kind':'final-native-storage-transfer','nativeTransferVerified':True,'migrationCompleted':True})
        self.patches=[patch.object(activation.storage,'spec_read',return_value=self.spec),patch.object(activation.storage,'verify_sources',side_effect=self.sources),patch.object(activation,'hold_profiles',return_value=lambda:None)]
        for mock in self.patches:mock.start();self.addCleanup(mock.stop)
        self.calls=[];self.fail_live=False;self.fail_after_install=False
        self.plan=activation.prepare_plan(self.prepared,self.aune,self.background,self.node,runner=self.runner)

    def sources(self,_spec):
        self.assertEqual(activation.backup.digest(self.original),self.original_hash)

    def runner(self,command,cwd,budget=600):
        command=list(map(str,command));self.calls.append(command)
        if command[-1]=='rollback-plan':return json.dumps({'kind':'managed-project-rollback','deployments':{'demo':'a'*64}}).encode()
        if 'restore-local-install.mjs' in command[1]:
            shutil.rmtree(self.install);shutil.move(self.historic,self.install);self.state.unlink();return b'PUBLIC_LIFECYCLE_RESULT'
        if command[-1]=='live' and self.fail_live:
            raise activation.ChildRefused(json.dumps({'kind':'managed-production-verification','status':'not-ready','reports':[{'ready':True,'readyForChat':False,'providerConnected':False}]}).encode())
        if command[-1]=='check' and self.fail_after_install and (Path(self.plan['configRoot'])/'settings.json').exists():raise RuntimeError('SYNTHETIC_POST_INSTALL_FAILURE')
        if command[-1]=='--version':return b'opencode v2.2.7\n'
        return b'{"kind":"SYNTHETIC_METADATA_ONLY"}'

    def test_replace_preserves_requested_mode_under_private_umask(self):
        entry = self.install / 'bin/opencode'
        previous = os.umask(0o077)
        try:
            activation.replace(entry, activation.wrapper_bytes(self.plan), 0o755)
        finally:
            os.umask(previous)
        self.assertEqual(entry.stat().st_mode & 0o777, 0o755)

    def test_complete_activation_retains_sources_auxiliaries_and_native_prefix(self):
        result=activation.activate(self.plan,confirmed=True,runner=self.runner)
        self.assertEqual(result['phase'],'installed-and-verified');self.assertFalse(result['originalRewritten'])
        self.assertEqual((self.install/'bin/engram').read_text(),'CURRENTengram')
        self.assertFalse((self.install/'node_modules').exists());self.assertFalse((self.install/'package.json').exists())
        self.assertTrue((self.prepared/'restored-historical-runtime/node_modules/.bin/example').is_symlink())
        self.assertTrue((self.prepared/'managed-cutover-postimages/postimages.json').exists())
        self.assertIn('"$@"',(self.install/'bin/opencode').read_text())
        self.assertNotIn('--session',(self.install/'bin/opencode').read_text())
        self.assertEqual((Path(self.plan['configRoot'])/'settings.json').stat().st_mode&0o777,0o600)
        self.assertEqual(activation.backup.digest(self.original),self.original_hash)
        count=len(self.calls);self.assertEqual(activation.activate(self.plan,confirmed=True,runner=self.runner)['kind'],'managed-v2-already-active');self.assertEqual(len(self.calls),count)

    def test_missing_confirmation_or_live_source_does_not_mutate_installation(self):
        with self.assertRaisesRegex(ValueError,'closure'):activation.activate(self.plan,runner=self.runner)
        with patch.object(activation.storage,'users_of',return_value=[{'pid':123}]):
            with self.assertRaisesRegex(ValueError,'still open'):activation.activate(self.plan,confirmed=True,runner=self.runner)
        self.assertEqual((self.install/'bin/opencode').read_text(),'CURRENTopencode');self.assertFalse((self.prepared/'activation-started.json').exists())

    def test_live_failure_keeps_v1_and_requires_explicit_continue_without_new_backup(self):
        self.fail_live=True
        with self.assertRaisesRegex(RuntimeError,'managed-live-preflight'):activation.activate(self.plan,confirmed=True,runner=self.runner)
        self.assertEqual((self.install/'bin/opencode').read_text(),'CURRENTopencode');self.assertTrue(self.historic.exists());self.assertTrue(self.state.exists())
        self.assertTrue(list(self.prepared.glob('verification-observation-*.json')))
        with self.assertRaisesRegex(ValueError,'Interrupted'):activation.activate(self.plan,confirmed=True,runner=self.runner)
        self.fail_live=False
        self.assertEqual(activation.activate(self.plan,confirmed=True,resume=True,runner=self.runner)['phase'],'installed-and-verified')
        self.assertEqual(sum('restore-local-install.mjs' in cmd[1] for cmd in self.calls if len(cmd)>1),1)

    def test_post_install_failure_can_restore_v1_and_preserves_new_production_data(self):
        self.fail_after_install=True
        with self.assertRaisesRegex(RuntimeError,'installed-check'):activation.activate(self.plan,confirmed=True,runner=self.runner)
        self.assertEqual((self.install/'bin/opencode').read_text(),'CURRENTopencode')
        self.assertTrue((self.prepared/'activation-installation-restored.json').exists())
        result=activation.restore(self.plan,confirmed=True,runner=self.runner)
        self.assertTrue(result['productionDataPreserved']);self.assertFalse(result['databaseRestored'])
        self.assertEqual((self.install/'bin/opencode').read_text(),'CURRENTopencode');self.assertEqual((self.install/'bin/engram').read_text(),'CURRENTengram')
        self.assertTrue(self.historic.exists());self.assertTrue(self.state.exists());self.assertTrue(self.target.exists())
        self.assertEqual(len(list(self.prepared.glob('rollback-production-*/opencode.db'))),1)
        self.assertTrue(any('rollback' in command for command in self.calls))

    def test_unknown_restored_npm_is_never_moved_or_adopted(self):
        shutil.rmtree(self.install);shutil.move(self.historic,self.install)
        (self.install/'node_modules/UNKNOWN').write_text('USER_CHANGE')
        with self.assertRaisesRegex(ValueError,'Unknown'):activation.retire_restored_npm(self.plan)
        self.assertTrue((self.install/'node_modules/UNKNOWN').exists());self.assertFalse((self.prepared/'restored-historical-runtime').exists())

    def test_foreign_postimage_and_overlapping_activation_lease_refused(self):
        with activation.lease(self.plan):
            with self.assertRaises(FileExistsError):
                with activation.lease(self.plan):pass
        self.assertFalse((self.prepared/'.managed-cutover.lock').exists())
        (self.install/'bin/engram').write_text('UNKNOWN_CHANGED_BINARY')
        with self.assertRaisesRegex(ValueError,'Unknown installation'):activation.known_postimages(self.plan)

    def test_normal_source_group_mode_is_preserved_but_writable_binary_refused(self):
        source=self.aune/'v2/production.mjs';source.chmod(0o664)
        activation.validate(self.plan);self.assertEqual(source.stat().st_mode&0o777,0o664)
        self.node.chmod(0o775)
        with self.assertRaisesRegex(ValueError,'Unsafe executable'):activation.validate(self.plan)

    def test_failed_install_never_rolls_back_over_unknown_user_drift(self):
        def foreign_change(command,cwd,budget=600):
            if command[-1]=='check' and (Path(self.plan['configRoot'])/'settings.json').exists():
                (self.install/'bin/engram').write_text('FOREIGN_CHANGE')
                raise RuntimeError('SYNTHETIC_FOREIGN_WRITER')
            return self.runner(command,cwd,budget)
        with self.assertRaisesRegex(RuntimeError,'installed-check'):activation.activate(self.plan,confirmed=True,runner=foreign_change)
        self.assertEqual((self.install/'bin/engram').read_text(),'FOREIGN_CHANGE')
        failures=[json.loads(file.read_text()) for file in self.prepared.glob('activation-failure-*.json')]
        self.assertFalse(failures[-1]['installationReturnedToPreCutover'])
        self.assertEqual(activation.backup.digest(self.original),self.original_hash)

    def test_rollback_after_success_deactivates_only_owned_entry_and_preserves_history(self):
        activation.activate(self.plan,confirmed=True,runner=self.runner)
        config=Path(self.plan['configRoot']);self.assertTrue((config/'active.json').exists())
        result=activation.restore(self.plan,confirmed=True,runner=self.runner)
        self.assertTrue(result['productionDataPreserved']);self.assertFalse((config/'active.json').exists())
        self.assertTrue(list(config.glob('inactive-*.json')));self.assertTrue(self.target.exists())
        self.assertEqual((self.install/'bin/opencode').read_text(),'CURRENTopencode')


if __name__=='__main__':unittest.main()
