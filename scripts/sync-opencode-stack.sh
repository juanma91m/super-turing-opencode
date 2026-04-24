#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="${HOME}/.config/opencode"
DRY_RUN=0
STATUS_ONLY=0
VALIDATE=1

MANAGED_FILES=()
WARNINGS=()
TO_CREATE=()
TO_UPDATE=()
UNCHANGED_COUNT=0
MISSING_SOURCE_COUNT=0

usage() {
  cat <<'EOF'
Usage: sync-opencode-stack.sh [options]

Options:
  --target-dir <path>   Target OpenCode config directory (default: ~/.config/opencode)
  --dry-run             Show what would be synchronized without writing files
  --status              Only report differences; do not synchronize files
  --no-validate         Do not run opencode debug config after sync
  -h, --help            Show this help
EOF
}

log() {
  printf '[opencode-sync] %s\n' "$*"
}

warn() {
  WARNINGS+=("$*")
  printf '[opencode-sync][warn] %s\n' "$*" >&2
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
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

classify_files() {
  local rel_path src dst

  for rel_path in "${MANAGED_FILES[@]}"; do
    src="$SOURCE_DIR/$rel_path"
    dst="$TARGET_DIR/$rel_path"

    if [[ ! -e "$src" ]]; then
      warn "Managed file missing in source: $rel_path"
      MISSING_SOURCE_COUNT=$((MISSING_SOURCE_COUNT + 1))
      continue
    fi

    if [[ ! -e "$dst" ]]; then
      TO_CREATE+=("$rel_path")
      continue
    fi

    if cmp -s "$src" "$dst"; then
      UNCHANGED_COUNT=$((UNCHANGED_COUNT + 1))
    else
      TO_UPDATE+=("$rel_path")
    fi
  done
}

print_plan() {
  local rel_path

  if [[ "${#TO_CREATE[@]}" -eq 0 && "${#TO_UPDATE[@]}" -eq 0 ]]; then
    log "No managed file differences detected"
    return 0
  fi

  if [[ "${#TO_CREATE[@]}" -gt 0 ]]; then
    printf 'Create:\n'
    for rel_path in "${TO_CREATE[@]}"; do
      printf '  + %s\n' "$rel_path"
    done
  fi

  if [[ "${#TO_UPDATE[@]}" -gt 0 ]]; then
    printf 'Update:\n'
    for rel_path in "${TO_UPDATE[@]}"; do
      printf '  ~ %s\n' "$rel_path"
    done
  fi
}

apply_changes() {
  local rel_path src dst timestamp backup_dir

  if [[ "${#TO_CREATE[@]}" -eq 0 && "${#TO_UPDATE[@]}" -eq 0 ]]; then
    return 0
  fi

  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup_dir="$TARGET_DIR/.stack-sync-backups/$timestamp"

  for rel_path in "${TO_CREATE[@]}"; do
    src="$SOURCE_DIR/$rel_path"
    dst="$TARGET_DIR/$rel_path"
    run mkdir -p "$(dirname "$dst")"
    run cp "$src" "$dst"
  done

  for rel_path in "${TO_UPDATE[@]}"; do
    src="$SOURCE_DIR/$rel_path"
    dst="$TARGET_DIR/$rel_path"
    run mkdir -p "$(dirname "$backup_dir/$rel_path")"
    run cp "$dst" "$backup_dir/$rel_path"
    run mkdir -p "$(dirname "$dst")"
    run cp "$src" "$dst"
  done
}

validate_config() {
  if [[ "$VALIDATE" -ne 1 ]]; then
    return 0
  fi

  if [[ "$STATUS_ONLY" -eq 1 || "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi

  if [[ "${#TO_CREATE[@]}" -eq 0 && "${#TO_UPDATE[@]}" -eq 0 ]]; then
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

  log "Validando configuración final con opencode debug config"
  opencode debug config >/dev/null
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
    --status)
      STATUS_ONLY=1
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

load_managed_files

log "Source dir: $SOURCE_DIR"
log "Target dir: $TARGET_DIR"

classify_files
print_plan

if [[ "$STATUS_ONLY" -eq 0 ]]; then
  apply_changes
  validate_config
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run finalizado"
  else
    log "Sync finalizado"
  fi
fi

printf 'Summary: create=%d update=%d unchanged=%d missing_source=%d\n' \
  "${#TO_CREATE[@]}" "${#TO_UPDATE[@]}" "$UNCHANGED_COUNT" "$MISSING_SOURCE_COUNT"

if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
  printf '\nWarnings:\n' >&2
  for item in "${WARNINGS[@]}"; do
    printf ' - %s\n' "$item" >&2
  done
fi
