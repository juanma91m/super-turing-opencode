#!/usr/bin/env python3
"""Requested analysis Markdown under project tmp; not app editing or ticket handoff."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import stat
import subprocess
import sys
import time

from planner_shell import clean_env, git_command


MAX_BYTES = 64 * 1024
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
RESERVED = {'verdict.md', 'result-dev.md'}


def safe_parts(value):
    path = PurePosixPath(value)
    parts = path.parts
    if (path.is_absolute() or len(parts) < 2 or len(parts) > 12 or parts[0] != 'tmp'
            or value != path.as_posix() or len(value) > 512 or '\\' in value
            or any(not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', part) for part in parts)
            or any(part in ('.', '..') for part in parts)
            or not parts[-1].endswith('.md')):
        raise ValueError('Use a canonical relative tmp/.../*.md path without hidden components')
    if parts[-1].lower() in RESERVED or 'code-review' in (part.lower() for part in parts):
        raise ValueError('Handoff and code-review artifacts require their own approved workflow')
    return parts


def untracked(root, path):
    result = subprocess.run(git_command(['ls-files', '--error-unmatch', '--', path]), cwd=root,
                            env=clean_env(), capture_output=True, timeout=10)
    if result.returncode == 0:
        raise ValueError('Planner analysis-doc does not edit versioned files')
    if result.returncode not in (1, 128) or (result.returncode == 128 and (root / '.git').exists()):
        raise ValueError('Cannot verify that the analysis document is untracked')


def open_parent(root, parts, create):
    directory = os.open(root, DIR_FLAGS)
    try:
        for part in parts[:-1]:
            if create:
                try:
                    os.mkdir(part, 0o700, dir_fd=directory)
                except FileExistsError:
                    pass
            child = os.open(part, DIR_FLAGS, dir_fd=directory)
            os.close(directory)
            directory = child
        return directory
    except BaseException:
        os.close(directory)
        raise


def read_entry(directory, name):
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    except FileNotFoundError:
        return None
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_mode & 0o111 or before.st_size > MAX_BYTES:
            raise ValueError('Existing destination must be a small regular non-executable file without hardlinks')
        content = b''
        while len(content) <= MAX_BYTES:
            chunk = os.read(fd, MAX_BYTES + 1 - len(content))
            if not chunk:
                break
            content += chunk
        after = os.fstat(fd)
        if len(content) > MAX_BYTES or (before.st_mtime_ns, before.st_size) != (after.st_mtime_ns, after.st_size):
            raise ValueError('Existing document exceeds the limit or changed while reading')
        return content, (after.st_dev, after.st_ino, after.st_mtime_ns, after.st_size)
    finally:
        os.close(fd)


def metadata(path, entry):
    return {'path': path, 'exists': entry is not None,
            **({'bytes': len(entry[0]), 'sha256': hashlib.sha256(entry[0]).hexdigest()} if entry else {})}


def operate(root, path, content=None, expected=None):
    parts = safe_parts(path)
    untracked(root, path)
    data = None
    if content is not None:
        data = content.encode('utf-8')
        if not content.strip() or len(data) > MAX_BYTES or '\x00' in content or re.search(r'<private(?:\s|>)', content, re.I):
            raise ValueError('Use nonempty Markdown up to 64 KiB, without NUL or private-marked content')
    try:
        directory = open_parent(root, parts, data is not None and expected is None)
    except FileNotFoundError:
        if data is None:
            return metadata(path, None)
        raise ValueError('Expected document is absent; inspect before replacing') from None
    temporary = None
    try:
        deadline = time.monotonic() + 3
        while True:
            try:
                fcntl.flock(directory, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise ValueError('Document directory is busy; retry after inspecting') from None
                time.sleep(0.02)
        current = read_entry(directory, parts[-1])
        if data is None:
            return metadata(path, current)
        if current is not None and expected is None:
            raise ValueError('Destination exists; inspect and supply --expected-sha256 to replace it')
        if expected is not None and (current is None or hashlib.sha256(current[0]).hexdigest() != expected):
            raise ValueError('Expected digest does not match; document absent or changed')
        temporary = '.planner-doc-' + secrets.token_hex(12) + '.tmp'
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if read_entry(directory, parts[-1]) != current:
            raise ValueError('Document changed before publication; no overwrite performed')
        if current is None:
            os.link(temporary, parts[-1], src_dir_fd=directory, dst_dir_fd=directory, follow_symlinks=False)
        else:
            os.replace(temporary, parts[-1], src_dir_fd=directory, dst_dir_fd=directory)
            temporary = None
        if temporary is not None:
            os.unlink(temporary, dir_fd=directory)
            temporary = None
        os.fsync(directory)
        return {'path': path, 'exists': True, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                'operation': 'created' if current is None else 'replaced'}
    finally:
        if temporary is not None:
            os.unlink(temporary, dir_fd=directory)
        os.close(directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='verb', required=True)
    commands.add_parser('help')
    for verb in ('inspect', 'write'):
        command = commands.add_parser(verb)
        command.add_argument('--path', required=True)
        if verb == 'write':
            command.add_argument('--content', required=True)
            command.add_argument('--expected-sha256', type=lambda value: value if re.fullmatch('[a-f0-9]{64}', value) else parser.error('Invalid expected digest'))
    args = parser.parse_args()
    if args.verb == 'help':
        parser.print_help()
        print('inspect --path tmp/.../*.md | write --path tmp/.../*.md --content <literal> [--expected-sha256 <digest>]')
        return 0
    try:
        result = operate(Path.cwd().resolve(), args.path, getattr(args, 'content', None), getattr(args, 'expected_sha256', None))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except UnicodeError:
        print('Analysis document blocked: invalid UTF-8 content', file=sys.stderr)
        return 2
    except ValueError as error:
        print(f'Analysis document blocked: {error}', file=sys.stderr)
        return 2
    except (OSError, subprocess.SubprocessError):
        # Do not print filesystem/subprocess payloads or document content.
        print('Analysis document blocked: unavailable/unsafe filesystem; inspect before retrying.', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
