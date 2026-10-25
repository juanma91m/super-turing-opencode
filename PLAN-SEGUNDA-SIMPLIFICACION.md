# Plan de segunda simplificación del stack OpenCode

Fecha de apertura: 2026-10-25.

Estado: plan registrado; pendiente de pulir y aprobar el punto 1.

## Objetivo

Reducir contexto residente, redundancia, llamadas innecesarias y mantenimiento,
preservando capacidades útiles, seguridad y calidad. No perseguir una reducción
cosmética de archivos ni reemplazar el stack por un agente gigante.

Este documento es el registro canónico de la iniciativa. Vive en el repo del
Core, pero no transfiere al Core el ownership de addons ni overlays. No se agrega
al manifest de instalación ni se carga como instrucciones de los agentes.

## Forma de trabajo acordada

Se trabaja de a un punto, en el orden numerado:

1. **Pulir:** revisar el estado real y especificar alcance, comportamiento que
   desaparece, responsabilidad que lo reemplaza, archivos, riesgos y pruebas.
2. **Aprobar:** el usuario autoriza explícitamente esa especificación y su alcance
   de despliegue. Aprobar este plan no autoriza implementar sus diez puntos.
3. **Ejecutar:** realizar únicamente el cambio aprobado en su fuente canónica;
   desplegar solo si también fue autorizado y mediante el flujo del dueño.
4. **Validar:** revisar diff, capacidades, permisos, paridad y configuración
   efectiva cuando corresponda; registrar resultados y limitaciones.
5. **Cerrar el punto:** anotar el resultado y el rollback disponible. Recién
   entonces pasar a pulir el siguiente, sin ejecutarlo automáticamente.

Un cambio material de alcance vuelve a aprobación. Un punto puede quedar
descartado o diferido: no hay obligación de implementar las diez propuestas.
Los experimentos requieren aprobar su diseño antes de ejecutarse; extender o
generalizar sus resultados requiere una decisión posterior.

### Estados

`pendiente` → `en especificación` → `pendiente de aprobación` → `aprobado` →
`en ejecución` → `en validación` → `cerrado`.

Alternativas: `bloqueado`, `diferido` o `descartado`, con motivo registrado.

## Límites transversales

- No modificar aplicaciones, índices, cambios locales ni worktrees de producto.
  Los repos producto son referencia de lectura; las pruebas se aíslan fuera de
  ellos. Una eventual autorización de despliegue local debe ser específica.
- No modificar el stack Claude Code. Los manifests de algunos overlays incluyen
  `CLAUDE.md` y `.claude/skills/`: no ejecutar un sync amplio que los alcance.
- No hacer commits ni pushes sin pedido explícito. No instalar ni sincronizar
  componentes por el solo hecho de estar mencionados en este plan.
- Preservar cambios preexistentes. El rollback debe deshacer solo el patch de
  esta iniciativa, nunca resetear un repo sucio al último commit.
- La instalación activa no es una fuente paralela: editar primero el dueño
  canónico y verificar el camino de composición/despliegue.
- Conservar por defecto `master-dev`, `planner`, `agent-design`, `code-reviewer`
  y `documenter`; cuestionarlos requiere explicar el tradeoff y pedir aprobación.
- Mantener overlays aditivos, guardas de secretos, mínimos permisos,
  confirmaciones riesgosas y validación de cambios.
- No crear agentes, skills ni addons para gestionar esta iniciativa.
- No declarar preservada una capacidad porque el modelo podría deducirla:
  identificar su contrato explícito, herramienta o control técnico restante.

## Fuentes y ownership

| Abreviatura | Ubicación canónica |
|---|---|
| Core | `~/.local/src/opencode-stack/` |
| Addon X | `~/.local/src/super-turing-opencode-X/` |
| Overlay X | `~/TRABAJO/AUNE/higyrus-workspace/super-turing-opencode-X/` |
| Instalación activa | `~/.config/opencode/`, salida compuesta, no fuente independiente |

