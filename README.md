# opencode-stack

Stack portable y versionable de OpenCode con:

- agentes y subagentes custom,
- planner y validador tecnico reutilizables,
- skills globales,
- skills de debugging, verificacion y review por etapas,
- skill global para SDD/TDD/BDD pragmático y trazabilidad spec -> cambio -> validación,
- cleanup de sesiones y composición con addons opcionales,
- integración con Playwright headless,
- integración opcional con Stitch,
- installer reproducible para desplegar el stack en otra máquina.

## Objetivo

Este repo es el **source of truth** del entorno OpenCode custom. La instalación activa vive en `~/.config/opencode/`, pero se considera un deploy derivado de este repo.

## Layout

- `agents/`: agentes y subagentes custom
- `commands/`: comandos reutilizables de ingeniería y mantenimiento del stack
- `skills/`: skills globales
- `plugins/`: plugins globales base del stack
- `patches/`: reservado para patches versionados sobre dependencias externas cuando el stack base realmente los necesite
- `scripts/`: installers y utilidades de bootstrap
- `README-AGENTS.md`: esquema de agentes efectivo
- `LOCAL-OVERLAY-TEMPLATE.md`: plantilla base para overlays locales aditivos por proyecto
- `PLAYBOOK-CODE-PATTERNS.md`: guía operativa para integrar Semgrep y ast-grep por proyecto
- `PLAYBOOK-LOCAL-OVERLAYS.md`: guía operativa para crear, auditar y mantener capas locales `.opencode/`
- `PLAYBOOK-PERMISSIONS.md`: política central de autoaprobación cotidiana y confirmación destructiva
- `COMPOSITION-MANIFEST.md`: mapa maestro del modelo de composición entre stack base, addons globales, runtime background y overlays locales
- `DEPENDENCY-POLICY.md`: ownership, bootstrap y guardrails para aplicaciones y runtimes externos
- `INSTALLATION.md`: guía concreta de instalación desde `git clone`
- `README-DISTRIBUTION.md`: criterios de distribución y migración
- `STACK-MANIFEST.json`: versión y assets administrados
- `CHANGELOG.md`: cambios relevantes del stack

## Instalación rápida

Guía completa paso a paso: `INSTALLATION.md`

```bash
bash install.sh --main
bash install.sh --complete
```

- `--main`: instala solo el stack base reusable.
- `--complete`: instala el pack portable completo en orden canónico llamando al
  instalador propio de cada addon.
- sin flags, en una terminal interactiva, el script permite elegir el modo.

La instalación completa incluye Knowledge, CodeGraph, Ticketing, Notifier,
Documents y Background. No instala `github-accounts-local` ni overlays
específicos de proyectos.

Ese script:

- instala dependencias npm del stack,
- instala Playwright Chromium user-space si falta,
- copia assets a `~/.config/opencode/`,
- regenera `opencode.json` según capacidades locales,
- valida la config final cuando corresponde,
- e intenta correr `stack-doctor` al final para reportar warnings/errores del entorno.

El entrypoint histórico `scripts/install-opencode-stack.sh` se conserva como
lifecycle exclusivo de la base y como implementación del modo `--main`.

## Capacidades globales nuevas del workflow

- `planner`: planner tecnico/funcional generico para trabajo previo a implementacion
- `dev-test`: validador tecnico reutilizable
- `debugging-sistematico`: skill para depurar con causa raiz antes de fixear
- `verificacion-antes-de-cerrar`: skill para exigir evidencia fresca antes de declarar cierre
- `revision-por-etapas`: skill para review en dos etapas (cumplimiento y luego calidad/riesgo)
- `sdd-tdd-bdd-pragmatico`: skill para incorporar criterios de aceptación, escenarios y pruebas pragmáticas sin volver rígido el workflow
- comandos globales `/sessions-*`; los comandos `/ticket-*` pertenecen al addon Ticketing
- comandos operativos `/stack-doctor`, `/check-local-overlays` y `/init-project-agent-layer`
- helper reusable `scripts/check_local_overlays.sh` + `check_local_overlays.py` para auditar capas locales `.opencode/`
- wrappers globales `scripts/check_code_patterns.sh` y `find_code_pattern.sh` para delegar pattern checks/búsqueda estructural al proyecto cuando exista integración local
- guardrail global para bloquear acceso general a `.env*` (salvo `.env.example`)
- autopilot de permisos para autoaprobar operaciones cotidianas y conservar confirmación en comandos destructivos, credenciales, infraestructura y publicación
- identidad y atribución multiagente para sesiones complejas
- workflow de worktrees por ticket con herramientas globales para crear/listar/borrar worktrees
- scheduler global para jobs recurrentes explícitos con logs, locks y timeout opcional

