#!/usr/bin/env python3
"""PTY keybind regression on a disposable unauthenticated workshop. No inference."""
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
metadata = subprocess.run([
    "node", "--input-type=module", "-e",
    'import fs from "node:fs";import os from "node:os";import path from "node:path";'
    'import {environment,layout} from "./migrations/v2/staging.mjs";'
    'import {prepareWorkshop,workshopKeybinds} from "./migrations/v2/workshop-profile.mjs";'
    'import {startServer} from "./migrations/v2/private-server.mjs";'
    'const base=layout(path.join(os.homedir(),".local/share/opencode-v2-clean"));'
    'const root=fs.mkdtempSync("/tmp/opencode/keys-v2-");'
    'const p=prepareWorkshop(root,{mock:"http://127.0.0.1:1/v1"});'
    'const s=await startServer(base.binary,p);const sessions=[];'
    'try{for(let i=0;i<2;i++){const r=await s.request("POST","/api/session",{title:"Keybind fixture",agent:"master-dev",model:{providerID:"workshop-mock",id:"mock"},location:{directory:p.project}});if(r.status!==200)throw new Error("Synthetic session creation failed");sessions.push(r.value.data.id);}}finally{await s.close();}'
    'console.log(JSON.stringify({binary:base.binary,env:environment(p),cwd:p.project,root,sessions,keybinds:workshopKeybinds,cli:path.join(p.config,"opencode/cli.json")}));'
], cwd=source, capture_output=True, text=True, check=True)
data = json.loads(metadata.stdout)


def launch(config, session):
    pathlib.Path(data["cli"]).write_text(json.dumps(config))
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 140, 0, 0))
    child = subprocess.Popen([data["binary"], "--standalone", "--session", session], cwd=data["cwd"], env=data["env"], stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
    os.close(slave)
    return child, master


def collect(fd, seconds):
    output = b""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if select.select([fd], [], [], 0.05)[0]:
            try:
                output += os.read(fd, 65536)
            except OSError:
                break
        assert len(output) < 4 * 1024 * 1024
    return re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", output.decode("utf-8", errors="replace"))


def close(child, master):
    try:
        if child.poll() is None:
            os.write(master, b"\x03")
            time.sleep(0.2)
            if child.poll() is None:
                os.write(master, b"\x03")
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGTERM)
                child.wait(timeout=5)
    finally:
        os.close(master)


def agent(text):
    found = re.findall(r"Master-Dev|Agent-Design|Code-Reviewer|Planner", text, re.I)
    return found[-1].lower() if found else None


original = json.loads(pathlib.Path(data["cli"]).read_text())
original.pop("keybinds", None)
child, master = launch(original, data["sessions"][0])
try:
    initial = collect(master, 5)
    assert agent(initial), "Initial agent footer not rendered"
    os.write(master, b"\t")
    tab = collect(master, 1)
    os.write(master, b"\x1b[Z")
    shift = collect(master, 1)
    print(json.dumps({"mode": "native", "initial": agent(initial), "tabRenderedAgent": agent(tab), "shiftTabRenderedAgent": agent(shift)}))
    assert agent(shift) and agent(shift) != agent(initial), "Native Shift+Tab did not cycle"
    assert agent(tab) in (None, agent(initial)), "Native Tab unexpectedly cycled"
finally:
    close(child, master)

configured = {**original, "keybinds": data["keybinds"]}
child, master = launch(configured, data["sessions"][1])
try:
    initial = collect(master, 5)
    assert agent(initial), "Initial configured agent footer not rendered"
    os.write(master, b"\t")
    forward = collect(master, 1)
    assert agent(forward) and agent(forward) != agent(initial), "Configured Tab did not cycle forward"
    os.write(master, b"\x1b[Z")
    reverse = collect(master, 1)
    assert agent(reverse) == agent(initial), "Configured Shift+Tab did not return to initial agent"
    os.write(master, b"@app/me")
    menu = collect(master, 1)
    os.write(master, b"\x00")  # Ctrl+Space in legacy terminals.
    complete = collect(master, 1)
    print(json.dumps({"mode": "configured", "initial": agent(initial), "tab": agent(forward), "shiftTab": agent(reverse), "completionCommitted": "@app/message.txt" in complete}))
    assert "@app/message.txt" in complete, f"Fixture autocomplete not committed (synthetic PTY output): {complete!r}"
finally:
    close(child, master)
print("OK PTY keybind regression; no prompt submitted, no login or real model used")
