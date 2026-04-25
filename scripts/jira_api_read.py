#!/usr/bin/env python3
import argparse
import base64
import json
import os
import shutil
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_ISSUE_FIELDS = [
    "summary",
    "status",
    "issuetype",
    "priority",
    "assignee",
    "reporter",
    "parent",
    "labels",
    "components",
    "description",
    "comment",
    "issuelinks",
    "subtasks",
    "attachment",
]
TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".sql", ".json", ".csv", ".log", ".xml", ".yaml", ".yml"}
MAX_AUTO_ATTACHMENT_BYTES = 5 * 1024 * 1024


def load_env_file(path: str) -> None:
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip()
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            if value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            os.environ.setdefault(key.strip(), value)


def auth_headers(email: str, token: str, accept: str = "application/json"):
    auth = base64.b64encode(f"{email}:{token}".encode()).decode()
    return {
        "Authorization": f"Basic {auth}",
        "Accept": accept,
    }


def jira_json_get(path: str, email: str, token: str, base_url: str):
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        headers=auth_headers(email, token),
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def jira_binary_get(url: str, email: str, token: str):
    req = urllib.request.Request(url, headers=auth_headers(email, token, accept="*/*"))
    with urllib.request.urlopen(req, timeout=60) as resp:
        content_type = resp.headers.get_content_type()
        content_length = resp.headers.get("Content-Length")
        filename = extract_filename(resp.headers.get("Content-Disposition"))
        data = resp.read()
        return data, content_type, content_length, filename


def jira_binary_preview(url: str, email: str, token: str):
    req = urllib.request.Request(url, headers=auth_headers(email, token, accept="*/*"))
    with urllib.request.urlopen(req, timeout=60) as resp:
        content_type = resp.headers.get_content_type()
        content_length = resp.headers.get("Content-Length")
        filename = extract_filename(resp.headers.get("Content-Disposition"))
        if content_type.startswith("video/"):
            return None, content_type, content_length, filename
        data = resp.read()
        return data, content_type, content_length, filename


def extract_filename(content_disposition):
    if not content_disposition:
        return None
    match = re.search(r'filename="?([^";]+)"?', content_disposition)
    return match.group(1) if match else None


def search_jql(jql: str, fields, max_results: int, email: str, token: str, base_url: str):
    q = urllib.parse.quote(jql)
    f = urllib.parse.quote(",".join(fields))
    return jira_json_get(
        f"/rest/api/3/search/jql?jql={q}&maxResults={max_results}&fields={f}",
        email,
        token,
        base_url,
    )


def adf_to_text(node) -> str:
    parts = []

    def walk(n):
        if isinstance(n, dict):
            ntype = n.get("type")
            if ntype == "text":
                parts.append(n.get("text", ""))
            elif ntype in {"paragraph", "heading", "listItem"}:
                for child in n.get("content", []) or []:
                    walk(child)
                parts.append("\n")
            else:
                for child in n.get("content", []) or []:
                    walk(child)
        elif isinstance(n, list):
            for item in n:
                walk(item)

    walk(node)
    text = "".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def preview_text(text: str, limit: int = 500) -> str:
    text = text.replace("\r", "").strip()
    return text[:limit]


def attachment_summary(attachment):
    return {
        "id": attachment.get("id"),
        "filename": attachment.get("filename"),
        "mimeType": attachment.get("mimeType"),
        "size": attachment.get("size"),
        "content": attachment.get("content"),
        "thumbnail": attachment.get("thumbnail"),
    }


