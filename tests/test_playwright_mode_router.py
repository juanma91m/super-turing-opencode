import importlib.util
import os
import pathlib
import unittest
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).parents[1] / "scripts" / "playwright_mode_router.py"
SPEC = importlib.util.spec_from_file_location("playwright_mode_router", MODULE_PATH)
assert SPEC and SPEC.loader
ROUTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ROUTER)


class PlaywrightModeRouterTest(unittest.TestCase):
    def command_for(self, mode):
        upstream = ROUTER.PlaywrightUpstream()
        upstream.mode = mode
        environment = {
            "PLAYWRIGHT_MCP_PACKAGE": "@playwright/mcp@test",
            "PLAYWRIGHT_MCP_EXECUTABLE_PATH": "/tmp/chromium",
        }
        with mock.patch.dict(os.environ, environment, clear=False), mock.patch.object(
            ROUTER.shutil, "which", return_value="/usr/bin/npx"
        ):
            return upstream._command()

    def test_headless_mode_adds_headless_flag(self):
        command = self.command_for("headless")
        self.assertIn("--headless", command)
        self.assertIn("--isolated", command)
        self.assertIn("--output-dir", command)

    def test_visible_mode_omits_headless_flag(self):
        command = self.command_for("visible")
        self.assertNotIn("--headless", command)
        self.assertIn("--isolated", command)

    def test_mode_tool_only_accepts_known_modes(self):
        definition = ROUTER.mode_tool_definition()
        self.assertEqual(definition["name"], "browser_set_mode")
        self.assertEqual(
            definition["inputSchema"]["properties"]["mode"]["enum"],
            ["headless", "visible"],
        )


if __name__ == "__main__":
    unittest.main()