La auditoría contrastó manifests, markers e instaladores. La paridad inicial fue
muestreada, no integral. Hay modificaciones preexistentes en Core, addons y
overlays; deben volver a inspeccionarse antes de intervenir cada punto.

## Evidencia inicial y límites

### Hechos observados

- Runtime gestionado identificado: OpenCode 1.19.4.
- Falta `~/.config/opencode/AGENTS.md`; el loader usa como fallback global
  `~/.claude/CLAUDE.md`, de 17.376 bytes.
- Instalación relevada: 22 archivos de agentes, 39 `SKILL.md` y 34 comandos.
  Sus cuerpos no se cargan todos al inicio: distinguir prompt seleccionado,
  instrucciones, esquemas, catálogos y contenido on-demand.
- Consulta SQLite read-only del 5 al 24 de octubre: 360 sesiones con tools,
  35.830 llamadas, 1.418 cargas de skills y ninguna respuesta de `gpt-6.1-sol`.
- `analisis-tecnico-evidencia`: 161 cargas y 162.610 bytes de salida.
- `knowledge-reader`: 88 delegaciones entre `task` y `delegate`.
- `mem_session_summary`: 1.125 llamadas, 136 completadas y 989 con error;
  985 errores mencionan `session_id`. El estado actual ya contiene un plugin y
  un fix relacionados: no asumir que el defecto histórico sigue vigente.
- CodeGraph: 1.233 llamadas y aproximadamente 23,77 MB de salida en esa ventana.
- Existen contradicciones entre la publicidad MCP de Engram y su allowlist,
  referencias a skills ausentes o no cargables y condiciones inconsistentes
  del workflow de tickets en Higyrus.

### Antecedente

Engram #1987 registra una reducción observacional de contexto inicial tras la
primera limpieza, sin atribución causal ni medición de calidad/retrabajo. No hubo
corridas A/B persistidas. Sus artefactos referenciados están en `/tmp/opencode/`:
no asumir que ese almacenamiento temporal constituye un archivo durable.

### Lo que todavía no está demostrado

- El ahorro operativo de cada recorte propuesto con el modelo nuevo.
- Que CodeGraph reemplace búsqueda manual en vez de sumarse a ella.
- Que menos skills o delegaciones conserven igual calidad en todas las tareas.
- El costo exacto en tokens de esquemas que todavía no se midieron.

## Secuencia de trabajo

| Nº | Grupo | Propuesta | Estado |
|---|---|---|---|
| 1 | A — poda segura condicionada a equivalencia | Instrucciones globales propias de OpenCode | pendiente |
| 2 | A | Referencias rotas y workflow opcional de Higyrus | pendiente |
| 3 | A | Deduplicar el contrato de code review | pendiente |
| 4 | A | Publicidad veraz de herramientas Engram | pendiente |
| 5 | B — experimento | Memoria proporcional y cierre por hito | pendiente |
| 6 | B | Carga selectiva de heurísticas genéricas | pendiente |
| 7 | B | Catálogos por responsabilidad | pendiente |
| 8 | B | CodeGraph por tipo de tarea | pendiente |
| 9 | C — decisión arquitectónica | Separación de artifact-planner y artifact-renderer | pendiente |
| 10 | C | Composición de agentes locales y snapshots manuales | pendiente |

La recomendación anterior de un lote combinado 1 + 4 queda reemplazada por el
trabajo secuencial acordado: primero el 1 completo y luego el 2, y así sucesivamente.

## 1. Instrucciones globales propias de OpenCode

**Problema:** el fallback incorpora contexto e instrucciones del stack Claude.

**Cambio candidato:** crear un `AGENTS.md` global breve, con fuente en Core y
lifecycle declarado en su manifest/sync. No editar `~/.claude/CLAUDE.md`.

**Desaparece:** carga automática del fallback Claude. Las reglas útiles deben
quedar explícitamente cubiertas por la capa común, los roles, las skills o los
controles técnicos de OpenCode, sin copiar el catálogo entero de Claude.

**Ubicación:** Core: nuevo `AGENTS.md`, `STACK-MANIFEST.json` y documentación
afectada. Revisar instalador/sync solo para determinar si necesitan adaptación.

