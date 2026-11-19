import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('managed_playwright', ROOT / 'v2/playwright/managed_runtime.py')
managed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(managed)
def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'v2/playwright' / file)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result
selector = module('selected_playwright', 'selected-runtime.py')
dispatcher = module('managed_dispatcher', 'managed_dispatcher.py')


class ManagedRuntimeTests(unittest.TestCase):
    def fixture(self):
        temporary = tempfile.TemporaryDirectory(prefix='playwright-managed-', dir='/tmp/opencode')
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        home = root / 'home'
        modules = home / '.npm/_npx/fixture/node_modules'
        package = modules / '@playwright/mcp'
        core = modules / 'playwright-core'
        package.mkdir(parents=True); core.mkdir()
        (package / 'package.json').write_text(json.dumps({'name': '@playwright/mcp', 'version': managed.VERSION}))
        (package / 'cli.js').write_text('console.log("synthetic MCP");\n')
        (core / 'package.json').write_text(json.dumps({'name': 'playwright-core', 'version': managed.CORE_VERSION}))
        (modules / '.bin').mkdir()
        (modules / '.bin/mcp').symlink_to(package / 'cli.js')
        browser = home / '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome'
        browser.parent.mkdir(parents=True)
        browser.write_text('#!/bin/sh\nexit 0\n'); browser.chmod(0o755)
        selected = {'home': str(home), 'cli': str(package / 'cli.js'), 'browser': str(browser), 'version': managed.VERSION}
        return root, modules, browser, selected, root / ('playwright-mcp-' + managed.VERSION)

    def test_offline_copy_rebases_links_and_survives_source_cache_removal(self):
        root, modules, browser, selected, target = self.fixture()
        plan = managed.source_plan(selected)
        self.assertGreater(plan['bytes'], 0); self.assertFalse(target.exists())
        before = (modules / '@playwright/mcp/cli.js').read_bytes()
        result = managed.prepare(target, selected)
        self.assertTrue(result['changed'])
        self.assertEqual((modules / '@playwright/mcp/cli.js').read_bytes(), before)
        self.assertTrue((target / 'node_modules/.bin/mcp').resolve().is_relative_to(target))
        shutil.rmtree(modules.parent)
        shutil.rmtree(browser.parent.parent)
        status = managed.status(target)
        self.assertTrue(Path(status['cli']).is_file()); self.assertTrue(Path(status['browser']).is_file())
        self.assertFalse(managed.prepare(target, selected)['changed'])
        managed.remove(target)
        self.assertFalse(target.exists()); self.assertTrue(root.exists())

    def test_private_files_symlink_escape_and_pin_drift_fail_before_target_creation(self):
        _, modules, _, selected, target = self.fixture()
        private = modules / '.env.production'; private.write_text('SYNTHETIC_SECRET_MUST_NOT_COPY')
        with self.assertRaisesRegex(ValueError, 'Private'):
            managed.prepare(target, selected)
        self.assertFalse(target.exists()); private.unlink()
        (modules / 'escape').symlink_to('/etc/passwd')
        with self.assertRaisesRegex(ValueError, 'escapes'):
            managed.prepare(target, selected)
        self.assertFalse(target.exists()); (modules / 'escape').unlink()
        (modules / '@playwright/mcp/package.json').write_text('{"name":"@playwright/mcp","version":"unapproved"}')
        with self.assertRaisesRegex(ValueError, 'pin drift'):
            managed.prepare(target, selected)
        self.assertFalse(target.exists())

    def test_existing_unknown_or_drifted_tree_is_not_adopted_repaired_or_removed(self):
        _, _, _, selected, target = self.fixture()
        target.mkdir(); (target / 'user.txt').write_text('Do not delete')
        with self.assertRaisesRegex(ValueError, 'unowned'):
            managed.prepare(target, selected)
        self.assertTrue((target / 'user.txt').exists())
        shutil.rmtree(target); managed.prepare(target, selected)
        file = target / 'node_modules/@playwright/mcp/cli.js'; file.write_text('Drift')
        for operation in (lambda: managed.status(target), lambda: managed.prepare(target, selected), lambda: managed.remove(target)):
            with self.assertRaisesRegex(ValueError, 'drift'):
                operation()
        self.assertTrue(file.exists())

    def test_invalid_destinations_and_profile_sources_are_refused(self):
        _, _, _, selected, target = self.fixture()
        with self.assertRaises(ValueError):
            managed.prepare(target.with_name('unversioned'), selected)
        source = {**selected, 'browser': str(Path(selected['home']) / '.config/chrome/Default/chrome')}
        with self.assertRaises(ValueError):
            managed.source_plan(source)

    def test_selector_and_dispatcher_use_owned_copy_after_original_caches_disappear(self):
        root, modules, browser, selected, target = self.fixture()
        config = root / 'config'; (config / 'scripts').mkdir(parents=True); (config / 'agents').mkdir()
        router = config / 'scripts/playwright_mode_router.py'
        shutil.copyfile(ROOT / 'scripts/playwright_mode_router.py', router)
        (config / 'opencode.json').write_text(json.dumps({'mcp': {'playwright': {'type': 'local', 'enabled': True, 'command': ['python3', str(router)], 'environment': {'PLAYWRIGHT_MCP_EXECUTABLE_PATH': str(browser)}}}, 'tools': {'playwright_*': False}}))
        for role in selector.ROLES:
            (config / 'agents' / (role + '.md')).write_text('---\ntools:\n  playwright_*: true\n---\nSynthetic role\n')
        managed.prepare(target, selected)
        shutil.rmtree(modules.parent); shutil.rmtree(browser.parent.parent)
        with patch.dict(sys.modules, {'managed_runtime': managed}):
            chosen = selector.select(selected['home'], config, parent={}, managed_root=target)
            self.assertEqual(chosen['managed_root'], str(target))
            binding = {key: chosen[key] for key in ('home', 'cli', 'browser', 'version', 'managed_root')}
            binding['output_dir'] = str(root / 'output')
            env = dispatcher.environment(binding, {'DISPLAY': ':7', 'OPENCODE_PASSWORD': 'SYNTHETIC', 'NODE_OPTIONS': 'MUST_NOT_FORWARD'})
            self.assertEqual(env['DISPLAY'], ':7'); self.assertEqual(env['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'], '1')
            self.assertNotIn('OPENCODE_PASSWORD', env); self.assertNotIn('NODE_OPTIONS', env)
            self.assertTrue(Path(env['PLAYWRIGHT_MCP_CLI']).is_relative_to(target))
            with self.assertRaises(ValueError):
                selector.select(selected['home'], config, parent={'PLAYWRIGHT_MCP_STORAGE_STATE': 'PRIVATE'}, managed_root=target)
            with self.assertRaises(ValueError):
                dispatcher.environment({**binding, 'browser': '/unreviewed/chrome'}, {})
            (target / 'node_modules/@playwright/mcp/cli.js').write_text('Unknown drift')
            with self.assertRaises(ValueError):
                dispatcher.environment(binding, {})

    def test_existing_snapshot_does_not_silently_adopt_a_different_selection(self):
        _, _, _, selected, target = self.fixture()
        managed.prepare(target, selected)
        with self.assertRaisesRegex(ValueError, 'selection differs'):
            managed.prepare(target, {**selected, 'home': '/another-identity'})

    def test_cli_requires_confirmation_and_rejects_inherited_profile_override_before_config_read(self):
        cli = ROOT / 'migrations/v2/playwright-runtime.mjs'
        for arguments, env in [(['prepare'], {}), (['remove', '--client-closed'], {}), (['plan'], {'PLAYWRIGHT_MCP_CDP_ENDPOINT': 'SYNTHETIC_PRIVATE_MARKER'})]:
            result = subprocess.run(['/usr/bin/node', str(cli), *arguments], env={'PATH': '/usr/bin:/bin', 'HOME': '/tmp/opencode/not-an-installed-home', **env}, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn('SYNTHETIC_PRIVATE_MARKER', result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
