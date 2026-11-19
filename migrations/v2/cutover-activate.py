"""Managed V2 activation. Preparation is read-only; activate runs only after closure.

Uses the existing native storage worker and Background lifecycle. No SQL merge,
credential files, forced client shutdown, arbitrary shell, or automatic retry.
"""
import argparse
from contextlib import contextmanager
import hashlib
import importlib.util
import json
import os
import queue
from pathlib import Path
import shlex
import signal
import sys
import threading
import stat
import subprocess
import time
import uuid


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    loaded = importlib.util.module_from_spec(spec); spec.loader.exec_module(loaded); return loaded


backup = module('activation_backup', 'cutover-backup.py')
storage = module('activation_storage', 'cutover-storage.py')
rollback = module('activation_rollback', 'cutover-rollback.py')
CONTRACT = 'managed-harness-v1'


class ChildRefused(RuntimeError):
    def __init__(self, stdout):
        super().__init__('Owned activation child refused; inspect stage metadata')
        self.stdout=stdout


def read(file):
    backup.signature(file)
    if file.stat().st_mode & 0o077 or file.stat().st_size > 16 * 1024**2:
        raise ValueError('Private bounded activation metadata required')
    return json.loads(file.read_text())


def prepare_plan(prepared, aune, background, node, runner=None):
    for file in [prepared, aune, background, node]: backup.physical(file)
    settings = read(prepared / 'production-entry.prepared.json')
    report = read(prepared / 'install-rollback.json')
    if settings.get('managedContract') != CONTRACT: raise ValueError('Managed contract was not selected')
    home = backup.physical(Path(report['home']))
    plan = {'schemaVersion': 1, 'owner': 'opencode-stack', 'kind': 'managed-v2-activation',
            'managedContract': CONTRACT, 'preparedRoot': str(prepared), 'home': str(home),
            'coreRoot': settings['coreRoot'], 'auneRoot': str(aune), 'backgroundRoot': str(background),
            'nodeBinary': str(node), 'entrySettings': str(prepared / 'production-entry.prepared.json'),
            'storageSpec': str(prepared / 'final-storage.prepared.json'),
            'installReceipt': str(prepared / 'install-rollback.json'),
            'configRoot': str(home / '.config/opencode/production-v2'),
            'entrypoint': str(home / '.opencode/bin/opencode')}
    raw=(runner or run_owned)([str(node),str(aune/'v2/production-check.mjs'),str(prepared/'production-entry.prepared.json'),'rollback-plan'],str(home))
    projects=json.loads(raw)
    if projects.get('kind')!='managed-project-rollback' or set(projects['deployments'])!=set(settings['products']):raise ValueError('Project rollback cohort incomplete')
    plan['deployments']=projects['deployments']
    file = prepared / 'activation-plan.json'
    if file.exists():
        if read(file) != plan: raise ValueError('Existing activation plan differs; review explicitly')
    else: backup.write_json(file, plan)
    return plan