Jira, los comandos `/ticket-*` y el workflow `tmp/<ticket>/` se instalan desde
`super-turing-opencode-ticketing`; no forman parte del core reusable.

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
- no reinstala Playwright ni addons externos,
- no regenera `opencode.json`,
- este repo también trae un `opencode.json` local con allowlists para sync/install, `opencode debug config` y git de mantenimiento habitual, para evitar prompts innecesarios al trabajar sobre el source-of-truth,
- no instala ni sincroniza addons externos opcionales,
- no debería usarse para secretos ni para migrar memoria.

## Regla de trabajo

No editar `~/.config/opencode/` como fuente principal.
Los cambios del stack deben hacerse en este repo y luego desplegarse con
`sync-opencode-stack.sh`; para bootstrap usar el `install.sh` raíz con `--main`
o `--complete` según el alcance deseado.

Si un proyecto crea una capa local `.opencode/`, el patrón esperado es **overlay aditivo**:

- reutilizar lo global por defecto,
- overridear solo cuando haga falta especializar,
- preservar explicitamente guardrails, permisos seguros y capacidades globales que sigan aplicando,
- dejar el delta de proyecto en `AGENTS.md`, agentes/skills/comandos locales y no en la capa global.

## Comandos operativos nuevos

- `/stack-doctor`: diagnostica instalación, config efectiva, assets globales, MCPs, dependencias base, drift del stack y overlays locales `.opencode/` cuando existan.
- `/check-local-overlays`: ejecuta la auditoría semiestructurada de `.opencode/` contra la base global y devuelve el detalle por override.
- `/check-code-patterns`: ejecuta checks de patrones del proyecto actual si existe integración local.
- `/find-code-pattern`: ejecuta búsquedas estructurales del proyecto actual si existe integración local.
- `/init-project-agent-layer <path>`: inspecciona un proyecto y propone o aplica una capa local de agentes/OpenCode reutilizando lo global, especializando solo lo necesario y sembrando IDs de Context7 cuando el stack detectado lo justifique.
- `CONTEXT7-TECH-CATALOG.md`: catálogo curado de tecnologías -> IDs canónicos de Context7 para inicializar `AGENTS.md` locales con confianza y notas de drift.
- `LOCAL-OVERLAY-TEMPLATE.md`: referencia rápida para construir overrides locales aditivos sin perder guardrails globales.
- `PLAYBOOK-LOCAL-OVERLAYS.md`: playbook completo de uso diario para overlays locales, `/check-local-overlays` y `/stack-doctor`.
- `PLAYBOOK-CODE-PATTERNS.md`: playbook de cuándo y cómo integrar Semgrep/ast-grep sin meter reglas de proyecto en global.

## Addons opcionales fuera del stack base

- `super-turing-opencode-knowledge`: memoria durable Engram y corpus recuperable Qdrant.
- `super-turing-opencode-ticketing`: Jira, Atlassian Rovo read-only, comandos `/ticket-*` y handoffs por ticket.
- `super-turing-opencode-background`: runtime gestionado, patch host/core versionado y UX async/background.
- `super-turing-opencode-codegraph`: runtime/MCP global de inteligencia estructural, wrappers seguros e índices machine-local por repository root.
- `super-turing-opencode-notifier`: notificaciones nativas del SO.
- `super-turing-opencode-documents`: publicación PDF/DOCX/ODT con Quarto/Typst, plantillas y QA visual.
- `super-turing-opencode-github-accounts-local`: política privada machine-local para seleccionar cuentas `gh` y aliases SSH sin versionar credenciales.

El stack base no absorbe el lifecycle de esos addons. El modo `--complete`
orquesta los addons globales portables; los addons machine-local permanecen
privados y fuera de esa instalación.

Para la composición real entre stack base, addons globales, runtime background y overlays locales, ver también `COMPOSITION-MANIFEST.md`.

## Tools globales nuevos

- `worktree_create` / `worktree_list` / `worktree_delete`: flujo global para trabajo paralelo por ticket usando git worktrees con config repo-local `.opencode/worktree.jsonc`, sync configurable y apertura best-effort de terminal nueva.
- `schedule_job` / `list_jobs` / `get_job` / `run_job` / `job_logs` / `delete_job`: automatización recurrente explícita por scope de workdir, con logs, locks, timeout opcional y ejecución no interactiva. Backend inicial: cron supervisado.

## Supuestos actuales

- `opencode` ya está instalado en la máquina destino
- Stitch sigue siendo opcional y requiere `stitch-api-key`

## Flujo recomendado de mantenimiento

1. cambiar este repo,
2. actualizar `STACK-MANIFEST.json` y `CHANGELOG.md` cuando corresponda,
3. revisar drift con `scripts/sync-opencode-stack.sh --status`,
4. sincronizar con `scripts/sync-opencode-stack.sh`,
5. usar `install.sh --main` o `--complete` solo para bootstrap o cambios de base más pesados,
6. validar con `opencode debug config`.

Importante:

- `opencode debug config` puede resolver secretos definidos con `{file:...}` y mostrarlos en claro en la salida efectiva,
- al compartir diagnosticos, resumir hallazgos y redactar valores sensibles en vez de pegar la salida cruda completa.
