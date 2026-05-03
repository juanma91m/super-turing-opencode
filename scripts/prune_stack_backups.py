#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


BACKUP_DIRS = (".stack-backups", ".stack-sync-backups")
PIN_FILENAME = ".pin"
DEFAULT_KEEP = 5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prune old OpenCode stack backups")
    parser.add_argument("--target-dir", required=True, help="Base OpenCode config directory")
    parser.add_argument("--keep", type=int, default=DEFAULT_KEEP, help="Recent unpinned backups to keep per bucket")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be removed without deleting")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable summary")
    return parser.parse_args()


def list_entries(root: Path) -> list[Path]:
    if not root.exists() or not root.is_dir():
        return []
    return sorted((entry for entry in root.iterdir() if entry.is_dir()), key=lambda p: p.name, reverse=True)


def is_pinned(entry: Path) -> bool:
    return (entry / PIN_FILENAME).exists()


def prune_bucket(root: Path, keep: int, dry_run: bool) -> dict[str, object]:
    kept: list[str] = []
    deleted: list[str] = []
    kept_unpinned = 0

    for entry in list_entries(root):
        if is_pinned(entry):
            kept.append(entry.name)
            continue

        if kept_unpinned < keep:
            kept.append(entry.name)
            kept_unpinned += 1
            continue

        deleted.append(entry.name)
        if not dry_run:
            shutil.rmtree(entry, ignore_errors=True)

    return {
        "bucket": root.name,
        "path": str(root),
        "kept": kept,
        "deleted": deleted,
        "dryRun": dry_run,
    }


def main() -> int:
    args = parse_args()
    target_dir = Path(args.target_dir).expanduser().resolve()
    summaries = [prune_bucket(target_dir / bucket, args.keep, args.dry_run) for bucket in BACKUP_DIRS]

    if args.json:
        print(json.dumps({"targetDir": str(target_dir), "summaries": summaries}, ensure_ascii=False, indent=2))
        return 0

    for summary in summaries:
        deleted = summary["deleted"]
        if deleted:
            prefix = "Would remove" if args.dry_run else "Removed"
            print(f"[{summary['bucket']}] {prefix}: {', '.join(deleted)}")
        else:
            print(f"[{summary['bucket']}] No old backups to prune")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
