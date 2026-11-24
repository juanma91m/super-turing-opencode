#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == '--v2' ]]; then shift; fi  # Existing V2 command spelling.
exec python3 -B "$REPO_DIR/v2/install/update.py" "$@"
