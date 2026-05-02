# Global Agents Reference

Este archivo documenta el **esquema efectivo de agentes** disponible en esta instalación de OpenCode y distingue entre:

- agentes **base** provistos por OpenCode,
- agentes y subagentes **custom globales** instalados en `~/.config/opencode/`.

Playbook operativo async: `~/.config/opencode/PLAYBOOK-ASYNC.md`

Distribución portable e instalación: `~/.config/opencode/README-DISTRIBUTION.md`

Playbook de overlays locales: `~/.config/opencode/PLAYBOOK-LOCAL-OVERLAYS.md`

Playbook de pattern checks: `~/.config/opencode/PLAYBOOK-CODE-PATTERNS.md`

## Agentes base de OpenCode presentes en el esquema efectivo

- `plan`: agente primario base de OpenCode. En este stack queda oculto/deshabilitado en favor del agente custom `planner`.
- `build`: agente primario orientado a ejecutar cambios y resolver tareas de implementación general.

## Agentes globales custom

- `planner`: planner tecnico/funcional generico para tickets y analisis previo a implementacion.
- `explorer`: investiga documentacion, APIs, herramientas y MCPs. Prioriza fetch directo y usa Playwright solo como segunda opcion.
- `agent-design`: diseña y mantiene agentes, skills, comandos, prompts y permisos para OpenCode.
- `master-dev`: lider tecnico generico para proyectos enterprise; analiza, decide y puede implementar con foco en evidencia, bajo riesgo y mantenibilidad.

## Subagentes custom

- `code-inspector`: inspecciona el flujo actual del codigo, entry points y componentes involucrados sin editar ni ejecutar cambios riesgosos.
- `backend-java-developer`: implementador de backend Java enterprise para servicios, APIs, persistencia, integraciones, cache y concurrencia.
- `dev-test`: crea/ajusta tests y ejecuta validacion tecnica final con evidencia reproducible.
- `frontend-web-developer`: implementador de capa de presentacion web en el stack real del proyecto, incluyendo Vaadin, React, Angular u otros.
- `merge-conflict-resolver`: integra conflictos de merge/rebase preservando la intención funcional de ambas ramas.
- `reviewer`: revisor tecnico centrado en riesgos, regresiones, compatibilidad, performance y validaciones pendientes.
- `ui-web-designer`: diseña interfaces y flujos web con criterio de UX, Material UI, Stitch y Playwright cuando haga falta. No implementa codigo; su foco es diseño y definicion visual.

## Agentes de soporte/base que pueden aparecer en OpenCode

- `general`: subagente base generico/fallback.
- `explore`: subagente base de exploracion read-only.
- `compaction`: agente interno de compactacion de contexto.
- `summary`: agente interno para resumir sesiones.
- `title`: agente interno para generar titulos de sesion.

## Skills globales

- `investigacion-web`: investigacion web con evidencia verificable y fetch-first.
- `diseno-agentes-opencode`: criterios para crear o ajustar agentes, skills, comandos y permisos.
- `diseno-ui-web`: criterios de diseño web claros, accesibles e implementables, con fuerte referencia en Material UI.
- `analisis-tecnico-evidencia`: separa hechos, inferencias, riesgos e informacion faltante.
- `cambio-seguro-enterprise`: prioriza cambios minimos, seguros y auditables en sistemas enterprise o legacy.
- `debugging-sistematico`: obliga a investigar causa raiz antes de proponer fixes.
- `performance-cache-concurrencia`: fuerza revisar costo, cache, transacciones y riesgos de concurrencia.
- `contratos-api-y-datos`: refuerza compatibilidad de contratos e impacto en acceso a datos.
- `implementacion-frontend-web`: baja cambios de UI al stack real del proyecto sin duplicar criterios de diseño.
- `memoria-engram-opencode`: define uso de Engram con memoria curada, buckets, source_agent, promocion y purga segura.
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
- `/stack-doctor`
- `/init-project-agent-layer <path>`

