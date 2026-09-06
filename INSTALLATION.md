# Instalación del stack OpenCode

Esta guía está pensada para un tercero que quiere instalar **todo** el stack desde este repo, empezando por un `git clone` limpio.

## Qué instala

El modo principal instala:

- agentes y subagentes globales,
- commands globales,
- skills globales,
- helpers Jira/session cleanup,
- configuración MCP para Context7, Playwright y Stitch,
- documentación operativa en `~/.config/opencode/`.

El modo completo agrega los seis addons globales portables definidos en
`distribution/addons.json`.

## Prerrequisitos mínimos

- `opencode` ya instalado
- `git`
- `node`, `npm`, `npx` con Node `^22.22.2`, `^24.15.0` o `>=26`
- `python3`

## Instalación paso a paso

### 1. Clonar el repo

```bash
git clone <URL-DEL-REPO> opencode-stack
cd opencode-stack
```

### 2. Elegir el modo de instalación

#### Solo stack principal

```bash
bash install.sh --main
```

#### Pack completo

```bash
bash install.sh --complete
```

Sin flags, en una terminal interactiva, el installer pregunta qué modo usar.

El pack completo instala en este orden:

1. stack base;
2. Knowledge;
3. CodeGraph;
4. Ticketing;
5. Notifier;
6. Documents;
7. Background.

No incluye `super-turing-opencode-github-accounts-local` ni repos/overlays
específicos de proyectos.

Ese comando:

- instala dependencias npm del stack,
- instala Playwright Chromium user-space si falta,
- copia assets a `~/.config/opencode/`,
- genera `~/.config/opencode/opencode.json` con Context7 global y el resto de MCPs base según disponibilidad local,
- selecciona `master-dev` como agente por defecto y oculta el built-in `build` de la selección manual sin deshabilitarlo,
- valida con `opencode debug config`,
- e intenta correr `stack-doctor` al final para reportar warnings/errores del entorno.

El stack base no absorbe addons externos. El modo completo solo los orquesta:
clona o actualiza cada repo y ejecuta el `scripts/install.sh` mantenido por ese
addon. La lista y el orden viven en `distribution/addons.json`.

Si elegiste `--main` y después querés sumar async/background, podés instalar
`super-turing-opencode-background` por separado.

Ese addon es el dueño canónico de:

- delegaciones async/background,
- patch host/core requerido por versión,
- UX TUI de Background Tasks,
- managed local install en `~/.opencode`.

Si elegiste `--main` y después querés inteligencia estructural, podés instalar
`super-turing-opencode-codegraph` por separado:

```bash
git clone git@github-juanma91m-v2:juanma91m/super-turing-opencode-codegraph.git
cd super-turing-opencode-codegraph
bash scripts/install.sh
```

Ese addon fija la versión de CodeGraph, registra el MCP global read-only y aporta wrappers para generar o adoptar `<repo>/.codegraph/`. Los índices siguen siendo machine-local por repository root y no forman parte del stack base ni de knowledge.

### 3. Prerrequisitos adicionales del modo completo

- acceso HTTPS a GitHub;
- `curl`, `tar` y `sha256sum` para instalar Quarto user-space desde Documents;
- `curl`, `unzip` y `sha256sum` si Background necesita bootstrappear Bun;
- instalación local de OpenCode compatible con el modo managed-local-install;
- Linux x64 para el lifecycle completo de Background actualmente soportado.

Background prepara por sí mismo el checkout fuente OpenCode fijado por su
manifest y, cuando falta, instala la versión de Bun fijada en un runtime
user-space propio. Si alguno de los requisitos no bootstrappeables falta, su
preflight corta con un error explícito antes de modificar el target.

Antes de copiar archivos al target, el modo completo clona/actualiza los repos
de addons y ejecuta el preflight base más cualquier `scripts/preflight.sh`
publicado por esos addons. Un fallo de Node/Bun aborta antes de modificar
`~/.config/opencode/`.

El lifecycle completo de Background opera sobre la instalación activa, por lo
que `--complete` debe usar el target estándar `~/.config/opencode`. Un
`--target-dir` alternativo sigue siendo válido para `--main`, pero no para el
takeover administrado de Background.

### 4. Completar secretos opcionales

#### Stitch

Si querés usar Stitch, crear:

```bash
mkdir -p ~/.config/opencode
printf '%s' '<TU_API_KEY_DE_STITCH>' > ~/.config/opencode/stitch-api-key
chmod 600 ~/.config/opencode/stitch-api-key
```

#### Jira helpers (solo si un proyecto los usa)

Los helpers de Jira se instalan con `super-turing-opencode-ticketing`, no con
el modo `--main`. No necesitan configuración global fija, pero los proyectos
que adopten workflow Jira deben tener un `.env` compatible con:

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
bash install.sh --complete --dry-run --skip-addon-update --skip-npm-install --skip-playwright-install --no-validate
```

`--workspace-dir` permite elegir dónde clonar addons; por defecto se usa el
directorio padre del checkout del stack base.

## Mantenimiento normal después de instalar

Una vez bootstrappeada la máquina, **no** hace falta reinstalar todo para cambios comunes.

Usar:

```bash
bash scripts/sync-opencode-stack.sh --status
bash scripts/sync-opencode-stack.sh
```

## Qué NO migra automáticamente

- `~/.cache/ms-playwright/`
- secretos fuera del repo (`stitch-api-key`, `.env` de proyectos, etc.)
- tokens, claves SSH o sesiones de `gh`
- Engram/Qdrant existentes: se migran con su backup/restore y configuración Cloud
- índices `.codegraph/` de cada proyecto, porque son machine-local y regenerables
- `github-accounts-local` y overlays específicos de proyectos


## Problemas frecuentes

### `opencode debug config` expone la Stitch key resuelta

Tratar su salida como sensible.

### El repo fuente está dirty pero el activo no tiene drift

Eso significa que tu `~/.config/opencode/` ya fue sincronizado con el working tree actual, pero todavía no committeaste esos cambios en el repo fuente.

### `delegate_isolated` falla con worktree API unreachable

Usar una sesión server-backed (`opencode serve` + `--attach`) para ese flujo.
