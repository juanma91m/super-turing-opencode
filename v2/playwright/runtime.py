#!/usr/bin/env python3
"""Run the canonical router with an existing pinned CLI and isolated pilot outputs."""
import json
import os
from pathlib import Path
import sys

DESKTOP = ('DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_SESSION_TYPE', 'XAUTHORITY')


def validate(binding):
    if set(binding) != {'home', 'cli', 'browser', 'version', 'output_dir'}:
        raise ValueError('Unexpected browser binding fields')
    if binding['version'] != '0.0.85': raise ValueError('Unreviewed MCP version')
    for key in ('home', 'cli', 'browser', 'output_dir'):
        if not isinstance(binding[key], str) or not Path(binding[key]).is_absolute():
            raise ValueError('Absolute paths required')
    cli = Path(binding['cli'])
    if cli.name != 'cli.js' or not cli.is_file() or not cli.resolve().is_relative_to((Path(binding['home']) / '.npm/_npx').resolve()):
        raise ValueError('Existing cached CLI required')
    data = json.loads((cli.parent / 'package.json').read_text())
    if data.get('name') != '@playwright/mcp' or data.get('version') != binding['version']:
        raise ValueError('Cached MCP drift; do not download a replacement')
    if not Path(binding['browser']).is_file() or not os.access(binding['browser'], os.X_OK):
        raise ValueError('Existing executable browser required')
    return binding


def runtime_env(binding, parent):
    validate(binding)
    # Never reuse a Chrome profile, CDP endpoint, cookies, storage state, proxy
    # credentials or arbitrary PLAYWRIGHT/NODE/PYTHON overrides from the host.
    env = {key: parent[key] for key in ('LANG', 'TERM', 'TMPDIR', 'TMP', 'TEMP', *DESKTOP) if key in parent}
    env.update(PATH='/usr/local/bin:/usr/bin:/bin', HOME=binding['home'],
               PLAYWRIGHT_MCP_CLI=binding['cli'], PLAYWRIGHT_MCP_EXECUTABLE_PATH=binding['browser'],
               PLAYWRIGHT_MCP_OUTPUT_DIR=binding['output_dir'], PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1')
    return env


if __name__ == '__main__':
    try:
        if sys.argv[1:]: raise ValueError('No browser CLI overrides accepted')
        scripts = Path(__file__).resolve().parent
        binding = validate(json.loads((scripts / 'playwright-runtime.json').read_text()))
        os.execve('/usr/bin/python3', ['/usr/bin/python3', str(scripts / 'playwright_mode_router.py')], runtime_env(binding, os.environ))
    except (ValueError, KeyError, TypeError, OSError):
        print('Playwright runtime unavailable; values suppressed; no install/profile reuse attempted', file=sys.stderr)
        raise SystemExit(2)
