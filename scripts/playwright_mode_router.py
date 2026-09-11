#!/usr/bin/env python3

"""Expose one Playwright MCP whose browser mode can be selected at runtime."""

from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
from typing import Any


MODE_TOOL = "browser_set_mode"
VALID_MODES = {"headless", "visible"}


def emit(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def tool_result(request_id: Any, text: str, *, is_error: bool = False) -> None:
    emit(
        {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "content": [{"type": "text", "text": text}],
                "isError": is_error,
            },
        }
    )


class PlaywrightUpstream:
    def __init__(self) -> None:
        self.mode = "headless"
        self.process: subprocess.Popen[str] | None = None
        self.initialize_params: dict[str, Any] | None = None

    def _command(self) -> list[str]:
        npx = shutil.which("npx")
        if not npx:
            raise RuntimeError("npx no está disponible para iniciar @playwright/mcp")

        package = os.environ.get("PLAYWRIGHT_MCP_PACKAGE", "@playwright/mcp@latest")
        command = [npx, "-y", package, "--isolated"]
        if self.mode == "headless":
            command.append("--headless")

        output_dir = os.path.expanduser(
            os.environ.get(
                "PLAYWRIGHT_MCP_OUTPUT_DIR",
                "~/.cache/opencode/playwright-mcp",
            )
        )
        command.extend(["--output-dir", output_dir])

        executable = os.environ.get("PLAYWRIGHT_MCP_EXECUTABLE_PATH", "")
        if executable:
            command.extend(["--executable-path", executable])
        return command

    def start(self) -> None:
        if self.process and self.process.poll() is None:
            return
        self.process = subprocess.Popen(
            self._command(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            text=True,
            bufsize=1,
            start_new_session=True,
        )

    def stop(self) -> None:
        process = self.process
        self.process = None
        if not process or process.poll() is not None:
            return
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=5)

    def send(self, message: dict[str, Any]) -> None:
        self.start()
        assert self.process and self.process.stdin
        self.process.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
        self.process.stdin.flush()

    def receive(self) -> dict[str, Any]:
        assert self.process and self.process.stdout
        line = self.process.stdout.readline()
        if not line:
            code = self.process.poll()
            raise RuntimeError(f"@playwright/mcp cerró la conexión (exit={code})")
        return json.loads(line)

    def request(self, message: dict[str, Any]) -> dict[str, Any]:
        self.send(message)
        request_id = message.get("id")
        while True:
            response = self.receive()
            if response.get("id") == request_id:
                return response
            emit(response)

    def initialize(self, params: dict[str, Any]) -> dict[str, Any]:
        self.initialize_params = params
        response = self.request(
            {
                "jsonrpc": "2.0",
                "id": "playwright-mode-router-initialize",
                "method": "initialize",
                "params": params,
            }
        )
        if "error" in response:
            raise RuntimeError(str(response["error"]))
        self.send(
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            }
        )
        return response["result"]

    def switch_mode(self, mode: str) -> bool:
        if mode == self.mode:
            return False
        if mode == "visible" and not (
            os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
        ):
            raise RuntimeError(
                "No hay DISPLAY ni WAYLAND_DISPLAY; el navegador visible no puede abrirse"
            )
        if self.initialize_params is None:
            raise RuntimeError("El MCP todavía no fue inicializado")

        self.stop()
        self.mode = mode
        try:
            self.start()
            self.initialize(self.initialize_params)
        except Exception:
            self.stop()
            self.mode = "headless"
            self.start()
            self.initialize(self.initialize_params)
            raise
        return True


def mode_tool_definition() -> dict[str, Any]:
    return {
        "name": MODE_TOOL,
        "description": (
            "Select Playwright browser mode before starting a browser workflow. "
            "Changing mode closes the current browser and loses its isolated session."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["headless", "visible"],
                    "description": "Browser mode for subsequent Playwright actions.",
                }
            },
            "required": ["mode"],
            "additionalProperties": False,
        },
    }


def main() -> int:
    upstream = PlaywrightUpstream()
    try:
        for line in sys.stdin:
            if not line.strip():
                continue
            message = json.loads(line)
            method = message.get("method")

            if method == "initialize":
                try:
                    result = upstream.initialize(message.get("params", {}))
                    emit({"jsonrpc": "2.0", "id": message.get("id"), "result": result})
                except Exception as exc:
                    emit(
                        {
                            "jsonrpc": "2.0",
                            "id": message.get("id"),
                            "error": {"code": -32000, "message": str(exc)},
                        }
                    )
                continue

            if method == "notifications/initialized":
                continue

            if method == "tools/list":
                response = upstream.request(message)
                tools = response.get("result", {}).get("tools")
                if isinstance(tools, list) and not any(
                    tool.get("name") == MODE_TOOL for tool in tools
                ):
                    tools.append(mode_tool_definition())
                emit(response)
                continue

            if method == "tools/call" and message.get("params", {}).get("name") == MODE_TOOL:
                mode = message.get("params", {}).get("arguments", {}).get("mode")
                if mode not in VALID_MODES:
                    tool_result(
                        message.get("id"),
                        "mode debe ser 'headless' o 'visible'",
                        is_error=True,
                    )
                    continue
                try:
                    changed = upstream.switch_mode(mode)
                    state = "cambiado" if changed else "ya estaba seleccionado"
                    tool_result(
                        message.get("id"),
                        f"Modo Playwright {mode}: {state}. Las próximas acciones usarán este modo.",
                    )
                except Exception as exc:
                    tool_result(message.get("id"), str(exc), is_error=True)
                continue

            if "id" in message:
                emit(upstream.request(message))
            else:
                upstream.send(message)
    except (BrokenPipeError, KeyboardInterrupt):
        return 0
    except Exception as exc:
        sys.stderr.write(f"playwright-mode-router: {exc}\n")
        return 1
    finally:
        upstream.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
