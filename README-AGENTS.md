# Global Agents Reference

Este archivo documenta el **esquema efectivo de agentes** disponible en esta instalación de OpenCode y distingue entre:

- agentes **base** provistos por OpenCode,
- agentes y subagentes **custom globales** instalados en `~/.config/opencode/`.

Distribución portable e instalación: `~/.config/opencode/README-DISTRIBUTION.md`

Playbook de overlays locales: `~/.config/opencode/PLAYBOOK-LOCAL-OVERLAYS.md`

Playbook de pattern checks: `~/.config/opencode/PLAYBOOK-CODE-PATTERNS.md`

## Instrucciones globales y separación de runtimes

`AGENTS.md` es la guía común del Core y se distribuye mediante
`STACK-MANIFEST.json` a `~/.config/opencode/AGENTS.md`. Complementa al agente
seleccionado y a las instrucciones locales; no reemplaza sus roles ni permisos.
`README-AGENTS.md` es documentación, no el archivo global de instrucciones.

En el runtime 1.19.4 verificado, OpenCode busca primero ese `AGENTS.md` global y,
si falta y la compatibilidad está habilitada, usa `~/.claude/CLAUDE.md`. Distribuir
la guía propia evita ese fallback, sin desactivar el descubrimiento de skills
externas ni modificar Claude. La guía Claude se mantiene por separado en
`super-turing-claude-code/base/CLAUDE.md`: se alinean principios, no herramientas,
roles o permisos por copia literal.

Tras cambiar las guías, reiniciar los clientes para comprobarlas en sesiones
nuevas. `opencode debug config` valida configuración, pero no prueba por sí solo
el conjunto completo de instrucciones recibido por el modelo.

## Agentes base de OpenCode presentes en el esquema efectivo

- `plan`: agente primario base de OpenCode. En este stack queda oculto/deshabilitado en favor del agente custom `planner`.
- `build`: agente primario base orientado a implementación general; queda oculto de la selección manual, pero disponible para compatibilidad y flujos internos.

## Agentes globales custom

- `planner`: planner tecnico/funcional generico para tickets y analisis previo a implementacion.
- `agent-design`: diseña y mantiene agentes, skills, comandos, prompts y permisos para OpenCode; usa `variant: high` por defecto, también en proyectos sin override local del rol.
- `master-dev`: agente global por defecto y líder técnico genérico para proyectos enterprise; analiza, decide y puede implementar con foco en evidencia, bajo riesgo y mantenibilidad.

Los cambios de defaults requieren reiniciar OpenCode. Una sesión reabierta puede restaurar el modelo y la variante de su último mensaje; las selecciones manuales también tienen precedencia. Si conserva una selección anterior, elegir el modelo y la variante deseados desde el TUI, sin editar la base de sesiones.

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
- `mentoria-tecnica-opencode`: refuerza un estilo de tutoría técnica con conceptos primero, explicación del porqué y desafío explícito de atajos flojos.
- `overlays-locales-opencode`: resume cuándo overridear `.opencode/`, cómo preservar la capa global y cómo auditar drift.
- `stitch-playwright-ui-opencode`: resume el uso operativo de Playwright y Stitch para trabajo de UI, incluida la selección dinámica entre navegador headless y visible.
- `sdd-tdd-bdd-pragmatico`: conecta especificación, comportamiento esperado y estrategia de pruebas sin imponer ceremonias rígidas.
- `verificacion-antes-de-cerrar`: evita declarar cierre o éxito sin evidencia fresca.
- `workflow-ticket-handoff` puede estar disponible cuando se instala el addon Ticketing; no pertenece al core.
- `revision-por-etapas`: separa revisión de cumplimiento funcional vs revisión de calidad/riesgo técnico.

## Comandos globales reutilizables del core

- `/sessions-list [args]`
- `/sessions-clean [args]`
- `/check-local-overlays`
- `/check-code-patterns [args]`
- `/find-code-pattern [args]`
- `/code-review <rama-origen> <rama-destino>`
- `/code-review-pr <url|numero|rama> [ticket-o-contexto]`
- `/stack-doctor`
- `/init-project-agent-layer <path>`

Cuando se instala `super-turing-opencode-ticketing`, el addon agrega los
comandos `/ticket-*` y el workflow de handoff asociado.

## Criterios globales resumidos

