# Distribución portable del stack OpenCode

Esta guía define cómo **paquetizar, versionar e instalar** este stack global de OpenCode en otra máquina con el menor trabajo manual posible.

## Objetivo

Tener un bundle reproducible que instale:

- agentes y subagentes custom,
- skills globales,
- plugin async,
- documentación operativa,
- integración MCP con Engram, Stitch y Playwright,
- política headless para Playwright,
- sin copiar secretos ni estado local innecesario.

## Qué se versiona

Estos archivos/directorios deben tratarse como **source of truth versionable**:

- `agents/`
- `skills/`
- `plugins/`
- `README-AGENTS.md`
- `PLAYBOOK-ASYNC.md`
- `README-DISTRIBUTION.md`
- `CHANGELOG.md`
- `README.md`
- `STACK-MANIFEST.json`
- `package.json`
- `package-lock.json`
- `patches/engram-source-agent.patch`
- `scripts/install-engram.sh`
- `scripts/install-opencode-stack.sh`
- `scripts/sync-opencode-stack.sh`

## Qué NO se versiona

Estos elementos son **machine-local** o sensibles:

- `stitch-api-key`
- `node_modules/`
- `opencode.json` generado para una máquina específica
- backups temporales como `.stack-backups/`
- browser cache de Playwright en `~/.cache/ms-playwright/`
- binario local de Engram en `~/.opencode/bin/engram`
- base de datos local de Engram en `~/.engram/engram.db`

## Modelo recomendado

La idea es tratar este directorio como un repo/versionable de stack:

1. versionás assets portables,
2. corrés un installer simple,
3. el installer copia assets y **renderiza** `opencode.json` para la máquina destino,
4. los secretos y rutas locales quedan fuera del bundle.

## Versionado recomendado

- usar `STACK-MANIFEST.json` como versión del stack,
- usar semver simple: `0.x` mientras el esquema siga evolucionando,
- registrar cambios relevantes en `CHANGELOG.md`,
- cuando el stack esté razonablemente estable, crear tags tipo `v0.1.0`, `v0.2.0`, etc.

## Instalación rápida

### Prerrequisitos mínimos

- `opencode` instalado
- `node`, `npm` y `npx`
- opcional: binario Engram ya compilado en `~/.opencode/bin/engram`
- opcional: `stitch-api-key` en `~/.config/opencode/stitch-api-key`
- para instalación automática de Engram: `git`, `python3`, `curl` y `tar`

### Paso 1

Clonar, copiar o sincronizar este stack en cualquier directorio fuente.

### Paso 2

Ejecutar:

```bash
bash scripts/install-opencode-stack.sh
```

Opciones útiles:

```bash
bash scripts/install-opencode-stack.sh --target-dir "$HOME/.config/opencode"
bash scripts/install-opencode-stack.sh --dry-run
bash scripts/install-opencode-stack.sh --skip-playwright-install
bash scripts/install-opencode-stack.sh --skip-npm-install
```

### Paso 3

Si hace falta, copiar manualmente:

- `~/.config/opencode/stitch-api-key`
- `~/.opencode/bin/engram`

### Paso 4

Validar:

```bash
opencode debug config
```

## Sync incremental recomendado

Después del bootstrap inicial, el flujo recomendado es:

```bash
bash scripts/sync-opencode-stack.sh --status
bash scripts/sync-opencode-stack.sh
```

Esto:

- detecta diferencias entre el repo y `~/.config/opencode/`,
- sincroniza solo archivos gestionados que cambiaron,
- hace backup de los archivos reemplazados,
- evita reinstalar dependencias pesadas innecesariamente.

## Qué hace el installer

- copia los assets versionados al target,
- hace backup de archivos reemplazados en `.stack-backups/`,
- instala dependencias npm del plugin si corresponde,
- instala o recompila Engram parcheado desde upstream + patch versionado,
- si falta Go, intenta instalar una copia local en `~/.local/opt/go` (soporte automático inicial para Linux x86_64),
- detecta Playwright Chromium en user-space,
- si no lo encuentra, intenta instalarlo con `npx playwright install chromium`,
- genera `opencode.json` con rutas locales de la máquina,
- habilita o deshabilita MCPs según disponibilidad local:
  - Engram: habilitado si existe `~/.opencode/bin/engram` después del bootstrap
  - Stitch: habilitado si existe `stitch-api-key`
  - Playwright: habilitado si se pudo detectar/instalar Chromium

## Cuándo usar install vs sync

- `install-opencode-stack.sh`: bootstrap completo, máquina nueva, cambios de base, reinstalación de Engram, o setup inicial de Playwright.
- `sync-opencode-stack.sh`: cambios normales del día a día en agentes, skills, plugins, scripts o documentación versionada.

## Migración de memoria Engram

Importante: **instalar el stack no equivale a migrar la memoria persistida**.

Si querés llevarte también la memoria histórica, además del stack deberías migrar:

- `~/.engram/engram.db`

Eso conviene tratarlo como una migración separada, porque es estado persistido y no configuración portable.

## Siguiente nivel recomendado

Cuando este scaffold ya esté cómodo:

1. moverlo a un repo dedicado,
2. automatizar release/tag,
3. agregar script de doctor/check,
4. separar templates de config si el stack sigue creciendo,
5. eventualmente ofrecer un install remoto tipo `curl | bash` solo si el repositorio ya está estable y auditado.
