#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


GLOBAL_ROOT = Path(__file__).resolve().parent.parent
TOKEN_GROUPS = {
    "memory": ["mem_context", "mem_search", "mem_get_observation"],
    "async_delegate": ["delegate", "delegation_", "delegacion async"],
    "ticket_handoff": ["tmp/<ticket>/verdict.md", "tmp/<key>/verdict.md", "result-dev.md"],
    "no_git_side_effects": ["git add", "git commit", "push"],
    "playwright_headless": ["headless", "foreground"],
    "stitch_timeout": ["stitch", "timeout", "polling"],
}


@dataclass
class Finding:
    severity: str
    message: str
    suggestion: str | None = None


@dataclass
class AuditItem:
    category: str
    local_path: str
    global_path: str | None
    name: str
    status: str = "OK"
    findings: list[Finding] = field(default_factory=list)

    def add(self, severity: str, message: str, suggestion: str | None = None) -> None:
        self.findings.append(Finding(severity=severity, message=message, suggestion=suggestion))
        if severity == "error":
            self.status = "error"
        elif severity == "warning" and self.status != "error":
            self.status = "warning"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit local .opencode overlays against the global stack")
    parser.add_argument("--project-root", default=os.getcwd(), help="Project root to audit (default: current directory)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    return parser.parse_args(argv)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def split_front_matter(text: str) -> tuple[dict[str, Any], str]:
    lines = text.splitlines()
    if len(lines) >= 3 and lines[0].strip() == "---":
        try:
            end_idx = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
        except StopIteration:
            return {}, text
        raw = "\n".join(lines[1:end_idx])
        body = "\n".join(lines[end_idx + 1 :])
        return parse_simple_yaml(raw), body
    return {}, text


def parse_simple_yaml(raw: str) -> dict[str, Any]:
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-1, root)]
    for line in raw.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()
        if ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        key = parse_scalar(key.strip())
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        current = stack[-1][1]
        if value.strip() == "":
            node: dict[str, Any] = {}
            current[key] = node
            stack.append((indent, node))
        else:
            current[key] = parse_scalar(value.strip())
    return root


def parse_scalar(value: str) -> Any:
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        value = value[1:-1]
    lower = value.lower()
    if lower == "true":
        return True
    if lower == "false":
        return False
    if lower == "null":
        return None
    return value


def extract_skills(body: str) -> list[str]:
    lines = body.splitlines()
    skills: list[str] = []
    in_section = False
    for line in lines:
        stripped = line.strip()
        if re.match(r"^Skills? sugeridas?:$", stripped, re.IGNORECASE):
            in_section = True
            continue
        if in_section:
            if not stripped:
                break
            if not stripped.startswith("-"):
                break
            skill = stripped.lstrip("-").strip()
            match = re.search(r"`([^`]+)`", skill)
            skills.append(match.group(1) if match else skill)
    return skills


def extract_markdown_headings(body: str) -> set[str]:
    return {normalize_heading(match.group(1).strip()) for match in re.finditer(r"^##\s+(.+)$", body, re.MULTILINE)}


def normalize_heading(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value.strip().lower())
    if normalized.startswith("orden recomendado de lectura"):
        return "orden recomendado de lectura"
    return normalized


def flatten_allow_map(node: Any) -> set[str]:
    if not isinstance(node, dict):
        return set()
    return {key for key, value in node.items() if value == "allow"}


def has_any_token(text: str, tokens: list[str]) -> bool:
    lower = text.lower()
    return any(token.lower() in lower for token in tokens)


def audit_agents_local_policy(project_root: Path) -> AuditItem | None:
    agents_md = project_root / "AGENTS.md"
    if not agents_md.exists():
        item = AuditItem(category="policy", local_path="AGENTS.md", global_path=None, name="AGENTS.md", status="warning")
        item.add("warning", "No existe `AGENTS.md` local a pesar de haber `.opencode/`.", "Agregar `AGENTS.md` local para documentar stack, reglas y principio de overlays.")
        return item

    body = read_text(agents_md)
    item = AuditItem(category="policy", local_path="AGENTS.md", global_path=None, name="AGENTS.md")
    if not re.search(r"principio.*overlay|overrides locales", body, re.IGNORECASE) or not re.search(r"preserv", body, re.IGNORECASE):
        item.add(
            "warning",
            "`AGENTS.md` no explicita claramente el principio de overlays locales aditivos.",
            "Documentar que los overrides locales preservan comportamiento global salvo recorte intencional.",
        )
    return item


