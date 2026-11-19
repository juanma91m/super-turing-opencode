#!/usr/bin/env python3
"""Owned synthetic TUI client; stdout is metadata-only JSON, never a transcript."""
import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import termios
import time

binary, url, session, cwd = sys.argv[1:]
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 35, 140, 0, 0))
child = subprocess.Popen([binary, "--server", url, "--session", session], cwd=cwd, env=dict(os.environ), stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
buffer = b""


def collect(seconds):
    global buffer
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if select.select([master], [], [], 0.05)[0]:
            try:
                buffer += os.read(master, 65536)
            except OSError:
                break
        assert len(buffer) < 8 * 1024 * 1024
    return re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", buffer.decode("utf-8", errors="replace"))


def report(kind, text):
    print(json.dumps({"kind": kind, "running": child.poll() is None, "agentVisible": "Master-Dev" in text,
        "questionVisible": "SYNTHETIC_QUESTION_UI" in text, "yesVisible": "YES_FIXTURE" in text,
        "noVisible": "NO_FIXTURE" in text, "askedSummary": "Asked" in text and "question" in text,
        "permissionVisible": "Permission required" in text, "permissionProbeVisible": "PERMISSION_UI_PROBE.txt" in text,
        "osc777Notifications": buffer.count(b"\x1b]777;notify;"),
        "osc9Notifications": buffer.count(b"\x1b]9;"),
        "httpErrorVisible": bool(re.search(r"(?:Error|error)[^\n]{0,100}(?:400|404|500)", text))}), flush=True)


try:
    report("ready", collect(4))
    for line in sys.stdin:
        command = json.loads(line)
        if command["action"] == "inspect":
            report("inspect", collect(2))
        elif command["action"] == "blur":
            os.write(master, b"\x1b[I")
            collect(0.2)
            os.write(master, b"\x1b[O")
            report("blur", collect(0.5))
        elif command["action"] == "desktop-test":
            os.write(master, b"/alerts-test")
            collect(0.4)
            os.write(master, b"\r")
            report("desktop-test", collect(1.5))
        elif command["action"] == "answer":
            os.write(master, b"\r")
            collect(0.5)
            os.write(master, b"\r")
            report("answer", collect(1))
        elif command["action"] == "reject":
            os.write(master, b"\x1b")  # Native root-session rejection shortcut.
            report("reject", collect(1))
        elif command["action"] == "stop":
            break
finally:
    if child.poll() is None:
        # Closing this disposable fixture is allowed; never touch user's client.
        os.write(master, b"\x03")
        time.sleep(0.2)
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=5)
    os.close(master)
