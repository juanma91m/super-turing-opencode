#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


TOOL_POLICY = {
    "playwright_*": False,
    "stitch_*": False,
}


def load_config(path: Path) -> dict:
    if not path.exists():
        return {"$schema": "https://opencode.ai/config.json"}
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in {path}: {exc}") from exc
    if not isinstance(config, dict):
        raise ValueError(f"expected a JSON object in {path}")
    tools = config.get("tools")
    if tools is not None and not isinstance(tools, dict):
        raise ValueError(f"expected 'tools' to be an object in {path}")
    return config


def apply_policy(config: dict) -> bool:
    tools = config.setdefault("tools", {})
    changed = False
    for name, value in TOOL_POLICY.items():
        if tools.get(name) is not value:
            tools[name] = value
            changed = True
    return changed


def write_config(path: Path, config: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply the core OpenCode tool visibility policy")
    parser.add_argument("command", choices=("check", "apply", "preview"))
    parser.add_argument("--config", required=True)
    args = parser.parse_args()

    path = Path(args.config).expanduser()
    try:
        config = load_config(path)
    except ValueError as exc:
        print(f"[opencode-tool-policy] {exc}", file=sys.stderr)
        return 2

    changed = apply_policy(config)
    if args.command == "check":
        return 1 if changed else 0
    if args.command == "preview":
        print(json.dumps(config, indent=2, ensure_ascii=False))
        return 0
    if changed:
        write_config(path, config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