def audit_agent(local_path: Path, global_path: Path | None, project_root: Path) -> AuditItem:
    item = AuditItem(category="agent", local_path=str(local_path.relative_to(project_root)), global_path=str(global_path.relative_to(GLOBAL_ROOT)) if global_path else None, name=local_path.stem)
    if global_path is None or not global_path.exists():
        return item

    local_meta, local_body = split_front_matter(read_text(local_path))
    global_meta, global_body = split_front_matter(read_text(global_path))

    if global_meta.get("mode") and local_meta.get("mode") != global_meta.get("mode"):
        item.add("error", f"`mode` difiere del global (`{global_meta.get('mode')}` -> `{local_meta.get('mode')}`).", "Preservar `mode` salvo cambio intencional explícitamente documentado.")

    global_tools = global_meta.get("tools", {}) if isinstance(global_meta.get("tools"), dict) else {}
    local_tools = local_meta.get("tools", {}) if isinstance(local_meta.get("tools"), dict) else {}
    for tool_name, global_value in global_tools.items():
        if tool_name not in local_tools:
            item.add("warning", f"Falta reinyectar la declaración de tool `{tool_name}` presente en el global.", "Copiar la declaración de `tools:` si la capacidad sigue aplicando en el proyecto.")
        elif global_value is True and local_tools.get(tool_name) is not True:
            item.add("warning", f"La tool `{tool_name}` quedó más restringida que en el global.", "Confirmar que el recorte es intencional o restaurar la capacidad global.")

    global_perm = global_meta.get("permission", {}) if isinstance(global_meta.get("permission"), dict) else {}
    local_perm = local_meta.get("permission", {}) if isinstance(local_meta.get("permission"), dict) else {}
    if global_perm.get("edit") == "allow" and local_perm.get("edit") != "allow":
        item.add("warning", "El permiso `edit` quedó más restrictivo que en el global.", "Documentar el recorte o restaurar `edit: allow` si el rol sigue siendo implementador.")

    global_bash_allow = flatten_allow_map(global_perm.get("bash"))
    local_bash_allow = flatten_allow_map(local_perm.get("bash"))
    for command in sorted(global_bash_allow - local_bash_allow):
        item.add("warning", f"Se perdió la allowlist segura de bash `{command}` presente en el global.", "Reinyectar la allowlist si sigue siendo válida para el proyecto.")

    global_task_allow = flatten_allow_map(global_perm.get("task"))
    local_task_allow = flatten_allow_map(local_perm.get("task"))
    for target in sorted(global_task_allow - local_task_allow):
        item.add("warning", f"Se perdió el target de task `{target}` presente en el global.", "Reinyectar el target si el rol local debería conservar esa coordinación.")

    global_skills = set(extract_skills(global_body))
    local_skills = set(extract_skills(local_body))
    if global_skills and global_skills.isdisjoint(local_skills):
        item.add("warning", "No se preservó ninguna skill sugerida del agente global.", "Mantener al menos las skills globales más relevantes y sumar las locales.")

    for group_name, tokens in TOKEN_GROUPS.items():
        if has_any_token(global_body, tokens) and not has_any_token(local_body, tokens):
            item.add("warning", f"No aparece el guardrail global del grupo `{group_name}` en el override local.", "Revisar si conviene reinyectar ese guardrail operativo en el prompt local.")

    return item


def audit_command(local_path: Path, global_path: Path | None, project_root: Path) -> AuditItem:
    item = AuditItem(category="command", local_path=str(local_path.relative_to(project_root)), global_path=str(global_path.relative_to(GLOBAL_ROOT)) if global_path else None, name=local_path.stem)
    if global_path is None or not global_path.exists():
        return item

    local_meta, local_body = split_front_matter(read_text(local_path))
    global_meta, global_body = split_front_matter(read_text(global_path))

    if global_meta.get("agent") and local_meta.get("agent") != global_meta.get("agent"):
        item.add("warning", f"El comando cambió de agente (`{global_meta.get('agent')}` -> `{local_meta.get('agent')}`).", "Confirmar que el cambio de ownership es intencional y quedó documentado.")
    if global_meta.get("subtask") is not None and local_meta.get("subtask") != global_meta.get("subtask"):
        item.add("warning", "El flag `subtask` difiere del global.", "Preservar `subtask` salvo necesidad explícita del workflow local.")

    if "Objetivo:" in global_body and "Objetivo:" not in local_body:
        item.add("warning", "El override no preserva la sección `Objetivo:` del comando global.", "Mantener el contrato básico del comando y luego especializarlo.")
    if "Reglas:" in global_body and "Reglas:" not in local_body:
        item.add("warning", "El override no preserva la sección `Reglas:` del comando global.", "Mantener guardrails básicos del comando global.")

    for group_name, tokens in TOKEN_GROUPS.items():
        if has_any_token(global_body, tokens) and not has_any_token(local_body, tokens):
            item.add("warning", f"No aparece el grupo de guardrails `{group_name}` presente en el comando global.", "Revisar si conviene reinyectar ese guardrail en el comando local.")
    return item