def summarize_issue(issue):
    fields = issue.get("fields", {})
    return {
        "key": issue.get("key"),
        "summary": fields.get("summary"),
        "status": (fields.get("status") or {}).get("name"),
        "issueType": (fields.get("issuetype") or {}).get("name"),
        "priority": (fields.get("priority") or {}).get("name"),
        "assignee": ((fields.get("assignee") or {}).get("displayName")),
        "reporter": ((fields.get("reporter") or {}).get("displayName")),
        "parent": ((fields.get("parent") or {}).get("key")),
        "labels": fields.get("labels") or [],
        "components": [c.get("name") for c in (fields.get("components") or [])],
        "subtasks": [
            {
                "key": s.get("key"),
                "summary": (s.get("fields") or {}).get("summary"),
                "status": (((s.get("fields") or {}).get("status")) or {}).get("name"),
            }
            for s in (fields.get("subtasks") or [])
        ],
        "commentCount": ((fields.get("comment") or {}).get("total")),
        "attachmentCount": len(fields.get("attachment") or []),
    }


def build_parent_chain(issue, parent_depth: int, email: str, token: str, base_url: str):
    chain = []
    current = issue
    depth = 0
    while depth < parent_depth:
        parent_key = ((current.get("fields") or {}).get("parent") or {}).get("key")
        if not parent_key:
            break
        parent = jira_json_get(
            f"/rest/api/3/issue/{urllib.parse.quote(parent_key)}?fields={urllib.parse.quote(','.join(DEFAULT_ISSUE_FIELDS))}",
            email,
            token,
            base_url,
        )
        chain.append(summarize_issue(parent))
        current = parent
        depth += 1
    return chain


def build_links(issue, limit: int):
    result = []
    for link in (issue.get("fields", {}).get("issuelinks") or [])[:limit]:
        outward = link.get("outwardIssue")
        inward = link.get("inwardIssue")
        target = outward or inward or {}
        fields = target.get("fields") or {}
        result.append(
            {
                "direction": "outward" if outward else "inward",
                "type": (link.get("type") or {}).get("name"),
                "key": target.get("key"),
                "summary": fields.get("summary"),
                "status": ((fields.get("status") or {}).get("name")),
                "issueType": ((fields.get("issuetype") or {}).get("name")),
            }
        )
    return result


def build_comments(issue, limit: int):
    comments = (issue.get("fields", {}).get("comment") or {}).get("comments") or []
    return [
        {
            "author": (c.get("author") or {}).get("displayName"),
            "created": c.get("created"),
            "preview": preview_text(adf_to_text(c.get("body")), 240),
        }
        for c in comments[-limit:]
    ]


def build_context(issue_key: str, parent_depth: int, siblings_limit: int, comments_limit: int, links_limit: int, email: str, token: str, base_url: str):
    issue = jira_json_get(
        f"/rest/api/3/issue/{urllib.parse.quote(issue_key)}?fields={urllib.parse.quote(','.join(DEFAULT_ISSUE_FIELDS))}",
        email,
        token,
        base_url,
    )
    parent_chain = build_parent_chain(issue, parent_depth, email, token, base_url)
    parent_key = ((issue.get("fields") or {}).get("parent") or {}).get("key")
    siblings = []
    if parent_key and siblings_limit > 0:
        siblings_payload = search_jql(
            f"parent = {parent_key} ORDER BY key ASC",
            ["summary", "status", "issuetype", "assignee", "parent"],
            siblings_limit,
            email,
            token,
            base_url,
        )
        siblings = [summarize_issue(x) for x in siblings_payload.get("issues", []) if x.get("key") != issue_key]
    return {
        "issue": summarize_issue(issue),
        "descriptionPreview": preview_text(adf_to_text((issue.get("fields") or {}).get("description")), 1200),
        "parentChain": parent_chain,
        "siblings": siblings,
        "links": build_links(issue, links_limit),
        "comments": build_comments(issue, comments_limit),
        "attachments": [attachment_summary(a) for a in ((issue.get("fields") or {}).get("attachment") or [])],
    }


def resolve_attachment_url(target: str) -> str:
    if target.startswith("http://") or target.startswith("https://"):
        return target
    return target


def safe_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return cleaned or "attachment"