## Criterios

- Mantener agentes genericos, sin referencias a dominios o proyectos concretos.
- Usar agentes globales para capacidades transversales reutilizables.
- Dejar lo especifico de cada proyecto en sus prompts, docs y configuraciones locales.
- Si un agente, skill o comando local sombrea uno global por nombre, el override debe preservar explicitamente el comportamiento global y sus permisos seguros salvo decision contraria del usuario; no asumir herencia automatica del runtime.
- Al describir el esquema total de agentes, incluir siempre la distincion entre agentes base de OpenCode y agentes custom globales; `plan` y `build` son agentes base aunque `plan` quede deshabilitado en este stack en favor de `planner`.
- `agent-design` debe proteger esa separacion y evitar que definiciones globales absorban detalles propios de un proyecto puntual.
- Evitar permisos globales que whitelisteen helpers repo-locales por patron amplio; si un wrapper o script solo tiene sentido en un proyecto, su permiso debe vivir en la capa local de ese proyecto.
- El workflow `tmp/<ticket>/verdict.md` / `result-dev.md` es reusable pero no obligatorio: debe activarse solo cuando el trabajo esta asociado a tickets y el proyecto adopta ese patron.
- Para operaciones largas de Stitch, favorecer polling y continuidad desde el estado del proyecto antes que repetir generaciones a ciegas.
- `master-dev` lidera el trabajo tecnico general; delega solo cuando la especializacion aporta foco real.
- `code-inspector`, `reviewer`, `explorer` y `ui-web-designer` son buenos candidatos para delegacion async read-only en la fase 1.
- `ui-web-designer` define UX y estructura visual; `frontend-web-developer` implementa la capa de presentacion en el stack concreto.
- `backend-java-developer` cubre backend, integraciones y datos; no debe absorber ownership de la capa de presentacion.
- La especificidad por proyecto debe vivir en el `AGENTS.md` del repo: stack real, frontend principal, build, tests, base de datos, integraciones, entry points y restricciones locales.
- Si Engram esta habilitado, la memoria debe mantenerse curada: primero bucket correcto, luego `source_agent`, uso de `topic_key`, promocion selectiva a buckets `mem-tech-*` o globales, y soft-delete de memorias obsoletas por defecto.
- Si Engram esta habilitado, la lectura debe seguir el patron `mem_context`/`mem_search` -> `mem_get_observation` para evitar razonar sobre previews truncados.
- `master-dev` actua como lector principal de memoria por defecto; los subagentes leen por su cuenta solo cuando la especialidad o el historial previo realmente lo ameritan.
- En async v1, toda delegacion debe llevar un paquete de contexto explicito: objetivo, motivo, alcance, hechos relevantes, rutas exactas, referencias de memoria si aplican y formato de salida esperado.
- `delegate` es async read-only y tiene matriz de permisos: `master-dev` puede delegar a especialistas/read-only; `frontend-web-developer` y `backend-java-developer` solo a `explorer` o `code-inspector`; `ui-web-designer` a `explorer`; `reviewer` a `code-inspector`.
- `delegate` ahora puede pasar por estado `pending` si no hay cupo de concurrencia; usar `delegation_tail` para progreso incremental y `delegation_cancel` si hace falta abortar.
- La delegacion nested read-only permite como maximo un nivel secundario: un subagente puede pedir investigacion/inspeccion, pero el agente delegado no puede seguir delegando.
- `delegate_isolated` es la Fase 2 inicial para trabajo write-capable async: solo `master-dev` puede lanzarlo, solo contra `backend-java-developer`, `frontend-web-developer` o `master-dev`, y siempre usa un worktree aislado sin auto-merge.
- `delegate_isolated` requiere disponibilidad de la API `/experimental/worktree`; en `opencode run` local directo puede no estar expuesta, por lo que conviene usar una sesión server-backed para ese flujo.
- `delegation_continue(id, prompt)` permite retomar una delegacion read-only completada en la misma sesion de subagente para follow-ups con continuidad de contexto.
- Toda salida de `delegate_isolated` queda para revision manual con artifacts persistidos: `meta.json`, `result.md`, `changed-files.json`, `git-status.txt`, `diff.patch` y `worktree.json`.
- Lifecycle inicial de delegacion aislada: `running` -> `review_pending` -> `accepted` -> `applied`, o `running/review_pending/accepted` -> `discarded`; en `error` o `timeout` se intenta cleanup automatico del worktree y se preservan artifacts.
- `delegation_accept(id)` marca una delegacion aislada como revisada/aceptada y conserva el worktree para integracion manual posterior.
- `delegation_apply(id)` aplica el `diff.patch` persistido sobre el workspace principal solo si la delegacion ya fue aceptada y el workspace principal esta limpio; no hace commit y luego intenta limpiar el worktree aislado.
- `delegation_discard(id)` elimina el worktree aislado y deja los artifacts para auditoria; ambos comandos quedan restringidos a `master-dev`.
- En la sesion hija de `delegate_isolated`, `bash` queda deshabilitado por defecto para evitar bloqueos por permisos `ask` en background; por ahora la validacion shell queda para revision manual o para una futura variante explicita con permisos controlados.
- Playwright MCP queda configurado en modo headless/no interactivo por defecto. Si alguna vez una inspeccion visual headed/manual realmente conviene, debe pedirse confirmacion explicita al usuario en un flujo foreground y no desde delegaciones async.
- Para distribuir este stack a otra maquina, tratar `agents/`, `skills/`, `plugins/`, docs y manifest como assets versionables; no versionar secretos ni estado local como `stitch-api-key`, `node_modules/` o la base de datos de Engram.
- Cuando uses `opencode debug config` para validar o diagnosticar, no compartas la salida cruda si contiene secretos ya resueltos; resumila y redacta valores sensibles.
- Si un repo tiene `.opencode/`, `stack-doctor` debe auditar explícitamente esos overrides por nombre y reportarlos con estado `OK`/`warning`/`error` usando el patrón institucional de overlays locales.

