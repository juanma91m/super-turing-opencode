#!/usr/bin/env python3
"""General-candidate dispatcher; old workshop cache dispatcher stays untouched."""
import json
import os
from pathlib import Path
import sys
sys.dont_write_bytecode = True


def environment(binding, parent):
    if 'managed_root' not in binding:
        from playwright_cache_runtime import runtime_env
        return runtime_env(binding, parent)
    from managed_runtime import status
    if set(binding) != {'home', 'cli', 'browser', 'version', 'output_dir', 'managed_root'}:
        raise ValueError('Unexpected managed browser binding')
    selected = status(binding['managed_root'])
    if any(binding[key] != selected[key] for key in ('home', 'cli', 'browser', 'version')) or not Path(binding['output_dir']).is_absolute():
        raise ValueError('Managed browser binding differs from verified runtime')
    desktop = ('DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_SESSION_TYPE', 'XAUTHORITY')
    env = {key: parent[key] for key in ('LANG', 'TERM', 'TMPDIR', 'TMP', 'TEMP', *desktop) if key in parent}
    env.update(PATH='/usr/local/bin:/usr/bin:/bin', HOME=binding['home'], PLAYWRIGHT_MCP_CLI=binding['cli'], PLAYWRIGHT_MCP_EXECUTABLE_PATH=binding['browser'],
               PLAYWRIGHT_MCP_OUTPUT_DIR=binding['output_dir'], PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1')
    return env


if __name__ == '__main__':
    try:
        if sys.argv[1:]:
            raise ValueError('No browser overrides accepted')
        scripts = Path(__file__).resolve().parent
        binding = json.loads((scripts / 'playwright-runtime.json').read_text())
        env = environment(binding, os.environ)
        os.execve('/usr/bin/python3', ['/usr/bin/python3', str(scripts / 'playwright_mode_router.py')], env)
    except Exception:
        print('General browser runtime unavailable; values suppressed; no download or profile reuse', file=sys.stderr)
        raise SystemExit(2)