def ensure_unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    idx = 1
    while True:
        candidate = parent / f"{stem}_{idx}{suffix}"
        if not candidate.exists():
            return candidate
        idx += 1


def repo_root() -> Path:
    return Path(os.getcwd()).resolve()


def repo_tmp_root() -> Path:
    return repo_root() / "tmp"


def ensure_under_tmp(path: Path) -> Path:
    resolved = path.resolve()
    tmp_root = repo_tmp_root().resolve()
    if resolved != tmp_root and tmp_root not in resolved.parents:
        raise ValueError(f"Output must stay under {tmp_root}")
    return resolved


def attachment_preview(target: str, email: str, token: str):
    url = resolve_attachment_url(target)
    if not (url.startswith("http://") or url.startswith("https://")):
        raise ValueError("attachment-preview requires a full attachment URL")
    data, content_type, content_length, filename = jira_binary_preview(url, email, token)
    result = {
        "url": url,
        "contentType": content_type,
        "contentLength": content_length,
        "filename": filename,
    }
    if data is None:
        result["note"] = "video-or-binary-skipped"
        return result
    if content_type.startswith("text/") or Path(filename or "").suffix.lower() in TEXT_EXTENSIONS:
        result["preview"] = preview_text(data.decode("utf-8", errors="replace"), 1200)
        return result
    if content_type.startswith("image/"):
        result["imageType"] = content_type
        result["bytes"] = len(data)
        return result
    result["bytes"] = len(data)
    result["note"] = "binary-preview-not-supported"
    return result


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def render_analysis(ticket_key: str, context) -> str:
    issue = context["issue"]
    lines = [
        f"# {ticket_key}",
        "",
        "## Issue principal",
        f"- Summary: {issue.get('summary')}",
        f"- Estado: {issue.get('status')}",
        f"- Tipo: {issue.get('issueType')}",
        f"- Parent inmediato: {issue.get('parent')}",
        f"- Comentarios analizados: {len(context.get('comments') or [])}",
        f"- Adjuntos detectados: {len(context.get('attachments') or [])}",
        "",
        "## Jerarquía de parent chain",
    ]
    if not context.get("parentChain"):
        lines.append("- Sin parent chain")
    else:
        for item in context["parentChain"]:
            lines.append(f"- {item.get('key')} [{item.get('issueType')}] — {item.get('summary')} ({item.get('status')})")
    lines.extend(["", "## Subtareas directas"])
    if not issue.get("subtasks"):
        lines.append("- Sin subtareas")
    else:
        for sub in issue["subtasks"]:
            lines.append(f"- {sub.get('key')} — {sub.get('summary')} ({sub.get('status')})")
    lines.extend(["", f"## Hermanos (máximo {len(context.get('siblings') or [])})"])
    if not context.get("siblings"):
        lines.append("- Sin hermanos detectados")
    else:
        for sibling in context["siblings"]:
            lines.append(f"- {sibling.get('key')} — {sibling.get('summary')} ({sibling.get('status')})")
    lines.extend(["", "## Tickets linkeados"])
    if not context.get("links"):
        lines.append("- Sin tickets linkeados directos")
    else:
        for link in context["links"]:
            lines.append(
                f"- {link.get('direction')} {link.get('type')} -> {link.get('key')} — {link.get('summary')} ({link.get('status')})"
            )
    lines.extend(["", "## Comentarios recientes"])
    if not context.get("comments"):
        lines.append("- Sin comentarios")
    else:
        for comment in context["comments"]:
            lines.append(f"- {comment.get('author')} @ {comment.get('created')}: {comment.get('preview')}")
    lines.extend(["", "## Adjuntos"])
    if not context.get("attachments"):
        lines.append("- Sin adjuntos")
    else:
        for attachment in context["attachments"]:
            lines.append(
                f"- {attachment.get('filename')} — {attachment.get('mimeType')} — {attachment.get('size')} bytes"
            )
    lines.extend(
        [
            "",
            "## Description preview",
            context.get("descriptionPreview") or "(sin preview)",
            "",
            "## Nota",
            "- Este analysis usa previews acotados para description y comentarios.",
            "- El detalle completo del issue queda en `issue_raw.json` y `comments_full.json`.",
            "",
        ]
    )
    return "\n".join(lines)


