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
- `plugins/`: plugins async server/TUI
- `patches/`: patches versionados sobre dependencias externas (por ahora Engram)
- `scripts/`: installers y utilidades de bootstrap
- `README-AGENTS.md`: esquema de agentes efectivo
- `LOCAL-OVERLAY-TEMPLATE.md`: plantilla base para overlays locales aditivos por proyecto
- `PLAYBOOK-CODE-PATTERNS.md`: guía operativa para integrar Semgrep y ast-grep por proyecto
- `PLAYBOOK-LOCAL-OVERLAYS.md`: guía operativa para crear, auditar y mantener capas locales `.opencode/`
- `INSTALLATION.md`: guía concreta de instalación desde `git clone`
- `PLAYBOOK-ASYNC.md`: playbook operativo async
- `README-DISTRIBUTION.md`: criterios de distribución y migración
- `STACK-MANIFEST.json`: versión y assets administrados
- `CHANGELOG.md`: cambios relevantes del stack

## Instalación rápida

Guía completa paso a paso: `INSTALLATION.md`

```bash
bash scripts/install-opencode-stack.sh
```

Ese script:

- instala dependencias npm del stack,
- instala o recompila Engram parcheado si hace falta,
- instala Playwright Chromium user-space si falta,
- copia assets a `~/.config/opencode/`,
- regenera `opencode.json` según capacidades locales,
- valida la config final cuando corresponde,
- e intenta correr `stack-doctor` al final para reportar warnings/errores del entorno.

## Capacidades globales nuevas del workflow

- `planner`: planner tecnico/funcional generico para trabajo previo a implementacion
- `dev-test`: validador tecnico reutilizable
- `workflow-ticket-handoff`: skill para el patron `tmp/<ticket>/verdict.md` -> implementacion -> `result-dev.md`
- `debugging-sistematico`: skill para depurar con causa raiz antes de fixear
- `verificacion-antes-de-cerrar`: skill para exigir evidencia fresca antes de declarar cierre
- `revision-por-etapas`: skill para review en dos etapas (cumplimiento y luego calidad/riesgo)
- comandos globales `/ticket-*` y `/sessions-*`
- comandos operativos `/stack-doctor`, `/check-local-overlays` y `/init-project-agent-layer`
- helper Jira reusable en `scripts/jira_helper.sh` + `jira_api_read.py`
- helper reusable `scripts/check_local_overlays.sh` + `check_local_overlays.py` para auditar capas locales `.opencode/`
- wrappers globales `scripts/check_code_patterns.sh` y `find_code_pattern.sh` para delegar pattern checks/búsqueda estructural al proyecto cuando exista integración local
- delegaciones async con cola, cancelación, progreso incremental y continuación read-only
- background same-session en TUI con `/bg-current`, `/bg-tasks` y el prompt inline vía `promptAsync`, para seguir encolando trabajo sin crear otra sesión
- notificaciones nativas del SO solo cuando OpenCode espera respuesta humana, cuando espera un permiso `Allow/Reject`, o cuando la tarea terminó y ya acepta un nuevo prompt, usando `OpenCode: <sesión>` como título; en Linux/GNOME Terminal el click intenta traer la terminal y, si puede, la pestaña exacta al frente en modo best-effort, y en X11 puede apoyarse opcionalmente en `wmctrl` o `xdotool` si están instalados
- guardrail global para bloquear acceso general a `.env*` (salvo `.env.example`)
- identidad y atribución multiagente para sesiones complejas
- bootstrap de memoria curada con `/memory-init`
- workflow de worktrees por ticket con herramientas globales para crear/listar/borrar worktrees
- scheduler global para jobs recurrentes explícitos con logs, locks y timeout opcional

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
- los backups viejos del stack se podan automáticamente con retención base de 5 snapshots por bucket, preservando cualquier snapshot marcado con `.pin`,
- si el sync detecta **GNOME** en Linux y faltan `wmctrl`/`xdotool`, avisa con una sugerencia de instalación para mejorar el click-to-focus del notifier (especialmente en GNOME/X11),
- no reinstala Engram ni Playwright,
- no regenera `opencode.json`,
- asegura `tui.json` para activar el plugin TUI async global sin pisar otros campos del archivo,
- este repo también trae un `opencode.json` local con allowlists para `sync-opencode-stack.sh`, `install-opencode-stack.sh`, `opencode debug config` y git de mantenimiento habitual, para evitar prompts innecesarios al trabajar sobre el source-of-truth,
- no debería usarse para secretos ni para migrar memoria.

