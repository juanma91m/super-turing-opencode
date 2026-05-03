#!/usr/bin/env python3

import json
import pathlib
import sys


PLUGIN_SPEC = "./plugins/background-agents-tui"
LEGACY_SPEC = "./plugins/background-agents-tui.ts"
LEGACY_FILE = "plugins/background-agents-tui.ts"
SCHEMA = "https://opencode.ai/tui.json"


def item_spec(item):
    if isinstance(item, str):
        return item
    if isinstance(item, list) and item and isinstance(item[0], str):
        return item[0]
    return None


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: ensure_tui_plugin.py <target-dir>", file=sys.stderr)
        return 2

    target_dir = pathlib.Path(sys.argv[1]).expanduser()
    tui_path = target_dir / "tui.json"

    data: dict[str, object]
    if tui_path.exists():
        try:
            loaded = json.loads(tui_path.read_text())
        except Exception as exc:  # noqa: BLE001
            print(f"invalid tui.json at {tui_path}: {exc}", file=sys.stderr)
            return 1
        if not isinstance(loaded, dict):
            print(f"invalid tui.json at {tui_path}: root must be an object", file=sys.stderr)
            return 1
        data = loaded
    else:
        data = {}

    plugin = data.get("plugin")
    if plugin is None:
        plugin_list = []
    elif isinstance(plugin, list):
        plugin_list = plugin
    else:
        print(f"invalid tui.json at {tui_path}: plugin must be an array", file=sys.stderr)
        return 1

    plugin_list = [item for item in plugin_list if item_spec(item) != LEGACY_SPEC]

    if not any(item_spec(item) == PLUGIN_SPEC for item in plugin_list):
        plugin_list.append(PLUGIN_SPEC)

    data["plugin"] = plugin_list
    data.setdefault("$schema", SCHEMA)

    tui_path.parent.mkdir(parents=True, exist_ok=True)
    tui_path.write_text(json.dumps(data, indent=2) + "\n")

    legacy = target_dir / LEGACY_FILE
    if legacy.exists() and legacy.is_file():
        legacy.unlink()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