## Patrón institucional para overlays locales

Cuando un repo crea `.opencode/` y sombrea una definicion global por nombre, el patrón institucional esperado es:

1. **Override solo si hace falta**
   - si alcanza con `AGENTS.md` o documentacion local, no crear archivo override,
   - si hace falta especializar un agente/skill/comando existente, mantener el mismo nombre base.
2. **Overlay aditivo, no reemplazo destructivo**
   - preservar responsabilidad global, guardrails y formato de salida,
   - agregar stack, dominio, entry points, riesgos y reglas locales del proyecto,
   - no recortar comportamiento global salvo pedido expreso del usuario o necesidad tecnica justificada.
3. **Checklist minimo por override**
   - `mode` correcto,
   - `tools:` preservados si el global los define,
   - permisos seguros heredados explicitamente cuando sigan aplicando,
   - responsabilidades y limites globales reinyectados si OpenCode no los hereda,
   - skills globales utiles mantenidas junto a skills locales especializadas.
4. **Recortes explicitados**
   - si un override reduce permisos, tools o comportamiento global, documentar el motivo en el `AGENTS.md` local o en la propuesta de cambio.
5. **Permisos repo-locales solo en local**
   - wrappers, helpers o scripts de `.opencode/scripts/` deben habilitarse en la capa local del repo que los introduce,
   - no promover esos permisos a la capa global generica.

Señales de drift a vigilar:

- un override local pierde allowlists seguras que existian globalmente,
- desaparecen skills globales relevantes sin una razon clara,
- se borran guardrails globales de memoria, async, validacion o handoff,
- un comando local cambia contrato o precondiciones sin documentarlo,
- la especializacion local se vuelve un prompt completamente distinto en vez de un refinamiento del rol global.