## Regla de trabajo

No editar `~/.config/opencode/` como fuente principal.
Los cambios del stack deben hacerse en este repo y luego desplegarse con `sync-opencode-stack.sh` o, si hace falta bootstrap completo, con `install-opencode-stack.sh`.

Si un proyecto crea una capa local `.opencode/`, el patrón esperado es **overlay aditivo**:

- reutilizar lo global por defecto,
- overridear solo cuando haga falta especializar,
- preservar explicitamente guardrails, permisos seguros y capacidades globales que sigan aplicando,
- dejar el delta de proyecto en `AGENTS.md`, agentes/skills/comandos locales y no en la capa global.

## Comandos operativos nuevos

- `/stack-doctor`: diagnostica instalación, config efectiva, assets globales, MCPs, dependencias base, drift del stack y overlays locales `.opencode/` cuando existan.
- `/memory-init`: siembra memoria Engram útil y durable para el repo actual sin implementar cambios.
- `/check-local-overlays`: ejecuta la auditoría semiestructurada de `.opencode/` contra la base global y devuelve el detalle por override.
- `/check-code-patterns`: ejecuta checks de patrones del proyecto actual si existe integración local.
- `/find-code-pattern`: ejecuta búsquedas estructurales del proyecto actual si existe integración local.
- `/init-project-agent-layer <path>`: inspecciona un proyecto y propone o aplica una capa local de agentes/OpenCode reutilizando lo global, especializando solo lo necesario y sembrando IDs de Context7 cuando el stack detectado lo justifique.
- `CONTEXT7-TECH-CATALOG.md`: catálogo curado de tecnologías -> IDs canónicos de Context7 para inicializar `AGENTS.md` locales con confianza y notas de drift.
- `LOCAL-OVERLAY-TEMPLATE.md`: referencia rápida para construir overrides locales aditivos sin perder guardrails globales.
- `PLAYBOOK-LOCAL-OVERLAYS.md`: playbook completo de uso diario para overlays locales, `/check-local-overlays` y `/stack-doctor`.
- `PLAYBOOK-CODE-PATTERNS.md`: playbook de cuándo y cómo integrar Semgrep/ast-grep sin meter reglas de proyecto en global.

## Tools globales nuevos

- `worktree_create` / `worktree_list` / `worktree_delete`: flujo global para trabajo paralelo por ticket usando git worktrees con config repo-local `.opencode/worktree.jsonc`, sync configurable y apertura best-effort de terminal nueva.
- `schedule_job` / `list_jobs` / `get_job` / `run_job` / `job_logs` / `delete_job`: automatización recurrente explícita por scope de workdir, con logs, locks, timeout opcional y ejecución no interactiva. Backend inicial: cron supervisado.

## Nota sobre `delegate_isolated`

`delegate_isolated` depende de la API de worktrees de OpenCode.

- en sesiones server-backed funciona como se espera,
- en algunos `opencode run` locales directos puede fallar porque `/experimental/worktree` no está expuesto.

Si necesitás ese flujo de forma confiable, usar una sesión con server/attach. Ver `INSTALLATION.md` y `PLAYBOOK-ASYNC.md`.

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

Importante:

- `opencode debug config` puede resolver secretos definidos con `{file:...}` y mostrarlos en claro en la salida efectiva,
- al compartir diagnosticos, resumir hallazgos y redactar valores sensibles en vez de pegar la salida cruda completa.
