# Changelog

Todos los cambios relevantes del stack global de OpenCode deberían registrarse acá.

## [0.5.0] - 2026-04-24

### Added

- skill global `debugging-sistematico`
- skill global `verificacion-antes-de-cerrar`
- skill global `revision-por-etapas`

### Changed

- `master-dev`, `reviewer`, `dev-test`, `backend-java-developer` y `frontend-web-developer` ahora sugieren estas skills cuando corresponde
- la versión del stack sube a `0.5.0`

### Notes

- se tomaron como inspiración prácticas de Superpowers, pero adaptadas a nuestro estilo y sin crear agentes nuevos ni imponer brainstorming/TDD rígido universal

## [0.4.0] - 2026-04-24

### Added

- agente global `planner` como reemplazo custom del planner base
- subagente global `dev-test` para validación técnica reusable
- skill global `workflow-ticket-handoff`
- comandos globales `/ticket-*` y `/sessions-*`
- helpers globales reutilizables para Jira/tickets y limpieza de sesiones

### Changed

- `master-dev` ahora contempla el patrón `verdict.md` / `result-dev.md` cuando el proyecto lo adopta
- `reviewer` ahora puede usar comandos git read-only acotados
- el stack pasa a ocultar/deshabilitar `plan` en favor de `planner`
- la versión del stack sube a `0.4.0`

### Notes

- el patrón `tmp/<ticket>/...` se promueve como workflow reusable, pero no obligatorio ni global para toda tarea
- Jira sigue siendo opcional y solo se usa cuando el proyecto lo adopta explícitamente

## [0.3.0] - 2026-04-24

### Added

- `scripts/sync-opencode-stack.sh` para sincronización incremental repo -> `~/.config/opencode/`
- backups dedicados `.stack-sync-backups/` para archivos reemplazados por sync

### Changed

- `install-opencode-stack.sh` ahora lee `managedFiles` desde `STACK-MANIFEST.json` para evitar drift
- la guía operativa ahora separa claramente bootstrap completo vs sync diario
- la versión del stack sube a `0.3.0`

### Notes

- el flujo recomendado de mantenimiento pasa a ser: editar repo -> `sync-opencode-stack.sh --status` -> `sync-opencode-stack.sh`

## [0.2.0] - 2026-04-24

### Added

- repo versionable `opencode-stack` como source of truth del entorno custom
- `README.md` de repo con layout y quickstart
- `scripts/install-engram.sh` para clonar Engram desde upstream, aplicar patch local y compilar binario reproducible
- patch versionado `patches/engram-source-agent.patch`
- metadata de componentes en `STACK-MANIFEST.json` con pin de Engram, bootstrap de Go y política Playwright

### Changed

- `scripts/install-opencode-stack.sh` ahora puede bootstrapear Engram además de npm/Playwright/config
- la versión del stack sube a `0.2.0`

### Notes

- el bootstrap automático de Go está pensado inicialmente para Linux x86_64
- la memoria persistida de Engram sigue siendo una migración separada

## [0.1.0] - 2026-04-24

### Added

- documentación del esquema efectivo de agentes con distinción entre agentes base de OpenCode y agentes custom globales
- guía de distribución portable e instalación del stack
- manifest inicial de versionado del stack
- installer inicial para copiar assets portables y renderizar `opencode.json` por máquina destino

### Notes

- esta versión inicial no empaqueta secretos ni estado persistido de Engram
- Playwright sigue configurado en modo headless/no interactivo por defecto
