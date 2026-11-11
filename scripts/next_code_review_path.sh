#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

mode="${1:-}"
subject="${2:-}"

case "$mode" in
  global)
    fail "storage global retirado; usar ticket <PROYECTO-numero> --content '<informe literal>' desde el repo revisado"
    ;;
  ticket)
    [[ "$#" -eq 2 || ( "$#" -eq 4 && "$3" == "--content" ) ]] \
      || fail "uso: $0 ticket <PROYECTO-numero> [--content '<informe literal>']"
    [[ "$subject" =~ ^[A-Z][A-Z0-9]+-[0-9]+$ ]] \
      || fail "ticket inválido; debe usar <PROYECTO>-<numero>"
    repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" \
      || fail "ticket mode requiere ejecutarse dentro de un repositorio git"
    # Sin --content se conserva la reserva legacy; no equivale a un informe escrito.
    # dir_fd + O_NOFOLLOW evita escapar por symlinks en cualquier componente.
    python3 - "$repo_root" "$subject" "${@:3}" <<'PY'
import os
import sys

root, ticket = sys.argv[1:3]
content = sys.argv[4] if len(sys.argv) == 5 else None
if content is not None and not content.strip():
    sys.exit("error: el informe no puede estar vacío")

directory = None
created = None
try:
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    directory = os.open(root, flags)
    for component in ("tmp", ticket, "code-review"):
        try:
            os.mkdir(component, mode=0o700, dir_fd=directory)
        except FileExistsError:
            pass
        child = os.open(component, flags, dir_fd=directory)
        os.close(directory)
        directory = child
    for number in range(1, 100000):
        name = f"code-review-{number}.md"
        try:
            fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o600, dir_fd=directory)
        except FileExistsError:
            continue
        created = name
        with os.fdopen(fd, "w", encoding="utf-8") as report:
            if content is not None:
                report.write(content)
                if not content.endswith("\n"):
                    report.write("\n")
            report.flush()
            os.fsync(report.fileno())
        print(f"tmp/{ticket}/code-review/{name}")
        break
    else:
        raise OSError("no se pudo reservar un path incremental")
except (OSError, UnicodeError) as error:
    if created is not None:
        os.unlink(created, dir_fd=directory)
    sys.exit(f"error: no se pudo guardar el informe: {error}")
finally:
    if directory is not None:
        os.close(directory)
PY
    ;;
  *)
    fail "uso: $0 ticket <PROYECTO-numero> [--content '<informe literal>']"
    ;;
esac