def validate(plan):
    expected = {'schemaVersion','owner','kind','managedContract','preparedRoot','home','coreRoot','auneRoot','backgroundRoot','nodeBinary','entrySettings','storageSpec','installReceipt','configRoot','entrypoint','deployments'}
    if set(plan) != expected or plan['schemaVersion'] != 1 or plan['owner'] != 'opencode-stack' or plan['kind'] != 'managed-v2-activation' or plan['managedContract'] != CONTRACT:
        raise ValueError('Unexpected activation contract')
    for key in expected - {'schemaVersion','owner','kind','managedContract','deployments'}: backup.physical(Path(plan[key]))
    root = Path(plan['preparedRoot']); home = Path(plan['home'])
    info=root.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.getuid() or info.st_mode&0o077:raise ValueError('Private user-owned activation directory required')
    if (Path(plan['entrySettings']) != root / 'production-entry.prepared.json' or Path(plan['storageSpec']) != root / 'final-storage.prepared.json'
        or Path(plan['installReceipt']) != root / 'install-rollback.json' or Path(plan['entrypoint']) != home / '.opencode/bin/opencode'
        or Path(plan['configRoot']) != home / '.config/opencode/production-v2'
        or Path(plan['coreRoot']) != Path(__file__).resolve().parents[2]):
        raise ValueError('Activation path/owner binding differs')
    settings = read(Path(plan['entrySettings'])); spec = storage.spec_read(Path(plan['storageSpec']))
    if (settings.get('managedContract') != CONTRACT or settings['coreRoot'] != plan['coreRoot']
        or settings['storageRoot'] != str(Path(spec['runRoot']) / 'production-storage')
        or read(Path(plan['installReceipt']))['home'] != plan['home']): raise ValueError('Entry/storage/rollback contracts differ')
    if set(plan['deployments'])!=set(settings['products']) or any(not isinstance(value,str) or len(value)!=64 or any(char not in '0123456789abcdef' for char in value) for value in plan['deployments'].values()):raise ValueError('Invalid deployment rollback cohort')
    for file in [Path(plan['nodeBinary']), Path(plan['auneRoot']) / 'v2/production.mjs', Path(plan['auneRoot']) / 'v2/production-check.mjs', Path(plan['backgroundRoot']) / 'scripts/restore-local-install.mjs']:
        backup.physical(file)
        info = file.stat()
        # Versioned user-owned source may use the normal collaborative umask002.
        # Do not chmod/freeze repos as an installer side effect. The executable
        # itself must not be group/world writable; scripts must not be world writable.
        forbidden=0o022 if file==Path(plan['nodeBinary']) else 0o002
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.getuid() or info.st_mode&forbidden: raise ValueError('Unsafe executable/source dependency')
    return settings, spec


def run_owned(command, cwd, budget=600):
    # Only children in this invocation's new process group are signalled. Raw
    # native/lifecycle output stays in RAM, never in receipts or model output.
    child = subprocess.Popen(list(map(str, command)), cwd=cwd, stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    try: out, err = child.communicate(timeout=budget)
    except subprocess.TimeoutExpired:
        for sig in [signal.SIGTERM, signal.SIGKILL]:
            try: os.killpg(child.pid, sig)
            except ProcessLookupError: pass
            try: child.communicate(timeout=10); break
            except subprocess.TimeoutExpired: pass
        raise RuntimeError('Owned activation child exceeded budget; inspect preserved stage') from None
    if len(out) + len(err) > 8 * 1024**2: raise RuntimeError('Activation output exceeded bound')
    if child.returncode: raise ChildRefused(out)
    return out


@contextmanager
def lease(plan):
    file=Path(plan['preparedRoot'])/'.managed-cutover.lock';nonce=uuid.uuid4().hex
    fd=os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);identity=os.fstat(fd)
    try:
        os.write(fd,json.dumps({'kind':'managed-cutover-lease','pid':os.getpid(),'nonce':nonce}).encode());os.fsync(fd)
        yield
    finally:
        try:
            current=file.lstat()
            if stat.S_ISLNK(current.st_mode) or (current.st_dev,current.st_ino)!=(identity.st_dev,identity.st_ino):raise ValueError('Cutover lease replaced; unknown file retained')
            file.unlink()
        finally:os.close(fd)


def note(phase):
    print('[OpenCode V2] '+phase,file=sys.stderr,flush=True)


@contextmanager
def heartbeat():
    stopped=threading.Event();start=time.monotonic()
    def observe():
        while not stopped.wait(30):note('Operación aún en ejecución ('+str(int(time.monotonic()-start))+'s). No abras clientes hasta finalizar; esto no certifica progreso de la migración.')
    worker=threading.Thread(target=observe,daemon=True);worker.start()
    try:yield
    finally:stopped.set();worker.join(timeout=1)


def wrapper_bytes(plan):
    return ('#!/bin/sh\nexec ' + shlex.quote(plan['nodeBinary']) + ' ' + shlex.quote(str(Path(plan['configRoot']) / 'entry.mjs')) + ' "$@"\n').encode()


def maintenance_bytes():
    return b'#!/bin/sh\nprintf "%s\\n" "OpenCode: actualizacion en curso; espera a que termine el comando de corte." >&2\nexit 1\n'


