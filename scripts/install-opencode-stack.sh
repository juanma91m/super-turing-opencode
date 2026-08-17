#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="${HOME}/.config/opencode"
DRY_RUN=0
SKIP_NPM_INSTALL=0
SKIP_PLAYWRIGHT_INSTALL=0
VALIDATE=1

MANAGED_FILES=()

WARNINGS=()
ADDITIVE_RENDER_DIR=""

cleanup_temp_artifacts() {
  if [[ -n "$ADDITIVE_RENDER_DIR" && -d "$ADDITIVE_RENDER_DIR" ]]; then
    rm -rf "$ADDITIVE_RENDER_DIR"
  fi
}

trap cleanup_temp_artifacts EXIT

usage() {
  cat <<'EOF'
Usage: install-opencode-stack.sh [options]

Options:
  --target-dir <path>         Target OpenCode config directory (default: ~/.config/opencode)
  --dry-run                   Show actions without writing files
  --skip-npm-install          Do not run npm install in target directory
  --skip-playwright-install   Do not try to install Playwright Chromium if missing
  --no-validate               Do not run opencode debug config after install
  -h, --help                  Show this help
EOF
}

load_managed_files() {
  if ! command -v python3 >/dev/null 2>&1; then
    printf 'python3 is required to read STACK-MANIFEST.json\n' >&2
    exit 1
  fi

  mapfile -t MANAGED_FILES < <(
    python3 - "$SOURCE_DIR/STACK-MANIFEST.json" <<'PY'
import json
import pathlib
import sys

manifest_path = pathlib.Path(sys.argv[1])
data = json.loads(manifest_path.read_text())
for item in data.get("managedFiles", []):
    print(item)
PY
  )

  if [[ "${#MANAGED_FILES[@]}" -eq 0 ]]; then
    printf 'No managed files found in %s\n' "$SOURCE_DIR/STACK-MANIFEST.json" >&2
    exit 1
  fi
}

log() {
  printf '[opencode-stack] %s\n' "$*"
}

