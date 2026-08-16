#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MODE=""
FORWARDED_ARGS=()

usage() {
  cat <<'EOF'
Usage: bash scripts/install.sh [--main|--complete] [installer options]

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
  6. Background

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
    exec bash "$SCRIPT_DIR/install-opencode-stack.sh" "${FORWARDED_ARGS[@]}"
    ;;
  complete)
    exec bash "$SCRIPT_DIR/install-opencode-distribution.sh" "${FORWARDED_ARGS[@]}"
    ;;
esac
