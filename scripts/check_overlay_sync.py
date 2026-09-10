#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path, PurePosixPath
from typing import Any


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check canonical overlay/target parity without writing files")
    parser.add_argument("--source-root", required=True, help="Canonical overlay root")
    parser.add_argument("--target-root", required=True, help="Deployed project root")
    parser.add_argument("--manifest", help="Manifest path (default: <source>/sync_manifest.txt)")
    parser.add_argument("--obsolete-targets", help="Obsolete targets path (default: <source>/obsolete_targets.txt)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    return parser.parse_args(argv)


def read_entries(path: Path, *, required: bool) -> list[str]:
    if not path.is_file():
        if required:
            raise ValueError(f"No existe el archivo requerido: {path}")
        return []
    entries: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        entry = raw.strip().rstrip("/")
        if not entry or entry.startswith("#"):
            continue
        validate_relative_entry(entry)
        entries.append(entry)
    return entries


def validate_relative_entry(entry: str) -> None:
    parts = PurePosixPath(entry).parts
    if not entry or entry == "." or os.path.isabs(entry) or ".." in parts:
        raise ValueError(f"Entrada insegura o no relativa: {entry!r}")


def excluded(relative: Path) -> bool:
    return (
        "node_modules" in relative.parts
        or "__pycache__" in relative.parts
        or relative.suffix == ".pyc"
        or relative.name == ".jira.env"
        or relative.name.endswith(".env")
    )


def fingerprint(path: Path) -> tuple[str, str]:
    if path.is_symlink():
        return "symlink", path.readlink().as_posix()
    if path.is_file():
        return "file", hashlib.sha256(path.read_bytes()).hexdigest()
    return "dir", ""


def snapshot(root: Path) -> dict[str, tuple[str, str]]:
    if root.is_symlink() or root.is_file():
        return {".": fingerprint(root)}
    return {
        path.relative_to(root).as_posix(): fingerprint(path)
        for path in root.rglob("*")
        if not excluded(path.relative_to(root))
    }


def compare_entry(source_root: Path, target_root: Path, entry: str) -> dict[str, Any] | None:
    source = source_root / entry
    target = target_root / entry
    if not source.exists() and not source.is_symlink():
        return {"entry": entry, "error": "missing_source"}
    if not target.exists() and not target.is_symlink():
        return {"entry": entry, "error": "missing_target"}
    source_snapshot = snapshot(source)
    target_snapshot = snapshot(target)
    if source_snapshot == target_snapshot:
        return None
    return {
        "entry": entry,
        "missing": sorted(source_snapshot.keys() - target_snapshot.keys()),
        "extra": sorted(target_snapshot.keys() - source_snapshot.keys()),
        "different": sorted(
            key
            for key in source_snapshot.keys() & target_snapshot.keys()
            if source_snapshot[key] != target_snapshot[key]
        ),
    }


def build_report(source_root: Path, target_root: Path, manifest: Path, obsolete_file: Path) -> dict[str, Any]:
    entries = read_entries(manifest, required=True)
    obsolete_entries = read_entries(obsolete_file, required=False)
    mismatches = [
        mismatch
        for entry in entries
        if (mismatch := compare_entry(source_root, target_root, entry)) is not None
    ]
    obsolete_present = [
        entry
        for entry in obsolete_entries
        if (target_root / entry).exists() or (target_root / entry).is_symlink()
    ]
    obsolete_in_source = [
        entry
        for entry in obsolete_entries
        if (source_root / entry).exists() or (source_root / entry).is_symlink()
    ]
    status = "pass" if not mismatches and not obsolete_present and not obsolete_in_source else "drift"
    return {
        "status": status,
        "sourceRoot": str(source_root),
        "targetRoot": str(target_root),
        "manifest": str(manifest),
        "obsoleteTargets": str(obsolete_file),
        "summary": {
            "managedEntries": len(entries),
            "mismatches": len(mismatches),
            "obsoletePresent": len(obsolete_present),
            "obsoleteInSource": len(obsolete_in_source),
        },
        "mismatches": mismatches,
        "obsoletePresent": obsolete_present,
        "obsoleteInSource": obsolete_in_source,
    }


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "## Paridad de overlay canónico",
        f"- Estado: `{report['status']}`",
        f"- Origen: `{report['sourceRoot']}`",
        f"- Target: `{report['targetRoot']}`",
        f"- Entradas gestionadas: {summary['managedEntries']}",
        f"- Drift: {summary['mismatches']}",
        f"- Obsoletos presentes: {summary['obsoletePresent']}",
        f"- Obsoletos todavía en el canónico: {summary['obsoleteInSource']}",
    ]
    for mismatch in report["mismatches"]:
        lines.append(f"- DRIFT `{mismatch['entry']}`: {json.dumps(mismatch, ensure_ascii=False)}")
    for entry in report["obsoletePresent"]:
        lines.append(f"- OBSOLETO `{entry}`")
    for entry in report["obsoleteInSource"]:
        lines.append(f"- CONTRADICCIÓN CANÓNICA `{entry}` también figura como obsoleto")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    source_root = Path(args.source_root).expanduser().resolve()
    target_root = Path(args.target_root).expanduser().resolve()
    manifest = Path(args.manifest).expanduser().resolve() if args.manifest else source_root / "sync_manifest.txt"
    obsolete_file = Path(args.obsolete_targets).expanduser().resolve() if args.obsolete_targets else source_root / "obsolete_targets.txt"
    try:
        if not source_root.is_dir() or not target_root.is_dir():
            raise ValueError("Origen y target deben ser directorios existentes")
        report = build_report(source_root, target_root, manifest, obsolete_file)
    except ValueError as exc:
        report = {"status": "error", "error": str(exc)}
    if args.format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(report) if "summary" in report else f"ERROR: {report['error']}")
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
