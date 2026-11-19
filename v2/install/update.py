#!/usr/bin/env python3
"""Data-preserving, fail-closed update from a published source lock (Linux).

Never updates canonical working trees, restores a database over a newer database,
copies authentication, kills clients, deletes locks, or executes a V1 asset installer.
Unknown legacy layouts fail before changing the active command.
"""
import argparse
from contextlib import closing, contextmanager
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import shlex
import signal
import shutil
import sqlite3
import stat
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
PIN = '589253d36810f21217edd51545cd435b328cdc3cf4f451fbe0cce6f88afcf5e1'


def physical(file):
    file = Path(file)
    if not file.is_absolute() or str(file) != os.path.normpath(file):
        raise ValueError('Canonical absolute path required')
    for current in [*reversed(file.parents), file]:
        if current.is_symlink():
            raise ValueError('Symlinked managed path requires explicit review')
    return file


def digest(file):
    result = hashlib.sha256()
    with Path(file).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def fingerprint(file):
    result = {'database': digest(file)}
    wal = Path(str(file) + '-wal')
    if wal.exists() and wal.stat().st_size:
        result['wal'] = digest(wal)
    return result


def read(file):
    physical(file)
    if file.stat().st_size > 4 * 1024**2:
        raise ValueError('Bounded metadata required')
    return json.loads(file.read_text())


def write(file, value):
    physical(file.parent)
    with open(file, 'x', opener=lambda p, flags: os.open(p, flags, 0o600)) as stream:
        json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())


def atomic(file, data, mode):
    physical(file.parent)
    temporary = file.with_name(file.name + '.' + uuid.uuid4().hex + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(fd, 'wb') as stream:
        os.fchmod(stream.fileno(), mode); stream.write(data); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, file)
    fd = os.open(file.parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)


def run(argv, *, cwd, env=None, budget=600):
    # Commands and their dependencies are explicit published code. No raw native
    # config/auth/HTTP response is emitted or written into a public transcript.
    child = subprocess.Popen(list(map(str, argv)), cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    try: out, err = child.communicate(timeout=budget)
    except subprocess.TimeoutExpired:
        try: os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        try: child.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            child.communicate()
        raise ValueError('Owned updater command exceeded its budget; stage retained') from None
    if child.returncode or len(out) + len(err) > 16 * 1024**2:
        raise ValueError('Updater dependency command failed; raw output suppressed, previous entry retained')
    return out.decode().strip()


def lock_manifest(file):
    data = read(file)
    if data.get('schemaVersion') != 1 or data.get('nativeVersion') != '2.2.7' or not isinstance(data.get('repositories'), list):
        raise ValueError('Published V2 source lock required')
    seen = set()
    for row in data['repositories']:
        if (set(row) != {'directory', 'repository', 'commit'} or not re.fullmatch(r'[a-z][a-z0-9-]+', row['directory'])
            or row['directory'] in seen or not re.fullmatch(r'juanma91m/super-turing-opencode(?:-[a-z0-9-]+)?', row['repository'])
            or not (re.fullmatch(r'[a-f0-9]{40}', row['commit']) or row['directory']=='opencode-stack' and row['commit']=='self')):
            raise ValueError('Unreviewed repository/commit in source lock')
        seen.add(row['directory'])
    required = {'opencode-stack', *('super-turing-opencode-' + name for name in ['knowledge','ticketing','codegraph','documents','notifier'])}
    if not required.issubset(seen): raise ValueError('Incomplete portable source lock')
    adapter = data.get('ownerAdapter')
    if adapter is not None and (not isinstance(adapter, dict) or set(adapter) != {'directory','module'}
        or adapter['directory'] not in seen or adapter['module'] != 'v2/upgrade.mjs'):
        raise ValueError('Invalid optional owner adapter')
    return data


def sources(file, destination, runner=run, *, github_account=None, home=None):
    """Clone exact commits into a fresh generation; never pull/reset user repos."""
    lock = lock_manifest(file)
    lock = json.loads(json.dumps(lock))
    for row in lock['repositories']:
        if row['commit']=='self':
            if runner(['git','status','--porcelain','--untracked-files=no'],cwd=ROOT): raise ValueError('Core updater tracked checkout is dirty; publish/review it first')
            row['commit']=runner(['git','rev-parse','HEAD'],cwd=ROOT)
            if not re.fullmatch(r'[a-f0-9]{40}',row['commit']): raise ValueError('Core updater commit is not pinned')
    physical(destination)
    if destination.exists(): raise ValueError('Fresh source-generation directory required')
    destination.mkdir(mode=0o700)
    env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GIT_CONFIG_NOSYSTEM': '1'}
    if home is not None: env['HOME']=str(home)
    credential_options=[]
    if github_account is not None:
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}',github_account):raise ValueError('Explicit GitHub account name required, never a token')
        helper=destination/'.git-askpass'
        content=('#!/bin/sh\nexec '+shlex.join([sys.executable,'-I','-B',str(ROOT/'v2/install/git-askpass.py')])+' "$@"\n').encode()
        atomic(helper,content,0o700)
        env.update(GIT_ASKPASS=str(helper),OPENCODE_UPDATE_GITHUB_ACCOUNT=github_account)
        credential_options=['-c','credential.helper=']
    for row in lock['repositories']:
        target = destination / row['directory']
        runner(['git', 'init', '--quiet', target], cwd=destination, env=env)
        runner(['git', '-C', target, 'remote', 'add', 'origin', 'https://github.com/' + row['repository'] + '.git'], cwd=destination, env=env)
        runner(['git', *credential_options, '-C', target, 'fetch', '--depth=1', 'origin', row['commit']], cwd=destination, env=env)
        runner(['git', '-C', target, 'checkout', '--detach', '--quiet', row['commit']], cwd=destination, env=env)
        if runner(['git', '-C', target, 'rev-parse', 'HEAD'], cwd=destination, env=env) != row['commit']:
            raise ValueError('Downloaded source identity mismatch')
    write(destination / 'source-lock.json', lock)
    return lock