**Beneficio candidato:** si el reemplazo ocupa como máximo 3.072 bytes, el recorte
estático sería de al menos 14.304 bytes respecto del fallback observado. No es
un límite aprobado ni una medición de ahorro operativo.

**Antes de aprobar:** presentar el texto exacto y una matriz antes/después de
secretos, privacidad, permisos, Git/GitHub, validación, memoria, documentación,
UI y routing. Separar instrucciones de razonamiento, dominio y enforcement.

**Validación:** verificar selección del archivo, convivencia con instrucciones
locales, permisos efectivos, paridad y `opencode debug config` con salida segura.
Comprobar capacidades en sesiones nuevas; medir contexto aparte de calidad.

**Rollback:** deshacer solo archivos/bloques introducidos por este punto y
restaurar la composición previa por el flujo del Core; Claude queda intacto.

## 2. Referencias rotas y workflow opcional de Higyrus

**Problema:** referencia a `memoria-lectura-opencode`, condiciones contradictorias
para `result-dev.md`, formulario de evaluación de handoff rutinario y skill
`workflow-ticket-handoff` sin metadata cargable.

**Cambio candidato:** corregir referencias; exigir artefactos solo cuando el
workflow está habilitado; informar contexto faltante sin formulario universal;
hacer cargable el contrato de handoff de tickets.

**Ubicación:** Overlay Higyrus: `AGENTS.md` y `.opencode/agents/`; Addon Ticketing:
`skills/workflow-ticket-handoff/SKILL.md`.

**Responsabilidad restante:** handoff y resultados siguen siendo obligatorios
dentro del workflow habilitado; la trazabilidad no desaparece.

**Beneficio:** menos cargas fallidas y ceremonia ad-hoc. Hubo cinco errores
históricos cargando el handoff; no atribuir automáticamente su eliminación al
cambio ni ocultar que reparar metadata agrega publicidad al catálogo.

**Validación:** tarea con ticket, tarea sin ticket y handoff incompleto en sandbox.
No desplegar a producto ni sincronizar assets Claude bajo autorización genérica.

**Rollback:** revertir el patch específico en sus dos dueños y, solo si hubo un
despliegue autorizado, restaurar esa salida con exclusiones equivalentes.

## 3. Deduplicar el contrato de code review

**Problema:** procedimiento y reglas repetidos entre agente, skill y comandos.

**Cambio candidato:** agente para identidad/límites/storage; skill para
procedimiento; comandos para argumentos/entrada. Conservar la skill especializada.

**Ubicación:** Core: `agents/code-reviewer.md`,
`skills/code-review-branch-to-branch/SKILL.md`, `commands/code-review*.md`;
evaluar después las especializaciones canónicas afectadas.

**Responsabilidad restante:** repo correcto, ticket consistente, conversación del
PR, snapshot exacto, anti-inyección, informe incremental y escritura acotada.

**Beneficio candidato:** agente + skill suman 14.239 bytes; explorar un recorte
editorial del 10–20%, sin convertirlo en cuota ni prometer menos tool calls.

**Validación:** PR de otro repo, ticket contradictorio, rereview con mismo head y
conversación nueva, e informe incremental; conservar umbral de hallazgos materiales.

**Rollback:** patch inverso y recomposición autorizada, sin tocar informes previos.

## 4. Publicidad veraz de herramientas Engram

**Problema:** instrucciones MCP anuncian herramientas fuera de la allowlist y un
mecanismo `ToolSearch` que no corresponde a esta superficie.

**Cambio candidato:** alinear instrucciones con herramientas realmente expuestas.
No cambiar todavía los disparadores de lectura/escritura: eso es el punto 5.

**Ubicación:** Addon Knowledge: `patches/engram-source-agent.patch` y pruebas del
contrato MCP. El checkout gestionado de build no se convierte en fuente canónica.

**Responsabilidad restante:** todas las herramientas válidas y el protocolo de
conflictos, adjudicación y confirmaciones quedan preservados.

