#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(CDPATH= cd -- "$SOURCE_DIR/.." && pwd)"
TARGET_DIR="${HOME}/.config/opencode"
MANIFEST_PATH="$SOURCE_DIR/distribution/addons.json"
DRY_RUN=0
VALIDATE=1
SKIP_ADDON_UPDATE=0
SKIP_NPM_INSTALL=0
SKIP_PLAYWRIGHT_INSTALL=0
INSTALLER_CONTRACT=""
ADDON_BRANCH=""
ADDONS=()
ADDON_REPO_DIR=""
PREPARED_ADDONS=()

usage() {
  cat <<'EOF'
Usage: bash scripts/install-opencode-distribution.sh [options]

Installs the base stack and all portable global addons in canonical order.
Addon implementation remains owned by each repository behind the stable
scripts/install.sh contract.

Options:
  --workspace-dir <path>        Directory used to clone/update addon repos
  --target-dir <path>           OpenCode config target (default: ~/.config/opencode)
  --manifest <path>             Alternate distribution manifest (advanced/testing)
  --skip-addon-update           Use existing addon checkouts without fetch/merge
  --skip-npm-install            Forward to the base installer
  --skip-playwright-install     Forward to the base installer
  --dry-run                     Show actions without changing the installation
  --no-validate                 Skip final opencode debug config and stack-doctor
  -h, --help                    Show this help

Excluded by design:
  - super-turing-opencode-github-accounts-local
  - every project-specific overlay/repository
EOF
}

log() { printf '[opencode-distribution] %s\n' "$*"; }

preflight_base() {
  local failed=0 dependency node_version
  for dependency in git python3 node npm npx; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
      printf '[opencode-distribution][preflight] missing required command: %s\n' "$dependency" >&2
      failed=1
    fi
  done
  if command -v node >/dev/null 2>&1; then
    node_version="$(node -p 'process.versions.node')"
    if ! python3 - "$node_version" <<'PY'
import sys

try:
    version = tuple(int(part) for part in sys.argv[1].split("."))
except ValueError:
    raise SystemExit(1)
major, minor, patch = (version + (0, 0, 0))[:3]
supported = (
    (major == 22 and (minor, patch) >= (22, 2))
    or (major == 24 and (minor, patch) >= (15, 0))
    or major >= 26
)
raise SystemExit(0 if supported else 1)
PY
    then
      printf '[opencode-distribution][preflight] unsupported Node.js %s; required: ^22.22.2, ^24.15.0 or >=26\n' "$node_version" >&2
      failed=1
    fi
  fi
  return "$failed"
}

load_manifest() {
  local manifest_output
  command -v python3 >/dev/null 2>&1 || { printf 'python3 is required\n' >&2; exit 1; }
  [[ -f "$MANIFEST_PATH" ]] || { printf 'Distribution manifest not found: %s\n' "$MANIFEST_PATH" >&2; exit 1; }

  manifest_output="$(python3 - "$MANIFEST_PATH" <<'PY'
import json
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
if data.get("schemaVersion") != 1:
    raise SystemExit("Unsupported distribution manifest schema")
contract = data.get("installerContract")
branch = data.get("branch", "main")
if contract != "scripts/install.sh":
    raise SystemExit("The only supported addon installer contract is scripts/install.sh")
if not re.fullmatch(r"[A-Za-z0-9._/-]+", branch):
    raise SystemExit("Invalid addon branch")
addons = data.get("addons")
if not isinstance(addons, list) or not addons:
    raise SystemExit("Distribution manifest has no addons")
seen = set()
print(f"meta\t{contract}\t{branch}")
for addon in addons:
    addon_id = addon.get("id", "")
    repository = addon.get("repository", "")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", addon_id):
        raise SystemExit(f"Invalid addon id: {addon_id!r}")
    if addon_id in seen:
        raise SystemExit(f"Duplicate addon id: {addon_id}")
    if not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git", repository):
        raise SystemExit(f"Unsupported repository URL for {addon_id}")
    seen.add(addon_id)
    print(f"addon\t{addon_id}\t{repository}")
PY
  )" || exit 1
  mapfile -t manifest_lines <<< "$manifest_output"

  local kind first second
  IFS=$'\t' read -r kind first second <<< "${manifest_lines[0]}"
  [[ "$kind" == "meta" ]] || { printf 'Invalid distribution manifest metadata\n' >&2; exit 1; }
  INSTALLER_CONTRACT="$first"
  ADDON_BRANCH="$second"
  ADDONS=("${manifest_lines[@]:1}")
}

