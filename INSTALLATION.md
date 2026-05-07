# Instalación del stack OpenCode

Esta guía está pensada para un tercero que quiere instalar **todo** el stack desde este repo, empezando por un `git clone` limpio.

## Qué instala

- agentes y subagentes globales,
- commands globales,
- skills globales,
- plugins async server/TUI,
- helpers Jira/session cleanup,
- Engram parcheado (si hace falta compilarlo),
- configuración MCP para Context7, Engram, Playwright y Stitch,
- documentación operativa en `~/.config/opencode/`.

## Prerrequisitos mínimos

- `opencode` ya instalado
- `git`
- `node`, `npm`, `npx`
- `python3`
- `curl` y `tar` si el script debe instalar Go automáticamente para compilar Engram

## Instalación paso a paso

### 1. Clonar el repo

```bash
git clone <URL-DEL-REPO> opencode-stack
cd opencode-stack
```

### 2. Ejecutar el installer

```bash
bash scripts/install-opencode-stack.sh
```

Ese comando:

- instala dependencias npm del stack,
- clona/aplica patch/recompila Engram si hace falta,
- instala Playwright Chromium user-space si falta,
- copia assets a `~/.config/opencode/`,
- genera `~/.config/opencode/opencode.json` con Context7 global y el resto de MCPs según disponibilidad local,
- asegura `~/.config/opencode/tui.json` para activar el plugin TUI async global sin pisar otros campos del archivo,
- valida con `opencode debug config`,
- e intenta correr `stack-doctor` al final para reportar warnings/errores del entorno.

Si el installer detecta **GNOME** en Linux, también puede sugerir instalar `wmctrl` y `xdotool`.

- en **GNOME/X11** esa recomendación es útil para mejorar el click-to-focus del notifier global,
- en **Wayland** el click-to-focus sigue siendo más best-effort y ese fallback no aplica igual.

Ejemplo en Debian/Ubuntu:

```bash
sudo apt install wmctrl xdotool
```

### 3. Completar secretos opcionales

#### Stitch

Si querés usar Stitch, crear:

```bash
mkdir -p ~/.config/opencode
printf '%s' '<TU_API_KEY_DE_STITCH>' > ~/.config/opencode/stitch-api-key
chmod 600 ~/.config/opencode/stitch-api-key
```

#### Jira helpers (solo si un proyecto los usa)

Los helpers globales de Jira **no** necesitan configuración global fija, pero los proyectos que adopten workflow Jira deben tener un `.env` compatible con:

- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

#### Context7

El MCP global de Context7 queda configurado via `npx -y @upstash/context7-mcp@latest` y sirve para documentacion actualizada de librerias/APIs.

- no requiere secreto para uso basico,
- aprovecha los prerrequisitos globales `node`/`npx` ya pedidos por el stack,
- si mas adelante queres mejores rate limits o material privado, conviene evaluar una API key local y ajustar esa integracion aparte.

## Validación básica

Después de instalar:

```bash
opencode run --command stack-doctor --agent agent-design --dir "$(pwd)" --dangerously-skip-permissions
```

Opcionalmente, correr:

```bash
opencode debug config
```

Y si querés validar la UX visual async en una TUI foreground real:

```bash
opencode ~/.local/src/opencode-stack
```

Dentro de esa sesión, usar:

```text
/bg-tasks
```

Ese comando abre la lista TUI de delegaciones del proyecto actual y permite navegar a la sesión hija cuando exista `sessionID`.

La idea es:

- el installer ya intenta ejecutar `stack-doctor`,
- y si querés revisar de nuevo después de corregir algo del entorno, corrés ese mismo comando manualmente hasta que el diagnóstico quede sano.

Si además estás dentro de un repo que tiene `.opencode/`, podés correr una auditoría focalizada del overlay local con:

```bash
opencode run --command check-local-overlays --agent agent-design --dir "$(pwd)" --dangerously-skip-permissions
```

Para entender cuándo usar `AGENTS.md`, cuándo overridear y cómo interpretar `OK` / `warning` / `error`, ver también:

- `PLAYBOOK-LOCAL-OVERLAYS.md`

Si un proyecto incorpora pattern checks con Semgrep/ast-grep, la guía global de uso e integración está en:

- `PLAYBOOK-CODE-PATTERNS.md`

## Instalación en modo diagnóstico (sin escribir)

Si querés ver qué haría el installer:

```bash
bash scripts/install-opencode-stack.sh --dry-run --skip-npm-install --skip-playwright-install --no-validate
```

## Mantenimiento normal después de instalar

Una vez bootstrappeada la máquina, **no** hace falta reinstalar todo para cambios comunes.

Usar:

```bash
bash scripts/sync-opencode-stack.sh --status
bash scripts/sync-opencode-stack.sh
```

## Nota importante sobre `delegate_isolated`

`delegate_isolated` usa la API `/experimental/worktree` de OpenCode.

### Funciona mejor en sesiones server-backed

Por ejemplo:

```bash
opencode serve --port 4104
opencode run --attach http://127.0.0.1:4104 --agent master-dev "..."
```

### Limitación conocida

En algunos usos de `opencode run` local directo (sin `--attach`), la API de worktree puede no estar expuesta y `delegate_isolated` fallará con un mensaje claro indicando que necesita una sesión con soporte de worktree.

Eso **no afecta**:

- `delegate` read-only,
- `delegation_read`,
- `delegation_tail`,
- `delegation_cancel`,
- `delegation_continue`,
- `/bg-tasks` dentro de una TUI foreground ya conectada.

## Qué NO migra automáticamente

- `~/.engram/engram.db`
- `~/.cache/ms-playwright/`
- secretos fuera del repo (`stitch-api-key`, `.env` de proyectos, etc.)

## Problemas frecuentes

### `opencode debug config` expone la Stitch key resuelta

Tratar su salida como sensible.

### El repo fuente está dirty pero el activo no tiene drift

Eso significa que tu `~/.config/opencode/` ya fue sincronizado con el working tree actual, pero todavía no committeaste esos cambios en el repo fuente.

### `delegate_isolated` falla con worktree API unreachable

Usar una sesión server-backed (`opencode serve` + `--attach`) para ese flujo.
