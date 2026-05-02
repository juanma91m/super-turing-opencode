#!/usr/bin/env bash
set -euo pipefail

resolve_repo_root() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
  else
    pwd -P
  fi
}

ROOT_DIR="$(resolve_repo_root)"
LOCAL_SCRIPT="$ROOT_DIR/.opencode/scripts/check_code_patterns.sh"

if [[ -f "$LOCAL_SCRIPT" ]]; then
  exec bash "$LOCAL_SCRIPT" "$@"
fi

cat <<EOF
No local pattern-checking integration found for repository:
  $ROOT_DIR

Expected local script:
  .opencode/scripts/check_code_patterns.sh

Recommended next step:
  - add project-local Semgrep integration in .opencode/
  - see ~/.config/opencode/PLAYBOOK-CODE-PATTERNS.md
EOF
exit 1
