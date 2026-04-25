#!/usr/bin/env python3
import argparse
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path


DEFAULT_DB_PATH = Path.home() / ".local/share/opencode/opencode.db"


def get_repo_root() -> Path:
    try:
        return Path(
            subprocess.check_output(
                ["git", "rev-parse", "--show-toplevel"], stderr=subprocess.DEVNULL, text=True
            ).strip()
        ).resolve()
    except Exception:
        return Path.cwd().resolve()


def get_project_ids(conn: sqlite3.Connection, current_only: bool) -> list[str]:
    cur = conn.cursor()
    if current_only:
        cur.execute("select id from project where worktree = ?", (str(get_repo_root()),))
    else:
        cur.execute("select id from project")
    return [row[0] for row in cur.fetchall()]


def query_sessions(conn: sqlite3.Connection, project_ids: list[str], child_only: bool, older_than_minutes: int):
    if not project_ids:
        return []
    placeholders = ",".join(["?"] * len(project_ids))
    clauses = [f"project_id in ({placeholders})", "time_archived is null"]
    params: list[object] = list(project_ids)
    if child_only:
        clauses.append("parent_id is not null")
    if older_than_minutes > 0:
        cutoff = int(time.time() * 1000) - older_than_minutes * 60 * 1000
        clauses.append("time_updated <= ?")
        params.append(cutoff)
    sql = (
        "select id, project_id, parent_id, title, directory, time_updated "
        f"from session where {' and '.join(clauses)} order by time_updated desc"
    )
    cur = conn.cursor()
    cur.execute(sql, params)
    return [
        {
            "id": row[0],
            "project_id": row[1],
            "parent_id": row[2],
            "title": row[3],
            "directory": row[4],
            "time_updated": row[5],
        }
        for row in cur.fetchall()
    ]


def delete_sessions(session_ids: list[str]):
    deleted = []
    failed = []
    for session_id in session_ids:
        proc = subprocess.run(
            ["opencode", "session", "delete", session_id],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if proc.returncode == 0:
            deleted.append(session_id)
        else:
            failed.append({"id": session_id, "stdout": proc.stdout.strip(), "stderr": proc.stderr.strip()})
    return deleted, failed


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Cleanup helper for OpenCode sessions")
    sub = parser.add_subparsers(dest="mode", required=True)

    for mode in ("list", "clean"):
        p = sub.add_parser(mode)
        p.add_argument("--all-projects", action="store_true")
        p.add_argument("--include-root", action="store_true")
        p.add_argument("--older-than-minutes", type=int, default=0)
        p.add_argument("--db-path", default=str(DEFAULT_DB_PATH))
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv or sys.argv[1:])
    db_path = Path(args.db_path).expanduser().resolve()
    if not db_path.exists():
        print(json.dumps({"error": f"OpenCode DB not found at {db_path}"}, ensure_ascii=False, indent=2))
        return 1

    conn = sqlite3.connect(str(db_path))
    try:
        project_ids = get_project_ids(conn, current_only=not args.all_projects)
        sessions = query_sessions(
            conn,
            project_ids,
            child_only=not args.include_root,
            older_than_minutes=args.older_than_minutes,
        )
        if args.mode == "list":
            print(json.dumps({"count": len(sessions), "sessions": sessions}, ensure_ascii=False, indent=2))
            return 0

        deleted, failed = delete_sessions([s["id"] for s in sessions])
        print(json.dumps({"candidates": len(sessions), "deleted": deleted, "failed": failed}, ensure_ascii=False, indent=2))
        return 0 if not failed else 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
