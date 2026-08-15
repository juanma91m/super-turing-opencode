# Global Agents Reference

Este archivo documenta el **esquema efectivo de agentes** disponible en esta instalación de OpenCode y distingue entre:

- agentes **base** provistos por OpenCode,
- agentes y subagentes **custom globales** instalados en `~/.config/opencode/`.

Distribución portable e instalación: `~/.config/opencode/README-DISTRIBUTION.md`

Playbook de overlays locales: `~/.config/opencode/PLAYBOOK-LOCAL-OVERLAYS.md`

Playbook de pattern checks: `~/.config/opencode/PLAYBOOK-CODE-PATTERNS.md`

## Agentes base de OpenCode presentes en el esquema efectivo

- `plan`: agente primario base de OpenCode. En este stack queda oculto/deshabilitado en favor del agente custom `planner`.
- `build`: agente primario orientado a ejecutar cambios y resolver tareas de implementación general.

## Agentes globales custom

- `planner`: planner tecnico/funcional generico para tickets y analisis previo a implementacion.
- `explorer`: investiga documentacion, APIs, herramientas y MCPs. Prioriza Context7 para docs de librerias/APIs, fetch directo para el resto y usa Playwright solo como segunda opcion.
- `agent-design`: diseña y mantiene agentes, skills, comandos, prompts y permisos para OpenCode.
- `master-dev`: lider tecnico generico para proyectos enterprise; analiza, decide y puede implementar con foco en evidencia, bajo riesgo y mantenibilidad.

## Subagentes custom

- `code-inspector`: inspecciona el flujo actual del codigo, entry points y componentes involucrados sin editar ni ejecutar cambios riesgosos.
- `backend-java-developer`: implementador de backend Java enterprise para servicios, APIs, persistencia, integraciones, cache y concurrencia.
- `dev-test`: crea/ajusta tests y ejecuta validacion tecnica final con evidencia reproducible.
- `frontend-web-developer`: implementador de capa de presentacion web en el stack real del proyecto, incluyendo Vaadin, React, Angular u otros.
- `merge-conflict-resolver`: integra conflictos de merge/rebase preservando la intención funcional de ambas ramas.
- `reviewer`: revisor tecnico centrado en riesgos, regresiones, compatibilidad, performance y validaciones pendientes.
- `code-reviewer`: revisión independiente de desarrollos de terceros por ramas o Pull Request; guarda informes incrementales y evita observaciones cosméticas.
- `ui-web-designer`: diseña interfaces y flujos web con criterio de UX, Material UI, Stitch y Playwright cuando haga falta. No implementa codigo; su foco es diseño y definicion visual.

## Agentes de soporte/base que pueden aparecer en OpenCode

- `general`: subagente base generico/fallback.
- `explore`: subagente base de exploracion read-only.
- `compaction`: agente interno de compactacion de contexto.
- `summary`: agente interno para resumir sesiones.
- `title`: agente interno para generar titulos de sesion.

## Skills globales

- `investigacion-web`: investigacion web con evidencia verificable y heuristica Context7-first para docs de librerias/APIs.
- `diseno-agentes-opencode`: criterios para crear o ajustar agentes, skills, comandos y permisos.
- `diseno-ui-web`: criterios de diseño web claros, accesibles e implementables, con fuerte referencia en Material UI.
- `analisis-tecnico-evidencia`: separa hechos, inferencias, riesgos e informacion faltante.
- `cambio-seguro-enterprise`: prioriza cambios minimos, seguros y auditables en sistemas enterprise o legacy.
- `code-review-branch-to-branch`: criterio común para revisar ramas o Pull Requests con evidencia, severidad y umbral anti-ruido.
- `debugging-sistematico`: obliga a investigar causa raiz antes de proponer fixes.
- `performance-cache-concurrencia`: fuerza revisar costo, cache, transacciones y riesgos de concurrencia.
- `contratos-api-y-datos`: refuerza compatibilidad de contratos e impacto en acceso a datos.
- `implementacion-frontend-web`: baja cambios de UI al stack real del proyecto sin duplicar criterios de diseño.
- `mentoria-tecnica-opencode`: refuerza un estilo de tutoría técnica con conceptos primero, explicación del porqué y desafío explícito de atajos flojos.
- `overlays-locales-opencode`: resume cuándo overridear `.opencode/`, cómo preservar la capa global y cómo auditar drift.
- `stitch-playwright-ui-opencode`: resume el uso operativo de Playwright y Stitch para trabajo de UI con foco en headless, polling y evitar regeneraciones ciegas.
- `sdd-tdd-bdd-pragmatico`: conecta especificación, comportamiento esperado y estrategia de pruebas sin imponer ceremonias rígidas.
- `verificacion-antes-de-cerrar`: evita declarar cierre o éxito sin evidencia fresca.
- `workflow-ticket-handoff`: define el patron reusable `tmp/<ticket>/verdict.md` -> implementacion -> `result-dev.md` para trabajo guiado por tickets.
- `revision-por-etapas`: separa revisión de cumplimiento funcional vs revisión de calidad/riesgo técnico.