def dump_ticket(ticket_key: str, out_dir: Path, parent_depth: int, siblings_limit: int, comments_limit: int, links_limit: int, email: str, token: str, base_url: str):
    context = build_context(ticket_key, parent_depth, siblings_limit, comments_limit, links_limit, email, token, base_url)
    raw_issue = jira_json_get(
        f"/rest/api/3/issue/{urllib.parse.quote(ticket_key)}?fields={urllib.parse.quote(','.join(DEFAULT_ISSUE_FIELDS))}",
        email,
        token,
        base_url,
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    attachments_dir = out_dir / "attachments"
    attachments_dir.mkdir(parents=True, exist_ok=True)

    write_json(out_dir / "context.json", context)
    write_json(out_dir / "issue.json", context["issue"])
    write_json(out_dir / "issue_raw.json", raw_issue)
    write_json(out_dir / "parent_chain.json", context.get("parentChain") or [])
    write_json(out_dir / "siblings.json", context.get("siblings") or [])
    write_json(out_dir / "comments.json", context.get("comments") or [])
    write_json(out_dir / "comments_full.json", ((raw_issue.get("fields") or {}).get("comment") or {}).get("comments") or [])
    write_json(out_dir / "links.json", context.get("links") or [])
    write_json(out_dir / "attachments.json", context.get("attachments") or [])
    write_text(out_dir / "analysis.md", render_analysis(ticket_key, context))

    downloaded = []
    skipped = []
    previews = []
    for attachment in context.get("attachments") or []:
        mime_type = attachment.get("mimeType") or ""
        size = int(attachment.get("size") or 0)
        filename = attachment.get("filename") or f"attachment-{attachment.get('id')}"
        content_url = attachment.get("content")
        if not content_url:
            skipped.append({"filename": filename, "reason": "missing-content-url"})
            continue
        if mime_type.startswith("video/"):
            skipped.append({"filename": filename, "reason": "video-not-downloaded"})
            continue
        if size > MAX_AUTO_ATTACHMENT_BYTES:
            skipped.append({"filename": filename, "reason": f"attachment-too-large-{size}"})
            continue
        data, content_type, _, remote_name = jira_binary_get(content_url, email, token)
        target = ensure_unique_path(attachments_dir / safe_name(remote_name or filename))
        target.write_bytes(data)
        downloaded.append({"filename": filename, "path": str(target.relative_to(out_dir.parent)), "contentType": content_type, "bytes": len(data)})
        if content_type.startswith("text/") or target.suffix.lower() in TEXT_EXTENSIONS:
            previews.append({"filename": filename, "preview": preview_text(data.decode("utf-8", errors="replace"), 1200)})
        elif content_type.startswith("image/"):
            previews.append({"filename": filename, "preview": f"image-downloaded ({len(data)} bytes)"})

    write_json(out_dir / "downloaded_attachments.json", downloaded)
    write_json(out_dir / "skipped_attachments.json", skipped)
    if previews:
        write_json(out_dir / "attachment_previews.json", previews)

    return {
        "ticket": ticket_key,
        "outputDir": str(out_dir),
        "downloadedAttachments": len(downloaded),
        "skippedAttachments": len(skipped),
    }


def write_note(ticket_key: str, content: str, filename: str):
    out_dir = ensure_under_tmp(repo_tmp_root() / ticket_key)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = ensure_under_tmp(out_dir / safe_name(filename))
    prefix = ""
    if target.exists() and target.stat().st_size > 0:
        prefix = "\n\n---\n\n"
    with target.open("a", encoding="utf-8") as fh:
        fh.write(prefix)
        fh.write(content.rstrip())
        fh.write("\n")
    return {
        "ticket": ticket_key,
        "savedTo": str(target),
        "bytesWritten": len(content.encode("utf-8")),
    }


def write_workspace_file(ticket_key: str, relative_path: str, content: str, append: bool):
    out_dir = ensure_under_tmp(repo_tmp_root() / ticket_key)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = ensure_under_tmp(out_dir / relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if append else "w"
    with target.open(mode, encoding="utf-8") as fh:
        fh.write(content)
        if not content.endswith("\n"):
            fh.write("\n")
    return {
        "ticket": ticket_key,
        "savedTo": str(target),
        "append": append,
        "bytesWritten": len(content.encode("utf-8")),
    }


def write_verdict(ticket_key: str, content: str):
    out_dir = ensure_under_tmp(repo_tmp_root() / ticket_key)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = ensure_under_tmp(out_dir / "verdict.md")
    target.write_text(content.rstrip() + "\n", encoding="utf-8")
    return {
        "ticket": ticket_key,
        "savedTo": str(target),
        "bytesWritten": len(content.encode("utf-8")),
    }


def mkdir_workspace(ticket_key: str, relative_path: str):
    out_dir = ensure_under_tmp(repo_tmp_root() / ticket_key)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = ensure_under_tmp(out_dir / relative_path)
    target.mkdir(parents=True, exist_ok=True)
    return {
        "ticket": ticket_key,
        "created": str(target),
    }


def delete_workspace(ticket_key: str, relative_path: str):
    out_dir = ensure_under_tmp(repo_tmp_root() / ticket_key)
    target = ensure_under_tmp(out_dir / relative_path)
    existed = target.exists()
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()
    return {
        "ticket": ticket_key,
        "deleted": str(target),
        "existed": existed,
    }


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Jira read-only helper for OpenCode ticket workflows")
    sub = parser.add_subparsers(dest="mode", required=True)

    p_issue = sub.add_parser("issue")
    p_issue.add_argument("key")

    p_search = sub.add_parser("search")
    p_search.add_argument("jql")
    p_search.add_argument("--max-results", type=int, default=10)

    p_context = sub.add_parser("context")
    p_context.add_argument("key")
    p_context.add_argument("--parent-depth", type=int, default=2)
    p_context.add_argument("--siblings", type=int, default=20)
    p_context.add_argument("--comments", type=int, default=10)
    p_context.add_argument("--links", type=int, default=10)

    p_attachments = sub.add_parser("attachments")
    p_attachments.add_argument("key")

    p_get = sub.add_parser("attachment-get")
    p_get.add_argument("target")
    p_get.add_argument("--out", required=True)

    p_preview = sub.add_parser("attachment-preview")
    p_preview.add_argument("target")

    p_dump = sub.add_parser("dump")
    p_dump.add_argument("key")
    p_dump.add_argument("--out", default=None)
    p_dump.add_argument("--parent-depth", type=int, default=2)
    p_dump.add_argument("--siblings", type=int, default=20)
    p_dump.add_argument("--comments", type=int, default=10)
    p_dump.add_argument("--links", type=int, default=10)

    p_note = sub.add_parser("note")
    p_note.add_argument("key")
    p_note.add_argument("--content", required=True)
    p_note.add_argument("--file", default="plan_notes.md")

    p_write = sub.add_parser("write")
    p_write.add_argument("key")
    p_write.add_argument("--file", required=True)
    p_write.add_argument("--content", required=True)
    p_write.add_argument("--append", action="store_true")

    p_verdict = sub.add_parser("verdict")
    p_verdict.add_argument("key")
    p_verdict.add_argument("--content", required=True)

    p_mkdir = sub.add_parser("mkdir")
    p_mkdir.add_argument("key")
    p_mkdir.add_argument("--dir", required=True)

    p_delete = sub.add_parser("delete")
    p_delete.add_argument("key")
    p_delete.add_argument("--path", required=True)

    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv or sys.argv[1:])
    env_file = os.environ.get("JIRA_ENV_FILE", os.path.join(os.getcwd(), ".env"))
    load_env_file(env_file)

    base_url = os.environ.get("JIRA_BASE_URL")
    email = os.environ.get("JIRA_EMAIL")
    token = os.environ.get("JIRA_API_TOKEN")

    if not base_url or not email or not token:
        print(
            json.dumps(
                {
                    "error": "Missing Jira credentials in environment",
                    "required": ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
                },
                ensure_ascii=False,
            )
        )
        return 1

    try:
        if args.mode == "issue":
            payload = jira_json_get(
                f"/rest/api/3/issue/{urllib.parse.quote(args.key)}?fields={urllib.parse.quote(','.join(DEFAULT_ISSUE_FIELDS))}",
                email,
                token,
                base_url,
            )
        elif args.mode == "search":
            payload = search_jql(
                args.jql,
                ["summary", "status", "issuetype", "priority", "assignee", "parent"],
                args.max_results,
                email,
                token,
                base_url,
            )
        elif args.mode == "context":
            payload = build_context(
                args.key,
                args.parent_depth,
                args.siblings,
                args.comments,
                args.links,
                email,
                token,
                base_url,
            )
        elif args.mode == "attachments":
            payload = build_context(args.key, 0, 0, 0, 0, email, token, base_url).get("attachments", [])
        elif args.mode == "attachment-get":
            target_url = resolve_attachment_url(args.target)
            if not (target_url.startswith("http://") or target_url.startswith("https://")):
                target_url = f"{base_url.rstrip('/')}/rest/api/3/attachment/content/{urllib.parse.quote(args.target)}"
            data, content_type, _, remote_name = jira_binary_get(target_url, email, token)
            out_path = ensure_under_tmp(Path(args.out))
            if out_path.is_dir() or str(args.out).endswith(os.sep):
                out_path.mkdir(parents=True, exist_ok=True)
                out_path = out_path / safe_name(remote_name or f"attachment-{args.target}")
            else:
                out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path = ensure_unique_path(out_path)
            out_path.write_bytes(data)
            payload = {
                "savedTo": str(out_path),
                "contentType": content_type,
                "bytes": len(data),
                "filename": remote_name,
            }
        elif args.mode == "attachment-preview":
            target = resolve_attachment_url(args.target)
            if not (target.startswith("http://") or target.startswith("https://")):
                target = f"{base_url.rstrip('/')}/rest/api/3/attachment/content/{urllib.parse.quote(args.target)}"
            payload = attachment_preview(target, email, token)
        elif args.mode == "dump":
            root = repo_root()
            out_dir = Path(args.out) if args.out else (root / "tmp" / args.key)
            out_dir = ensure_under_tmp(out_dir)
            payload = dump_ticket(
                args.key,
                out_dir,
                args.parent_depth,
                args.siblings,
                args.comments,
                args.links,
                email,
                token,
                base_url,
            )
        elif args.mode == "note":
            payload = write_note(args.key, args.content, args.file)
        elif args.mode == "write":
            payload = write_workspace_file(args.key, args.file, args.content, args.append)
        elif args.mode == "verdict":
            payload = write_verdict(args.key, args.content)
        elif args.mode == "mkdir":
            payload = mkdir_workspace(args.key, args.dir)
        elif args.mode == "delete":
            payload = delete_workspace(args.key, args.path)
        else:
            payload = {"error": f"Unsupported mode: {args.mode}"}
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 1

        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    except urllib.error.HTTPError as err:
        body = err.read().decode(errors="ignore")
        print(json.dumps({"http_error": err.code, "body": body[:2000]}, ensure_ascii=False, indent=2))
        return 1
    except Exception as err:
        print(json.dumps({"error": str(err)}, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
