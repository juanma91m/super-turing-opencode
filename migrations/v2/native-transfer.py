"""Orchestrate official public migration/export/import inside an isolated worker.

No SQL, converter, transcript files, authentication files, sanitization, business
tools or model calls. Export DTOs live only in RAM; API errors never print bodies.
"""
import base64
import hashlib
import http.client
import json
import os
from pathlib import Path
import queue
import re
import secrets
import shutil
import subprocess
import threading
import time
import urllib.parse


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()


class NativeHost:
    def __init__(self, database, profile, deadline):
        self.deadline = deadline
        self.password = secrets.token_urlsafe(32)
        profile = Path(profile)
        for name in ['home', 'config/opencode', 'state', 'cache', 'data', 'tmp', 'project']:
            (profile / name).mkdir(parents=True, exist_ok=True, mode=0o700)
        # No original project or installed harness is mounted. Neutral policy also
        # rejects provider/MCP use; only explicit public metadata/history is read.
        config = {'update': 'disable', 'warming': False, 'snapshots': False,
                  'plugins': ['-opencode.provider.ollama'], 'mcp': {'servers': {}},
                  'policies': [{'action': 'provider.use', 'resource': '*', 'effect': 'deny'},
                               {'action': 'mcp.use', 'resource': '*', 'effect': 'deny'}]}
        (profile / 'config/opencode/opencode.json').write_text(json.dumps(config))
        env = {'HOME': str(profile / 'home'), 'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8',
               'XDG_CONFIG_HOME': str(profile / 'config'), 'XDG_DATA_HOME': str(profile / 'data'),
               'XDG_STATE_HOME': str(profile / 'state'), 'XDG_CACHE_HOME': str(profile / 'cache'),
               'OPENCODE_CONFIG_DIR': str(profile / 'config/opencode'), 'OPENCODE_DB': database,
               'OPENCODE_PASSWORD': self.password, 'OPENCODE_DISABLE_MODELS_FETCH': '1',
               'OPENCODE_DISABLE_AUTOUPDATE': '1', 'OPENCODE_DISABLE_EXTERNAL_SKILLS': '1',
               'OPENCODE_DISABLE_CLAUDE_CODE_SKILLS': '1', 'TMPDIR': str(profile / 'tmp')}
        env.update(GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1', GIT_OPTIONAL_LOCKS='0')
        env.update(GIT_CONFIG_COUNT='2', GIT_CONFIG_KEY_0='core.fsmonitor', GIT_CONFIG_VALUE_0='false',
                   GIT_CONFIG_KEY_1='core.hooksPath', GIT_CONFIG_VALUE_1='/dev/null')
        self.env = env
        self.failure = None
        self.pending_since = None
        self.request_lock = threading.Lock()
        self.stopping = threading.Event()
        self.process = subprocess.Popen(['/runtime/opencode', 'serve', '--stdio', '--hostname', '127.0.0.1', '--port', '0'],
                                        cwd=profile / 'project', env=env, stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        def deadline_reached():
            self.failure = 'absolute_native_budget_exceeded'
            try: self.process.terminate()
            except ProcessLookupError: pass
        self.watchdog = threading.Timer(max(.01, deadline-time.monotonic()), deadline_reached)
        self.watchdog.start()
        def observe():
            # Independent of SQLite and a potentially long migration HTTP wait.
            # Numeric/status telemetry only; never argv, auth, URLs or bodies.
            with open('/evidence/observation-' + profile.name + '-' + str(time.monotonic_ns()) + '.jsonl', 'x') as log:
                while not self.stopping.is_set():
                    try:
                        free = shutil.disk_usage('/destination').free
                        row = {'alive': self.process.poll() is None, 'freeBytes': free,
                               'pendingOver120s': self.pending_since is not None and time.monotonic()-self.pending_since > 120}
                        try:
                            fields = Path('/proc/' + str(self.process.pid) + '/stat').read_text().rsplit(')', 1)[1].split()
                            row.update(cpuUserTicks=int(fields[11]), cpuSystemTicks=int(fields[12]))
                        except OSError: pass
                        log.write(json.dumps(row) + '\n'); log.flush()
                        if free < 20 * 1024**3:
                            self.failure = 'native_destination_space_low'
                            try: self.process.terminate()
                            except ProcessLookupError: pass
                            return
                    except OSError:
                        self.failure = 'native_space_observer_failed'
                        try: self.process.terminate()
                        except ProcessLookupError: pass
                        return
                    self.stopping.wait(5)
        def observe_safely():
            try: observe()
            except OSError:
                self.failure = 'native_observation_unavailable'
                try: self.process.terminate()
                except ProcessLookupError: pass
        self.observer = threading.Thread(target=observe_safely, daemon=True); self.observer.start()
        lines = queue.Queue()
        def drain():
            for line in self.process.stdout:
                try:
                    record = json.loads(line)
                    if isinstance(record.get('url'), str): lines.put(record['url'])
                except (ValueError, AttributeError): pass
            lines.put(None)
        threading.Thread(target=drain, daemon=True).start()
        try:
            self.url = lines.get(timeout=min(30, self.remaining()))
            parsed = urllib.parse.urlsplit(self.url or '')
            if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or not parsed.port or parsed.username or parsed.password:
                raise RuntimeError('invalid_owned_native_endpoint')
            self.port = parsed.port
        except BaseException:
            self.close(); raise RuntimeError('owned_native_host_not_ready') from None

    def remaining(self):
        if self.failure: raise RuntimeError(self.failure)
        value = self.deadline-time.monotonic()
        if value <= 0: raise RuntimeError('absolute_native_budget_exceeded')
        if shutil.disk_usage('/destination').free < 20 * 1024**3: raise RuntimeError('native_destination_space_low')
        return value

    def request(self, method, route, data=None):
        if not route.startswith('/') or route.startswith('//'): raise RuntimeError('invalid_public_route')
        if not self.request_lock.acquire(blocking=False): raise RuntimeError('overlapping_native_request')
        self.pending_since = time.monotonic()
        connection = None
        try:
            connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=min(30, self.remaining()))
            connection.connect(); connection.sock.settimeout(self.remaining())
            headers = {'Authorization': 'Basic ' + base64.b64encode(('opencode:' + self.password).encode()).decode()}
            if data is not None: headers['Content-Type'] = 'application/json'
            connection.request(method, route, body=json.dumps(data) if data is not None else None, headers=headers)
            response = connection.getresponse(); body = response.read(512 * 1024**2 + 1)
            if len(body) > 512 * 1024**2: raise RuntimeError('native_transfer_response_too_large')
            value = json.loads(body) if body else None
            self.remaining()
            if response.status >= 400: raise RuntimeError('native_http_' + str(response.status))
            return value
        except (OSError, http.client.HTTPException, ValueError):
            raise RuntimeError('native_http_transport_or_json_failed') from None
        finally:
            if connection is not None: connection.close()
            self.pending_since = None; self.request_lock.release()

    def close(self):
        self.stopping.set(); self.observer.join(timeout=1)
        self.watchdog.cancel()
        if self.process.stdin: self.process.stdin.close()
        try: self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            try: self.process.wait(timeout=3)
            except subprocess.TimeoutExpired: self.process.kill(); self.process.wait()


def pages(host, route):
    cursor = None; seen = set()
    for _ in range(100000):
        query = {'limit': 200, **({'cursor': cursor} if cursor else {'order': 'asc'})}
        result = host.request('GET', route + '?' + urllib.parse.urlencode(query))
        yield from result['data']
        cursor = (result.get('cursor') or {}).get('next')
        if not cursor: return
        if cursor in seen: raise RuntimeError('native_cursor_repeated')
        seen.add(cursor)
    raise RuntimeError('native_page_budget_exceeded')


def migration(host):
    while True:
        value = host.request('GET', '/api/experimental/migration/v1')
        if value.get('status') == 'completed': return
        if value.get('status') not in ['required', 'running']: raise RuntimeError('native_migration_not_completed')
        time.sleep(min(1, host.remaining()))


def exported(host, sid):
    data = host.request('GET', '/api/experimental/session/' + sid + '/export')['data']
    if data.get('info', {}).get('id') != sid: raise RuntimeError('native_export_identity_mismatch')
    # The native exporter drops unsettled rows. Detect that rather than silently
    # accepting its loss; the full source backup is kept regardless.
    stored = [row['id'] for row in pages(host, '/api/session/' + sid + '/message')]
    if stored != [row['id'] for row in data['messages']]: raise RuntimeError('native_export_excludes_unsettled_messages')
    return data


def transferable(data):
    info = data['info']
    return {'messages': data['messages'], 'info': {key: info.get(key) for key in ['id', 'parentID', 'projectID', 'title', 'agent', 'model', 'permissions', 'metadata']},
            'created': info['time']['created'], 'archived': info['time'].get('archived')}


def transfer(source, target, prepare_location=lambda directory: None):
    original = {row['id']: row for row in pages(target, '/api/session')}
    pilot = {row['id']: row for row in pages(source, '/api/session')}
    known = set(original); duplicate = 0
    # Conflicts are checked before the first import, never SQL-merged or replaced.
    for sid in sorted(set(original) & set(pilot)):
        if fingerprint(transferable(exported(source, sid))) != fingerprint(transferable(exported(target, sid))):
            raise RuntimeError('divergent_existing_session_no_native_merge')
        duplicate += 1
    pending = set(pilot) - known; imported = 0
    while pending:
        ready = sorted(sid for sid in pending if not pilot[sid].get('parentID') or pilot[sid]['parentID'] in known)
        if not ready: raise RuntimeError('missing_parent_or_native_family_cycle')
        for sid in ready:
            data = exported(source, sid)
            directory = data['info']['location']['directory']; prepare_location(directory)
            target.request('POST', '/api/experimental/session/import', {**data, 'location': {'directory': directory}})
            actual = exported(target, sid)
            if fingerprint(transferable(data)) != fingerprint(transferable(actual)) or actual['info']['location']['directory'] != directory or actual['info'].get('projectID') != data['info'].get('projectID'):
                raise RuntimeError('native_transfer_verification_failed')
            pending.remove(sid); known.add(sid); imported += 1
    actual = {row['id'] for row in pages(target, '/api/session')}
    if actual != set(original) | set(pilot): raise RuntimeError('native_union_listing_mismatch')
    return {'originalSessions': len(original), 'pilotSessions': len(pilot), 'identicalDuplicates': duplicate,
            'importedSessions': imported, 'finalSessions': len(actual), 'nativeTransferVerified': True}


def placeholder(directory):
    file = Path(directory)
    if not file.is_absolute() or str(file) != os.path.normpath(file) or len(file.parts) < 3 or file.parts[1] in ['usr', 'proc', 'dev', 'runtime', 'operations', 'destination', 'pilot', 'profiles', 'evidence', 'bin', 'lib', 'lib64']:
        raise RuntimeError('session_location_conflicts_with_worker_namespace')
    # Empty same-name locations in the private namespace, never host projects.
    file.mkdir(parents=True, exist_ok=True, mode=0o700)


def native_auth_pipe(source, target, deadline):
    """Explicit native credential transfer via OS pipe; no auth file or logging.

    This is opt-in, not login/fallback, and keeps native import's conflict/selection
    semantics. Real credentials are never exposed to the caller/model.
    """
    env_source = {**source.env, 'OPENCODE_PASSWORD': source.password}
    env_target = {**target.env, 'OPENCODE_PASSWORD': target.password}
    exporter = subprocess.Popen(['/runtime/opencode', 'auth', 'export', '--server', source.url], env=env_source,
                                cwd='/profiles/pilot/project', stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    importer = subprocess.Popen(['/runtime/opencode', 'auth', 'import', '--server', target.url], env=env_target,
                                cwd='/profiles/target/project', stdin=exporter.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    exporter.stdout.close()
    try:
        code_target = importer.wait(timeout=max(.01, deadline-time.monotonic()))
        code_source = exporter.wait(timeout=max(.01, deadline-time.monotonic()))
        if code_source or code_target: raise RuntimeError('native_auth_pipe_failed')
    finally:
        for child in [exporter, importer]:
            if child.poll() is None: child.terminate()
            try: child.wait(timeout=3)
            except subprocess.TimeoutExpired: child.kill(); child.wait()


def worker():
    os.umask(0o077)
    spec = json.loads(Path('/evidence/worker-spec.json').read_text())
    deadline = time.monotonic() + spec['budgetSeconds']
    target = source = None
    try:
        target = NativeHost('/destination/data/opencode/opencode.db', '/profiles/target', deadline); migration(target)
        source = NativeHost('/pilot/opencode.db', '/profiles/pilot', deadline); migration(source)
        result = transfer(source, target, placeholder)
        if spec['authTransfer'] == 'native-pipe': native_auth_pipe(source, target, deadline)
        result.update(kind='final-native-storage-transfer', migrationCompleted=True,
                      authTransfer=spec['authTransfer'], modelRequests=0, businessToolCalls=0,
                      credentialValidityVerified=False, externalApplicationFilesRestored=False)
    finally:
        if source: source.close()
        if target: target.close()
    with open('/evidence/native-transfer.json', 'x') as file: json.dump(result, file, indent=2)


if __name__ == '__main__':
    try: worker()
    except BaseException as error:
        label = str(error) if type(error) is RuntimeError and re.fullmatch('[a-z0-9_]+', str(error)) else 'native_worker_' + type(error).__name__
        try:
            with open('/evidence/native-transfer-failure.json', 'x') as file: json.dump({'kind': 'native-transfer-failure', 'label': label}, file)
        except OSError: pass
        raise SystemExit('Native transfer failed; sources untouched, working copies retained; no raw bodies/auth logged.')
