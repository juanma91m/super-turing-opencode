#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(CDPATH= cd -- "$SOURCE_DIR/.." && pwd)"
TARGET_DIR="${HOME}/.config/opencode"
DRY_RUN=0
VALIDATE=1
SKIP_ADDON_PULL=0
SKIP_NPM_INSTALL=0
SKIP_PLAYWRIGHT_INSTALL=0
INSTALL_NOTIFIER=1
INSTALL_KNOWLEDGE=1
INSTALL_TICKETING=1
INSTALL_BACKGROUND=0
INSTALL_NOTIFIER_EXAMPLE_CONFIG=0
BACKGROUND_OPENCODE_ROOT=""
BACKGROUND_ADOPT_LOCAL_INSTALL=0
BACKGROUND_BUN_PATH=""
WARNINGS=()
LAST_REPO_READY=1

NOTIFIER_REPO_NAME="super-turing-opencode-notifier"
NOTIFIER_REPO_URL="https://github.com/juanma91m/super-turing-opencode-notifier.git"
KNOWLEDGE_REPO_NAME="super-turing-opencode-knowledge"
KNOWLEDGE_REPO_URL="https://github.com/juanma91m/super-turing-opencode-knowledge.git"
TICKETING_REPO_NAME="super-turing-opencode-ticketing"
TICKETING_REPO_URL="https://github.com/juanma91m/super-turing-opencode-ticketing.git"
BACKGROUND_REPO_NAME="super-turing-opencode-background"
BACKGROUND_REPO_URL="https://github.com/juanma91m/super-turing-opencode-background.git"

usage() {
  cat <<'EOF'
Usage: install-opencode-distribution.sh [options]

Instala el stack base desde este checkout y orquesta addons externos recomendados.

Por defecto instala:
  - stack base (`opencode-stack`)
  - `super-turing-opencode-notifier`
  - `super-turing-opencode-knowledge`
  - `super-turing-opencode-ticketing`

`super-turing-opencode-background` queda opt-in porque requiere un checkout
fuente compatible de OpenCode para aplicar su patch de host.

Options:
  --workspace-dir <path>             Directorio donde viven o se clonan los addons
  --target-dir <path>                Target OpenCode config dir (default: ~/.config/opencode)
  --skip-addon-pull                  No hace git pull en addons ya clonados (usa working tree actual)
  --skip-npm-install                 Reenvía --skip-npm-install al installer base
  --skip-playwright-install          Reenvía --skip-playwright-install al installer base
  --skip-notifier                    No instala el addon notifier
  --skip-knowledge                   No instala el addon knowledge
  --skip-ticketing                   No instala el addon ticketing
  --install-notifier-example-config  Reenvía --install-example-config al installer notifier
  --with-background                  Intenta instalar también el addon background
  --background-opencode-root <path>  Checkout fuente compatible de OpenCode para background
  --background-adopt-local-install   Después de enable, corre adopt-local-install para ~/.opencode
  --background-bun-path <path>       Bun a usar para adopt-local-install (si aplica)
  --dry-run                          Muestra acciones sin escribir
  --no-validate                      No corre validación final con opencode debug config
  -h, --help                         Show this help
EOF
}

log() {
  printf '[opencode-distribution] %s\n' "$*"
}

warn() {
  WARNINGS+=("$*")
  printf '[opencode-distribution][warn] %s\n' "$*" >&2
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

addon_repo_dir() {
  printf '%s/%s\n' "$WORKSPACE_DIR" "$1"
}

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    return 0
  fi
  printf 'git es requerido para clonar o actualizar addons\n' >&2
  exit 1
}

