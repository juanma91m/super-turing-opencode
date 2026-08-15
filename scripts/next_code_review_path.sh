#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

reserve_next() {
  local directory="$1" prefix="$2" number path
  mkdir -p "$directory"

  for ((number = 1; number <= 99999; number++)); do
    path="$directory/$prefix-$number.md"
    if (set -o noclobber; : > "$path") 2>/dev/null; then
      printf '%s\n' "$path"
      return 0
    fi
  done

  fail "no se pudo reservar un path incremental en $directory"
}

mode="${1:-}"
subject="${2:-}"

case "$mode" in
  global)
    [[ -n "$subject" ]] || fail "uso: $0 global <identificador>"
    slug="$(printf '%s' "$subject" \
      | tr '[:upper:]' '[:lower:]' \
      | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
    [[ -n "$slug" ]] || fail "el identificador no contiene caracteres utilizables"
    slug="${slug:0:120}"
    base="$HOME/code-reviews"
    [[ ! -L "$base" ]] || fail "$base no puede ser un symlink"
    reserve_next "$base/$slug" "code-review"
    ;;
  ticket)
    [[ "$subject" =~ ^[A-Z][A-Z0-9]+-[0-9]+$ ]] \
      || fail "ticket inválido; debe usar <PROYECTO>-<numero>"
    repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" \
      || fail "ticket mode requiere ejecutarse dentro de un repositorio git"
    absolute="$(reserve_next "$repo_root/tmp/$subject/code-review" "code-review")"
    printf '%s\n' "${absolute#"$repo_root/"}"
    ;;
  *)
    fail "uso: $0 global <identificador> | ticket <PROYECTO-numero>"
    ;;
esac
