# Changelog

Todos los cambios relevantes del stack global de OpenCode deberían registrarse acá.

## [0.8.5] - 2026-05-02

### Added

- `PLAYBOOK-LOCAL-OVERLAYS.md` con la guía operativa completa de cómo usar, auditar y mantener capas locales `.opencode/`

### Changed

- `README.md`, `README-AGENTS.md`, `README-DISTRIBUTION.md`, `INSTALLATION.md` y `LOCAL-OVERLAY-TEMPLATE.md` ahora referencian explícitamente el playbook de overlays
- `STACK-MANIFEST.json` sube a `0.8.5`

### Notes

- con esto queda documentado en un solo lugar qué se agregó al stack, cómo usar `/check-local-overlays`, cómo interpreta `stack-doctor` los overlays y cuál es el flujo recomendado de adopción

## [0.8.4] - 2026-05-02

### Added

- comando global `/check-local-overlays` para ejecutar la auditoría semiestructurada de capas `.opencode/` de forma focalizada

### Changed

- `/stack-doctor` ahora debe usar el helper de overlays como baseline obligatorio cuando detecta `.opencode/`
- `README.md`, `README-AGENTS.md`, `INSTALLATION.md` y `LOCAL-OVERLAY-TEMPLATE.md` incorporan el nuevo flujo operativo
- la versión del stack sube a `0.8.4`

### Notes

- el flujo operativo recomendado queda en dos niveles: `/check-local-overlays` para auditoría focalizada del overlay y `/stack-doctor` para diagnóstico más amplio del entorno y del stack

## [0.8.3] - 2026-05-02

### Added

- helper global `scripts/check_local_overlays.sh` + `check_local_overlays.py` para auditar capas locales `.opencode/` contra la base global

### Changed

- `agent-design` y permisos globales ahora permiten ejecutar el helper de auditoría de overlays
- `/stack-doctor` ahora puede apoyarse explícitamente en el helper para producir la sección `Auditoría de overlays locales`
- la versión del stack sube a `0.8.3`

### Notes

- el helper hace checks semiestructurados (mode, tools, allowlists, task targets, headings/tokens clave) y deja la evaluación final al diagnóstico del agente

## [0.8.2] - 2026-05-02

### Changed

- `/stack-doctor` ahora exige una auditoría más explícita de overlays locales `.opencode/`, incluyendo clasificación `OK`/`warning`/`error` por override relevante
- `README.md` y `README-AGENTS.md` actualizan la descripción operativa de `stack-doctor`
- la versión del stack sube a `0.8.2`

### Notes

- el chequeo de overlays sigue siendo guiado por prompt/documentación, pero ahora el contrato de salida del comando es mucho más explícito y auditable

## [0.8.1] - 2026-05-02

### Added

- `LOCAL-OVERLAY-TEMPLATE.md` como plantilla base reusable para capas locales `.opencode/`

### Changed

- `README-AGENTS.md` institucionaliza el patrón de overlays locales aditivos con checklist y señales de drift
- `README-DISTRIBUTION.md`, `README.md` e `init-project-agent-layer` ahora referencian explícitamente el modelo de especialización local por proyecto
- `STACK-MANIFEST.json` sube a `0.8.1`

### Notes

- el criterio de override local deja de ser solo una recomendación dispersa y pasa a ser una convención documentada y reusable para futuros proyectos

## [0.8.0] - 2026-04-26

### Added

- `INSTALLATION.md` con guía paso a paso desde `git clone`

### Changed

- documentación de async e instalación ahora aclara la limitación conocida de `delegate_isolated` fuera de sesiones server-backed
- `install-opencode-stack.sh` ahora intenta ejecutar `stack-doctor` al final cuando valida la instalación sobre `~/.config/opencode/`
- la versión del stack sube a `0.8.0`

### Notes

- no se implementó fallback local a `git worktree`; por ahora el sistema documenta y reporta explícitamente cuándo la API `/experimental/worktree` no está disponible

## [0.7.0] - 2026-04-26

### Added

- `delegation_cancel(id|all=true)` para cancelar delegaciones pending/running
- `delegation_tail(id)` para leer progreso incremental y mensajes nuevos
- `delegation_continue(id, prompt)` para retomar delegaciones read-only completadas con continuidad de contexto
- cola/concurrencia para delegaciones async con estado `pending`

### Changed

- `delegation_read` ahora puede devolver estado actual sin bloquear y soporta `wait=true`
- `delegation_list` muestra más contexto operativo (modo, duración, último tool, último mensaje)
- documentación async actualizada con los nuevos estados y herramientas

### Notes

- se mantiene nuestro esquema fuerte de worktree aislado + review/apply manual para write-capable
- las mejoras tomadas de oh-my-opencode se enfocan en UX y lifecycle de delegaciones, no en copiar su orquestación completa

## [0.6.0] - 2026-04-26

### Added

- subagente global `merge-conflict-resolver`
- comando global `/stack-doctor`
- comando global `/init-project-agent-layer`

### Changed

- `master-dev` ahora puede delegar a `merge-conflict-resolver`
- documentación actualizada con los nuevos comandos operativos

### Notes

- `/stack-doctor` queda orientado a `agent-design` y hace diagnóstico read-only del stack
- `/init-project-agent-layer` queda orientado a `agent-design` y arranca siempre en modo propuesta antes de escribir archivos

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
