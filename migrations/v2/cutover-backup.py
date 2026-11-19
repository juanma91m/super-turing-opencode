"""Explicit cutover backups, not a migrator/installer or automatic restore.

Install rollback is an allowlist, never a recursive copy of HOME/config/data.
SQLite uses Backup API with normal locking; live DB/WAL/SHM are never copied.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import stat
import time
import re


def physical(file):
    file = Path(file)
    if not file.is_absolute() or str(file) != os.path.normpath(file):
        raise ValueError('Explicit physical absolute path required')
    for component in [*reversed(file.parents), file]:
        if component.is_symlink():
            raise ValueError('Symlink refused; no automatic dereference')
    return file


def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def signature(file):
    info = physical(file).stat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid():
        raise ValueError('User-owned single regular file required')
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def write_json(file, value):
    fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())


def fresh(destination):
    physical(destination)
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)


def copy_verified(source, destination):
    before = signature(source)
    destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with source.open('rb') as origin, os.fdopen(fd, 'wb') as target:
        for chunk in iter(lambda: origin.read(1024 * 1024), b''):
            target.write(chunk)
        target.flush()
        os.fsync(target.fileno())
    checksum = digest(destination)
    if signature(source) != before or digest(source) != checksum or signature(source) != before:
        raise ValueError('Rollback source changed during preservation; partial backup retained')
    return {'source': str(source), 'backup': str(destination), 'sha256': checksum,
            'bytes': before[2], 'sourceMode': stat.S_IMODE(source.stat().st_mode), 'backupMode': 0o600}


def public_install_tree(tree):
    """Inventory the historical npm install explicitly, without secret files.

    Keep internal npm .bin symlinks as links, never follow/copy an external target.
    Names are screened before any payload is read. Unknown content stops backup.
    """
    if not tree.is_dir():
        raise ValueError('Historical node_modules must be a directory')
    def enumeration_failed(_error):
        raise ValueError('Historical install enumeration failed; no success receipt')
    files, links = [], []
    for directory, folders, names in os.walk(tree, followlinks=False, onerror=enumeration_failed):
        for name in [*folders, *names]:
            file = Path(directory) / name
            if (name.startswith('.env') and name != '.env.example') or name in {'.npmrc', '.ssh', '.gnupg', '.aws'} or re.match(r'^(auth|credentials?|tokens?|secrets?)\.(jsonc?|db|sqlite)$', name, re.I) or re.search(r'\.(pem|key|p12|pfx|db|sqlite)(?:-wal|-shm)?$', name, re.I):
                raise ValueError('Private/unknown historical install entry; no payload copied')
            if file.is_symlink():
                if not file.resolve(strict=True).is_relative_to(tree):
                    raise ValueError('Historical install symlink escaped the public install')
                links.append(file)
                if name in folders: folders.remove(name)
            elif file.is_file():
                signature(file); files.append(file)
            elif not file.is_dir():
                raise ValueError('Special historical installation entry')
    return files, links


def prepare_install(home, destination):
    home = physical(home)
    install = home / '.opencode'
    state = home / '.local/state/opencode-addons/opencode-background-tasks/state.json'
    marker = install / '.opencode-background-addon.json'
    signature(marker); signature(state)
    owner = json.loads(marker.read_text())
    saved = json.loads(state.read_text())
    if owner.get('mode') != 'managed-local-install' or saved.get('mode') != 'managed-local-install':
        raise ValueError('Expected managed-local-install ownership')
    historic = physical(owner['backupPath'])
    expected = home / '.local/state/opencode-addons/opencode-background-tasks/backups'
    if historic.parent != expected or saved.get('managedLocalInstall', {}).get('backupPath') != str(historic):
        raise ValueError('Historical install backup/state binding differs')
    files = [state]; links = []
    known_bins = {'opencode', 'opencode-managed-runtime', 'engram', 'semgrep'}
    for tree in [install, historic]:
        top = {'bin', '.gitignore', '.opencode-background-addon.json'} | ({'package.json', 'package-lock.json', 'node_modules'} if tree == historic else set())
        if set(os.listdir(physical(tree))) - top:
            raise ValueError('Unexpected installation entry; review instead of copying blindly')
        if set(os.listdir(physical(tree / 'bin'))) - known_bins:
            raise ValueError('Unexpected auxiliary binary; explicit inventory needed')
        files += [tree / 'bin' / name for name in sorted(os.listdir(tree / 'bin'))]
        files += [tree / name for name in ['.gitignore', '.opencode-background-addon.json'] if (tree / name).exists()]
        if tree == historic:
            files += [tree / name for name in ['package.json', 'package-lock.json'] if (tree / name).exists()]
            if (tree / 'node_modules').exists():
                physical(tree / 'node_modules')
                public_files, public_links = public_install_tree(tree / 'node_modules')
                files += public_files; links += public_links
    configured = home / '.config/opencode'
    allowed = {str(configured / name) for name in ['plugins/background-agents.ts', 'plugins/background-agents-tui/index.ts', 'PLAYBOOK-ASYNC.md', 'skills/delegacion-async-opencode/SKILL.md']}
    for record in saved.get('plugins', []) + saved.get('assets', []):
        installed = physical(record['installedPath'])
        if str(installed) not in allowed:
            raise ValueError('Unreviewed Background managed path')
        if installed.exists():
            files.append(installed)
        if record.get('backupPath'):
            backup = physical(record['backupPath'])
            if not backup.is_relative_to(configured / '.stack-sync-backups') or backup.name != 'before-plugin.ts':
                raise ValueError('Unreviewed managed-file backup')
            files.append(backup)
    for file in files:
        signature(file)
    fresh(destination)
    records = []
    for file in dict.fromkeys(files):
        records.append(copy_verified(file, destination / 'files' / file.relative_to(home)))
    for file in links:
        target = destination / 'files' / file.relative_to(home); target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        to = os.readlink(file)
        if Path(to).is_absolute():
            raise ValueError('Absolute historical npm link needs explicit relocatable preservation')
        target.symlink_to(to)
        records.append({'source': str(file), 'backup': str(target), 'kind': 'symlink', 'to': to, 'bytes': 0})
    report = {'schemaVersion': 1, 'owner': 'opencode-stack', 'kind': 'pre-cutover-install-rollback',
              'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'home': str(home),
              'checkoutVersion': owner.get('checkoutVersion'), 'historicalInstall': str(historic),
              'files': records, 'activeInstallChanged': False, 'databaseOpened': False,
              'storageBackupIncluded': False, 'finalCutoverBackup': False,
              'restorePolicy': 'Close affected clients; preserve post-cutover files first; verify every checksum; restore exact preimages/modes, including ownership state and consumed historical backup. Never restore a V2 database over the V1 original.'}
    write_json(destination / 'install-rollback.json', report)
    return report


def sqlite_backup(source, destination):
    source = physical(source); signature(source)
    if source.name != 'opencode.db':
        raise ValueError('Only explicitly selected OpenCode DB is supported')
    physical(destination)
    if destination.exists() or destination.name != 'opencode.db':
        raise ValueError('New explicit opencode.db destination required')
    if not destination.parent.exists() or destination.parent.stat().st_mode & 0o077:
        raise ValueError('Private prepared backup directory required')
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600); os.close(fd)
    # No immutable, PRAGMA mutations, checkpoints, SQL merge, transcripts or auth.
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=30)) as origin:
        with closing(sqlite3.connect(destination)) as target:
            origin.backup(target, pages=4096, sleep=0.05)
            if target.execute('PRAGMA integrity_check').fetchone() != ('ok',):
                raise ValueError('SQLite backup integrity failed; copy retained')
            if target.execute('PRAGMA foreign_key_check').fetchone() is not None:
                raise ValueError('SQLite backup foreign key check failed; copy retained')
    return {'source': str(source), 'backup': str(destination), 'sha256': digest(destination),
            'bytes': destination.stat().st_size, 'integrity': 'ok', 'foreignKeyViolations': 0,
            'method': 'sqlite-online-backup-api', 'finalCutoverBackup': False,
            'limitation': 'Point-in-time SQLite only; not continuous replication, external files or proof of source closure.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    install = sub.add_parser('prepare-install'); install.add_argument('--home', required=True, type=Path); install.add_argument('--destination', required=True, type=Path)
    db = sub.add_parser('sqlite-backup'); db.add_argument('--source', required=True, type=Path); db.add_argument('--destination', required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.action == 'prepare-install':
            report = prepare_install(args.home, args.destination)
            print(json.dumps({'kind': report['kind'], 'directory': str(args.destination), 'files': len(report['files']), 'bytes': sum(file['bytes'] for file in report['files']), 'activeInstallChanged': False, 'databaseOpened': False}))
        else:
            report = sqlite_backup(args.source, args.destination)
            write_json(args.destination.parent / 'backup-receipt.json', report)
            print(json.dumps({key: report[key] for key in ['bytes', 'integrity', 'foreignKeyViolations', 'method', 'finalCutoverBackup']}))
    except Exception:
        parser.exit(1, 'Cutover backup refused/failed; inspect paths, ownership, space and retained partials. No automatic cleanup/restore.\n')


if __name__ == '__main__':
    main()