ensure_addon_repo() {
  local name="$1"
  local repo_dir="$2"
  local repo_url="$3"
  local dirty=""

  LAST_REPO_READY=1

  if [[ -d "$repo_dir/.git" ]]; then
    if [[ "$SKIP_ADDON_PULL" -eq 1 ]]; then
      log "Usando addon existente sin pull: $name ($repo_dir)"
      return 0
    fi

    dirty="$(git -C "$repo_dir" status --porcelain)"
    if [[ -n "$dirty" ]]; then
      printf 'El repo addon %s tiene cambios locales en %s; abortando para no pisarlos. Usá --skip-addon-pull si querés instalar ese working tree tal cual.\n' "$name" "$repo_dir" >&2
      exit 1
    fi

    log "Actualizando addon $name"
    run git -C "$repo_dir" pull --ff-only
    return 0
  fi

  if [[ -e "$repo_dir" ]]; then
    printf 'La ruta del addon %s existe pero no es un repo git: %s\n' "$name" "$repo_dir" >&2
    exit 1
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run: se clonaría addon $name en $repo_dir"
    LAST_REPO_READY=0
    return 0
  fi

  log "Clonando addon $name en $repo_dir"
  mkdir -p "$(dirname "$repo_dir")"
  git clone "$repo_url" "$repo_dir"
}

install_base_stack() {
  local args=(--target-dir "$TARGET_DIR" --no-validate)
  [[ "$DRY_RUN" -eq 1 ]] && args+=(--dry-run)
  [[ "$SKIP_NPM_INSTALL" -eq 1 ]] && args+=(--skip-npm-install)
  [[ "$SKIP_PLAYWRIGHT_INSTALL" -eq 1 ]] && args+=(--skip-playwright-install)

  log "Instalando stack base desde $SOURCE_DIR"
  bash "$SOURCE_DIR/scripts/install-opencode-stack.sh" "${args[@]}"
}

install_notifier() {
  local repo_dir
  local args=(--target-dir "$TARGET_DIR")
  repo_dir="$(addon_repo_dir "$NOTIFIER_REPO_NAME")"
  ensure_addon_repo "$NOTIFIER_REPO_NAME" "$repo_dir" "$NOTIFIER_REPO_URL"
  [[ "$LAST_REPO_READY" -eq 1 ]] || {
    warn "Se omite instalación de notifier en dry-run porque el repo todavía no existe localmente"
    return 0
  }
  [[ "$DRY_RUN" -eq 1 ]] && args+=(--dry-run)
  [[ "$INSTALL_NOTIFIER_EXAMPLE_CONFIG" -eq 1 ]] && args+=(--install-example-config)

  log "Instalando addon notifier"
  bash "$repo_dir/scripts/install.sh" "${args[@]}"
}

install_knowledge() {
  local repo_dir
  local args=(--target-dir "$TARGET_DIR" --all --no-validate)
  repo_dir="$(addon_repo_dir "$KNOWLEDGE_REPO_NAME")"
  ensure_addon_repo "$KNOWLEDGE_REPO_NAME" "$repo_dir" "$KNOWLEDGE_REPO_URL"
  [[ "$LAST_REPO_READY" -eq 1 ]] || {
    warn "Se omite instalación de knowledge en dry-run porque el repo todavía no existe localmente"
    return 0
  }
  [[ "$DRY_RUN" -eq 1 ]] && args+=(--dry-run)

  log "Instalando addon knowledge"
  bash "$repo_dir/scripts/install.sh" "${args[@]}"
}

install_ticketing() {
  local repo_dir
  local args=(--target-dir "$TARGET_DIR")
  repo_dir="$(addon_repo_dir "$TICKETING_REPO_NAME")"
  ensure_addon_repo "$TICKETING_REPO_NAME" "$repo_dir" "$TICKETING_REPO_URL"
  [[ "$LAST_REPO_READY" -eq 1 ]] || {
    warn "Se omite instalación de ticketing en dry-run porque el repo todavía no existe localmente"
    return 0
  }
  [[ "$DRY_RUN" -eq 1 ]] && args+=(--dry-run)

  log "Instalando addon ticketing"
  bash "$repo_dir/scripts/install-opencode-ticketing.sh" "${args[@]}"
}

