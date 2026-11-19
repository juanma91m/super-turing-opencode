#!/usr/bin/env python3
"""Select current non-secret Playwright wiring; never open profiles/auth or install."""
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import sys

VERSION = '0.0.85'
ROLES = ['master-dev', 'planner', 'frontend-web-developer', 'ui-web-designer', 'dev-test']
LEGACY_ROUTER = 'e3f3edebd195372a2ba0f879097da7c973dfed1ee0b27fb83b7ac00426182dc6'
ROOT = Path(__file__).resolve().parents[2]


def select(home, config, parent=None, managed_root=None):
    parent = os.environ if parent is None else parent
    home, config = Path(home), Path(config)
    if not home.is_absolute() or not config.is_absolute():
        raise ValueError('Absolute runtime paths required')
    source = json.loads((config / 'opencode.json').read_text())
    server = source.get('mcp', {}).get('playwright')
    router = config / 'scripts/playwright_mode_router.py'
    if not isinstance(server, dict) or set(server) != {'type', 'command', 'enabled', 'environment'} or server.get('type') != 'local' or server.get('enabled') is not True:
        raise ValueError('Unreviewed Playwright server; reconcile explicitly')
    if server['command'] != ['python3', str(router)]:
        raise ValueError('Expected the existing single mode router')
    digest = hashlib.sha256(router.read_bytes()).hexdigest()
    if digest not in (LEGACY_ROUTER, hashlib.sha256((ROOT / 'scripts/playwright_mode_router.py').read_bytes()).hexdigest()):
        raise ValueError('Installed router drift requires review')
    env = server['environment']
    if not isinstance(env, dict) or set(env) - {'PLAYWRIGHT_MCP_EXECUTABLE_PATH', 'PLAYWRIGHT_MCP_PACKAGE'}:
        raise ValueError('Unreviewed Playwright environment; no arbitrary values copied')
    browser = Path(env.get('PLAYWRIGHT_MCP_EXECUTABLE_PATH', ''))
    managed = None
    if managed_root is not None:
        from managed_runtime import status
        if Path(managed_root).exists():
            managed = status(managed_root)
            if managed['source']['home'] != str(home) or managed['source']['browser'] != str(browser):
                raise ValueError('Managed runtime source selection differs; reconcile explicitly')
    if not browser.is_absolute() or not managed and (not browser.is_file() or not os.access(browser, os.X_OK)):
        raise ValueError('Existing browser required; no install attempted')
    if parent.get('PLAYWRIGHT_MCP_CLI') or any(parent.get(key) for key in ('PLAYWRIGHT_MCP_STORAGE_STATE', 'PLAYWRIGHT_MCP_CDP_ENDPOINT', 'PLAYWRIGHT_MCP_CONFIG', 'PLAYWRIGHT_MCP_PROXY_SERVER')):
        raise ValueError('Inherited browser connection/profile overrides require explicit reconciliation')
    package = env.get('PLAYWRIGHT_MCP_PACKAGE', parent.get('PLAYWRIGHT_MCP_PACKAGE', '@playwright/mcp@latest'))
    if package not in ('@playwright/mcp@latest', '@playwright/mcp@' + VERSION):
        raise ValueError('Unreviewed MCP version')
    candidates = []
    if not managed:
        for file in (home / '.npm/_npx').glob('*/node_modules/@playwright/mcp/package.json'):
            data = json.loads(file.read_text())
            if data.get('name') == '@playwright/mcp' and data.get('version') == VERSION and (file.parent / 'cli.js').is_file():
                candidates.append(file.parent / 'cli.js')
    if not managed and len(candidates) != 1:
        raise ValueError('Select one existing reviewed cached MCP; no download attempted')
    if source.get('tools', {}).get('playwright_*') is not False:
        raise ValueError('Expected global browser visibility deny')
    inline = source.get('agent', {})
    for actor, data in inline.items():
        if not isinstance(data, dict) or any(key.startswith('playwright_') for key in data.get('tools', {})):
            raise ValueError('Inline browser overrides require reconciliation')
        overrides = data.get('permission', {})
        if isinstance(overrides, str):
            if actor in ROLES and overrides != 'allow': raise ValueError('Inline browser permissions require reconciliation')
        elif isinstance(overrides, dict):
            if any((key.startswith('playwright_') or fnmatch.fnmatchcase('playwright_browser_navigate', key)) and value != 'allow' for key, value in overrides.items()):
                raise ValueError('Inline browser permissions require reconciliation')
        else:
            raise ValueError('Unsupported inline permissions')
    permissions = source.get('permission', {})
    if isinstance(permissions, str): permissions = {'*': permissions}
    if not isinstance(permissions, dict): raise ValueError('Unsupported permissions')
    for pattern, value in permissions.items():
        if (pattern.startswith('playwright_') or fnmatch.fnmatchcase('playwright_browser_navigate', pattern)) and value != 'allow':
            raise ValueError('Current browser permission overrides require reconciliation')
    actual = []
    for file in (config / 'agents').glob('*.md'):
        text = file.read_text().split('\n---\n', 1)[0]
        # Reject ambiguous/custom matching rules instead of guessing YAML merges.
        matches = re.findall(r'^  ["\']?playwright_\*["\']?:\s*(true|false)\s*$', text, re.M)
        if len(matches) > 1: raise ValueError('Ambiguous browser actor flags')
        if matches == ['true']:
            flags = re.findall(r'^  ["\']?(playwright_[^"\':\s]+)["\']?:\s*(?:true|false)\s*$', text, re.M)
            if any(key != 'playwright_*' for key in flags):
                raise ValueError('Specific actor browser flags require reconciliation')
            if re.search(r'^permission:\s*(?:deny|ask)\s*$', text, re.M) or re.search(r'^  ["\']?(?:playwright_[^\n:]*|\*)["\']?:\s*(?:deny|ask)\s*$', text, re.M):
                raise ValueError('Actor browser denies require reconciliation')
            actual.append(file.stem)
    if sorted(actual) != sorted(ROLES):
        raise ValueError('Installed browser actors differ; no permission normalization')
    return {**managed, 'roles': ROLES} if managed else {'home': str(home), 'cli': str(candidates[0]), 'browser': str(browser), 'version': VERSION, 'roles': ROLES}


if __name__ == '__main__':
    try:
        options = json.load(sys.stdin)
        print(json.dumps(select(options['home'], options['config'], managed_root=options.get('managed_root'))))
    except (ValueError, KeyError, TypeError, OSError):
        print('Playwright selection failed; values suppressed; no browser/install attempted', file=sys.stderr)
        raise SystemExit(2)
