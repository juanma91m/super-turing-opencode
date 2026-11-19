#!/usr/bin/env python3
"""Offline snapshot of an explicitly selected approved public MCP/browser pair.

No registry requests, profiles, cookies, auth files, installers or source deletion.
Integrity is source/copy/manifest parity, not a new claim of upstream provenance.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import secrets
import sys
import tempfile

VERSION = '0.0.85'
CORE_VERSION = '1.66.0-alpha-2026-11-09'
MARKER = '.playwright-managed.json'
MAX_FILES, MAX_BYTES = 30000, 1536 * 1024 * 1024
PRIVATE_NAMES = {'.npmrc', '.yarnrc', '.git', '.ssh', '.gnupg', 'credentials.json', 'auth.json', 'cookies', 'storage-state.json', 'Crash Reports', 'User Data', 'Default'}


def no_links(path):
    path = Path(path)
    for item in (*reversed(path.parents), path):
        if item.is_symlink():
            raise ValueError('Runtime path symlink refused')


def target_path(value):
    path = Path(value)
    if not path.is_absolute() or '..' in path.parts or path.name != 'playwright-mcp-' + VERSION:
        raise ValueError('Explicit versioned runtime directory required')
    home = Path.home()
    for forbidden in (home / '.config/opencode', home / '.opencode', home / '.local/share/opencode-v2-clean/workshop'):
        if path == forbidden or path.is_relative_to(forbidden):
            raise ValueError('Active configuration/workshop is not a runtime target')
    no_links(path)
    return path


def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def scan(root, *, hardened=False):
    """Never follow symlinks; allow only links wholly inside this public tree."""
    root = Path(root)
    no_links(root)
    records, total = {}, 0
    def walk(directory):
        nonlocal total
        for entry in sorted(directory.iterdir()):
            relative = entry.relative_to(root).as_posix()
            if entry.name in PRIVATE_NAMES or entry.name.startswith('.env') and entry.name != '.env.example' or entry.suffix.lower() in ('.log', '.pem', '.key'):
                raise ValueError('Private/operational file in runtime source; nothing copied')
            info = entry.lstat()
            if hardened and not stat.S_ISLNK(info.st_mode) and info.st_mode & 0o6022:
                raise ValueError('Managed runtime permissions drift')
            if stat.S_ISLNK(info.st_mode):
                destination = entry.resolve(strict=True)
                if not destination.is_relative_to(root.resolve()):
                    raise ValueError('Runtime symlink escapes approved source')
                # Rebase absolute in-tree links so the snapshot never points back
                # into cache. Relative links retain their equivalent semantics.
                records[relative] = {'kind': 'link', 'target': os.path.relpath(destination, entry.parent)}
            elif stat.S_ISDIR(info.st_mode):
                records[relative] = {'kind': 'directory'}
                walk(entry)
            elif stat.S_ISREG(info.st_mode):
                total += info.st_size
                if total > MAX_BYTES:
                    raise ValueError('Runtime size limit exceeded')
                records[relative] = {'kind': 'file', 'bytes': info.st_size, 'sha256': digest(entry), 'mode': 0o755 if info.st_mode & 0o111 else 0o644}
            else:
                raise ValueError('Runtime source must be regular public distribution data')
            if len(records) > MAX_FILES:
                raise ValueError('Runtime file-count limit exceeded')
    walk(root)
    return records, total


def source_plan(selected):
    if selected.get('version') != VERSION:
        raise ValueError('Unreviewed MCP pin')
    home, cli, browser = (Path(selected[key]) for key in ('home', 'cli', 'browser'))
    if not all(path.is_absolute() for path in (home, cli, browser)):
        raise ValueError('Explicit selected source paths required')
    no_links(cli); no_links(browser)
    modules = cli.parents[2]
    if cli.name != 'cli.js' or cli.parent.name != 'mcp' or cli.parent.parent.name != '@playwright' or modules.name != 'node_modules' or not modules.is_relative_to(home / '.npm/_npx'):
        raise ValueError('Expected selected cached public MCP dependency tree')
    package = json.loads((cli.parent / 'package.json').read_text())
    core = json.loads((modules / 'playwright-core/package.json').read_text())
    if package.get('name') != '@playwright/mcp' or package.get('version') != VERSION or core.get('version') != CORE_VERSION:
        raise ValueError('Selected MCP/dependency pin drift')
    distribution = browser.parent
    build = distribution.parent.name
    if not browser.is_file() or not os.access(browser, os.X_OK) or browser.name != 'chrome' or distribution.name not in ('chrome-linux', 'chrome-linux64') or not build.startswith('chromium-') or not distribution.is_relative_to(home / '.cache/ms-playwright'):
        raise ValueError('Expected approved Chromium public executable distribution, not a profile')
    npm, npm_bytes = scan(modules)
    chrome, chrome_bytes = scan(distribution)
    if npm_bytes + chrome_bytes > MAX_BYTES:
        raise ValueError('Combined runtime size limit exceeded')
    entries = {'node_modules/' + key: value for key, value in npm.items()}
    entries.update({'browser/' + key: value for key, value in chrome.items()})
    return {'entries': entries, 'bytes': npm_bytes + chrome_bytes, 'modules': modules, 'distribution': distribution,
            'source': {'home': str(home), 'cli': str(cli), 'browser': str(browser)}, 'browserBuild': build,
            'cliRelative': 'node_modules/@playwright/mcp/cli.js', 'browserRelative': 'browser/chrome'}


def status(root):
    root = target_path(root)
    marker = root / MARKER
    no_links(marker)
    if not marker.is_file():
        raise ValueError('Refusing unowned/incomplete runtime directory')
    data = json.loads(marker.read_text())
    if data.get('owner') != 'opencode-stack' or data.get('kind') != 'public-playwright-runtime' or data.get('schemaVersion') != 1 or data.get('version') != VERSION or data.get('coreVersion') != CORE_VERSION:
        raise ValueError('Unknown managed runtime identity')
    if data.get('cliRelative') != 'node_modules/@playwright/mcp/cli.js' or data.get('browserRelative') != 'browser/chrome':
        raise ValueError('Unreviewed managed runtime entrypoint')
    source = data.get('source')
    if not isinstance(source, dict) or set(source) != {'home', 'cli', 'browser'} or any(not isinstance(value, str) or not Path(value).is_absolute() for value in source.values()):
        raise ValueError('Invalid managed runtime source identity')
    entries = data.get('entries')
    if not isinstance(entries, dict) or not entries or len(entries) > MAX_FILES:
        raise ValueError('Invalid runtime integrity manifest')
    for name in entries:
        path = Path(name)
        if not path.parts or path.as_posix() != name or path.is_absolute() or '..' in path.parts or path.parts[0] not in ('node_modules', 'browser'):
            raise ValueError('Unsafe runtime manifest path')
    npm, _ = scan(root / 'node_modules', hardened=True); chrome, _ = scan(root / 'browser', hardened=True)
    actual = {'node_modules/' + key: value for key, value in npm.items()}
    actual.update({'browser/' + key: value for key, value in chrome.items()})
    if actual != entries or set(path.name for path in root.iterdir()) != {'node_modules', 'browser', MARKER}:
        raise ValueError('Managed runtime integrity drift; no automatic repair/download')
    browser = root / data['browserRelative']
    if not browser.is_file() or not os.access(browser, os.X_OK):
        raise ValueError('Managed executable missing')
    return {'home': data['source']['home'], 'cli': str(root / data['cliRelative']), 'browser': str(browser), 'version': VERSION,
            'managed_root': str(root), 'browserBuild': data['browserBuild'], 'files': len(entries), 'bytes': data['bytes'], 'source': data['source']}


def prepare(root, selected):
    root = target_path(root)
    def existing_status():
        current = status(root)
        identity = selected.get('source', selected)
        if selected.get('version') != VERSION or any(identity.get(key) != current['source'][key] for key in ('home', 'cli', 'browser')):
            raise ValueError('Managed runtime source selection differs; reconcile explicitly')
        return {'changed': False, **current}
    if root.exists():
        return existing_status()
    plan = source_plan(selected)  # Full preflight before directory/file writes.
    if root == plan['modules'] or root.is_relative_to(plan['modules']) or root == plan['distribution'] or root.is_relative_to(plan['distribution']):
        raise ValueError('Runtime cannot be installed into its source cache')
    parent = root.parent
    existing = parent
    while not existing.exists():
        existing = existing.parent
    if shutil.disk_usage(existing).free < plan['bytes'] + 64 * 1024 * 1024:
        raise ValueError('Insufficient space for offline runtime snapshot')
    parent.mkdir(parents=True, exist_ok=True)
    no_links(parent)
    lock = parent / '.playwright-runtime.lock'
    no_links(lock)
    with lock.open('a') as stream:
        lock.chmod(0o600)
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        if root.exists():
            return existing_status()
        temporary = Path(tempfile.mkdtemp(prefix='.playwright-runtime-', dir=parent))
        try:
            for prefix, origin in (('node_modules', plan['modules']), ('browser', plan['distribution'])):
                (temporary / prefix).mkdir(mode=0o755)
                for name, record in plan['entries'].items():
                    relative = Path(name)
                    if relative.parts[0] != prefix:
                        continue
                    destination = temporary / relative
                    if record['kind'] == 'directory':
                        destination.mkdir(parents=True, exist_ok=True, mode=0o755)
                    elif record['kind'] == 'link':
                        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                        destination.symlink_to(record['target'])
                    else:
                        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                        with (origin / Path(*relative.parts[1:])).open('rb') as source, destination.open('xb') as target:
                            shutil.copyfileobj(source, target, 1024 * 1024)
                        destination.chmod(record['mode'])
            # Detect concurrent source mutation and validate copied public data.
            if source_plan(selected)['entries'] != plan['entries']:
                raise ValueError('Source changed during runtime preparation')
            data = {key: plan[key] for key in ('entries', 'bytes', 'source', 'browserBuild', 'cliRelative', 'browserRelative')}
            data.update(owner='opencode-stack', kind='public-playwright-runtime', schemaVersion=1, version=VERSION, coreVersion=CORE_VERSION)
            (temporary / MARKER).write_text(json.dumps(data, sort_keys=True) + '\n')
            (temporary / MARKER).chmod(0o600)
            # status requires the versioned basename; verify equivalent subtrees
            # here before publishing by a single directory rename.
            npm, _ = scan(temporary / 'node_modules', hardened=True); chrome, _ = scan(temporary / 'browser', hardened=True)
            if ({'node_modules/' + key: value for key, value in npm.items()} | {'browser/' + key: value for key, value in chrome.items()}) != plan['entries']:
                raise ValueError('Copied runtime differs from selected source')
            temporary.rename(root)
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
    return {'changed': True, **status(root)}


def remove(root):
    root = target_path(root)
    status(root)
    lock = root.parent / '.playwright-runtime.lock'
    no_links(lock)
    with lock.open('a') as stream:
        lock.chmod(0o600)
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        status(root)  # Refuse unknown/drifted trees; never delete source caches.
        retired = root.with_name('.playwright-retired-' + secrets.token_hex(8))
        root.rename(retired)
        shutil.rmtree(retired)
    return {'removed': True}


if __name__ == '__main__':
    try:
        options = json.load(sys.stdin)
        action = options['action']
        if action == 'plan':
            data = source_plan(options['selected'])
            result = {'version': VERSION, 'coreVersion': CORE_VERSION, 'browserBuild': data['browserBuild'], 'files': len(data['entries']), 'bytes': data['bytes'], 'networkRequests': 0, 'profilesCopied': False}
        elif action == 'prepare':
            result = prepare(options['root'], options['selected'])
        elif action == 'status':
            result = status(options['root'])
        elif action == 'remove' and options.get('clientClosed') is True and options.get('confirm') is True:
            result = remove(options['root'])
        else:
            raise ValueError('Unknown or unconfirmed runtime action')
        # Do not dump manifest or source paths; callers may request the explicit
        # descriptor for native binding without including credentials/content.
        print(json.dumps(result))
    except Exception as error:
        print('Managed Playwright runtime failed: ' + str(error) if isinstance(error, ValueError) else 'Managed Playwright runtime failed; values suppressed', file=sys.stderr)
        raise SystemExit(2)
