#!/usr/bin/env bash
# Fetch new code into a fresh durable checkout, never pull/reset an old stack repo.
set -euo pipefail
ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/opencode-stack/bootstrap"
mkdir -p "$ROOT"
CHECKOUT="$(mktemp -d "$ROOT/source-XXXXXXXX")"
export GIT_TERMINAL_PROMPT=0
git clone --quiet --depth 1 --branch main https://github.com/juanma91m/super-turing-opencode.git "$CHECKOUT/core"
exec python3 "$CHECKOUT/core/v2/install/update.py" "$@"
