"""Fresh base installation. No takeover, configuration import or history copy."""

import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import stat
import subprocess
import tarfile
import tempfile


def preflight(home, physical):
    physical(home)
    if not home.is_dir() or home.stat().st_uid != os.getuid() or Path(os.environ['HOME']) != home:
        raise ValueError('An existing user-owned canonical HOME is required')
    state = home / '.local/state/opencode-stack/install'
    entry = home / '.opencode/bin/opencode'
    config = Path(os.environ.get('XDG_CONFIG_HOME') or home / '.config')
    data = Path(os.environ.get('XDG_DATA_HOME') or home / '.local/share')
    for existing in (home / '.opencode', home / '.config/opencode', config / 'opencode',
                     home / '.local/share/opencode', data / 'opencode', home / '.local/share/opencode-v2-clean',
                     home / '.local/bin/opencode', state / 'current.json'):
        if existing.exists() or existing.is_symlink():
            raise ValueError('Existing OpenCode files detected; installation does not take ownership')
    if any(os.environ.get(key) for key in ('OPENCODE_CONFIG', 'OPENCODE_CONFIG_DIR', 'OPENCODE_CONFIG_CONTENT', 'OPENCODE_DB')):
        raise ValueError('Remove OpenCode configuration/storage overrides from this terminal before installation')
    physical(state); physical(entry); physical(config); physical(data)
    node = shutil.which('node')
    if not node or any(shutil.which(cmd) is None for cmd in ('git', 'npm')):
        raise ValueError('Git, Node.js 22.22.2+ and npm are required')
    return Path(node), state / 'current.json', entry


def publish_new(file, content, mode):
    """Atomically create an entry, without replacing any existing file."""
    with tempfile.NamedTemporaryFile(dir=file.parent) as staged:
        staged.write(content); staged.flush()
        os.fchmod(staged.fileno(), mode); os.fsync(staged.fileno())
        os.link(staged.name, file, follow_symlinks=False)
    fd = os.open(file.parent, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)


def install_base(home, generation, *, source, physical, run, write):
    node, marker, entry = preflight(home, physical)
    physical(generation)
    if generation.is_relative_to(home / '.opencode'):
        raise ValueError('Generation must be separate from the command directory')
    if run(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=source):
        raise ValueError('Install from a clean tracked checkout')
    revision = run(['git', 'rev-parse', 'HEAD'], cwd=source)
    generation.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    generation.mkdir(mode=0o700)
    try:
        core = generation / 'sources/opencode-stack'
        core.mkdir(parents=True, mode=0o700)
        with tempfile.TemporaryDirectory(dir=generation) as temporary:
            archive = Path(temporary) / 'source.tar'
            run(['git', 'archive', '--format=tar', '--output=' + str(archive), revision], cwd=source)
            with tarfile.open(archive) as files:
                files.extractall(core, filter='data')
        build = json.loads(run([node, core / 'v2/install/fresh.mjs', generation, home], cwd=core,
                               env={'PATH': os.environ['PATH'], 'HOME': str(home)}, budget=400))
        if build.get('kind') != 'fresh-native-staged' or build.get('nativeVersion') != '2.2.7':
            raise ValueError('Fresh native profile not verified')
        version = run([node, generation / 'entry.mjs', '--version'], cwd=core)
        if version != 'opencode v2.2.7':
            raise ValueError('Native entry version not verified')
        preflight(home, physical)
        install_entry = generation / 'entry.mjs'
        wrapper = ('#!/bin/sh\nexec ' + shlex.join([str(node), str(install_entry)]) + ' "$@"\n').encode()
        complete = {'kind': 'fresh-native-install-complete', 'profile': 'base', 'version': '2.2.7',
                    'generation': str(generation), 'sourceRevision': revision, 'entry': str(entry), 'needsLogin': True}
        write(generation / 'complete.json', complete)
        entry.parent.mkdir(parents=True, mode=0o700)
        physical(entry)
        publish_new(entry, wrapper, 0o755)
        try:
            publish_new(marker, (json.dumps({'kind': 'opencode-stack-managed-generation', 'generation': str(generation),
                                             'entrySHA256': hashlib.sha256(wrapper).hexdigest()}) + '\n').encode(), 0o600)
        except OSError:
            if not marker.exists() and not marker.is_symlink() and stat.S_ISREG(entry.lstat().st_mode) and entry.read_bytes() == wrapper:
                entry.unlink()
            raise
        return complete
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        write(generation / 'failure.json', {'kind': 'fresh-native-install-stopped', 'errorType': type(error).__name__,
              'automaticRetry': False})
        raise
