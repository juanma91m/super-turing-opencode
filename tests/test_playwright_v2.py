import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PlaywrightV2Test(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.config = self.home / '.config/opencode'
        (self.config / 'scripts').mkdir(parents=True)
        (self.config / 'agents').mkdir()
        self.selector = load('browser_selector', ROOT / 'v2/playwright/selected-runtime.py')
        self.runtime = load('browser_runtime', ROOT / 'v2/playwright/runtime.py')
        self.router = load('browser_router', ROOT / 'scripts/playwright_mode_router.py')
        self.browser = self.home / 'browser'
        self.browser.write_text('#!/bin/sh\nexit 99\n'); self.browser.chmod(0o700)
        self.cli = self.home / '.npm/_npx/fixture/node_modules/@playwright/mcp/cli.js'
        self.cli.parent.mkdir(parents=True)
        self.cli.write_text('// Fixture only; must not be executed\n')
        (self.cli.parent / 'package.json').write_text(json.dumps({'name': '@playwright/mcp', 'version': '0.0.85'}))
        (self.config / 'scripts/playwright_mode_router.py').write_bytes((ROOT / 'scripts/playwright_mode_router.py').read_bytes())
        for role in self.selector.ROLES:
            (self.config / 'agents' / (role + '.md')).write_text('---\ntools:\n  "playwright_*": true\npermission:\n  edit: deny\n---\nFixture\n')
        self.source = {'mcp': {'playwright': {'type': 'local', 'command': ['python3', str(self.config / 'scripts/playwright_mode_router.py')], 'enabled': True, 'environment': {'PLAYWRIGHT_MCP_EXECUTABLE_PATH': str(self.browser)}}, 'other': {'headers': {'Authorization': 'FIXTURE_NOT_FOR_OUTPUT'}}}, 'tools': {'playwright_*': False}}
        self.save()

    def save(self):
        (self.config / 'opencode.json').write_text(json.dumps(self.source))

    def binding(self):
        selected = self.selector.select(str(self.home), str(self.config))
        selected.pop('roles')
        selected['output_dir'] = str(self.home / 'outputs')
        return selected

    def test_selection_uses_only_existing_non_secret_wiring_and_does_not_open_browser(self):
        selected = self.selector.select(str(self.home), str(self.config))
        self.assertEqual(selected['version'], '0.0.85')
        self.assertEqual(selected['cli'], str(self.cli))
        self.assertEqual(len(selected['roles']), 5)
        self.assertNotIn('FIXTURE_NOT_FOR_OUTPUT', json.dumps(selected))
        self.assertFalse((self.home / 'outputs').exists())

    def test_selection_rejects_credentials_role_drift_router_drift_and_missing_cache(self):
        original = json.loads(json.dumps(self.source))
        self.source['mcp']['playwright']['environment']['PLAYWRIGHT_MCP_STORAGE_STATE'] = 'FIXTURE_NOT_FOR_OUTPUT'
        self.save()
        with self.assertRaises(ValueError): self.selector.select(str(self.home), str(self.config))
        self.source = original; self.save()
        (self.config / 'agents/planner.md').write_text('---\ntools:\n  "playwright_*": false\n---\n')
        with self.assertRaises(ValueError): self.selector.select(str(self.home), str(self.config))
        (self.config / 'agents/planner.md').write_text('---\ntools:\n  "playwright_*": true\n---\n')
        self.cli.unlink()
        with self.assertRaises(ValueError): self.selector.select(str(self.home), str(self.config))

    def test_runtime_strips_credentials_profiles_and_preloads_but_preserves_desktop_transport(self):
        env = self.runtime.runtime_env(self.binding(), {'OPENAI_API_KEY': 'fixture', 'NODE_OPTIONS': '--require fixture', 'PYTHONPATH': 'fixture', 'PLAYWRIGHT_MCP_STORAGE_STATE': 'fixture', 'PLAYWRIGHT_MCP_CDP_ENDPOINT': 'fixture', 'DISPLAY': ':fixture', 'XAUTHORITY': '/fixture/authority'})
        for key in ('OPENAI_API_KEY', 'NODE_OPTIONS', 'PYTHONPATH', 'PLAYWRIGHT_MCP_STORAGE_STATE', 'PLAYWRIGHT_MCP_CDP_ENDPOINT'):
            self.assertNotIn(key, env)
        self.assertEqual(env['DISPLAY'], ':fixture')
        self.assertEqual(env['XAUTHORITY'], '/fixture/authority')
        self.assertEqual(env['PLAYWRIGHT_MCP_CLI'], str(self.cli))

    def test_runtime_refuses_missing_browser_or_changed_version_without_installing(self):
        binding = self.binding()
        with self.assertRaises(ValueError): self.runtime.validate({**binding, 'token': 'fixture'})
        self.browser.unlink()
        with self.assertRaises(ValueError): self.runtime.validate(binding)
        self.assertFalse(self.browser.exists())

    def test_inherited_connection_overrides_and_specific_actor_flags_fail_closed(self):
        with self.assertRaises(ValueError): self.selector.select(str(self.home), str(self.config), {'PLAYWRIGHT_MCP_STORAGE_STATE': 'FIXTURE_NOT_FOR_OUTPUT'})
        with self.assertRaises(ValueError): self.selector.select(str(self.home), str(self.config), {'PLAYWRIGHT_MCP_PACKAGE': '@playwright/mcp@unreviewed'})
        role = self.config / 'agents/planner.md'
        role.write_text(role.read_text().replace('  "playwright_*": true', '  "playwright_*": true\n  playwright_browser_file_upload: false'))
        with self.assertRaises(ValueError): self.selector.select(str(self.home), str(self.config), {})

    def test_same_mode_preserves_browser_and_visible_without_display_does_not_close_it(self):
        upstream = self.router.PlaywrightUpstream(); upstream.initialize_params = {}
        with mock.patch.object(upstream, 'stop') as stop, mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(upstream.switch_mode('headless'))
            with self.assertRaises(RuntimeError): upstream.switch_mode('visible')
            stop.assert_not_called()

    def test_visible_switch_reinitializes_and_fallback_restores_headless(self):
        upstream = self.router.PlaywrightUpstream(); upstream.initialize_params = {'fixture': True}
        with mock.patch.dict(os.environ, {'DISPLAY': ':fixture'}, clear=True), mock.patch.object(upstream, 'stop') as stop, mock.patch.object(upstream, 'start'), mock.patch.object(upstream, 'initialize') as initialize:
            self.assertTrue(upstream.switch_mode('visible')); self.assertEqual(upstream.mode, 'visible')
            stop.assert_called_once(); initialize.assert_called_once_with({'fixture': True})
        upstream.mode = 'headless'
        with mock.patch.dict(os.environ, {'DISPLAY': ':fixture'}, clear=True), mock.patch.object(upstream, 'stop'), mock.patch.object(upstream, 'start', side_effect=[RuntimeError('fixture failure'), None]), mock.patch.object(upstream, 'initialize'):
            with self.assertRaises(RuntimeError): upstream.switch_mode('visible')
            self.assertEqual(upstream.mode, 'headless')


if __name__ == '__main__': unittest.main()
