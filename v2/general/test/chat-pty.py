#!/usr/bin/env python3
"""Run only the synthetic candidate worker in an owned PTY; emit booleans only."""
import fcntl
import json
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import termios
import time

node, worker, descriptor = sys.argv[1:]
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 35, 140, 0, 0))
child = subprocess.Popen([node, worker, descriptor], stdin=slave, stdout=slave, stderr=slave, start_new_session=True, env=dict(os.environ))
os.close(slave)
buffer = b''

def collect(seconds):
    global buffer
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if select.select([master], [], [], 0.05)[0]:
            try:
                buffer += os.read(master, 65536)
            except OSError:
                break
        if len(buffer) > 4 * 1024 * 1024:
            raise RuntimeError('Synthetic TUI output limit exceeded')

try:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline and child.poll() is None:
        collect(0.2)
        if b'Master-Dev' in buffer or b'FIXTURE_PRELAUNCH_FAILED' in buffer:
            break
    ready = b'Master-Dev' in buffer and b'FIXTURE_PRELAUNCH_FAILED' not in buffer
    # Only this owned UI/worker. The Node launcher forwards the signal to its
    # child and closes its owned server and lease; no process-name/PID discovery.
    if child.poll() is None:
        child.send_signal(signal.SIGTERM)
    deadline = time.monotonic() + 10
    while child.poll() is None and time.monotonic() < deadline:
        collect(0.2)
    collect(0.2)
    print(json.dumps({'nativeTuiReady': ready, 'workerClosed': b'FIXTURE_WORKER_CLOSED' in buffer, 'workerExited': child.poll() is not None, 'prelaunchFailed': b'FIXTURE_PRELAUNCH_FAILED' in buffer, 'authNotReady': b'FIXTURE_AUTH_NOT_READY' in buffer}), flush=True)
finally:
    if child.poll() is None:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait(timeout=5)
    os.close(master)