warn() {
  WARNINGS+=("$*")
  printf '[opencode-stack][warn] %s\n' "$*" >&2
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

backup_path() {
  local rel_path="$1"
  local src="$TARGET_DIR/$rel_path"
  local backup_dir="$2"

  if [[ ! -e "$src" ]]; then
    return 0
  fi

  run mkdir -p "$(dirname "$backup_dir/$rel_path")"
  run cp -R "$src" "$backup_dir/$rel_path"
}

copy_file() {
  local rel_path="$1"
  local src="$SOURCE_DIR/$rel_path"
  local dst="$TARGET_DIR/$rel_path"

  if [[ ! -e "$src" ]]; then
    warn "Managed file missing in source: $rel_path"
    return 0
  fi

  run mkdir -p "$(dirname "$dst")"

  if [[ -e "$dst" ]] && [[ "$(realpath -m "$src")" == "$(realpath -m "$dst")" ]]; then
    log "Skipping copy for $rel_path (source and target are the same file)"
    return 0
  fi

  run cp "$src" "$dst"
}

recompose_additive_agents() {
  if [[ ! -f "$SOURCE_DIR/scripts/recompose_additive_agents.py" ]]; then
    warn "No se encontró scripts/recompose_additive_agents.py; se omite recomposición de agentes aditivos"
    return 0
  fi

  ADDITIVE_RENDER_DIR="$(mktemp -d)"
  python3 "$SOURCE_DIR/scripts/recompose_additive_agents.py" render \
    --source-dir "$SOURCE_DIR" \
    --target-dir "$TARGET_DIR" \
    --output-dir "$ADDITIVE_RENDER_DIR"

  local rel_path src dst
  for rel_path in agents/agent-design.md agents/master-dev.md agents/planner.md; do
    src="$ADDITIVE_RENDER_DIR/$rel_path"
    dst="$TARGET_DIR/$rel_path"
    if [[ ! -f "$src" ]]; then
      continue
    fi
    if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
      continue
    fi
    run mkdir -p "$(dirname "$dst")"
    run cp "$src" "$dst"
  done
}

detect_playwright_executable() {
  local matches=()
  local candidate

  shopt -s nullglob
  for candidate in "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome; do
    if [[ -x "$candidate" ]]; then
      matches+=("$candidate")
    fi
  done
  shopt -u nullglob

  if [[ "${#matches[@]}" -eq 0 ]]; then
    return 1
  fi

  printf '%s\n' "${matches[-1]}"
}

maybe_install_playwright() {
  if [[ "$SKIP_PLAYWRIGHT_INSTALL" -eq 1 ]]; then
    return 0
  fi

  if ! command -v npx >/dev/null 2>&1; then
    warn "npx no está disponible; no se puede intentar instalar Playwright Chromium"
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run: omitiendo instalación real de Playwright Chromium"
    return 0
  fi

  log "Playwright Chromium no encontrado; intento instalación user-space"
  if ! npx -y playwright@latest install chromium; then
    warn "Falló la instalación de Playwright Chromium; el MCP Playwright podría quedar deshabilitado"
  fi
}

render_opencode_config() {
  local stitch_key="$TARGET_DIR/stitch-api-key"
  local stitch_enabled="false"
  local playwright_enabled="false"
  local playwright_exec=""

  if [[ -f "$stitch_key" ]]; then
    stitch_enabled="true"
  else
    warn "No se encontró stitch-api-key en $stitch_key; MCP Stitch quedará deshabilitado"
  fi

  if playwright_exec="$(detect_playwright_executable 2>/dev/null)"; then
    playwright_enabled="true"
  else
    maybe_install_playwright
    if playwright_exec="$(detect_playwright_executable 2>/dev/null)"; then
      playwright_enabled="true"
    else
      warn "No se encontró Chromium user-space de Playwright; MCP Playwright quedará deshabilitado"
    fi
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run: opencode.json sería regenerado en $TARGET_DIR/opencode.json"
    return 0
  fi

  PLAYWRIGHT_ENABLED="$playwright_enabled" \
  PLAYWRIGHT_EXECUTABLE="$playwright_exec" \
  STITCH_ENABLED="$stitch_enabled" \
  STITCH_KEY_FILE="$stitch_key" \
  python3 <<'PY' > "$TARGET_DIR/opencode.json"
import json
import os

playwright_enabled = os.environ["PLAYWRIGHT_ENABLED"] == "true"
stitch_enabled = os.environ["STITCH_ENABLED"] == "true"

playwright_command = ["npx", "-y", "@playwright/mcp@latest", "--headless"]
playwright_exec = os.environ.get("PLAYWRIGHT_EXECUTABLE", "")
if playwright_exec:
    playwright_command.extend(["--executable-path", playwright_exec])

stitch_config = {
    "type": "remote",
    "url": "https://stitch.googleapis.com/mcp",
    "enabled": stitch_enabled,
    "timeout": 300000,
    "oauth": False,
}
if stitch_enabled:
    stitch_config["headers"] = {
        "X-Goog-Api-Key": "{file:%s}" % os.environ["STITCH_KEY_FILE"],
    }

config = {
    "$schema": "https://opencode.ai/config.json",
    "model": "openai/gpt-5.6-sol",
    "small_model": "openai/gpt-5.6-sol",
    "default_agent": "master-dev",
    "agent": {
        "build": {
            "hidden": True,
        },
        "plan": {
            "disable": True,
        },
        "general": {
            "model": "openai/gpt-5.6-sol",
            "variant": "medium",
        },
        "explore": {
            "model": "openai/gpt-5.6-sol",
            "variant": "medium",
        },
        "title": {
            "model": "openai/gpt-5.6-sol",
            "variant": "low",
        },
        "summary": {
            "model": "openai/gpt-5.6-sol",
            "variant": "medium",
        },
        "compaction": {
            "model": "openai/gpt-5.6-sol",
            "variant": "medium",
        },
    },
    "permission": {
        "external_directory": {
            "~/.config/opencode/scripts/**": "allow",
        },
    },
    "mcp": {
        "context7": {
            "type": "local",
            "command": [
                "npx",
                "-y",
                "@upstash/context7-mcp@latest",
            ],
            "enabled": True,
        },
        "playwright": {
            "type": "local",
            "command": playwright_command,
            "enabled": playwright_enabled,
        },
        "stitch": stitch_config,
    },
}

print(json.dumps(config, indent=2))
PY
}

install_npm_dependencies() {
  if [[ "$SKIP_NPM_INSTALL" -eq 1 ]]; then
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    warn "npm no está disponible; no se pudieron instalar dependencias del plugin"
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run: se omite npm install en $TARGET_DIR"
    return 0
  fi

  log "Instalando dependencias npm del stack"
  (cd "$TARGET_DIR" && npm install)
}

validate_config() {
  if [[ "$VALIDATE" -ne 1 ]]; then
    return 0
  fi

  if ! command -v opencode >/dev/null 2>&1; then
    warn "opencode no está disponible; se omite validación final"
    return 0
  fi

  if [[ "$TARGET_DIR" != "$HOME/.config/opencode" ]]; then
    warn "El target no es ~/.config/opencode; se omite opencode debug config automático"
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run: se omite opencode debug config"
    return 0
  fi

  log "Validando configuración final con opencode debug config"
  opencode debug config >/dev/null

  log "Ejecutando stack-doctor post instalación"
  if ! opencode run --command stack-doctor --agent agent-design --dir "$SOURCE_DIR" --dangerously-skip-permissions; then
    warn "stack-doctor no pudo ejecutarse automáticamente; corré 'opencode run --command stack-doctor --agent agent-design --dir \"$SOURCE_DIR\" --dangerously-skip-permissions' para revisar el estado del stack"
  fi
}

prune_backups() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    warn "python3 no está disponible; no se pudieron podar backups viejos"
    return 0
  fi

  if [[ ! -f "$TARGET_DIR/scripts/prune_stack_backups.py" ]]; then
    warn "No se encontró scripts/prune_stack_backups.py en el target; se omite poda de backups"
    return 0
  fi

  log "Podando backups viejos del stack (retención: 5 + pinned)"
  python3 "$TARGET_DIR/scripts/prune_stack_backups.py" --target-dir "$TARGET_DIR" --keep 5 >/dev/null || warn "Falló la poda de backups viejos"
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --skip-npm-install)
      SKIP_NPM_INSTALL=1
      shift
      ;;
    --skip-playwright-install)
      SKIP_PLAYWRIGHT_INSTALL=1
      shift
      ;;
    --no-validate)
      VALIDATE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$TARGET_DIR/.stack-backups/$TIMESTAMP"

load_managed_files

log "Source dir: $SOURCE_DIR"
log "Target dir: $TARGET_DIR"

run mkdir -p "$TARGET_DIR"

for rel_path in "${MANAGED_FILES[@]}"; do
  backup_path "$rel_path" "$BACKUP_DIR"
done
backup_path "opencode.json" "$BACKUP_DIR"

for rel_path in "${MANAGED_FILES[@]}"; do
  copy_file "$rel_path"
done

recompose_additive_agents
install_npm_dependencies
render_opencode_config
prune_backups
validate_config

log "Instalación finalizada"

if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
  printf '\nWarnings:\n' >&2
  for item in "${WARNINGS[@]}"; do
    printf ' - %s\n' "$item" >&2
  done
fi
