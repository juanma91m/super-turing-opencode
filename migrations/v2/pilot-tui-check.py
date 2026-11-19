#!/usr/bin/env python3
"""Initial PTY render only. No prompts, login, recorded terminal or real model."""
import fcntl
import json
import os
import pathlib
import pty
import re
import select
import signal
import struct
import subprocess
import termios
import time

source = pathlib.Path(__file__).resolve().parents[2]
status = subprocess.run(["node", "migrations/v2/pilot.mjs", "verify"], cwd=source, capture_output=True, text=True, check=True)
assert not json.loads(status.stdout)["connected"], "PTY check requires an unauthenticated initial profile; use manual QA after login"
metadata = subprocess.run([
    "node", "--input-type=module", "-e",
    'import {environment,layout} from "./migrations/v2/staging.mjs";'
    'import {preparePilot} from "./migrations/v2/pilot-profile.mjs";'
    'import os from "node:os";import path from "node:path";'
    'const base=layout(path.join(os.homedir(),".local/share/opencode-v2-clean"));'
    'const p=preparePilot(path.join(base.root,"pilot"));'
    'console.log(JSON.stringify({binary:base.binary,env:environment(p),cwd:p.project}));'
], cwd=source, capture_output=True, text=True, check=True)
data = json.loads(metadata.stdout)
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 120, 0, 0))
child = subprocess.Popen([data["binary"], "--standalone"], cwd=data["cwd"], env=data["env"], stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
buffer = b""
text = ""
try:
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        if select.select([master], [], [], 0.1)[0]:
            try:
                chunk = os.read(master, 65536)
            except OSError:
                break
            buffer += chunk
            assert len(buffer) < 4 * 1024 * 1024, "Unexpected terminal output volume"
        text = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", buffer.decode("utf-8", errors="replace")).lower()
        if "v2-pilot" in text:
            break
    assert child.poll() is None, "TUI exited during initial render"
    assert "v2-pilot" in text, "Pilot agent not found in initial TUI render"
    assert "error:" not in text, "Error shown during initial render"
    print("OK PTY initial render: official V2 and v2-pilot; no prompt/login sent")
finally:
    if child.poll() is None:
        os.write(master, b"\x03")
        time.sleep(0.3)
        if child.poll() is None:
            os.write(master, b"\x03")
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGTERM)
            child.wait(timeout=5)
    os.close(master)