**Beneficio:** retirar instrucciones imposibles; ahorro operativo no cuantificado.

**Validación:** confrontar `tools/list`, allowlist e instrucciones; verificar patch
y lifecycle. No reconstruir ni instalar el runtime sin autorización de ese alcance.

**Rollback:** restaurar el patch anterior y el artefacto gestionado, si fue desplegado.

## 5. Memoria proporcional y cierre por hito

**Hipótesis:** recuperaciones pequeñas pueden hacerse directamente y los summaries
pueden reservarse para hitos con continuidad útil, sin perder antecedentes.

**Experimento candidato:** consulta directa para ID/búsqueda puntual; reader para
recuperación amplia/corpus; cierre selectivo; no repetir errores determinísticos
sin cambiar su causa. Verificar primero el fix actual de summaries.

**Ubicación:** Addon Knowledge: `scripts/manage_agent_autonomy.py`, skills de
memoria y patch MCP; adaptación posterior de overlays si resulta necesaria.

**Responsabilidad restante:** lectura relevante, persistencia durable conservadora,
privacidad y reader disponible. No borrar ni reclasificar memorias existentes.

**Beneficio a medir:** sesiones hijas, llamadas y contexto evitados. Las 88
delegaciones históricas no son 88 oportunidades de eliminación demostradas.

**Validación:** antecedentes relevantes, irrelevantes y ya destilados en handoff;
medir omisiones y continuidad además de tokens. Aprobar el protocolo antes de correrlo.

**Rollback:** restaurar triggers y políticas anteriores sin alterar el corpus.

## 6. Carga selectiva de heurísticas genéricas

**Hipótesis:** cargar skills que repiten obligaciones del rol agrega ceremonia en
tareas simples sin mejorar necesariamente el resultado.

**Experimento candidato:** estrechar triggers de `analisis-tecnico-evidencia` y
evaluar otras heurísticas una por una, no retirarlas en bloque.

**Ubicación:** Core: skills genéricas y referencias desde agentes.

**Responsabilidad restante:** evidencia, incertidumbre y validación permanecen
explícitas. No retirar de entrada checklists específicos de contratos o concurrencia.

**Beneficio a medir:** cargas y salida evitadas; las 161 cargas/162.610 bytes de la
skill relevada son un techo histórico, no un ahorro previsto.

**Validación:** tareas simples y ambiguas equivalentes; comparar hallazgos,
evidencia, supuestos y retrabajo. Resolver explícitamente cualquier skill no cargable.

**Rollback:** restaurar triggers y referencias, sin cambiar permisos.

## 7. Catálogos por responsabilidad

**Hipótesis:** los roles pueden recibir menos esquemas/anuncios sin perder acceso
operativo a capacidades útiles por routing explícito.

**Experimento candidato:** retirar mutaciones Engram del reader; lifecycle aislado
de roles no habilitados; evaluar catálogo editorial en roles de código por separado.

**Ubicación:** agentes Core/Knowledge; Addon Background para su superficie;
Addon Documents para contratos y routing editorial.

**Responsabilidad restante:** herramientas válidas en roles autorizados; conservar
controles runtime. No sustituir restricciones técnicas por promesas del prompt.

**Beneficio candidato:** cinco esquemas mutadores fuera del reader y cuatro de
lifecycle aislado fuera de roles no habilitados, sujeto a matriz efectiva. Medir
tokens de esquemas y costo de routing antes de generalizar.

**Validación:** matriz rol × herramienta; rechazo de operaciones indebidas y éxito
de las válidas; requests mixtos de código/documentos sin callejones sin salida.

**Rollback:** restaurar visibilidad previa sin ampliar permisos por accidente.

## 8. CodeGraph por tipo de tarea

**Hipótesis:** el beneficio depende del tipo de pregunta y del contexto disponible.

**Experimento candidato:** comparar routing estructural frente a búsqueda directa,
usando herramientas de benchmark existentes, sesiones nuevas y snapshots iguales.
No imponer ni retirar CodeGraph universalmente.

