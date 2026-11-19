import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('general_render', Path(__file__).resolve().parents[1] / 'render.py')
render = importlib.util.module_from_spec(spec)
spec.loader.exec_module(render)


class NativeRenderTests(unittest.TestCase):
    def test_maps_preserve_rules_and_native_model_variant(self):
        text = '''---
description: Test role
mode: primary
model: openai/gpt-6.1-sol
variant: high
permission:
  edit: deny
  bash:
    "*": deny
    "git diff*": allow
  task:
    "*": deny
    reviewer: allow
---
Global instructions.
'''
        agent = render.native(text, '/candidate/config')
        self.assertEqual(agent['model'], 'openai/gpt-6.1-sol#high')
        self.assertEqual(agent['permissions'], [
            {'action': 'edit', 'resource': '*', 'effect': 'deny'},
            {'action': 'shell', 'resource': '*', 'effect': 'deny'},
            {'action': 'shell', 'resource': 'git diff*', 'effect': 'allow'},
            {'action': 'subagent', 'resource': '*', 'effect': 'deny'},
            {'action': 'subagent', 'resource': 'reviewer', 'effect': 'allow'},
        ])
        self.assertEqual(agent['system'], 'Global instructions.\n')

    def test_duplicate_fields_or_unknown_yaml_fail_closed(self):
        for header in [
            'permission:\n  edit: deny\n  edit: allow',
            'permission:\n  bash: deny\npermission:\n  edit: allow',
            'permission:\n  - action: edit',
            'permission: &permissions',
            'permission: !!str deny',
            'description: |\n  hidden block',
            'permission:\n    edit: allow',
            'permission:\n\tedit: deny',
        ]:
            with self.subTest(header=header), self.assertRaises((ValueError, TypeError)):
                render.closed_frontmatter(header)

    def test_true_mcp_visibility_never_grants_wildcard_native_execution(self):
        text = '---\ndescription: Test\nmode: primary\ntools:\n  "playwright_*": true\n  "stitch_*": false\npermission:\n  edit: deny\n---\nBody\n'
        agent = render.native(text, '/candidate/config')
        self.assertNotIn({'action': 'playwright_*', 'resource': '*', 'effect': 'allow'}, agent['permissions'])
        self.assertIn({'action': 'stitch_*', 'resource': '*', 'effect': 'deny'}, agent['permissions'])


if __name__ == '__main__':
    unittest.main()
