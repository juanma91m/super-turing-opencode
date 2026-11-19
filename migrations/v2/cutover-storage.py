"""Final-window storage orchestration, not a migrator or active entry installer.

plan is read-only metadata. prepare/resume/publish require explicit closure gates.
Native work receives only isolated working copies; original/pilot/trial are never
mounted in its namespace. Backup payloads/transcripts never reach stdout.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess

MODULE = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('cutover-backup.py'))
backup = importlib.util.module_from_spec(MODULE); MODULE.loader.exec_module(backup)
OFFICIAL = '589253d36810f21217edd51545cd435b328cdc3cf4f451fbe0cce6f88afcf5e1'


def read(file):
    backup.signature(file)
    if file.stat().st_mode & 0o077 or file.stat().st_size > 1024**2: raise ValueError('Private bounded metadata required')
    return json.loads(file.read_text())


def spec_read(file):
    spec = read(file)
    if set(spec) != {'schemaVersion', 'owner', 'kind', 'originalDB', 'pilotDB', 'runRoot', 'runtime', 'budgetSeconds', 'authTransfer', 'projectRoots'} or spec['schemaVersion'] != 1 or spec['owner'] != 'opencode-stack' or spec['kind'] != 'final-storage-plan':
        raise ValueError('Unexpected explicit final-storage contract')
    for key in ['originalDB', 'pilotDB', 'runRoot', 'runtime']: backup.physical(Path(spec[key]))
    if spec['originalDB'] == spec['pilotDB'] or not 30 <= spec['budgetSeconds'] <= 3600 or spec['authTransfer'] not in ['none', 'native-pipe']:
        raise ValueError('Invalid final-storage selection')
    root = Path(spec['runRoot'])
    for key in ['originalDB', 'pilotDB']:
        source = Path(spec[key]); backup.signature(source)
        if source.name != 'opencode.db' or source.is_relative_to(root) or root.is_relative_to(source.parent): raise ValueError('Separate immutable sources and destination required')
    if backup.digest(Path(spec['runtime'])) != OFFICIAL: raise ValueError('Official2.2.7 runtime pin changed')
    if not isinstance(spec['projectRoots'], list) or len(spec['projectRoots']) > 1000: raise ValueError('Explicit bounded readonly project metadata roots required')
    for directory in spec['projectRoots']: backup.physical(Path(directory))
    return spec


def users_of(databases, *, gaps=None):
    wanted = {str(Path(file)) + suffix for file in databases for suffix in ['', '-wal', '-shm']}; rows = []
    for process in Path('/proc').iterdir():
        if not process.name.isdigit(): continue
        try:
            if process.stat().st_uid != os.getuid(): continue
            for descriptor in (process / 'fd').iterdir():
                try: value = os.readlink(descriptor)
                except FileNotFoundError: continue
                except PermissionError:
                    if gaps is not None: gaps.add(int(process.name))
                    continue
                if value.removesuffix(' (deleted)') in wanted: rows.append({'pid': int(process.name), 'file': value})
        except (FileNotFoundError, ProcessLookupError): continue
        except PermissionError:
            if gaps is not None: gaps.add(int(process.name))
            continue
    return rows


def unchanged(file):
    # Metadata only, including WAL: DB mtime alone misses committed WAL writes.
    result = {}
    for suffix in ['', '-wal', '-shm']:
        current = Path(str(file) + suffix); backup.physical(current)
        if current.exists(): result[suffix] = list(backup.signature(current))
    return result


def capture_fingerprint(file):
    # Opening SQLite read-only with normal locks may create/remove empty WAL/SHM.
    # They are coordination, not committed messages. A nonempty WAL still counts.
    return {key: value for key, value in unchanged(file).items() if key != '-shm' and not (key == '-wal' and value[2] == 0)}


def project_metadata(spec):
    # Expose only explicitly selected read-only Git metadata, not worktrees,
    # configs/plugins/envs. Native Project.resolve must derive the SAME project
    # identity when importing, or ordinary project-scoped session lists lose it.
    mounts = []
    env = {'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_OPTIONAL_LOCKS': '0'}
    for directory in spec['projectRoots']:
        dotgit = backup.physical(Path(directory) / '.git')
        if not dotgit.exists(): raise ValueError('Selected project metadata has no native Git marker')
        mounts.append(str(dotgit))
        for args in [['--absolute-git-dir'], ['--path-format=absolute', '--git-common-dir']]:
            probe = subprocess.run(['/usr/bin/git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'rev-parse', *args], cwd=directory, env=env, capture_output=True, text=True, timeout=10)
            if probe.returncode: raise ValueError('Readonly native Git metadata preflight failed')
            selected = backup.physical(Path(probe.stdout.strip()))
            if selected.name != '.git' and '.git' not in selected.parts: raise ValueError('Unexpected native Git metadata path')
            mounts.append(str(selected))
    return sorted(set(mounts))


def sandbox(spec, root):
    binary = spec['runtime']; source = Path(__file__).parent
    for name in ['profiles', 'tmp']: (root / name).mkdir(mode=0o700, exist_ok=True)
    command = ['/usr/bin/bwrap', '--unshare-all', '--unshare-user', '--disable-userns', '--die-with-parent', '--new-session', '--cap-drop', 'ALL', '--clearenv',
               '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
               '--proc', '/proc', '--dev', '/dev', '--bind', str(root / 'production-storage'), '/destination',
               '--bind', str(root / 'pilot-working'), '/pilot', '--bind', str(root / 'evidence'), '/evidence',
               '--bind', str(root / 'profiles'), '/profiles', '--bind', str(root / 'tmp'), '/tmp',
               '--ro-bind', str(source / 'native-transfer.py'), '/operations/native-transfer.py', '--ro-bind', binary, '/runtime/opencode',
               '--setenv', 'PATH', '/usr/bin:/bin', '--setenv', 'PYTHONDONTWRITEBYTECODE', '1',
               '/usr/bin/python3', '/operations/native-transfer.py']
    mounts = project_metadata(spec); extra = []
    for mount in sorted(set(mounts)):
        if any(mount.startswith(parent + '/') for parent in set(mounts) if parent != mount): continue
        extra += ['--ro-bind', mount, mount]
    command[-2:-2] = extra
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=spec['budgetSeconds']+15)
    if result.returncode: raise RuntimeError('Isolated native transfer failed; inspect metadata and preserve partial work')


def plan(spec):
    sizes = [Path(spec[key]).stat().st_size for key in ['originalDB', 'pilotDB']]
    reserve = 20 * 1024**3 + 3 * sizes[0] + 2 * sizes[1]
    root = Path(spec['runRoot']); ancestor = root.parent
    while not ancestor.exists(): ancestor = ancestor.parent
    bindings = project_metadata(spec)
    gaps = set(); users = users_of([spec['originalDB'], spec['pilotDB']], gaps=gaps)
    return {'kind': 'final-storage-preflight', 'sourceBytes': sizes, 'requiredFreeEstimate': reserve,
            'freeBytes': shutil.disk_usage(ancestor).free, 'sourceUsers': users, 'uninspectableProcessCount': len(gaps),
            'destinationExists': root.exists(), 'runtimePinVerified': True, 'databaseOpened': False,
            'readonlyGitMetadataBindings': len(bindings),
            'descriptorVisibility': 'Observable same-user descriptors only; OS-denied processes remain outside this evidence. Explicit human closure remains mandatory.',
            'externalFilesPolicy': 'Keep original absolute resources intact; external archives/recovery are a separate explicit scope, not claimed by SQLite.'}


def prepare(spec, *, closed=False):
    if closed is not True: raise ValueError('Final preparation requires both V1 and pilot closure, not inferred consent')
    preflight = plan(spec)
    if preflight['sourceUsers']: raise ValueError('Source DB/WAL/SHM still has observable same-user descriptors; no forced closure')
    if preflight['freeBytes'] < preflight['requiredFreeEstimate']: raise ValueError('Insufficient conservative storage reserve')
    root = Path(spec['runRoot']); backup.fresh(root)
    backup.write_json(root / 'owner.json', spec)
    for relative in ['backups/original', 'backups/pilot', 'production-storage/data/opencode', 'production-storage/state', 'pilot-working', 'evidence']:
        (root / relative).mkdir(mode=0o700, parents=True, exist_ok=True)
    receipts = {}
    for key, name in [('originalDB', 'original'), ('pilotDB', 'pilot')]:
        before = capture_fingerprint(spec[key])
        receipts[name] = backup.sqlite_backup(Path(spec[key]), root / 'backups' / name / 'opencode.db')
        after = capture_fingerprint(spec[key])
        if before != after:
            backup.write_json(root / 'source-snapshot-observation.json', {'source': name, 'before': before, 'after': after})
            raise ValueError('Source advanced during snapshot; keep copies but do not publish')
    backup.sqlite_backup(root / 'backups/original/opencode.db', root / 'production-storage/data/opencode/opencode.db')
    backup.sqlite_backup(root / 'backups/pilot/opencode.db', root / 'pilot-working/opencode.db')
    state = {'kind': 'final-storage-sources', 'original': unchanged(spec['originalDB']), 'pilot': unchanged(spec['pilotDB']), 'backups': receipts}
    if users_of([spec['originalDB'], spec['pilotDB']]): raise ValueError('Source reopened during backup; copies retained but not final')
    backup.write_json(root / 'sources.json', state)
    backup.write_json(root / 'evidence/worker-spec.json', {'budgetSeconds': spec['budgetSeconds'], 'authTransfer': spec['authTransfer']})
    return resume(spec)


def verify_sources(spec):
    root = Path(spec['runRoot'])
    if read(root / 'owner.json') != spec: raise ValueError('Final storage owner/selection drift')
    state = read(root / 'sources.json')
    if users_of([spec['originalDB'], spec['pilotDB']]): raise ValueError('Original/pilot reopened; publication requires current closure')
    if state['original'] != unchanged(spec['originalDB']) or state['pilot'] != unchanged(spec['pilotDB']): raise ValueError('Source advanced since snapshot; new explicit final capture required, no incremental SQL/native-conflict merge')
    for record in state['backups'].values():
        file = Path(record['backup']); backup.signature(file)
        if backup.digest(file) != record['sha256']: raise ValueError('Preserved source backup drift')


def resume(spec):
    verify_sources(spec); root = Path(spec['runRoot'])
    if users_of([root / 'production-storage/data/opencode/opencode.db', root / 'pilot-working/opencode.db']): raise ValueError('Working copy is already in use')
    if (root / 'evidence/native-transfer.json').exists(): return read(root / 'evidence/native-transfer.json')
    sandbox(spec, root)
    return read(root / 'evidence/native-transfer.json')


def publish(spec, *, closed=False):
    if closed is not True: raise ValueError('Publication requires explicit current V1/pilot closure')
    verify_sources(spec); root = Path(spec['runRoot']); report = read(root / 'evidence/native-transfer.json')
    if report.get('kind') != 'final-native-storage-transfer' or report.get('nativeTransferVerified') is not True or report.get('migrationCompleted') is not True: raise ValueError('Native history verification is incomplete')
    if users_of([root / 'production-storage/data/opencode/opencode.db']): raise ValueError('Production store already in use')
    storage = root / 'production-storage'
    marker = {'schemaVersion': 1, 'owner': 'opencode-stack', 'kind': 'production-native-storage', 'nativeVersion': '2.2.7', 'root': str(storage), 'phase': 'history-verified'}
    file=storage / '.production-storage.json'
    if file.exists():
        if read(file)!=marker:raise ValueError('Published storage marker differs; no adoption')
    else:backup.write_json(file, marker)
    return {'kind': 'production-storage-published', 'root': str(storage), 'entryActivated': False, 'sourceHistoryRewritten': False}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('action', choices=['plan', 'prepare', 'resume', 'publish']); parser.add_argument('--spec', type=Path, required=True); parser.add_argument('--v1-closed', action='store_true'); parser.add_argument('--pilot-closed', action='store_true'); args = parser.parse_args()
    try:
        spec = spec_read(args.spec)
        if args.action == 'plan': result = plan(spec)
        else:
            if not (args.v1_closed and args.pilot_closed): raise ValueError('Both current closure confirmations required')
            result = prepare(spec, closed=True) if args.action == 'prepare' else publish(spec, closed=True) if args.action == 'publish' else resume(spec)
        print(json.dumps(result))
    except BaseException as error:
        # Only curated error labels; raw native responses never escape workers.
        if args.action != 'plan' and 'spec' in locals():
            labels = {'Source advanced during snapshot; keep copies but do not publish': 'source_advanced_during_snapshot', 'Source DB/WAL/SHM still has observable same-user descriptors; no forced closure': 'source_still_open', 'Insufficient conservative storage reserve': 'insufficient_space'}
            failure = {'kind': 'storage-preparation-failure', 'errorType': type(error).__name__, 'label': labels.get(str(error), 'inspect_preserved_stage')}
            root = Path(spec['runRoot'])
            try:
                if read(root / 'owner.json') == spec: backup.write_json(root / 'preparation-failure.json', failure)
            except (OSError, ValueError): pass
        parser.exit(1, 'Final storage refused/failed; keep sources/copies and inspect gates. No automatic retry, cleanup, migration of original or install change.\n')


if __name__ == '__main__': main()