ensure_addon_repo() {
  local id="$1" repository="$2" repo_name repo_dir branch dirty origin_url expected_slug
  repo_name="${repository##*/}"
  repo_name="${repo_name%.git}"
  repo_dir="$WORKSPACE_DIR/$repo_name"
  ADDON_REPO_DIR="$repo_dir"

  if [[ -d "$repo_dir/.git" ]]; then
    expected_slug="${repository#https://github.com/}"
    origin_url="$(git -C "$repo_dir" remote get-url origin 2>/dev/null || true)"
    case "$origin_url" in
      "https://github.com/$expected_slug"|git@*:"$expected_slug") ;;
      *)
        printf 'Addon %s has an unexpected origin: %s\n' "$id" "${origin_url:-missing}" >&2
        exit 1
        ;;
    esac
    branch="$(git -C "$repo_dir" branch --show-current)"
    [[ "$branch" == "$ADDON_BRANCH" ]] || {
      printf 'Addon %s must be on branch %s, found %s in %s\n' "$id" "$ADDON_BRANCH" "${branch:-detached}" "$repo_dir" >&2
      exit 1
    }
    dirty="$(git -C "$repo_dir" status --porcelain)"
    [[ -z "$dirty" ]] || {
      printf 'Addon %s has local changes in %s; refusing to update or execute it\n' "$id" "$repo_dir" >&2
      exit 1
    }
    if [[ "$SKIP_ADDON_UPDATE" -eq 0 ]]; then
      if [[ "$DRY_RUN" -eq 1 ]]; then
        log "Dry-run: would fetch and fast-forward $id in $repo_dir"
      else
        log "Updating $id"
        git -C "$repo_dir" fetch origin "$ADDON_BRANCH"
        git -C "$repo_dir" merge --ff-only "origin/$ADDON_BRANCH"
      fi
    else
      log "Using existing checkout without update: $id"
    fi
  elif [[ -e "$repo_dir" ]]; then
    printf 'Addon path exists but is not a Git repository: %s\n' "$repo_dir" >&2
    exit 1
  elif [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run: would clone $repository into $repo_dir"
    return 10
  else
    log "Cloning $id into $repo_dir"
    mkdir -p "$WORKSPACE_DIR"
    git clone --branch "$ADDON_BRANCH" --single-branch "$repository" "$repo_dir"
  fi

  [[ -f "$repo_dir/$INSTALLER_CONTRACT" ]] || {
    printf 'Addon %s does not implement %s at commit %s\n' "$id" "$INSTALLER_CONTRACT" "$(git -C "$repo_dir" rev-parse --short HEAD)" >&2
    exit 1
  }
}

install_base() {
  local args=(--target-dir "$TARGET_DIR" --no-validate)
  [[ "$DRY_RUN" -eq 1 ]] && args+=(--dry-run)
  [[ "$SKIP_NPM_INSTALL" -eq 1 ]] && args+=(--skip-npm-install)
  [[ "$SKIP_PLAYWRIGHT_INSTALL" -eq 1 ]] && args+=(--skip-playwright-install)
  log "Installing base stack"
  bash "$SOURCE_DIR/scripts/install-opencode-stack.sh" "${args[@]}"
}

prepare_addons() {
  local line kind id repository result
  PREPARED_ADDONS=()
  for line in "${ADDONS[@]}"; do
    IFS=$'\t' read -r kind id repository <<< "$line"
    [[ "$kind" == "addon" ]] || { printf 'Invalid addon manifest row\n' >&2; exit 1; }
    result=0
    ensure_addon_repo "$id" "$repository" || result=$?
    if [[ "$result" -eq 10 ]]; then
      log "Dry-run: preflight/installer for $id cannot run because its repo is not present"
      continue
    fi
    [[ "$result" -eq 0 ]] || exit "$result"
    PREPARED_ADDONS+=("$id"$'\t'"$ADDON_REPO_DIR")
  done
}

run_addon_preflights() {
  local line id repo_dir failed=0
  for line in "${PREPARED_ADDONS[@]}"; do
    IFS=$'\t' read -r id repo_dir <<< "$line"
    if [[ ! -f "$repo_dir/scripts/preflight.sh" ]]; then
      continue
    fi
    log "Running $id preflight"
    if ! bash "$repo_dir/scripts/preflight.sh" --target-dir "$TARGET_DIR"; then
      printf '[opencode-distribution][preflight] %s failed\n' "$id" >&2
      failed=1
    fi
  done
  return "$failed"
}

install_addons() {
  local line id repo_dir args
  for line in "${PREPARED_ADDONS[@]}"; do
    IFS=$'\t' read -r id repo_dir <<< "$line"
    args=(--target-dir "$TARGET_DIR")
    [[ "$DRY_RUN" -eq 1 ]] && args+=(--dry-run)
    log "Installing $id from commit $(git -C "$repo_dir" rev-parse --short HEAD)"
    bash "$repo_dir/$INSTALLER_CONTRACT" "${args[@]}"
  done
}

validate_distribution() {
  [[ "$VALIDATE" -eq 1 ]] || return 0
  [[ "$DRY_RUN" -eq 0 ]] || { log 'Dry-run: final validation skipped'; return 0; }
  if [[ "$TARGET_DIR" != "$HOME/.config/opencode" ]]; then
    log "Target is not the active global config; final runtime validation skipped"
    return 0
  fi
  command -v opencode >/dev/null 2>&1 || { log 'opencode not found; final runtime validation skipped'; return 0; }
  log 'Validating final merged configuration'
  opencode debug config >/dev/null
  log 'Running stack-doctor'
  opencode run --command stack-doctor --agent agent-design --dir "$SOURCE_DIR" --dangerously-skip-permissions || \
    log 'stack-doctor reported warnings; inspect its output before using the installation'
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --workspace-dir) WORKSPACE_DIR="$2"; shift 2 ;;
    --target-dir) TARGET_DIR="$2"; shift 2 ;;
    --manifest) MANIFEST_PATH="$2"; shift 2 ;;
    --skip-addon-update) SKIP_ADDON_UPDATE=1; shift ;;
    --skip-npm-install) SKIP_NPM_INSTALL=1; shift ;;
    --skip-playwright-install) SKIP_PLAYWRIGHT_INSTALL=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-validate) VALIDATE=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

command -v git >/dev/null 2>&1 || { printf 'git is required\n' >&2; exit 1; }
load_manifest
log "Workspace: $WORKSPACE_DIR"
log "Target: $TARGET_DIR"
log 'Excluded: github-accounts-local and project-specific overlays'
preflight_failed=0
preflight_base || preflight_failed=1
prepare_addons
run_addon_preflights || preflight_failed=1
if [[ "$preflight_failed" -ne 0 ]]; then
  printf '[opencode-distribution] Preflight failed; no files were installed into %s\n' "$TARGET_DIR" >&2
  exit 2
fi
install_base
install_addons
validate_distribution
log 'Complete portable pack installation finished'
