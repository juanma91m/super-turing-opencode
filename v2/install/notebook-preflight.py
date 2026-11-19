#!/usr/bin/env python3
"""Bounded notebook inventory; no OpenCode launch, DB opens, config dump or writes.

Python 3.8+ so that older machines can diagnose before running the newer updater.
This is not installation approval: owner selectors still validate complete wiring.
"""
import argparse
import json
import os
from pathlib import Path
import platform
import pwd
import re
import shutil
import subprocess
import sys


def physical(path):
    return path.is_absolute() and not any(p.is_symlink() for p in [path] + list(path.parents))


def metadata(path):
    if not physical(path):
        return {"present": path.exists() or path.is_symlink(), "symlinkedPath": True}
    if not path.exists():
        return {"present": False}
    stat = path.stat()
    return {"present": True, "directory": path.is_dir(), "bytes": stat.st_size if path.is_file() else None}


def node_version(home):
    binary = shutil.which("node")
    if not binary:
        return {"present": False, "compatible": False}
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(home), "LANG": "C.UTF-8"}
    try:
        run = subprocess.run([binary, "--version"], cwd=home, env=env, stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10, universal_newlines=True)
        match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)\s*", run.stdout) if run.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        match = None
    if not match:
        return {"present": True, "compatible": False, "version": "unavailable"}
    major, minor, patch = map(int, match.groups())
    compatible = (major == 22 and (minor, patch) >= (22, 2) or
                  major == 24 and (minor, patch) >= (15, 0) or major >= 26)
    return {"present": True, "version": ".".join(match.groups()), "compatible": compatible}


def inspect(home):
    if not physical(home) or not home.is_dir():
        raise ValueError("Existing physical absolute HOME required")
    paths = {
        "legacySQLite": home / ".local/share/opencode/opencode.db",
        "legacyJSONSessions": home / ".local/share/opencode/storage/session",
        "productionV2Settings": home / ".config/opencode/production-v2/settings.json",
        "updaterGeneration": home / ".local/state/opencode-stack/install/current.json",
        "engramDefault": home / ".engram/engram.db",
        "engramAlternate": home / ".local/share/engram/engram.db",
        "corpusDefault": home / ".local/share/super-turing-opencode-knowledge/qdrant",
        "backgroundOwnershipMarker": home / ".opencode/.opencode-background-addon.json",
    }
    inventory = {key: metadata(path) for key, path in paths.items()}
    blocked = []
    if platform.system() != "Linux" or platform.machine() != "x86_64":
        blocked.append("published-runtime-requires-linux-x86_64")
    node = node_version(home)
    tools = {name: shutil.which(name) is not None for name in ["git", "npm", "corepack", "bwrap", "gh"]}
    if sys.version_info < (3, 9):
        blocked.append("updater-needs-python-3.9-or-newer")
    if not node["compatible"]:
        blocked.append("node-missing-or-incompatible")
    for name in ["git", "npm", "corepack", "bwrap"]:
        if not tools[name]:
            blocked.append("missing-" + name)
    marker = paths["backgroundOwnershipMarker"]
    mode = "absent"
    if inventory["backgroundOwnershipMarker"].get("present"):
        mode = "unreviewed"
        if physical(marker) and marker.is_file() and marker.stat().st_size <= 65536:
            try:
                if json.loads(marker.read_text()).get("mode") == "managed-local-install":
                    mode = "managed-local-install"
            except (ValueError, OSError, AttributeError):
                pass
        if mode == "managed-local-install":
            blocked.append("background-owner-cutover-required")
        else:
            blocked.append("background-marker-needs-review")
    v2 = inventory["productionV2Settings"].get("present") or inventory["updaterGeneration"].get("present")
    if not v2 and not inventory["legacySQLite"].get("present"):
        blocked.append("official-legacy-history-conversion-or-explicit-path-required")
    if not v2 and inventory["legacySQLite"].get("present") and inventory["legacyJSONSessions"].get("present"):
        blocked.append("mixed-sqlite-and-json-history-review-required")
    return {"kind": "notebook-readonly-diagnostic", "schemaVersion": 1,
            "platform": {"system": platform.system(), "machine": platform.machine()},
            "python": ".".join(map(str, sys.version_info[:3])), "node": node, "toolsPresent": tools,
            "knownPaths": inventory, "backgroundMode": mode,
            "homeVolumeFreeGiB": round(shutil.disk_usage(home).free / 1024**3, 2),
            "earlyBlockers": blocked, "installationApproved": False,
            "nextStep": "Review this metadata, then owner updater plan; no update on unknown layout",
            "scope": "Known default paths only; custom stores, addon runtimes and complete config not inspected",
            "openCodeLaunched": False, "databasesOpened": False, "writesPerformed": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path(pwd.getpwuid(os.getuid()).pw_dir))
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args.home), indent=2))
    except (OSError, ValueError):
        parser.exit(1, "Notebook inventory refused; check HOME/path permissions. No install or data changes performed.\n")


if __name__ == "__main__":
    main()
