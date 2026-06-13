#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ADDITIVE_AGENT_FILES = (
    "agent-design.md",
    "master-dev.md",
    "planner.md",
)

ADDON_SPECS = (
    {
        "id": "knowledge",
        "marker": ".opencode-knowledge-addon.json",
        "default_repo_dir": "~/.local/src/super-turing-opencode-knowledge",
        "default_script": "scripts/manage_agent_autonomy.py",
    },
    {
        "id": "ticketing",
        "marker": ".opencode-ticketing-addon.json",
        "default_repo_dir": "~/.local/src/super-turing-opencode-ticketing",
        "default_script": "scripts/manage_agent_autonomy.py",
    },
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Render effective additive agents for a composed OpenCode install"
    )
    parser.add_argument("render", nargs="?", help=argparse.SUPPRESS)
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--target-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser


def copy_base_agents(source_dir: Path, output_dir: Path) -> None:
    agents_output_dir = output_dir / "agents"
    if agents_output_dir.exists():
        shutil.rmtree(agents_output_dir)
    agents_output_dir.mkdir(parents=True, exist_ok=True)

    for filename in ADDITIVE_AGENT_FILES:
        source_path = source_dir / "agents" / filename
        if not source_path.exists():
            raise FileNotFoundError(f"Missing base additive agent source: {source_path}")
        shutil.copy2(source_path, agents_output_dir / filename)


def load_marker(target_dir: Path, marker_name: str) -> dict | None:
    marker_path = target_dir / marker_name
    if not marker_path.exists():
        return None
    return json.loads(marker_path.read_text())


def resolve_autonomy_script(marker: dict, default_repo_dir: str, default_script: str) -> Path | None:
    candidates: list[Path] = []

    repo_dir = marker.get("repoDir")
    script_rel = marker.get("autonomyScript", default_script)
    if isinstance(repo_dir, str) and repo_dir.strip():
        candidates.append(Path(repo_dir).expanduser() / script_rel)

    candidates.append(Path(default_repo_dir).expanduser() / default_script)

    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if candidate.exists():
            return candidate
    return None


def apply_addon_autonomy(script_path: Path, output_dir: Path) -> None:
    subprocess.run(
        [sys.executable, str(script_path), "apply", "--target-dir", str(output_dir)],
        check=True,
    )


def render_effective_agents(source_dir: Path, target_dir: Path, output_dir: Path) -> None:
    copy_base_agents(source_dir, output_dir)

    for spec in ADDON_SPECS:
        marker = load_marker(target_dir, spec["marker"])
        if marker is None:
            continue

        script_path = resolve_autonomy_script(
            marker,
            spec["default_repo_dir"],
            spec["default_script"],
        )
        if script_path is None:
            raise FileNotFoundError(
                f"Could not resolve autonomy script for addon '{spec['id']}'. "
                f"Checked marker {spec['marker']} and fallback repo {spec['default_repo_dir']}."
            )

        apply_addon_autonomy(script_path, output_dir)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    source_dir = Path(args.source_dir).expanduser()
    target_dir = Path(args.target_dir).expanduser()
    output_dir = Path(args.output_dir).expanduser()

    render_effective_agents(source_dir, target_dir, output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