def users(paths):
    wanted = [str(physical(path)) for path in paths]
    found = set()
    for process in Path('/proc').iterdir():
        if not process.name.isdigit(): continue
        try:
            if process.stat().st_uid != os.getuid(): continue
            for fd in (process / 'fd').iterdir():
                try: target = os.readlink(fd).removesuffix(' (deleted)')
                except (FileNotFoundError, PermissionError): continue
                if any(target == p or target.startswith(p + '/') or target in [p + '-wal', p + '-shm'] for p in wanted):
                    found.add(int(process.name))
        except (FileNotFoundError, ProcessLookupError, PermissionError): continue
    return sorted(found)


def sqlite_copy(source, target):
    physical(source); physical(target.parent)
    if target.exists(): raise ValueError('Backup destination must be new')
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600); os.close(fd)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=30)) as origin:
        with closing(sqlite3.connect(target)) as copy:
            origin.backup(copy)
            if copy.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise ValueError('SQLite backup failed integrity verification')
            if copy.execute('PRAGMA foreign_key_check').fetchone() is not None:
                raise ValueError('SQLite backup has foreign-key violations')
    return {'source': str(source), 'backup': str(target), 'sha256': digest(target), 'integrity': 'ok'}


def inventory(root):
    """Private data stays private; only hashes/relative names enter its local receipt."""
    physical(root); result = {}
    for folder, directories, files in os.walk(root):
        for name in directories + files:
            path = Path(folder) / name
            if name.startswith('.env') or name in ['auth.json','credentials.json'] or path.suffix in ['.pem','.key','.p12','.pfx']:
                raise ValueError('Private file in corpus directory; review instead of copying it blindly')
            if path.is_symlink(): raise ValueError('Symlink in data tree; no blind backup')
            if path.is_file() and path != root / '.lock':
                result[path.relative_to(root).as_posix()] = digest(path)
    return result