install_background() {
  local repo_dir
  local enable_args=()
  local adopt_args=()
  local bun_path="${BACKGROUND_BUN_PATH:-}"

  if [[ -z "$BACKGROUND_OPENCODE_ROOT" ]]; then
    printf '%s\n' '--with-background requiere --background-opencode-root con un checkout fuente compatible de OpenCode' >&2
    exit 1
  fi

  repo_dir="$(addon_repo_dir "$BACKGROUND_REPO_NAME")"
  ensure_addon_repo "$BACKGROUND_REPO_NAME" "$repo_dir" "$BACKGROUND_REPO_URL"
  [[ "$LAST_REPO_READY" -eq 1 ]] || {
    warn "Se omite instalación de background en dry-run porque el repo todavía no existe localmente"
    return 0
  }

  enable_args=(--opencode-root "$BACKGROUND_OPENCODE_ROOT")
  [[ "$DRY_RUN" -eq 1 ]] && enable_args+=(--dry-run)

  log "Instalando addon background sobre checkout $BACKGROUND_OPENCODE_ROOT"
  node "$repo_dir/scripts/enable.mjs" "${enable_args[@]}"

  if [[ "$BACKGROUND_ADOPT_LOCAL_INSTALL" -ne 1 ]]; then
    return 0
  fi

  if [[ -z "$bun_path" ]]; then
    bun_path="$(command -v bun || true)"
  fi
  if [[ -z "$bun_path" ]]; then
    printf '%s\n' '--background-adopt-local-install requiere bun; pasá --background-bun-path o instalá bun en PATH' >&2
    exit 1
  fi

  adopt_args=(--checkout-root "$BACKGROUND_OPENCODE_ROOT" --bun-path "$bun_path")
  [[ "$DRY_RUN" -eq 1 ]] && adopt_args+=(--dry-run)

  log "Adoptando instalación local de background en ~/.opencode"
  node "$repo_dir/scripts/adopt-local-install.mjs" "${adopt_args[@]}"
}

validate_distribution() {
  if [[ "$VALIDATE" -ne 1 ]]; then
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run: se omite validación final"
    return 0
  fi

  if [[ "$TARGET_DIR" != "$HOME/.config/opencode" ]]; then
    warn "El target no es ~/.config/opencode; se omite opencode debug config automático"
    return 0
  fi

  if ! command -v opencode >/dev/null 2>&1; then
    warn "opencode no está disponible; se omite validación final"
    return 0
  fi

  log "Validando configuración final con opencode debug config"
  opencode debug config >/dev/null

  log "Ejecutando stack-doctor post instalación de distribución"
  if ! opencode run --command stack-doctor --agent agent-design --dir "$SOURCE_DIR" --dangerously-skip-permissions; then
    warn "stack-doctor no pudo ejecutarse automáticamente; corré 'opencode run --command stack-doctor --agent agent-design --dir "$SOURCE_DIR" --dangerously-skip-permissions' para revisar el estado final"
  fi
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --workspace-dir)
      WORKSPACE_DIR="$2"
      shift 2
      ;;
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --skip-addon-pull)
      SKIP_ADDON_PULL=1
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
    --skip-notifier)
      INSTALL_NOTIFIER=0
      shift
      ;;
    --skip-knowledge)
      INSTALL_KNOWLEDGE=0
      shift
      ;;
    --skip-ticketing)
      INSTALL_TICKETING=0
      shift
      ;;
    --install-notifier-example-config)
      INSTALL_NOTIFIER_EXAMPLE_CONFIG=1
      shift
      ;;
    --with-background)
      INSTALL_BACKGROUND=1
      shift
      ;;
    --background-opencode-root)
      INSTALL_BACKGROUND=1
      BACKGROUND_OPENCODE_ROOT="$2"
      shift 2
      ;;
    --background-adopt-local-install)
      INSTALL_BACKGROUND=1
      BACKGROUND_ADOPT_LOCAL_INSTALL=1
      shift
      ;;
    --background-bun-path)
      INSTALL_BACKGROUND=1
      BACKGROUND_BUN_PATH="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
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

ensure_git

log "Source dir: $SOURCE_DIR"
log "Workspace dir: $WORKSPACE_DIR"
log "Target dir: $TARGET_DIR"

install_base_stack

if [[ "$INSTALL_NOTIFIER" -eq 1 ]]; then
  install_notifier
fi

if [[ "$INSTALL_KNOWLEDGE" -eq 1 ]]; then
  install_knowledge
fi

if [[ "$INSTALL_TICKETING" -eq 1 ]]; then
  install_ticketing
fi

if [[ "$INSTALL_BACKGROUND" -eq 1 ]]; then
  install_background
fi

validate_distribution

log "Instalación de distribución finalizada"

if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
  printf '\nWarnings:\n' >&2
  for item in "${WARNINGS[@]}"; do
    printf ' - %s\n' "$item" >&2
  done
fi