def audit_skill(local_path: Path, global_path: Path | None, project_root: Path) -> AuditItem:
    item = AuditItem(category="skill", local_path=str(local_path.relative_to(project_root)), global_path=str(global_path.relative_to(GLOBAL_ROOT)) if global_path else None, name=local_path.parent.name)
    if global_path is None or not global_path.exists():
        return item

    local_body = read_text(local_path)
    global_body = read_text(global_path)

    global_headings = extract_markdown_headings(global_body)
    local_headings = extract_markdown_headings(local_body)
    for heading in sorted(global_headings - local_headings):
        item.add("warning", f"Falta la sección `## {heading}` presente en la skill global.", "Reinyectar la sección o documentar por qué deja de aplicar localmente.")

    for group_name, tokens in TOKEN_GROUPS.items():
        if has_any_token(global_body, tokens) and not has_any_token(local_body, tokens):
            item.add("warning", f"No aparece el grupo de guardrails `{group_name}` presente en la skill global.", "Revisar si conviene reinyectar ese criterio reusable en la skill local.")
    return item


def collect_items(project_root: Path) -> list[AuditItem]:
    items: list[AuditItem] = []
    overlay_root = project_root / ".opencode"
    if not overlay_root.exists():
        items.append(AuditItem(category="overlay", local_path=".opencode/", global_path=None, name=".opencode", status="OK"))
        return items

    policy_item = audit_agents_local_policy(project_root)
    if policy_item is not None:
        items.append(policy_item)

    agents_dir = overlay_root / "agents"
    if agents_dir.exists():
        for local_path in sorted(agents_dir.glob("*.md")):
            global_path = GLOBAL_ROOT / "agents" / local_path.name
            items.append(audit_agent(local_path, global_path if global_path.exists() else None, project_root))

    commands_dir = overlay_root / "commands"
    if commands_dir.exists():
        for local_path in sorted(commands_dir.glob("*.md")):
            global_path = GLOBAL_ROOT / "commands" / local_path.name
            items.append(audit_command(local_path, global_path if global_path.exists() else None, project_root))

    skills_dir = overlay_root / "skills"
    if skills_dir.exists():
        for local_path in sorted(skills_dir.glob("*/SKILL.md")):
            global_path = GLOBAL_ROOT / "skills" / local_path.parent.name / "SKILL.md"
            items.append(audit_skill(local_path, global_path if global_path.exists() else None, project_root))

    return items


def summarize(items: list[AuditItem]) -> dict[str, int]:
    summary = {"OK": 0, "warning": 0, "error": 0}
    for item in items:
        summary[item.status] = summary.get(item.status, 0) + 1
    return summary


def render_markdown(project_root: Path, items: list[AuditItem]) -> str:
    lines = [
        "## Auditoría de overlays locales",
        f"- Proyecto: `{project_root}`",
    ]
    if not (project_root / ".opencode").exists():
        lines.append("- Estado: `OK` — no se detectó `.opencode/` local.")
        return "\n".join(lines)

    summary = summarize(items)
    lines.append(f"- Resumen: OK={summary['OK']} warning={summary['warning']} error={summary['error']}")
    lines.append("")
    for item in items:
        badge = item.status.upper()
        lines.append(f"### [{badge}] `{item.local_path}`")
        if item.global_path:
            lines.append(f"- Equivalente global: `{item.global_path}`")
        else:
            lines.append("- Equivalente global: _(sin equivalente)_")
        if not item.findings:
            lines.append("- Hallazgo principal: preserva estructura global o no requiere observaciones.")
        else:
            for finding in item.findings:
                lines.append(f"- {finding.severity.upper()}: {finding.message}")
                if finding.suggestion:
                    lines.append(f"  - Acción sugerida: {finding.suggestion}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_json(project_root: Path, items: list[AuditItem]) -> str:
    payload = {
        "projectRoot": str(project_root),
        "hasOverlay": (project_root / ".opencode").exists(),
        "summary": summarize(items),
        "items": [
            {
                "category": item.category,
                "name": item.name,
                "localPath": item.local_path,
                "globalPath": item.global_path,
                "status": item.status,
                "findings": [finding.__dict__ for finding in item.findings],
            }
            for item in items
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    project_root = Path(args.project_root).expanduser().resolve()
    if not project_root.exists():
        print(json.dumps({"error": f"Project root not found: {project_root}"}, ensure_ascii=False))
        return 1

    items = collect_items(project_root)
    if args.format == "json":
        sys.stdout.write(render_json(project_root, items))
    else:
        sys.stdout.write(render_markdown(project_root, items))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
