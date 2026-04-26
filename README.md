# opencode-stack

Stack portable y versionable de OpenCode con:

- agentes y subagentes custom,
- planner y validador tecnico reutilizables,
- skills globales,
- skills de debugging, verificacion y review por etapas,
- plugin async con delegación read-only y worktrees aislados,
- integración con Engram parcheado,
- helpers opcionales para Jira/tickets y cleanup de sesiones,
- integración con Playwright headless,
- integración opcional con Stitch,
- installer reproducible para desplegar el stack en otra máquina.

## Objetivo

Este repo es el **source of truth** del entorno OpenCode custom. La instalación activa vive en `~/.config/opencode/`, pero se considera un deploy derivado de este repo.

## Layout

- `agents/`: agentes y subagentes custom
- `commands/`: comandos reutilizables para tickets y mantenimiento
- `skills/`: skills globales
- `plugins/`: plugin async
- `patches/`: patches versionados sobre dependencias externas (por ahora Engram)
- `scripts/`: installers y utilidades de bootstrap
- `README-AGENTS.md`: esquema de agentes efectivo
- `PLAYBOOK-ASYNC.md`: playbook operativo async
- `README-DISTRIBUTION.md`: criterios de distribución y migración
- `STACK-MANIFEST.json`: versión y assets administrados
- `CHANGELOG.md`: cambios relevantes del stack

## Instalación rápida

```bash
bash scripts/install-opencode-stack.sh
```

Ese script:

- instala dependencias npm del stack,
- instala o recompila Engram parcheado si hace falta,
- instala Playwright Chromium user-space si falta,
- copia assets a `~/.config/opencode/`,
- regenera `opencode.json` según capacidades locales,
- valida la config final cuando corresponde.

## Capacidades globales nuevas del workflow

- `planner`: planner tecnico/funcional generico para trabajo previo a implementacion
- `dev-test`: validador tecnico reutilizable
- `workflow-ticket-handoff`: skill para el patron `tmp/<ticket>/verdict.md` -> implementacion -> `result-dev.md`
- `debugging-sistematico`: skill para depurar con causa raiz antes de fixear
- `verificacion-antes-de-cerrar`: skill para exigir evidencia fresca antes de declarar cierre
- `revision-por-etapas`: skill para review en dos etapas (cumplimiento y luego calidad/riesgo)
- comandos globales `/ticket-*` y `/sessions-*`
- helper Jira reusable en `scripts/jira_helper.sh` + `jira_api_read.py`

## Sync diario recomendado

Una vez que la máquina ya quedó bootstrappeada, el flujo normal no debería ser reinstalar todo sino:

1. editar este repo,
2. inspeccionar drift con:

```bash
bash scripts/sync-opencode-stack.sh --status
```

3. sincronizar solo archivos versionados que cambiaron:

```bash
bash scripts/sync-opencode-stack.sh
```

Notas:

- el sync compara repo vs target y copia **solo** archivos gestionados que difieren,
- los archivos modificados en destino se respaldan en `.stack-sync-backups/`,
- no reinstala Engram ni Playwright,
- no regenera `opencode.json`,
- no debería usarse para secretos ni para migrar memoria.

## Regla de trabajo

No editar `~/.config/opencode/` como fuente principal.
Los cambios del stack deben hacerse en este repo y luego desplegarse con `sync-opencode-stack.sh` o, si hace falta bootstrap completo, con `install-opencode-stack.sh`.

## Supuestos actuales

- `opencode` ya está instalado en la máquina destino
- el bootstrap automático de Go está pensado inicialmente para Linux x86_64
- Stitch sigue siendo opcional y requiere `stitch-api-key`
- la memoria persistida de Engram (`~/.engram/engram.db`) se migra aparte

## Flujo recomendado de mantenimiento

1. cambiar este repo,
2. actualizar `STACK-MANIFEST.json` y `CHANGELOG.md` cuando corresponda,
3. revisar drift con `scripts/sync-opencode-stack.sh --status`,
4. sincronizar con `scripts/sync-opencode-stack.sh`,
5. usar `scripts/install-opencode-stack.sh` solo para bootstrap o cambios de base más pesados,
6. validar con `opencode debug config`.
