#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "--v2" ]]; then
  shift
  exec python3 "$REPO_DIR/v2/install/update.py" "$@"
fi
if [[ "${1:-}" != "--help" && "${1:-}" != "-h" ]] && [[ -f "$HOME/.config/opencode/production-v2/active.json" || -f "$HOME/.local/state/opencode-stack/install/current.json" ]]; then
  printf 'An active V2 installation was detected. V1 --main/--complete installers must not replace it. Use: bash install.sh --v2 plan\n' >&2
  exit 2
fi
MODE=""
FORWARDED_ARGS=()

usage() {
  cat <<'EOF'
Usage: bash install.sh [--main|--complete] [installer options]
       bash install.sh --v2 plan|update|verify-backup|rollback [options]

V2: data-preserving native update, explicit close gate and verified backups.
See v2/install/README.md. Legacy modes below are V1 only, not V2 installers.

Modes:
  --main       Install only the reusable base stack
  --complete   Install the base stack and every portable global addon

If no mode is provided in an interactive terminal, the installer asks which
mode to use. In non-interactive environments the mode is required.

Complete mode installs, in order:
  1. base stack
  2. Knowledge
  3. CodeGraph
  4. Ticketing
  5. Notifier
  6. Documents
  7. Background

It never installs github-accounts-local or project-specific overlays.

Common options forwarded to the selected installer include:
  --target-dir <path>
  --workspace-dir <path>       Complete mode only
  --dry-run
  --no-validate
  --skip-npm-install
  --skip-playwright-install
  --skip-addon-update          Complete mode only

Use the mode-specific installer help for the authoritative option list:
  bash scripts/install-opencode-stack.sh --help
  bash scripts/install-opencode-distribution.sh --help
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --main)
      [[ -z "$MODE" ]] || { printf 'Choose only one install mode\n' >&2; exit 2; }
      MODE="main"
      shift
      ;;
    --complete)
      [[ -z "$MODE" ]] || { printf 'Choose only one install mode\n' >&2; exit 2; }
      MODE="complete"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      FORWARDED_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$MODE" ]]; then
  if [[ ! -t 0 ]]; then
    printf 'Non-interactive installation requires --main or --complete\n\n' >&2
    usage >&2
    exit 2
  fi

  printf '%s\n' 'Select installation mode:'
  printf '%s\n' '  1) Main stack only'
  printf '%s\n' '  2) Complete portable pack'
  read -r -p 'Option [1-2]: ' answer
  case "$answer" in
    1) MODE="main" ;;
    2) MODE="complete" ;;
    *) printf 'Invalid option: %s\n' "$answer" >&2; exit 2 ;;
  esac
fi

case "$MODE" in
  main)
    exec bash "$REPO_DIR/scripts/install-opencode-stack.sh" "${FORWARDED_ARGS[@]}"
    ;;
  complete)
    exec bash "$REPO_DIR/scripts/install-opencode-distribution.sh" "${FORWARDED_ARGS[@]}"
    ;;
esac