- Mantener agentes globales genéricos, reutilizables y sin dominio de proyecto; lo específico debe vivir en el `AGENTS.md` local o en overlays del repo.
- Distinguir siempre entre agentes base de OpenCode y agentes custom del stack; `agent-design` debe proteger esa separación.
- Para docs externas de librerías o APIs, Context7 es la fuente preferida cuando esté disponible; IDs canónicos, versiones objetivo o fuentes privadas deben quedar en la capa local del proyecto.
- Si un agente, skill o comando local sombrea uno global, el override debe ser aditivo y reinyectar explícitamente comportamiento, permisos seguros y guardrails útiles; para checklist, drift y `__replace__`, referirse a `overlays-locales-opencode`, `PLAYBOOK-LOCAL-OVERLAYS.md` y `LOCAL-OVERLAY-TEMPLATE.md`.
- Si está instalado Ticketing, el workflow `tmp/<ticket>/verdict.md` -> implementación -> `result-dev.md` sigue siendo reusable pero opcional: activarlo solo cuando el proyecto adopta ese patrón.
- `master-dev` lidera el trabajo técnico general; `ui-web-designer` define UX, `frontend-web-developer` implementa presentación y `backend-java-developer` cubre backend/datos. Delegar solo cuando la especialización aporte foco real.
- `planner`, `master-dev`, `reviewer` y `agent-design` también pueden actuar como tutores técnicos: explicar conceptos primero, desafiar atajos y hacer explícito el porqué técnico cuando eso ayude al crecimiento del usuario.
- `reviewer` conserva el workflow de verificación post-solución durante desarrollo propio; `code-reviewer` se usa para aprobar implementaciones de terceros y ambos comparten solo criterios técnicos reutilizables.
- Antes de revisar un PR, `code-reviewer` valida repo actual vs URL, consistencia del ticket y snapshot de commits; un cambio posterior del head requiere una nueva revisión incremental.
- Toda revisión de PR lee comentarios y reviews antes del veredicto. En rereviews, las justificaciones del autor se vuelven a contrastar con el head, los contratos y los hallazgos previos: se aceptan solo con evidencia suficiente y, si no satisfacen, el informe explica por qué el riesgo continúa.
- SDD/TDD/BDD se aplican como heurística pragmática: usar criterios de aceptación, escenarios y test-first cuando aclaran o reducen riesgo; no forzarlos en microcambios triviales ni en zonas donde el harness vuelva el ritual más caro que útil.
- El stack global incluye guardrails explícitos sobre `.env*` (salvo `.env.example`) para evitar lecturas/ediciones accidentales de secretos.
- `permission-autopilot` autoaprueba prompts de bajo riesgo, pero conserva confirmación para `sudo`, borrados, Git destructivo/force, infraestructura, bases de datos, publicación y referencias sensibles. Los `deny` de agentes read-only no se modifican.
- El stack global puede exponer `agent_attribution` para atribución multiagente.
- Si el addon externo `super-turing-opencode-background` está instalado, puede exponer tools y UX async adicionales sin volverlo parte del stack base.
- Si `super-turing-opencode-codegraph` está instalado, `code-inspector`, `planner`, `reviewer`, `code-reviewer` y `master-dev` pueden usar `codegraph_explore` para análisis estructural en repos ya indexados; inicialización y reindex siguen wrappers explícitos del addon.
- Para uso operativo de Playwright y Stitch en trabajo de UI, referirse a `stitch-playwright-ui-opencode`.
- Stitch pertenece operativamente a `ui-web-designer`; otros agentes deben derivar allí el trabajo de generación o variación visual.
- Playwright se expone solo a roles que planifican, implementan, diseñan o validan superficies web; los overlays pueden especializar ese acceso según el stack real.
- Playwright se expone como un único MCP `playwright_*`; `playwright_browser_set_mode` selecciona `headless` o `visible` antes de cada workflow. Cambiar el modo reinicia el único browser activo y pierde su sesión aislada, por lo que no se deben superponer workflows foreground/background.
- Para distribuir este stack a otra máquina, versionar `agents/`, `skills/`, `plugins/`, docs y manifest; no versionar secretos ni estado local (`stitch-api-key`, `node_modules/`, etc.).
- Los backups del stack se podan automáticamente con retención base de 5 snapshots por bucket y soporte de `.pin`.
- Cuando uses `opencode debug config`, no compartas la salida cruda si contiene secretos resueltos; resumila y redactá valores sensibles.
