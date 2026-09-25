import importlib.util
import io
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

    def test_request_relays_upstream_request_and_client_response(self):
        upstream = ROUTER.PlaywrightUpstream()
        browser_request = {
            "jsonrpc": "2.0",
            "id": 0,
            "method": "roots/list",
        }
        browser_response = {
            "jsonrpc": "2.0",
            "id": 7,
            "result": {"content": []},
        }
        client_response = {
            "jsonrpc": "2.0",
            "id": 0,
            "result": {"roots": []},
        }
        client_request = {
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {
                "name": "browser_navigate",
                "arguments": {"url": "https://example.test"},
            },
        }

        with (
            mock.patch.object(upstream, "send") as send,
            mock.patch.object(
                upstream,
                "receive",
                side_effect=[browser_request, browser_response],
            ),
            mock.patch.object(ROUTER, "emit") as emit,
            mock.patch.object(
                ROUTER.sys,
                "stdin",
                io.StringIO(f"{ROUTER.json.dumps(client_response)}\n"),
            ),
        ):
            result = upstream.request(client_request)

        self.assertEqual(result, browser_response)
        self.assertEqual(
            send.call_args_list,
            [mock.call(client_request), mock.call(client_response)],
        )
        emit.assert_called_once_with(browser_request)


if __name__ == "__main__":
    unittest.main()