## Comandos globales reutilizables

- `/ticket-plan <ticket>`
- `/ticket-refresh <ticket>`
- `/ticket-verdict <ticket>`
- `/ticket-implement <ticket>`
- `/ticket-validate <ticket>`
- `/sessions-list [args]`
- `/sessions-clean [args]`
- `/check-local-overlays`
- `/check-code-patterns [args]`
- `/find-code-pattern [args]`
- `/code-review <rama-origen> <rama-destino>`
- `/code-review-pr <url|numero|rama> [ticket-o-contexto]`
- `/stack-doctor`
- `/init-project-agent-layer <path>`

## Criterios globales resumidos

- Mantener agentes globales genéricos, reutilizables y sin dominio de proyecto; lo específico debe vivir en el `AGENTS.md` local o en overlays del repo.
- Distinguir siempre entre agentes base de OpenCode y agentes custom del stack; `agent-design` debe proteger esa separación.
- Para docs externas de librerías o APIs, Context7 es la fuente preferida cuando esté disponible; IDs canónicos, versiones objetivo o fuentes privadas deben quedar en la capa local del proyecto.
- Si un agente, skill o comando local sombrea uno global, el override debe ser aditivo y reinyectar explícitamente comportamiento, permisos seguros y guardrails útiles; para checklist, drift y `__replace__`, referirse a `overlays-locales-opencode`, `PLAYBOOK-LOCAL-OVERLAYS.md` y `LOCAL-OVERLAY-TEMPLATE.md`.
- El workflow `tmp/<ticket>/verdict.md` -> implementación -> `result-dev.md` es reusable pero opcional: activarlo solo cuando el proyecto adopta ese patrón.
- `master-dev` lidera el trabajo técnico general; `ui-web-designer` define UX, `frontend-web-developer` implementa presentación y `backend-java-developer` cubre backend/datos. Delegar solo cuando la especialización aporte foco real.
- `planner`, `master-dev`, `reviewer` y `agent-design` también pueden actuar como tutores técnicos: explicar conceptos primero, desafiar atajos y hacer explícito el porqué técnico cuando eso ayude al crecimiento del usuario.
- `reviewer` conserva el workflow de verificación post-solución durante desarrollo propio; `code-reviewer` se usa para aprobar implementaciones de terceros y ambos comparten solo criterios técnicos reutilizables.
- Antes de revisar un PR, `code-reviewer` valida repo actual vs URL, consistencia del ticket y snapshot de commits; un cambio posterior del head requiere una nueva revisión incremental.
- SDD/TDD/BDD se aplican como heurística pragmática: usar criterios de aceptación, escenarios y test-first cuando aclaran o reducen riesgo; no forzarlos en microcambios triviales ni en zonas donde el harness vuelva el ritual más caro que útil.
- El stack global incluye guardrails explícitos sobre `.env*` (salvo `.env.example`) para evitar lecturas/ediciones accidentales de secretos.
- El stack global puede exponer `agent_attribution` para atribución multiagente.
- Si el addon externo `super-turing-opencode-background` está instalado, puede exponer tools y UX async adicionales sin volverlo parte del stack base.
- Si `super-turing-opencode-codegraph` está instalado, `code-inspector`, `planner`, `reviewer`, `code-reviewer` y `master-dev` pueden usar `codegraph_explore` para análisis estructural en repos ya indexados; inicialización y reindex siguen wrappers explícitos del addon.
- Para uso operativo de Playwright y Stitch en trabajo de UI, referirse a `stitch-playwright-ui-opencode`.
- Las herramientas de worktree y scheduler deben usarse solo bajo pedido explícito del usuario.
- Playwright MCP queda en modo headless/no interactivo por defecto; si una inspección visual headed/manual realmente conviene, debe pedirse confirmación explícita en foreground.
- Para distribuir este stack a otra máquina, versionar `agents/`, `skills/`, `plugins/`, docs y manifest; no versionar secretos ni estado local (`stitch-api-key`, `node_modules/`, etc.).
- Los backups del stack se podan automáticamente con retención base de 5 snapshots por bucket y soporte de `.pin`.
- Cuando uses `opencode debug config`, no compartas la salida cruda si contiene secretos resueltos; resumila y redactá valores sensibles.