**Ubicación:** Addon CodeGraph: skill, playbook y benchmark.

**Responsabilidad restante:** callers, flujos, impacto y fallback directo; preservar
consentimiento para init/reindex y aislamiento de índices por worktree.

**Beneficio a medir:** tokens, duración y salida combinada del grafo y búsqueda
manual. Los 23,77 MB observados no son por sí solos desperdicio.

**Validación:** pares comparables con el mismo modelo, tarea y criterio de calidad;
captura persistida de métricas agregadas, sin prompts ni outputs crudos. No escribir
índices ni productos como efecto de la medición.

**Rollback:** restaurar routing anterior; conservar evidencia del experimento.

## 9. Separación de artifact-planner y artifact-renderer

**Decisión requerida:** evaluar si `documenter` debe planificar/renderizar lo
rutinario directamente, reservando sesiones independientes para especialización real.

**Ubicación:** Addon Documents: `.opencode/agent/` y workflow documental.

**Fundamento candidato:** superposición con responsabilidades y tools de
`documenter`. La baja frecuencia histórica no demuestra inutilidad.

**Responsabilidad restante:** contratos de spec, procedencia, render, receipts y
validación. Conservar QA visual independiente y el rol protegido `documenter`.

**Beneficio a medir:** sesión hija y coordinación por despacho evitado, no solo
cantidad de agentes. Especificar capacidades únicas antes de proponer un retiro.

**Validación:** documentos PDF/PPTX/DOCX y diagramas representativos; evaluar
calidad, editabilidad, seguridad y aislamiento. Aprobación explícita antes de retirar roles.

**Rollback:** restaurar agentes/routing previos; no modificar artefactos existentes.

## 10. Composición local y snapshots manuales

**Decisión requerida:** evaluar especialización declarativa y composición al
generar, extendiendo herramientas existentes en vez de crear otro addon.

**Ubicación:** Core: recomposición/auditoría; manifests y especializaciones de
overlays canónicos. No mover dominio AUNE al Core.

**Responsabilidad restante:** overlays aditivos, permisos seguros, reglas locales
y ownership por producto. No asumir herencia automática de prompts/permisos/tools.

**Beneficio esperado:** menos copias manuales que mantener. No promete menor
contexto residente: la salida generada podría tener el mismo tamaño.

**Riesgo:** agregar complejidad de build y dependencia del orden de composición.
Se puede descartar si cuesta más de lo que ahorra.

**Validación:** equivalencia semántica, permisos, precedencia, idempotencia, paridad
y exclusión de Claude/productos. Probar generación en sandbox antes de cualquier despliegue.

**Rollback:** conservar snapshots anteriores y restaurar solo el mecanismo aprobado.

## Registro obligatorio por punto

Completar al avanzar, sin crear un reporte nuevo para cada microiteración:

- Estado y fecha.
- Especificación final acordada y archivos alcanzados.
- Aprobación explícita: qué se autorizó y qué quedó fuera, incluido despliegue.
- Cambios realizados y diferencias respecto de lo aprobado.
- Validaciones ejecutadas y resultado; comprobaciones pendientes.
- Permisos/capacidades antes y después.
- Recorte estático medido, separado de resultados operativos experimentales.
- Rollback concreto y pendientes.

### Historial

| Fecha | Punto | Registro |
|---|---|---|
| 2026-10-25 | Plan | Usuario pidió persistir las diez propuestas y trabajarlas secuencialmente: pulir, aprobar, ejecutar y validar cada una. Solo se autorizó crear este documento. |
| 2026-10-25 | Preparación | Usuario autorizó auditar, sincronizar y publicar los repos canónicos antes de la poda. Ver `SYNC-BASELINE-2026-10-25.md`; esta preparación no aprueba ni ejecuta ninguno de los diez puntos. |

## Próxima acción

Pulir **el punto 1**: presentar la matriz de equivalencia y el contenido candidato
del `AGENTS.md` propio de OpenCode. No crear ni desplegar ese archivo hasta que el
usuario apruebe su especificación.