def hold_profiles(plan):
    command=[plan['nodeBinary'],str(Path(plan['auneRoot'])/'v2/production-check.mjs'),plan['entrySettings'],'hold']
    child=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=True)
    ready=queue.Queue()
    def observe():
        try:ready.put(child.stdout.readline())
        except BaseException:ready.put('')
    threading.Thread(target=observe,daemon=True).start()
    def release():
        if child.stdin and not child.stdin.closed:child.stdin.close()
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            try:os.killpg(child.pid,signal.SIGTERM)
            except ProcessLookupError:pass
            try:child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                try:os.killpg(child.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                child.wait()
        child.stdout.close()
        if child.returncode!=0:raise ValueError('Profile guard did not release cleanly; inspect owned leases')
    try:
        message=json.loads(ready.get(timeout=30))
        if message!={'kind':'managed-install-profile-guard','ready':True,'pid':child.pid}:raise ValueError('Profile guard refused')
    except BaseException:
        release();raise ValueError('Production profiles active or guard unavailable; no lifecycle change') from None
    return release


def loader_bytes(plan):
    entry = (Path(plan['auneRoot']) / 'v2/production.mjs').as_uri()
    return ("import fs from 'node:fs';\nconst settings=JSON.parse(fs.readFileSync(new URL('./settings.json',import.meta.url)));\n"
            "const information=process.argv.length===3&&['--version','-v','--help','-h'].includes(process.argv[2]);\n"
            "if(!information){let active;try{active=JSON.parse(fs.readFileSync(new URL('./active.json',import.meta.url)));}catch{}if(active?.kind!=='managed-v2-entry-active'||active.nativeVersion!==settings.nativeVersion||active.managedContract!==settings.managedContract||active.storageRoot!==settings.storageRoot){console.error('OpenCode V2: activacion pendiente; espera a que termine el comando de corte.');process.exit(1);}}\n"
            "process.env.OPENCODE_STACK_SOURCE_DIR=settings.coreRoot;\nconst {main}=await import(" + json.dumps(entry) + ");\n"
            "main(process.argv.slice(2),process.cwd(),settings).then(code=>{process.exitCode=code;}).catch(error=>{console.error(error.message);process.exitCode=1;});\n").encode()


def replace(file, value, mode):
    backup.physical(file.parent); temporary = file.with_name(file.name + '.activation-tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(fd, 'wb') as stream:
        os.fchmod(stream.fileno(), mode)
        stream.write(value); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, file)
    fd = os.open(file.parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)


def retire_restored_npm(plan):
    """Move only exact restored historical npm payloads out of discovery paths.

    Background restore reintroduces its old package/node_modules at ~/.opencode.
    Keeping it there would load an unreviewed V1 executable ancestor in V2. Never
    weaken the source guard to adopt it or delete unknown installation contents.
    """
    report = read(Path(plan['installReceipt'])); rows = rollback.preimages(Path(plan['installReceipt']))
    historic = Path(report['historicalInstall']); install = Path(plan['home']) / '.opencode'
    selected = [install / name for name in ['package.json','package-lock.json','node_modules'] if (install / name).exists()]
    for item in selected:
        files = [item]
        if item.is_dir():
            files = []
            def failed(_error): raise ValueError('Restored npm enumeration failed')
            for directory, folders, names in os.walk(item, followlinks=False, onerror=failed):
                files += [Path(directory) / name for name in names + [name for name in folders if (Path(directory) / name).is_symlink()]]
        for file in files:
            original = historic / file.relative_to(install)
            if original not in rows or rollback.identity(file) != rows[original]['image']: raise ValueError('Unknown restored npm payload; not moved')
    if selected:
        destination = Path(plan['preparedRoot']) / 'restored-historical-runtime'; backup.fresh(destination)
        for item in selected:
            # Same destination disk may differ from HOME. Copy verified public
            # tree only after complete inventory, then remove only that tree.
            target = destination / item.name
            if item.is_dir(): shutil_copytree(item, target)
            else: backup.copy_verified(item, target)
            if item.is_dir():
                import shutil
                shutil.rmtree(item)
            else: item.unlink()


def shutil_copytree(source, target):
    import shutil
    shutil.copytree(source, target, symlinks=True)
    for directory, folders, files in os.walk(source, followlinks=False):
        for name in files + [name for name in folders if (Path(directory) / name).is_symlink()]:
            file = Path(directory) / name; copied = target / file.relative_to(source)
            if rollback.identity(file)['kind'] == 'symlink':
                if os.readlink(file) != os.readlink(copied): raise ValueError('Historical link preservation failed')
            elif backup.digest(file) != backup.digest(copied): raise ValueError('Historical npm preservation failed')


def known_postimages(plan):
    receipt = Path(plan['installReceipt']); report = read(receipt); rows = rollback.preimages(receipt)
    home = Path(plan['home']); historic = Path(report['historicalInstall']); plugin_before = {}
    state = home / '.local/state/opencode-addons/opencode-background-tasks/state.json'
    saved = json.loads(rows[state]['payload'].read_text())
    for item in saved.get('plugins', []) + saved.get('assets', []):
        if item.get('backupPath') and Path(item['backupPath']) in rows:
            plugin_before[Path(item['installedPath'])] = rows[Path(item['backupPath'])]['image']
    for file, row in rows.items():
        allowed = [row['image'], {'kind':'missing'}]
        if file.is_relative_to(home / '.opencode'):
            old = historic / file.relative_to(home / '.opencode')
            if old in rows: allowed.append(rows[old]['image'])
        if file in plugin_before: allowed.append(plugin_before[file])
        if file == Path(plan['entrypoint']): allowed.append({'kind':'file','sha256':hashlib.sha256(wrapper_bytes(plan)).hexdigest(),'mode':0o755})
        if file == Path(plan['entrypoint']): allowed.append({'kind':'file','sha256':hashlib.sha256(maintenance_bytes()).hexdigest(),'mode':0o755})
        if rollback.identity(file) not in allowed: raise ValueError('Unknown installation change; refusing to seal/adopt drift')


def activate(plan, *, confirmed=False, resume=False, runner=run_owned):
    settings, spec = validate(plan)
    if not confirmed: raise ValueError('Current V1 and pilot closure confirmation required')
    databases = [spec['originalDB'], spec['pilotDB']]
    if storage.users_of(databases): raise ValueError('V1/pilot still open; no activation changes')
    root = Path(plan['preparedRoot']); done = root / 'activation-complete.json'; started = root / 'activation-started.json'
    if done.exists():
        previous = read(done)
        if previous['planSHA256'] != fingerprint(plan) or rollback.identity(Path(plan['entrypoint'])) != previous['entryImage']: raise ValueError('Activated entry drift; review explicitly')
        if read(Path(plan['configRoot'])/'settings.json')!=settings or (Path(plan['configRoot'])/'entry.mjs').read_bytes()!=loader_bytes(plan):raise ValueError('Active managed config differs')
        if read(Path(plan['configRoot'])/'active.json')!=active_record(plan,settings):raise ValueError('Managed activation commit differs')
        return {'kind':'managed-v2-already-active','version':'2.2.7','historyPreserved':True}
    if started.exists():
        if not resume or read(started).get('planSHA256')!=fingerprint(plan) or (root/'activation-mutations-started.json').exists():raise ValueError('Interrupted activation retained; explicit review/rollback required, no repeated backup/lifecycle')
    elif resume:raise ValueError('No interrupted preparation to continue')
    config = Path(plan['configRoot'])
    if config.exists(): raise ValueError('Existing production config requires review; no adoption')
    rollback.verify_current(Path(plan['installReceipt']))
    # All source/settings checks precede data capture or mutation of installation.
    check = [plan['nodeBinary'], str(Path(plan['auneRoot']) / 'v2/production-check.mjs'), plan['entrySettings']]
    runner(check + ['check'], plan['home'])
    if not started.exists():backup.write_json(started, {'kind':'managed-activation-started','planSHA256':fingerprint(plan),'time':time.time()})
    phase = 'storage';release_profiles=None
    try:
        note('Captura final y transferencia nativa; puede tardar varios minutos. Fuentes preservadas.')
        if Path(spec['runRoot']).exists():
            storage.verify_sources(spec)
            if not (Path(spec['runRoot']) / 'evidence/native-transfer.json').exists():
                if not resume:raise ValueError('Native transfer incomplete; continue explicitly, no automatic retry')
                storage.resume(spec)
        else: storage.prepare(spec, closed=True)
        storage.publish(spec, closed=True)
        note('Historial publicado. Comprobando harness gestionado con sus datos definitivos, sin inferencias.')
        phase = 'managed-live-preflight'; runner(check + ['live'], plan['home'], 900)
        # Recheck source closure/preimages immediately before Background retirement.
        storage.verify_sources(spec); rollback.verify_current(Path(plan['installReceipt']))
        production_db = Path(spec['runRoot']) / 'production-storage/data/opencode/opencode.db'
        rollback.closure([spec['originalDB'],str(production_db)],True)
        release_profiles=hold_profiles(plan)
        phase = 'background-retirement'
        note('Retirando ownership Background mediante su lifecycle; rollback real preservado.')
        backup.write_json(root / 'activation-mutations-started.json', {'kind':'managed-install-mutations','planSHA256':fingerprint(plan)})
        runner([plan['nodeBinary'], str(Path(plan['backgroundRoot']) / 'scripts/restore-local-install.mjs'), '--install-root', str(Path(plan['home']) / '.opencode')], plan['home'])
        replace(Path(plan['entrypoint']),maintenance_bytes(),0o755)
        phase = 'auxiliaries-and-runtime-prefix'
        rollback.auxiliaries(Path(plan['installReceipt']), [spec['originalDB'], str(production_db)], confirmed=True)
        retire_restored_npm(plan)
        phase = 'entry-publication'; config.mkdir(mode=0o700,parents=True)
        note('Publicando entrada habitual V2 y sellando rollback.')
        backup.write_json(config / 'settings.json', settings)
        replace(config / 'entry.mjs', loader_bytes(plan), 0o600)
        replace(Path(plan['entrypoint']), wrapper_bytes(plan), 0o755)
        known_postimages(plan)
        phase = 'rollback-seal'
        rollback.seal(Path(plan['installReceipt']), root / 'managed-cutover-postimages', [spec['originalDB'], str(production_db)], confirmed=True)
        phase = 'installed-check'
        note('Verificando entrada instalada, configuración y versión.')
        runner([plan['nodeBinary'], str(Path(plan['auneRoot']) / 'v2/production-check.mjs'), str(config / 'settings.json'), 'check'], plan['home'])
        version = runner([plan['entrypoint'], '--version'], plan['home'], 30).decode().strip()
        if version != 'opencode v2.2.7': raise ValueError('Installed command version differs')
        storage.verify_sources(spec)
        result = {'kind':'managed-v2-activation-completed','version':version,'managedContract':CONTRACT,'planSHA256':fingerprint(plan),'entryImage':rollback.identity(Path(plan['entrypoint'])),'storageRoot':settings['storageRoot'],'rollbackPostimages':str(root / 'managed-cutover-postimages/postimages.json'),'originalRewritten':False,'pilotRewritten':False,'modelsRequested':0,'phase':'installed-and-verified'}
        release=release_profiles;release_profiles=None;release()
        backup.write_json(done, result)
        backup.write_json(config/'active.json',active_record(plan,settings))
        note('Entrada habitual OpenCode V2 gestionada instalada y verificada. Ya puedes abrir opencode.')
        return result
    except BaseException as error:
        if isinstance(error,ChildRefused) and phase in ['managed-live-preflight','installed-check']:
            try:
                report=json.loads(error.stdout)
                allowed={'kind','status','action','reports','modelRequests','businessCalls','errorType','details'}
                if report.get('kind')=='managed-production-verification' and set(report)<=allowed:
                    rows=report.get('reports',[])
                    if all(set(row)<={'directory','ready','readyForChat','providerConnected','mcp','blockingFindings','modelRequests','businessCalls','checked','hostStarted'} for row in rows):
                        backup.write_json(root/('verification-observation-'+str(time.time_ns())+'.json'),report)
                        if phase=='managed-live-preflight' and any(row.get('providerConnected') is False for row in rows):
                            note('Falta autenticación nativa en el store nuevo; V1 no fue retirado. Con V1/piloto aún cerrados, usa '+str(root/'opencode.staged')+' auth login y luego el comando continue con el mismo plan.')
            except (OSError,ValueError,TypeError,AttributeError):pass
        reverted=False
        if done.exists() and not (config/'active.json').exists():
            if read(done).get('planSHA256')==fingerprint(plan):os.replace(done,root/('activation-uncommitted-'+str(time.time_ns())+'.json'))
        if (root/'activation-mutations-started.json').exists():
            # Installation-only abort: return exactly to the pre-cutover entry,
            # leaving data and the previously applied V2 projects untouched.
            # Unknown drift or a reopened store prevents any forced recovery.
            try:
                production_db=Path(spec['runRoot'])/'production-storage/data/opencode/opencode.db'
                rollback.closure([spec['originalDB'],str(production_db)],True)
                retire_restored_npm(plan);known_postimages(plan)
                post=root/'managed-cutover-postimages/postimages.json'
                if not post.exists():rollback.seal(Path(plan['installReceipt']),post.parent,[spec['originalDB'],str(production_db)],confirmed=True)
                rollback.restore(post,confirmed=True)
                rollback.verify_current(Path(plan['installReceipt']))
                deactivate_entry(plan,settings)
                reverted=True
                backup.write_json(root/'activation-installation-restored.json',{'kind':'activation-installation-restored','planSHA256':fingerprint(plan),'projectOverlaysPreserved':True,'databasesRestored':False})
                note('La comprobación falló: entrada/ownership V1 restaurados; datos y overlays V2 preservados.')
            except BaseException:
                note('Se detuvo el corte. No abras clientes todavía: revisar journal y rollback conservados; no se forzó recuperación.')
        file = root / ('activation-failure-' + str(time.time_ns()) + '.json')
        backup.write_json(file, {'kind':'managed-activation-stopped','phase':phase,'errorType':type(error).__name__,'planSHA256':fingerprint(plan),'automaticRetry':False,'installationReturnedToPreCutover':reverted,'sourcesPreserved':True})
        raise RuntimeError('Managed activation stopped at '+phase+'; preserve state and inspect metadata; no automatic retry') from None
    finally:
        if release_profiles:release_profiles()


def fingerprint(plan):
    return hashlib.sha256(json.dumps(plan, sort_keys=True, separators=(',',':')).encode()).hexdigest()


def active_record(plan,settings):
    return {'kind':'managed-v2-entry-active','nativeVersion':'2.2.7','managedContract':CONTRACT,'storageRoot':settings['storageRoot'],'planSHA256':fingerprint(plan)}


def deactivate_entry(plan,settings):
    file=Path(plan['configRoot'])/'active.json'
    if file.exists():
        if read(file)!=active_record(plan,settings):raise ValueError('Unknown active entry metadata; not overwritten')
        os.replace(file,file.with_name('inactive-'+str(time.time_ns())+'.json'))


def restore(plan, *, confirmed=False, runner=run_owned):
    _,spec=validate(plan)
    rollback.closure([spec['originalDB'],str(Path(spec['runRoot'])/'production-storage/data/opencode/opencode.db')],confirmed)
    if storage.users_of([spec['pilotDB']]):raise ValueError('Close pilot clients before restoring project overlays')
    release=hold_profiles(plan)
    try:return restore_files(plan,confirmed=confirmed,runner=runner)
    finally:release()


def restore_files(plan, *, confirmed=False, runner=run_owned):
    settings, spec = validate(plan); root = Path(plan['preparedRoot'])
    production_db=Path(spec['runRoot'])/'production-storage/data/opencode/opencode.db'
    rollback.closure([spec['originalDB'],str(production_db)],confirmed)
    if storage.users_of([spec['pilotDB']]):raise ValueError('Close pilot clients before restoring project overlays')
    postimages = root / 'managed-cutover-postimages/postimages.json'
    if not postimages.exists():
        if not (root / 'activation-mutations-started.json').exists(): raise ValueError('No installation changes to restore; source entry preserved')
        rollback.closure([spec['originalDB'],str(Path(spec['runRoot'])/'production-storage/data/opencode/opencode.db')],confirmed)
        known_postimages(plan)
        rollback.seal(Path(plan['installReceipt']),root/'managed-cutover-postimages',[spec['originalDB'],str(Path(spec['runRoot'])/'production-storage/data/opencode/opencode.db')],confirmed=confirmed)
    active=Path(plan['configRoot'])/'active.json'
    if active.exists() and read(active)!=active_record(plan,settings):raise ValueError('Unknown managed entry metadata; no project changed')
    # Preserve newly created V2 history before returning the default entry to V1.
    saved=root/('rollback-production-'+str(time.time_ns()));backup.fresh(saved)
    report=backup.sqlite_backup(production_db,saved/'opencode.db');backup.write_json(saved/'backup-receipt.json',report)
    # Revert the activation cohort through its own receipts, not app files or a
    # replacement of the entire product directory. All targets preflight first.
    runner([plan['nodeBinary'],str(Path(plan['auneRoot'])/'v2/production-check.mjs'),plan['entrySettings'],'rollback',str(root/'activation-plan.json')],plan['home'])
    returned=root/'activation-installation-restored.json'
    if returned.exists():
        if read(returned).get('planSHA256')!=fingerprint(plan):raise ValueError('Installation restoration receipt differs')
        rollback.verify_current(Path(plan['installReceipt']))
        deactivate_entry(plan,settings)
        return {'kind':'installation-already-restored-projects-returned','productionDataPreserved':True,'databaseRestored':False}
    result=rollback.restore(postimages,confirmed=confirmed);deactivate_entry(plan,settings);return result


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=['prepare-plan','plan','guard-check','activate','continue','rollback']);parser.add_argument('--plan',type=Path);parser.add_argument('--prepared',type=Path);parser.add_argument('--aune-root',type=Path);parser.add_argument('--background-root',type=Path);parser.add_argument('--node',type=Path);parser.add_argument('--clients-closed',action='store_true');parser.add_argument('--confirm',action='store_true');args=parser.parse_args()
    try:
        if args.action=='prepare-plan':
            if not all([args.prepared,args.aune_root,args.background_root,args.node]):raise ValueError('Explicit preparation inputs required')
            plan=prepare_plan(args.prepared,args.aune_root,args.background_root,args.node);validate(plan);result={'kind':'managed-activation-plan-prepared','plan':str(args.prepared/'activation-plan.json'),'activeInstallationChanged':False}
        else:
            if not args.plan:raise ValueError('Explicit activation plan required')
            plan=read(args.plan);_,spec=validate(plan)
            if args.action=='guard-check':
                release=hold_profiles(plan);release();result={'kind':'managed-profile-guard-verified','databaseOpened':False,'installationChanged':False}
            elif args.action=='plan':
                report=storage.plan(spec);result={'kind':'managed-activation-preflight','sourceUsers':sorted({row['pid'] for row in report['sourceUsers']}),'freeBytes':report['freeBytes'],'requiredFreeEstimate':report['requiredFreeEstimate'],'storageDestinationExists':report['destinationExists'],'entrypoint':plan['entrypoint'],'managedContract':CONTRACT,'installationChanged':False,'databaseOpened':False}
            else:
                if not(args.clients_closed and args.confirm):raise ValueError('Current closure and activation confirmation required')
                with lease(plan),heartbeat():result=activate(plan,confirmed=True,resume=args.action=='continue') if args.action in ['activate','continue'] else restore(plan,confirmed=True)
        print(json.dumps(result))
    except BaseException as error:
        parser.exit(1,'Managed activation refused/stopped: '+(str(error) if type(error) in [ValueError,RuntimeError] else type(error).__name__)+'; no automatic client shutdown or recovery.\n')


if __name__=='__main__':main()
