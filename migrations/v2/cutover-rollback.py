"""Exact installation rollback with sealed postimages and explicit recovery.

Never restores databases. Production data remains separate and must be backed up
before switching entrypoints. This command is not run on active installations in
preparation; its mutation tests use disposable homes only.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import stat
import uuid


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file)); loaded = importlib.util.module_from_spec(spec); spec.loader.exec_module(loaded); return loaded


backup = module('backup', 'cutover-backup.py')
storage = module('storage', 'cutover-storage.py')


def json_read(file):
    backup.signature(file)
    if file.stat().st_size > 16 * 1024**2: raise ValueError('Bounded rollback metadata required')
    return json.loads(file.read_text())


def identity(file):
    backup.physical(file.parent)
    try: info = file.lstat()
    except FileNotFoundError: return {'kind': 'missing'}
    if info.st_uid != os.getuid(): raise ValueError('Foreign rollback target owner')
    if stat.S_ISLNK(info.st_mode): return {'kind': 'symlink', 'to': os.readlink(file)}
    backup.signature(file)
    return {'kind': 'file', 'sha256': backup.digest(file), 'mode': stat.S_IMODE(info.st_mode)}


def preimages(receipt):
    report = json_read(receipt); home = backup.physical(Path(report['home']))
    if report.get('kind') != 'pre-cutover-install-rollback' or report.get('owner') != 'opencode-stack' or report.get('schemaVersion') != 1: raise ValueError('Unexpected rollback receipt')
    result = {}
    for row in report['files']:
        source = Path(row['source']); payload = Path(row['backup'])
        if not source.is_relative_to(home) or not payload.is_relative_to(receipt.parent / 'files') or payload.relative_to(receipt.parent / 'files') != source.relative_to(home): raise ValueError('Rollback payload/source escaped explicit binding')
        relative = source.relative_to(home).as_posix()
        allowed = relative.startswith('.opencode/') or relative.startswith('.local/state/opencode-addons/opencode-background-tasks/') or relative in ['.config/opencode/plugins/background-agents.ts', '.config/opencode/plugins/background-agents-tui/index.ts', '.config/opencode/PLAYBOOK-ASYNC.md', '.config/opencode/skills/delegacion-async-opencode/SKILL.md'] or relative.startswith('.config/opencode/.stack-sync-backups/') and relative.endswith('/before-plugin.ts')
        if not allowed or source in result: raise ValueError('Unreviewed/duplicate rollback target')
        backup.physical(source.parent)
        expected = {'kind': 'symlink', 'to': row['to']} if row.get('kind') == 'symlink' else {'kind': 'file', 'sha256': row['sha256'], 'mode': row['sourceMode']}
        observed = identity(payload)
        if observed['kind'] != expected['kind'] or expected['kind'] == 'file' and observed['sha256'] != expected['sha256'] or expected['kind'] == 'symlink' and observed != expected: raise ValueError('Rollback backup checksum/link mismatch')
        result[source] = {'image': expected, 'payload': payload}
    return result


def closure(databases, confirmed):
    if confirmed is not True or len(databases) != 2: raise ValueError('Explicit original and production closure required')
    for file in databases:
        backup.physical(Path(file))
        if Path(file).name != 'opencode.db': raise ValueError('Explicit OpenCode database gates required')
    if storage.users_of(databases): raise ValueError('Affected DB/WAL/SHM still in use; no kill or lock removal')


def verify_current(receipt):
    report = json_read(receipt); rows = preimages(receipt)
    for root in [Path(report['home']) / '.opencode', Path(report['historicalInstall'])]:
        def enumeration_failed(_error): raise ValueError('Installation enumeration failed')
        for directory, folders, files in os.walk(root, followlinks=False, onerror=enumeration_failed):
            for name in files + [name for name in folders if (Path(directory) / name).is_symlink()]:
                if Path(directory) / name not in rows: raise ValueError('Unknown installation entry since rollback snapshot; no lifecycle authorized by this receipt')
    for source, row in rows.items():
        if identity(source) != row['image']: raise ValueError('Current installation advanced since rollback snapshot')
    return {'kind': 'current-installation-matches-rollback', 'entries': len(rows), 'installationChanged': False, 'databaseOpened': False}


def seal(receipt, directory, databases, *, confirmed=False):
    closure(databases, confirmed); before = preimages(receipt); backup.fresh(directory)
    rows = []; home = Path(json_read(receipt)['home'])
    for source in before:
        image = identity(source); relative = source.relative_to(home)
        payload = directory / 'files' / relative
        if image['kind'] == 'file': backup.copy_verified(source, payload)
        elif image['kind'] == 'symlink': payload.parent.mkdir(mode=0o700, parents=True, exist_ok=True); payload.symlink_to(image['to'])
        rows.append({'source': str(source), 'image': image, 'payload': str(payload)})
    report = {'schemaVersion': 1, 'kind': 'sealed-cutover-postimages', 'receipt': str(receipt), 'receiptSHA256': backup.digest(receipt), 'databases': list(map(str, databases)), 'files': rows}
    backup.write_json(directory / 'postimages.json', report)
    return {'kind': report['kind'], 'files': len(rows), 'databaseRestored': False}


def apply_image(file, image, payload):
    backup.physical(file.parent); file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = file.parent / ('.cutover-' + uuid.uuid4().hex + '.tmp')
    if image['kind'] == 'file':
        backup.copy_verified(payload, temporary); temporary.chmod(image['mode']); os.replace(temporary, file)
    elif image['kind'] == 'symlink': temporary.symlink_to(image['to']); os.replace(temporary, file)
    elif image['kind'] == 'missing':
        if file.exists() or file.is_symlink(): file.unlink()
    fd = os.open(file.parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)


def restore(postimages, *, confirmed=False, recover=None):
    report = json_read(postimages)
    if report.get('kind') != 'sealed-cutover-postimages' or report.get('schemaVersion') != 1: raise ValueError('Unexpected sealed postimages')
    closure(report['databases'], confirmed)
    receipt = Path(report['receipt'])
    if backup.digest(receipt) != report['receiptSHA256']: raise ValueError('Rollback receipt changed after seal')
    before = preimages(receipt); after = {Path(row['source']): row for row in report['files']}
    if set(before) != set(after): raise ValueError('Sealed target set differs')
    if recover not in [None, 'before', 'after']: raise ValueError('Explicit recovery direction required')
    for source, row in after.items():
        image = row['image']; payload = Path(row['payload'])
        if not payload.is_relative_to(postimages.parent / 'files'): raise ValueError('Postimage payload escaped seal')
        if image['kind'] != 'missing':
            actual_payload = identity(payload)
            if actual_payload['kind'] != image['kind'] or image['kind'] == 'file' and actual_payload['sha256'] != image['sha256'] or image['kind'] == 'symlink' and actual_payload != image: raise ValueError('Preserved postimage drift')
        current = identity(source)
        accepted = [image] if recover is None else [image, before[source]['image']]
        if current not in accepted: raise ValueError('Unknown current installation drift; no file changed')
    lock = postimages.parent / '.rollback.lock'; fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600); inode = os.fstat(fd)
    os.write(fd, (json.dumps({'kind': 'installation-rollback-lease', 'pid': os.getpid(), 'nonce': uuid.uuid4().hex})+'\n').encode()); os.fsync(fd)
    journal = postimages.parent / 'rollback-started.json'
    try:
        if recover is None: backup.write_json(journal, {'kind': 'installation-rollback-started', 'postimagesSHA256': backup.digest(postimages)})
        elif json_read(journal).get('postimagesSHA256') != backup.digest(postimages): raise ValueError('Recovery journal mismatch')
        changed = 0
        # Publish the entrypoint last: a restored V1 wrapper must not start
        # against a half-restored runtime/plugin installation.
        entry=Path(json_read(receipt)['home'])/'.opencode/bin/opencode'
        for source in sorted(before,key=lambda file:(file==entry,str(file))):
            row = after[source] if recover == 'after' else before[source]
            if identity(source) != row['image']:
                apply_image(source, row['image'], Path(row['payload'])); changed += 1
        outcome = {'kind': 'installation-rollback-completed', 'direction': recover or 'before', 'filesChanged': changed, 'databaseRestored': False, 'productionDataPreserved': True}
        backup.write_json(postimages.parent / ('rollback-completed-' + uuid.uuid4().hex + '.json'), outcome)
        return outcome
    finally:
        try:
            current = lock.lstat()
            if not stat.S_ISLNK(current.st_mode) and (current.st_dev, current.st_ino) == (inode.st_dev, inode.st_ino): lock.unlink()
            else: raise ValueError('Rollback lease changed; unknown lease retained')
        finally: os.close(fd)


def auxiliaries(receipt, databases, *, confirmed=False):
    """After Background restore, retain today's auxiliaries, not historical ones.

    Only engram/semgrep, only recognized current/historical preimages, atomic
    replacement. No install/adoption, unrelated binary or process restart.
    """
    closure(databases, confirmed); report = json_read(receipt); rows = preimages(receipt)
    home = Path(report['home']); historic = Path(report['historicalInstall']); changed = 0
    if (home / '.opencode/.opencode-background-addon.json').exists(): raise ValueError('Run the Background restore lifecycle first')
    selected = []
    for name in ['engram', 'semgrep']:
        source = home / '.opencode/bin' / name
        if source not in rows: continue
        expected = rows[source]['image']; current = identity(source)
        allowed = [expected]
        if historic / 'bin' / name in rows: allowed.append(rows[historic / 'bin' / name]['image'])
        else: allowed.append({'kind': 'missing'})
        if current not in allowed: raise ValueError('Unknown auxiliary drift; no binary changed')
        selected.append((source, rows[source]))
    for source, row in selected:
        if identity(source) != row['image']:
            apply_image(source, row['image'], row['payload']); changed += 1
    return {'kind': 'current-auxiliaries-reconciled', 'filesChanged': changed, 'unrelatedBinariesChanged': False, 'databaseRestored': False}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__); sub = parser.add_subparsers(dest='action', required=True)
    seal_parser = sub.add_parser('seal'); seal_parser.add_argument('--receipt', type=Path, required=True); seal_parser.add_argument('--destination', type=Path, required=True); seal_parser.add_argument('--original-db', type=Path, required=True); seal_parser.add_argument('--production-db', type=Path, required=True)
    restore_parser = sub.add_parser('restore'); restore_parser.add_argument('--postimages', type=Path, required=True); restore_parser.add_argument('--recover', choices=['before', 'after'])
    aux_parser = sub.add_parser('auxiliaries'); aux_parser.add_argument('--receipt', type=Path, required=True); aux_parser.add_argument('--original-db', type=Path, required=True); aux_parser.add_argument('--production-db', type=Path, required=True)
    verify_parser = sub.add_parser('verify-current'); verify_parser.add_argument('--receipt', type=Path, required=True)
    for command in [seal_parser, restore_parser, aux_parser]: command.add_argument('--clients-closed', action='store_true'); command.add_argument('--confirm', action='store_true')
    args = parser.parse_args()
    try:
        if args.action != 'verify-current' and not args.confirm: raise ValueError('Explicit confirmation required')
        if args.action == 'verify-current': result = verify_current(args.receipt)
        elif args.action == 'seal': result = seal(args.receipt, args.destination, [args.original_db, args.production_db], confirmed=args.clients_closed)
        elif args.action == 'auxiliaries': result = auxiliaries(args.receipt, [args.original_db, args.production_db], confirmed=args.clients_closed)
        else: result = restore(args.postimages, confirmed=args.clients_closed, recover=args.recover)
        print(json.dumps(result))
    except BaseException: parser.exit(1, 'Installation rollback refused/failed; keep pre/postimages and journal. No automatic recovery, cleanup, database restore or process shutdown.\n')


if __name__ == '__main__': main()