@contextmanager
def corpus_lock(root):
    file = root / '.lock'; physical(file)
    fd = os.open(file, os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    except BlockingIOError:
        raise ValueError('Corpus is in use; never remove its lock') from None
    finally: os.close(fd)


def discover(home, *, engram=None, qdrant=None, history=None):
    physical(home)
    config = home / '.config/opencode'
    updater_marker = home / '.local/state/opencode-stack/install/current.json'
    previous_update = read(updater_marker) if updater_marker.exists() else None
    current_file = config / 'production-v2/settings.json'
    if previous_update:
        if previous_update.get('kind') != 'opencode-stack-managed-generation':
            raise ValueError('Unknown installer ownership marker')
        current_file = physical(Path(previous_update['generation'])) / 'settings.json'
        active_entry = home / '.opencode/bin/opencode'
        if digest(active_entry) != previous_update.get('entrySHA256'):
            raise ValueError('Installer marker/active command differ; no old-history fallback')
    current = read(current_file) if current_file.exists() else None
    if current is not None:
        allowed = {'schemaVersion','owner','nativeVersion','managedContract','coreRoot','stagingRoot','foundation','generalRoot','generalRevision','privateRoot','privateRevision','workspace','storageRoot','products','auneRoot','ownerEntry'}
        if set(current) - allowed: raise ValueError('Unreviewed production settings fields; no configuration copied')
        if current.get('nativeVersion') != '2.2.7' or current.get('managedContract') != 'managed-harness-v1':
            raise ValueError('Unknown active V2 contract; no automatic downgrade')
        selected = physical(Path(current['storageRoot']))
        default = selected / 'data/opencode/opencode.db'
    else:
        default = home / '.local/share/opencode/opencode.db'
    if current and history is not None and Path(history) != default:
        raise ValueError('An active V2 generation cannot be updated from an older history override')
    history = physical(Path(history) if history else default)
    if not history.is_file():
        # Old file-per-session storage must first pass the official native
        # conversion path. Do not initialize an empty DB and hide old sessions.
        raise ValueError('Existing SQLite history not found; file-based/unknown legacy history requires official conversion before this updater')
    choices = [p for p in [home / '.engram/engram.db', home / '.local/share/engram/engram.db'] if p.is_file()]
    if engram is None and len(choices) != 1:
        raise ValueError('Engram DB selection is absent/ambiguous; provide --engram-db, never create a replacement')
    engram = physical(Path(engram) if engram else choices[0])
    qdrant = physical(Path(qdrant) if qdrant else home / '.local/share/super-turing-opencode-knowledge/qdrant')
    if not engram.is_file() or not qdrant.is_dir(): raise ValueError('Existing Knowledge data required; nothing is reset or initialized')
    entry = home / '.opencode/bin/opencode'; physical(entry.parent)
    if not entry.exists() or entry.is_symlink(): raise ValueError('Regular existing user entry required; alternate installations require explicit integration')
    assets = {name: str(physical(history.parent / name)) for name in ['snapshot', 'repos'] if (history.parent / name).exists()}
    return {'home': str(home), 'history': str(history), 'historyAssets': assets, 'engram': str(engram), 'qdrant': str(qdrant),
            'entry': str(entry), 'previousSettings': current, 'previousUpdate': previous_update, 'config': str(config)}


def owner_rollback(root, runner=run):
    spec_file = root / 'build-spec.json'
    if not spec_file.exists() or not (root / 'owner-applied.json').exists(): return
    spec = read(spec_file)
    if not spec.get('ownerAdapter'): raise ValueError('Owner journal has no owner binding')
    node = shutil.which('node')
    runner([node, root / 'sources/opencode-stack/v2/install/owner-rollback.mjs', spec_file], cwd=root)


def capture(selection, root):
    paths = [Path(selection[key]) for key in ['history', 'engram', 'qdrant']]
    if users(paths): raise ValueError('OpenCode/Engram/corpus still in use; close clients and sync timers, no process is stopped automatically')
    physical(root)
    if root.exists(): raise ValueError('Fresh private backup directory required')
    root.mkdir(mode=0o700)
    reports = {}
    for name, source in zip(['opencode', 'engram'], paths[:2]):
        directory = root / name; directory.mkdir(mode=0o700)
        reports[name] = sqlite_copy(source, directory / source.name)
    with corpus_lock(paths[2]):
        if users(paths[:2]): raise ValueError('Client reopened during backup; copies retained')
        before = inventory(paths[2])
        shutil.copytree(paths[2], root / 'qdrant', ignore=lambda directory, names: ['.lock'] if Path(directory) == paths[2] else [])
        copied = inventory(root / 'qdrant')
        if before != copied or inventory(paths[2]) != before: raise ValueError('Corpus changed during capture; backup not approved')
    reports['qdrant'] = {'source': str(paths[2]), 'backup': str(root / 'qdrant'), 'files': len(before), 'hashes': before}
    reports['historyAssets'] = {}
    for name, source in selection.get('historyAssets', {}).items():
        if name not in ['snapshot', 'repos']: raise ValueError('Unreviewed OpenCode data directory')
        source = physical(Path(source)); before = inventory(source)
        target = root / 'opencode' / name
        shutil.copytree(source, target)
        if inventory(target) != before or inventory(source) != before:
            raise ValueError('OpenCode snapshot/repository data changed during capture')
        reports['historyAssets'][name] = {'source': str(source), 'backup': str(target), 'hashes': before}
    entry = Path(selection['entry']); entry_image = {'sha256': digest(entry), 'mode': stat.S_IMODE(entry.stat().st_mode)}
    shutil.copyfile(entry, root / 'previous-entry'); (root / 'previous-entry').chmod(0o600)
    reports['entry'] = {'source': str(entry), **entry_image}
    write(root / 'backup.json', reports)
    return reports


def verify_backup(root):
    receipt = read(root / 'backup.json')
    for key in ['opencode', 'engram']:
        if digest(physical(Path(receipt[key]['backup']))) != receipt[key]['sha256']:
            raise ValueError('Backup checksum mismatch')
    if inventory(root / 'qdrant') != receipt['qdrant']['hashes']:
        raise ValueError('Corpus backup checksum mismatch')
    if digest(root / 'previous-entry') != receipt['entry']['sha256']:
        raise ValueError('Entry backup checksum mismatch')
    for name, record in receipt.get('historyAssets', {}).items():
        if name not in ['snapshot', 'repos'] or inventory(root / 'opencode' / name) != record['hashes']:
            raise ValueError('OpenCode snapshot/repository backup checksum mismatch')
    return receipt


def tree_bytes(root):
    return sum(p.stat().st_size for p in root.rglob('*') if p.is_file() and not p.is_symlink())


def update(selection, destination, *, closed=False, source_lock=None, github_account=None, runner=run):
    if not closed: raise ValueError('Explicit --clients-closed required; an updater is not permission to kill clients')
    if users([Path(selection[k]) for k in ['history', 'engram', 'qdrant']]):
        raise ValueError('Affected stores still in use; no update started')
    if (Path(selection['home']) / '.opencode/.opencode-background-addon.json').exists():
        marker = read(Path(selection['home']) / '.opencode/.opencode-background-addon.json')
        if marker.get('mode') == 'managed-local-install':
            raise ValueError('Background-owned legacy runtime requires its sealed cutover lifecycle before this updater; no blind takeover')
    physical(destination)
    if destination.exists(): raise ValueError('Previous attempt retained; use a new generation or inspect its journal')
    parent = destination.parent
    parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    required = 3 * Path(selection['history']).stat().st_size + Path(selection['engram']).stat().st_size + tree_bytes(Path(selection['qdrant'])) + 2 * sum(tree_bytes(Path(p)) for p in selection.get('historyAssets', {}).values()) + 4 * 1024**3
    if shutil.disk_usage(parent).free < required: raise ValueError('Insufficient backup/staging reserve; choose --destination on a larger durable volume')
    destination.mkdir(mode=0o700)
    phase = 'backup'
    write(destination / 'selection.json', selection)
    write(destination / 'started.json', {'kind': 'data-preserving-update', 'time': time.time(), 'phase': phase})
    try:
        print('[stack-update] Capturing verified OpenCode, Engram and corpus backups.', file=sys.stderr, flush=True)
        originals = {key: fingerprint(Path(selection[key])) for key in ['history', 'engram']}
        capture(selection, destination / 'backup'); verify_backup(destination / 'backup')
        if any(fingerprint(Path(selection[key])) != originals[key] for key in originals):
            raise ValueError('Source changed during snapshot; no update approved')
        write(destination / 'source-fingerprints.json', originals)
        phase = 'sources'
        if source_lock is None: source_lock = ROOT / 'v2/install/source-lock.json'
        source_record = sources(source_lock, destination / 'sources', runner, github_account=github_account,home=selection['home'])
        core = destination / 'sources/opencode-stack'
        node = shutil.which('node')
        if node is None: raise ValueError('Node 22.22.2+ is required; no system runtime replaced')
        spec = {'selection': selection, 'root': str(destination), 'sourceRoot': str(destination / 'sources'),
                'ownerAdapter': source_record.get('ownerAdapter')}
        write(destination / 'build-spec.json', spec)
        phase = 'native-stage'
        print('[stack-update] Preparing complete native profile and migrating a COPY of history.', file=sys.stderr, flush=True)
        raw = runner([node, core / 'v2/install/build.mjs', destination / 'build-spec.json'], cwd=core, budget=4200)
        result = json.loads(raw)
        if result.get('kind') != 'native-update-staged' or not result.get('ready') or result.get('nativeVersion') != '2.2.7':
            raise ValueError('Complete native stage not verified; previous command remains active')
        if not isinstance(result.get('entry'), str) or Path(result['entry']) != destination / 'entry.mjs':
            raise ValueError('Staged entry escaped generation')
        physical(Path(result['entry']))
        phase = 'publish'
        # The existing profile, auth/config, state, corpus and Engram DB are NOT
        # overwritten. The adapter must finish all setup before this single rename.
        if users([Path(selection[k]) for k in ['history', 'engram', 'qdrant']]): raise ValueError('Stores reopened; publication refused')
        backup = verify_backup(destination / 'backup')
        marker_file = Path(selection['home']) / '.local/state/opencode-stack/install/current.json'
        observed_marker = read(marker_file) if marker_file.exists() else None
        if observed_marker != selection.get('previousUpdate'): raise ValueError('Another installer changed the active generation')
        entry = Path(selection['entry'])
        if digest(entry) != backup['entry']['sha256'] or stat.S_IMODE(entry.stat().st_mode) != backup['entry']['mode']:
            raise ValueError('Active entry advanced; no overwrite')
        for key in ['history', 'engram']:
            # Closed sources must remain byte-identical; schema migration ran in
            # the new store. Never merge later source edits silently.
            original = Path(selection[key])
            if fingerprint(original) != originals[key]:
                raise ValueError('Source changed during native staging')
        for record in backup.get('historyAssets', {}).values():
            if inventory(Path(record['source'])) != record['hashes']:
                raise ValueError('OpenCode snapshots changed during native staging')
        wrapper = ('#!/bin/sh\nexec ' + shlex.quote(node) + ' ' + shlex.quote(result['entry']) + ' "$@"\n').encode()
        write(destination / 'publication.json', {'entrySHA256': hashlib.sha256(wrapper).hexdigest(), 'previousSHA256': backup['entry']['sha256']})
        marker_file.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        atomic(entry, wrapper, 0o755)
        write(destination / 'complete.json', {'kind': 'data-preserving-update-complete', 'version': '2.2.7',
              'entry': str(entry), 'sourceStoresReplaced': False, 'originalConfigurationReplaced': False,
              'engramReplaced': False, 'qdrantReplaced': False, 'nativeStage': result})
        atomic(marker_file, (json.dumps({'kind':'opencode-stack-managed-generation','generation':str(destination),'entrySHA256':hashlib.sha256(wrapper).hexdigest()})+'\n').encode(), 0o600)
        return {'kind': 'data-preserving-update-complete', 'generation': str(destination), 'version': '2.2.7',
                'sourceStoresReplaced': False, 'needsLogin': result.get('needsLogin', False)}
    except BaseException as error:
        recovered = False
        try:
            published = read(marker_file) if phase == 'publish' and marker_file.exists() else None
            committed = published is not None and published.get('generation') == str(destination)
            if phase == 'publish' and (destination / 'publication.json').exists() and not committed:
                entry = Path(selection['entry'])
                if digest(entry) == read(destination / 'publication.json')['entrySHA256']:
                    before = verify_backup(destination / 'backup')
                    atomic(entry, (destination / 'backup/previous-entry').read_bytes(), before['entry']['mode'])
            if not committed:
                owner_rollback(destination, runner); recovered = True
        except (ValueError, OSError, subprocess.SubprocessError):
            pass
        write(destination / 'failure.json', {'kind': 'update-stopped', 'phase': phase, 'errorType': type(error).__name__,
              'automaticRetry': False, 'sourceStoresReplaced': False, 'knownUncommittedOwnerChangesReverted': recovered})
        raise


def rollback(generation, *, closed=False, runner=run):
    selection = read(generation / 'selection.json')
    if not closed: raise ValueError('Close old/new clients before rollback')
    state = read(generation / 'complete.json'); stage = state['nativeStage']
    paths = [Path(selection[k]) for k in ['history','engram','qdrant']] + [Path(stage['storageRoot'])]
    if users(paths): raise ValueError('Stores still open; no forced rollback')
    before = verify_backup(generation / 'backup'); entry = Path(selection['entry'])
    expected = read(generation / 'publication.json')['entrySHA256']
    if digest(entry) != expected: raise ValueError('Unknown entry drift; not overwritten')
    marker_file = Path(selection['home']) / '.local/state/opencode-stack/install/current.json'
    marker = read(marker_file) if marker_file.exists() else None
    if marker is not None and marker.get('generation') != str(generation) and marker != selection.get('previousUpdate'):
        raise ValueError('Another update owns the current marker; no rollback')
    # Rollback changes only the entry. New V2 conversations remain in the new
    # store and are NOT written over the old DB. No automatic deletion or pruning.
    owner_rollback(generation, runner)
    atomic(entry, (generation / 'backup/previous-entry').read_bytes(), before['entry']['mode'])
    if marker is not None and marker.get('generation') == str(generation):
        if selection.get('previousUpdate'):
            atomic(marker_file, (json.dumps(selection['previousUpdate'])+'\n').encode(), 0o600)
        else:
            # Preserve the retired metadata instead of pruning installation history.
            os.replace(marker_file, marker_file.with_name('retired-'+uuid.uuid4().hex+'.json'))
    write(generation / 'rolled-back.json', {'kind': 'entry-rollback', 'newHistoryPreserved': True, 'databasesRestored': False})
    return {'kind': 'entry-rollback', 'newHistoryPreserved': True, 'databasesRestored': False}


@contextmanager
def install_lease(home):
    directory = physical(home / '.local/state/opencode-stack/install')
    directory.mkdir(parents=True, mode=0o700, exist_ok=True)
    file = directory / 'update.lock'
    fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    before = os.fstat(fd)
    try:
        os.write(fd, json.dumps({'pid':os.getpid(),'owner':'opencode-stack-updater'}).encode()); os.fsync(fd)
        yield
    finally:
        current = file.lstat()
        if current.st_ino != before.st_ino or current.st_dev != before.st_dev or file.is_symlink():
            os.close(fd); raise ValueError('Installer lease replaced; unknown file retained')
        file.unlink(); os.close(fd)


def record_diagnostic_attempt(directory, record):
    if directory is None: return
    try:
        write(directory / 'attempt.json', record)
    except (OSError, ValueError):
        print('[stack-update] Could not save the optional attempt receipt; keep the generation journal. Installation result is unchanged.', file=sys.stderr)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan','update','verify-backup','rollback'])
    parser.add_argument('--home', type=Path, default=Path(pwd.getpwuid(os.getuid()).pw_dir))
    parser.add_argument('--history-db', type=Path); parser.add_argument('--engram-db', type=Path)
    parser.add_argument('--qdrant-dir', type=Path); parser.add_argument('--destination', type=Path)
    parser.add_argument('--source-lock', type=Path); parser.add_argument('--clients-closed', action='store_true')
    parser.add_argument('--github-account', help='Explicit local gh account for private Git fetch; no account switch or token file')
    args = parser.parse_args()
    diagnostic_directory = None
    generation = None
    try:
        if args.action == 'update':
            sys.dont_write_bytecode = True
            spec = importlib.util.spec_from_file_location('notebook_preflight', ROOT / 'v2/install/notebook-preflight.py')
            diagnostic = importlib.util.module_from_spec(spec); spec.loader.exec_module(diagnostic)
            inventory = diagnostic.inspect(args.home, history=args.history_db)
            diagnostic_directory = diagnostic.save_report(args.home, inventory)
            print('[stack-update] Diagnóstico y continuación local: ' + str(diagnostic_directory / 'NEXT-STEPS.md'), file=sys.stderr, flush=True)
            if inventory['earlyBlockers']:
                raise ValueError('Notebook preflight blocked: ' + ', '.join(inventory['earlyBlockers']) + '; follow the local NEXT-STEPS.md')
        if args.action == 'verify-backup':
            if args.destination is None: raise ValueError('--destination generation required')
            verify_backup(args.destination / 'backup'); result = {'kind':'backup-verified','writesPerformed':0}
        elif args.action == 'rollback':
            if args.destination is None: raise ValueError('--destination generation required')
            with install_lease(args.home): result = rollback(args.destination, closed=args.clients_closed)
        else:
            selected = discover(args.home, history=args.history_db, engram=args.engram_db, qdrant=args.qdrant_dir)
            if args.action == 'plan':
                result = {'kind':'safe-update-preflight','selectedPaths':{k:selected[k] for k in ['home','history','engram','qdrant','entry']},'hasPreviousV2':selected['previousSettings'] is not None,'sourceUsers':users([Path(selected[k]) for k in ['history','engram','qdrant']]),'writesPerformed':0,
                          'limitation':'Known SQLite/native2.2.7 layouts and existing qualified addon runtimes only. Unknown legacy config is refused, never normalized.'}
            else:
                root = args.destination or args.home / '.local/share/opencode-stack/updates' / (time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + uuid.uuid4().hex[:8])
                generation = root
                with install_lease(args.home): result = update(selected, root, closed=args.clients_closed, source_lock=args.source_lock,github_account=args.github_account)
        record_diagnostic_attempt(diagnostic_directory, {'kind':'update-attempt','status':'complete','generation':result.get('generation'),'sourceStoresReplaced':False})
        print(json.dumps(result))
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        destination = generation or args.destination
        record_diagnostic_attempt(diagnostic_directory, {'kind':'update-attempt','status':'stopped','errorType':type(error).__name__,'generation':str(destination) if destination else None,'automaticRetry':False})
        parser.exit(1, 'Stack update refused/stopped: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__) + '. Keep all generations/backups; no automatic cleanup.\n')


if __name__ == '__main__': main()
