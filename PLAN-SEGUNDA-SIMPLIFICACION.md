# Plan de segunda simplificación del stack OpenCode

Fecha de apertura: 2026-10-25.

Estado: puntos 1 y 2 implementados, validados y sincronizados. El punto 2 incluye
reconciliación de las divergencias previas autorizada por el usuario. Reiniciar
clientes y usar sesiones nuevas. Segundo repaso y addendum del punto 2 cerrados:
activación determinista, shell restringido y estilo local prioritario (2.h–2.i).
Los puntos 3–10 siguen pendientes.

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
- Política cross-stack actualizada por el usuario: evaluar cada cambio en OpenCode
  y Claude, con comportamiento igual o parecido para el mismo proyecto. Mantener
  una fuente para contenido agnóstico compartido; no duplicar lo que ya tiene
  symlinks. Prompts/configuración específicos de runtime pueden diferir en forma,
  pero deben preservar un contrato semántico equivalente y límites seguros.
- Esto no autoriza cambios indiscriminados: cada punto necesita alcance aprobado
  para ambos lados. Hooks, permisos, herramientas y modelos no se amplían por
  arrastre. Los manifests locales incluyen assets de ambos clientes: revisar el
  plan de despliegue completo, sin syncs amplios ni escrituras en productos.
- No hacer commits ni pushes sin pedido explícito. No instalar ni sincronizar
  componentes por el solo hecho de estar mencionados en este plan.
- Nunca hacer commits ni pushes en los repos producto AUNE en esta iniciativa:
  solo en los canónicos. Los productos son destinos de despliegue; sus cambios
  locales de capas de agentes se conservan sin publicar. No pedir ticket/rama
  para publicarlos ni forzar assets ignorados a sus índices Git.
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
| Adaptaciones Claude | `~/.local/src/super-turing-claude-code/`, limitadas al alcance aprobado de cada punto |
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
| 1 | A — poda segura condicionada a equivalencia | Guía OpenCode propia y guía Claude alineada y podada | cerrado |
| 2 | A | Referencias, metadata y workflows coherentes en ambos stacks y nueve overlays | cerrado |
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
lifecycle declarado en su manifest/sync. Usar la guía Claude como referencia de
capacidades y criterios, no como plantilla para copiar.

El usuario pidió además comportamiento igual o parecido entre ambos stacks.
Se incorpora una alineación acotada de principios comunes en el `base/CLAUDE.md`
canónico, conservando instrucciones específicas de cada runtime. No editar las
instalaciones activas como fuentes independientes ni portar agentes en esta etapa.

**Desaparece:** carga automática del fallback Claude. Las reglas útiles deben
quedar explícitamente cubiertas por la capa común, los roles, las skills o los
controles técnicos de OpenCode, sin copiar el catálogo entero de Claude.

**Ubicación:** Core: nuevo `AGENTS.md`, `STACK-MANIFEST.json` y documentación
afectada. Revisar instalador/sync solo para determinar si necesitan adaptación.
Claude: `~/.local/src/super-turing-claude-code/base/CLAUDE.md` para los principios
comunes; registrar el cambio en su documentación de cambios cuando se implemente.

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
restaurar cada guía desde su fuente canónica. No revertir cambios ajenos ni
alterar hooks, permisos o assets operativos para volver al texto anterior.

### 1.a. Criterio acordado y alcance de la alineación

- Principios equivalentes, no archivos idénticos ni una promesa de paridad funcional
  entre runtimes. No crear un generador, repo compartido, skill ni addon para esto.
- OpenCode: guía común que complementa al agente seleccionado; no convierte a
  `planner`, `reviewer` o un lector en implementador.
- Claude: conservar el rol base de líder técnico/implementador que su guía ya
  cumple; no reemplazarlo por una referencia al `master-dev` inexistente allí.
- No prometer capacidades homólogas sin verificar sus contratos. Por ejemplo,
  el rol `documenter` está en OpenCode pero no en el catálogo Claude revisado;
  Claude conserva su flujo documental actual, sin portar ese agente.
- Los cambios de política de memoria, exposición de esquemas/tools, delegación y
  otros experimentos siguen en sus puntos originales. La poda de listas manuales
  de la guía Claude fue autorizada aparte en 1.g; no cambia catálogos efectivos.
- Para desplegar, revisar diferencias de cada lifecycle. El sync Claude también
  mergea hooks/permisos en `settings.json`: no ejecutarlo como si solo copiara
  `CLAUDE.md`. Si alcanza assets excluidos, detenerse y definir despliegue acotado.

### 1.b. Guía OpenCode implementada y desplegada

El texto definitivo se mantiene únicamente en `AGENTS.md` del Core; este plan no
conserva una segunda copia que pueda divergir. Se revisaron las 131 líneas del
`base/CLAUDE.md` anterior antes de construirlo.

Respecto del candidato se explicitaron escritura de corpus solo por wrappers,
Jira read-only, aislamiento de índices por worktree y QA de cada página/slide y
editable solicitado. Son contratos existentes, no capacidades inferidas del modelo.

### 1.c. Adaptación inicial de Claude implementada y desplegada

- Alinear los bloques de principios y estilo con el criterio de trabajo y la
  seguridad del candidato anterior, evitando repetir reglas equivalentes.
- Conservar `Rol por defecto`: Claude aplica el liderazgo/implementación en la
  sesión principal; OpenCode lo mantiene en `master-dev`.
- Conservar contratos operativos Claude de hooks, permisos, subagentes y uso de
  herramientas. No copiar nombres de tools, mecanismos async ni roles exclusivos
  de OpenCode al archivo Claude.
- En esta entrega inicial no se recortaron catálogos ni dominio. El usuario
  autorizó después esa ampliación, documentada en 1.g; no se aplica retroactivamente
  al alcance ni a los resultados de la primera entrega.
- Se reemplazaron solo principios/estilo y se agregó el bloque común de seguridad.
  La concordancia no se valida por igualdad byte a byte de las guías completas;
  los bloques operativos deben permanecer idénticos a su baseline.

### 1.d. Matriz de responsabilidad a comprobar antes del despliegue

| Capacidad/regla | OpenCode | Claude | Control de esta etapa |
|---|---|---|---|
| Evidencia, alcance, cambio mínimo y estilo | Guía común y rol | Principios comunes y rol base | Comparación semántica |
| Límites del rol y delegación | Agente seleccionado y permisos | Sesión principal, subagentes y permisos propios | No equiparar autoridad de roles |
| Secretos y operaciones riesgosas | Guía, plugins y permisos existentes | Guía, hooks y permisos existentes | No modificar ni eludir controles |
| GitHub y cuentas | Política privada disponible | Política privada disponible | No copiar identidades al Core portable |
| Context7 | Roles/MCP y guía | Guía y MCP actuales | Mantener prioridad de documentación |
| Memoria y corpus | Addon, roles y herramientas actuales | Guía e integración actuales | No cambiar disparadores en este punto |
| Tickets y dominio | Addon y overlays | Contratos e instrucciones locales actuales | No universalizar workflows |
| CodeGraph | Contrato y runtime actuales | Contrato y runtime actuales | Preservar límites de init/reindex |
| UI y documentación | Roles, herramientas y QA disponibles | Flujos y QA actualmente disponibles | No inventar paridad de agentes |

#### Revisión completa de la guía Claude anterior

| Bloque anterior | Responsabilidad preservada en OpenCode |
|---|---|
| Presentación y rol base | Límites del rol activo en AGENTS; `agents/master-dev.md` conserva liderazgo e implementación |
| Principios y estilo | Bloques comunes alineados en ambas guías |
| Tooling UI | Playwright condicionado y Stitch en `ui-web-designer`; contratos y permisos sin cambios |
| Guardrail de secretos y permission-autopilot | Seguridad común más `plugins/env-guard.ts` y `plugins/permission-autopilot.ts`, sin prometer hooks Claude en OpenCode |
| Catálogo de subagentes/modelos | Archivos de agentes y catálogo real; no copiar roles o modelos Claude |
| CodeGraph | Regla global más skill estructural; no init/reindex autónomo ni compartir índices entre worktrees |
| Ticketing | Jira read-only, handoff y artefactos condicionales; helpers/overlays siguen siendo dueños del detalle |
| Documents | Fuente, plantillas completas, herramientas aprobadas y QA explícitos; detalles en `documenter` y skills documentales existentes |
| GitHub accounts local | Carga explícita de `github-cuentas-multiples`, sin copiar cuentas/aliases al Core |
| Engram/Qdrant | Recuperación según política vigente, persistencia durable conservadora y corpus solo por wrappers |
| Catálogos de skills/comandos | Descubrimiento real sin repetir listas manuales ni corregir metadata en esta etapa |
| Rollout AUNE y exclusión de higyrus-AN | Instrucciones locales; no incorporar dominio AUNE al Core ni modificar productos |
| Fuera de alcance Claude y fuente del archivo | Metadatos específicos Claude no se trasladan; ownership OpenCode documentado en README-AGENTS |

Validaciones de carga y paridad en sesiones nuevas, sin ejecutar operaciones
sensibles reales para demostrar un bloqueo. `opencode debug config` verifica
configuración, pero por sí solo no prueba el prompt global completo recibido.

### 1.e. Resultado y validación de la entrega inicial — 2026-10-25

- **Autorización:** el usuario aprobó implementar y pidió revisar completamente
  CLAUDE.md antes de construir AGENTS.md. Se respetó la excepción Claude limitada
  a principios/estilo/seguridad comunes; no se ejecutaron puntos 2–10.
- **Core:** nuevo `AGENTS.md`; alta en `STACK-MANIFEST.json`; documentación en
  `README-AGENTS.md`, `INSTALLATION.md` y `CHANGELOG.md`. Los scripts existentes
  ya consumen `managedFiles`: no se modificaron instalador ni sync.
- **Claude:** modificados solo `base/CLAUDE.md` y `CHANGELOG.md`. Se verificaron
  tres bloques comunes alineados y 15 secciones anteriores restantes sin cambios,
  además de la presentación del archivo sin cambios.
- **Despliegue acotado:** cinco assets Core (`AGENTS.md`, manifest, README-AGENTS,
  INSTALLATION y CHANGELOG) y `~/.claude/CLAUDE.md`, copiados desde sus fuentes.
  No se ejecutaron syncs de aplicación: se evitaron merges de settings, podas y
  despliegues ajenos al punto. Los scripts oficiales se usaron después en `--status`.
- **Paridad:** los seis destinos coinciden byte a byte con las fuentes. Core
  reportó create=0/update=0/remove=0/config_policy_update=0, 70 archivos sin
  diferencias y 0 fuentes faltantes. Claude reportó 0 crear/actualizar/retirar
  y 61 archivos sin cambios.
- **Controles preservados:** 251 archivos operativos de ambas instalaciones
  comparados mediante SHA-256 antes/después, incluidos agentes, plugins/hooks,
  scripts, skills, comandos y configuración. Sin diferencias. No se expusieron
  configuraciones crudas ni secretos.
- **Configuración efectiva:** `opencode debug config` antes/después, con salida
  capturada y resumida sin persistir valores sensibles. Misma proyección de
  modelos, agente por defecto, agentes, herramientas y permisos: 27 entradas de
  agentes, `master-dev`, `openai/gpt-6.1-sol`.
- **Loader:** suite existente `bun test test/session/instruction.test.ts` del
  runtime 1.19.4: 9 pass, 1 todo preexistente, 0 fail. Smoke adicional: 2 pass,
  0 fail; usa el AGENTS.md realmente desplegado y un proyecto temporal, confirma
  coexistencia global/local y exclusión de la guía global Claude. Otro caso prueba
  el fallback sin AGENTS.md en sandbox. No se modificó código del host.
- **Incidencia de QA:** el primer intento del smoke temporal no resolvió el
  import absoluto de Effect. Se corrigió solo el import del test temporal y el
  rerun pasó; no fue un defecto del stack ni requirió instalar dependencias.
- **Tamaño:** bloque global anterior 17.376 bytes; AGENTS.md final 3.144 bytes:
  14.232 bytes menos (81,9%) en ese bloque. Se priorizó completar contratos sobre
  la meta inicial de 3.072 bytes. La guía Claude pasó a 17.853 bytes (+477): se
  alinearon criterios, no se aplicó una poda general de su contenido operativo.
- **Límites:** sin sesión LLM real ni A/B de calidad/costo; tests del loader y
  configuración no prueban ahorro operativo o paridad funcional entre runtimes.
  En el propio repo Core, el archivo fuente también puede cargarse como guía
  local; la cifra anterior mide solo la sustitución del bloque global.
- **Artefactos temporales de QA:** `/tmp/opencode/point1-guidance-checks.py`,
  `point1-instructions.test.ts`, `point1-guidance-baseline.json` y
  `point1-guidance-result.json`. No son assets del stack ni almacenamiento durable;
  los resultados relevantes quedan registrados aquí.
- **Memoria:** decisión curada guardada en Engram #2017 y plan actualizado en
  #1999. El cierre con `mem_session_summary` devolvió `unknown_session` para el ID
  de sesión propagado por el plugin. No se modificó esa integración ni se forzó
  el uso de una sesión ajena: revisar el contrato real en el punto 5. Los fixes
  presentes en fuentes no demostraron resolver este caso en el runtime activo.
- **Sin commits, pushes, instalaciones de dependencias ni cambios de producto,
  índices o worktrees.**

### 1.f. Rollback concreto

Backups previos al despliegue y ledger `point1-rollback.json`:

- OpenCode: `~/.config/opencode/.stack-sync-backups/point1-20261025T180411Z/`
  (snapshot marcado con `.pin`).
- Claude: `~/.claude/backups/claude-stack-sync/point1-20261025T180411Z/`.

Si se solicita rollback, comprobar primero que los destinos no tengan cambios
posteriores. Restaurar los cuatro assets Core previos y la guía Claude desde el
backup; AGENTS.md global no existía: retirar solo el archivo creado por este punto.
Aplicar también el patch inverso correspondiente en fuentes canónicas, preservando
modificaciones ajenas y el historial del plan. No ejecutar reset global ni tocar
controles técnicos. Revalidar paridad/configuración y reiniciar clientes.

### 1.g. Ampliación aprobada: poda de la guía Claude

**Autorización:** «Perfecto. avancemos con la poda de ese punto en claude».
Se amplía el punto 1, no se inicia el punto 2. Fuente `super-turing-claude-code`,
destino únicamente `~/.claude/CLAUDE.md`; README/CHANGELOG quedan en su repo.

**Cambio:** guía residente con rol principal explícito, límites de subagentes,
los tres bloques comunes intactos y reglas breves de uso. Se retiran del prompt
catálogos manuales/modelos, relato histórico de hooks, comparaciones entre hosts,
rollout AUNE, rutas de runtime y listas extensas de comandos/patrones.

**Responsabilidad restante:** README Claude mantiene la matriz de operación;
los archivos de agentes/comandos/skills conservan descripciones, herramientas y
contratos especializados. Historia de hooks en changelog; dominio en la capa
local. No se presupone preservación porque el modelo pueda deducirla: se
revisaron prompts de review/curación, comandos de tickets/documentos y skills.

**Límites expresos:** no cambiar hooks/settings/permisos, modelos, agentes, skills,
comandos, MCPs, índices, productos o worktrees. No imports `@` ni obligación de
leer README al abrir una tarea. No reparar metadata ausente del handoff en esta
etapa. No afirmar paridad funcional ni ahorro operativo por tamaño de archivo.

**Validación prevista:** paridad fuente/destino, tres bloques comunes sin cambios,
hashes de assets operativos y OpenCode intactos, metadata disponible y casos
sintéticos de hooks sin leer secretos reales. Status oficial read-only; no usar
`claude agents` como prueba de descubrimiento: la CLI inspeccionada administra
sesiones background con ese comando. No ejecutar una sesión LLM por reflejo.

**Baseline y rollback de esta ampliación:**
`~/.claude/backups/claude-stack-sync/point1-claude-prune-20261025T182635Z/`.
Incluye la guía activa de 17.853 bytes, fuente/README/CHANGELOG previos y ledger.
Restaurar solo la ampliación dejaría vigente la primera entrega del punto 1,
sin deshacerla ni pisar cambios posteriores. No usar reset al último commit.

**Resultado — 2026-10-25:** implementado, validado y desplegado.

- `base/CLAUDE.md` pasó de 17.853 a **3.925 bytes**, de 136 a 43 líneas:
  **13.928 bytes menos (78,0%)** del archivo global de esta ampliación. Frente al
  original previo a la primera entrega (17.376), son 13.451 bytes menos.
  `AGENTS.md` OpenCode permanece en 3.144 bytes, sin cambios en esta ampliación.
- Conservados byte a byte los tres bloques comunes previos (principios,
  seguridad y estilo), más rol base explícito, regresiones/performance/integración,
  límites de subagentes, memoria/corpus, acceso externo, tickets, CodeGraph, UI,
  documentos y cuentas. No se exigió que ambas guías tuvieran igual tamaño.
- README Claude contiene matriz de responsabilidades y referencias de operación,
  no otra copia del prompt ni de todos los catálogos. La historia de fases se
  identifica como histórica; la guía no importa ni exige leer ese README al inicio.
- Metadata comprobada en **14 agentes, 3 skills críticas y 4 comandos**. No se
  repararon assets no cargables ni se afirmó que un archivo sin metadata sea una
  capacidad descubierta por el runtime. Descripciones nativas y contratos locales
  fundamentan retirar el catálogo duplicado, no la intuición del modelo.
- **8 casos sintéticos de hooks pasados:** Read/Edit/Write/Bash de rutas ficticias
  protegidas, excepción `.env.example`, referencias sensibles Read/Bash con `ask`,
  y lectura ordinaria. Los payloads solo se inspeccionan: no ejecutan comandos ni
  leen archivos de secretos. Esto no demuestra invocación end-to-end desde Claude.
- **207 archivos protegidos sin cambios** por SHA-256: assets fuente/activos de
  roles, comandos, skills y hooks; settings/snippets/lifecycle; AGENTS y assets
  administrados de OpenCode. No se cambiaron herramientas, permisos ni modelos.
- **Despliegue:** solo `~/.claude/CLAUDE.md`, en paridad byte a byte con su fuente.
  `sync-claude-stack.sh --status`: 0 crear/actualizar/retirar, 61 sin cambios.
  No se ejecutó sync de aplicación, merge de settings, instalaciones ni podas.
- `git diff --check` pasó. Sin sesión LLM real, benchmark A/B, pruebas de OAuth o
  conexión a sistemas de producto. La cifra es reducción estática, no ahorro
  operativo demostrado. `opencode debug config` no se repitió: sus archivos y
  configuración no cambiaron en esta extensión exclusivamente Claude.
- QA temporal en `/tmp/opencode/point1-claude-prune.py`, su baseline y resultado;
  evidencia durable resumida aquí. Backups fuente/activo y `rollback.json` en el
  directorio indicado arriba: permiten volver a la primera entrega, no al HEAD
  anterior a toda la iniciativa. Comprobar cambios posteriores antes de restaurar.
- Sin commits/pushes ni modificaciones de aplicaciones, índices o worktrees de
  producto. Puntos 2–10 no iniciados. Reiniciar Claude y usar sesión nueva.

## 2. Referencias, metadata y workflows coherentes en ambos stacks

**Ampliación solicitada:** no limitar el análisis a Higyrus; revisar todos los
overlays canónicos y reflejar correcciones compartidas en Claude y OpenCode.
Los desvíos reportados por el usuario son un síntoma: las contradicciones podrían
contribuir, pero no se atribuye causalidad sin ejemplos de ejecución.

### 2.a. Alcance y evidencia del diagnóstico — 2026-10-25

Relevamiento read-only de los nueve repos `super-turing-opencode-*` del workspace,
sus `AGENTS.md`/`CLAUDE.md`, patrones de agentes/comandos/skills relacionados y
capas globales Core, Knowledge, Ticketing y adaptaciones Claude. No se modificaron
prompts operativos, symlinks, metadata ni configuración en esta auditoría.

| Proyecto | Contrato local que se propone conservar, en ambos clientes |
|---|---|
| Higyrus | Handoff completo para trabajo guiado por tickets; no extenderlo a tareas ad-hoc |
| Virtual Broker | Planning/handoff opcionales; code review por ticket con storage acotado |
| Aggregator | Code review por ticket; sin verdict/result-dev de implementación por defecto |
| Keycloak | Planning sin handoff local por defecto; code review por ticket |
| Higyrus Gateway | Code review por ticket; no habilitar verdict/result-dev por arrastre |
| Market Data | Solo workflow Jira/tmp de code review; sin handoff de implementación por defecto |
| Documento API | Solo workflow Jira/tmp de code review; sin handoff de implementación por defecto |
| Perfil Inversor | Solo workflow Jira/tmp de code review; sin handoff de implementación por defecto |
| OMS API | Solo workflow Jira/tmp de code review; sin handoff de implementación por defecto |

Equivalencia **entre clientes dentro de cada proyecto**, no uniformar los nueve
proyectos ni habilitar un workflow nuevo porque hay un identificador Jira.

#### Hechos observados

- Higyrus conserva dos referencias a `memoria-lectura-opencode` y una regla no
  condicionada de cierre con `result-dev.md`; su skill local de tickets tiene
  obligaciones de verdict/result que deben delimitarse al workflow activo.
- Formularios `Contexto recibido/Faltó/Sobró`: 7 instrucciones en agentes Core,
  9 en agentes Claude, 9 en Higyrus (incluidas peticiones de coordinadores) y 5
  en Virtual Broker. Son 30 ubicaciones de texto, no 30 pasos por sesión.
  Otros overlays pueden recibir el formulario desde agentes globales: no basta
  retirarlo de una copia local.
- Metadata básica revisada en las **53 skills locales versionadas** de los nueve
  overlays: las 53 contienen cabecera/name/description. No equivale a invocación
  end-to-end ni demuestra ausencia de cualquier otro defecto.
- Cinco skills globales sin metadata cargable completa:
  `workflow-ticket-handoff` (Ticketing), `knowledge-governance-opencode`
  (Knowledge), `debugging-sistematico`, `verificacion-antes-de-cerrar` y
  `revision-por-etapas` (Core). Las cinco contrapartes Claude resuelven al asset
  instalado OpenCode mediante symlink; no necesitan fuentes nuevas.
- Higyrus y Virtual Broker describen Rovo como complemento si el helper no
  alcanza, pero sus skills también exigen intentarlo en comandos de planning.
  Esa contradicción puede sumar consulta por reflejo. El planner Claude no
  declara Rovo en su allowlist, por lo que tampoco corresponde prometerlo como
  disponible por el mero hecho de estar autenticado.
- Cinco overlays (Gateway, Market Data, Documento API, Perfil Inversor y OMS API)
  dicen aplicar la skill branch-to-branch a **cualquier revisión de cambios**.
  El contrato global distingue `reviewer` para trabajo propio de `code-reviewer`
  para terceros: delimitar el trigger evita arrastrar un workflow formal al review
  técnico interno. No se cambian procedimiento, presupuestos ni storage del review.
- Aggregator tiene `CLAUDE.md -> AGENTS.md`, no una copia independiente. El texto
  compartido menciona `master-dev`, que no es un rol primario Claude portado:
  revisar wording neutral de routing, preservando el symlink, no crear ese agente.
- Diferencia lateral detectada en Gateway: AGENTS describe mappings operativos
  del perfil `external` en repos de configuración; CLAUDE apunta a rutas locales/
  legacy. No asumir que uno es correcto por ser OpenCode: requiere contraste
  read-only con código/configuración antes de proponer corrección de dominio.
  No ampliar esta etapa a reauditar stacks/versiones de aplicaciones.

#### Ownership y propagación real

- Global: fuente canónica de cada addon → asset instalado OpenCode ← symlink
  Claude. Editar la fuente no despliega por sí solo: sincronizar solo lo aprobado
  y comprobar la resolución Claude tras actualizar el target compartido.
- Local: `.claude/skills/.../SKILL.md` referencia `.opencode/skills/.../SKILL.md`
  del mismo overlay; verificar los links afectados y su mapping de despliegue.
- Agentes con frontmatter/tools específicos no se convierten a symlinks por
  parecer similares. Adaptar ambos contratos sin copiar herramientas o permisos
  de un runtime al otro. No crear un generador o addon nuevo para esta corrección.

### 2.b. Correcciones aprobadas e implementadas

1. **Descubrimiento real:** completar metadata de las cinco skills globales en
   sus dueños, sin cambiar sus procedimientos ni imponer su carga. Handoff debe
   anunciar el requisito de workflow adoptado; un ticket aislado no lo activa.
   Reparar metadata puede aumentar el catálogo residente: es corrección de
   capacidad, no ahorro estático. Decidir cargas genéricas sigue en el punto 6.
2. **Activación y handoff:** corregir la referencia de memoria Higyrus y hacer
   explícitas las condiciones de artefactos en sus agentes/skill. Mantener la
   política actual de memoria y la trazabilidad cuando el workflow esté activo;
   no anticipar el experimento del punto 5. Alinear la activación en CLAUDE/AGENTS
   y comandos afectados sin habilitar handoffs en los siete proyectos restantes.
3. **Rovo como complemento y roles claros:** quitar contradicciones entre
   complemento y consulta obligatoria; pedirlo solo si falta contexto material y
   el caller dispone de la capacidad aprobada. No ampliar allowlists del planner
   Claude para hacer cumplir un prompt incorrecto. Delimitar la revisión formal
   respecto del review interno y neutralizar routing compartido donde corresponda.
4. **Salida sin ceremonia:** retirar el formulario de evaluación de contexto
   de las fuentes globales de ambos clientes y de las copias Higyrus/VB. Conservar
   el deber explícito de reportar faltantes críticos, alcance y evidencia.

Se auditan nueve overlays, pero **solo se editan los que tengan un defecto
identificado**. No hacer cambios cosméticos para que todos aparezcan modificados.
La discrepancia de dominio Gateway se deja identificada, no se corrige sin evidencia.

**Fuentes candidatas:** Core (metadata y cuerpos de agentes), Knowledge y
Ticketing (metadata propia), `super-turing-claude-code/base/agents/` y comandos
adaptados si requieren ajuste, y overlays afectados (`AGENTS.md`, `CLAUDE.md`,
agentes/skills/comandos locales). Diff exacto y selección final antes de desplegar.

### 2.c. Validación y rollback propuestos

- Matriz proyecto × cliente × tarea: ad-hoc, ticket sin handoff solicitado,
  workflow habilitado, handoff requerido incompleto, review interno y review formal.
- Conservar ruta, ticket, snapshot y reportes incrementales del code review;
  ningún resultado cae en storage global si la capa local lo prohíbe.
- Metadata cargable, referencias resueltas y symlinks fuente/target correctos;
  distinguir archivo existente, metadata anunciada y tool disponible al rol.
- Rovo ausente/no autorizado/autenticación faltante no dispara loops ni otra
  integración por evasión; usar evidencia suficiente ya disponible o declarar límite.
- Comparar hashes/permisos antes/después: ninguna ampliación de herramientas,
  acceso sensible, escritura remota, builds o infraestructura.
- Validar overlays en sandbox. No modificar repos producto, índices ni worktrees.
  Despliegue global de assets compartidos y cualquier rollout local requieren
  alcance explícito; no ejecutar syncs amplios por reflejo.
- Pruebas estructurales no demuestran obediencia del modelo. Si el usuario aporta
  uno o dos casos de desvío, usarlos como regresión; una prueba LLM controlada debe
  tener alcance/costo y criterio de aceptación acordados, sin cambios de producto.
- Rollback: backup por dueño y patch inverso de este lote, preservando los cambios
  del punto 1 y trabajo ajeno. Restaurar assets compartidos una vez, no duplicarlos.

### 2.d. Aprobación y bloqueo inicial de preflight — resuelto

El usuario confirmó: trabajar primero en los canónicos, sincronizar después las
capas de agentes en los proyectos y usar el resultado en nuevas sesiones. Esto
autoriza el rollout acotado del punto 2 en ambos clientes, no cambios de aplicación,
secretos, índices, worktrees ni un sync amplio que sobrescriba trabajo divergente.

El preflight comparó fuentes/destinos antes de editar y se detuvo:

- **Virtual Broker, CLAUDE.md:** fuente canónica de 70 líneas frente a guía
  desplegada de 369 líneas. El destino contiene comandos, patrones y notas de
  testing adicionales, además de versiones distintas. No sobrescribir ni asumir
  que todo es obsoleto: requiere reconciliar lo vigente hacia fuentes canónicas,
  preferentemente en skills existentes cuando sea detalle de dominio.
- **Gateway, CLAUDE.md:** una línea de mapping operativo `external` ya actualizada
  en destino y en AGENTS canónico, pero no en CLAUDE canónico. Preservar la regla
  desplegada; no revertirla al sincronizar. Su reconciliación explícita evita
  presentar una diferencia de baseline como parte de la poda del workflow.
- **Aggregator:** faltan en destino los cuatro symlinks `.claude/skills/.../SKILL.md`
  de dominio/ecosistema declarados por el canónico. Existen tres skills locales
  adicionales (`fechas`, `psql`, `zalando-api-guidelines`): preservarlas. Crear los
  links faltantes es distinto de reemplazar o borrar esas skills.
- **Core:** tres diferencias iniciales (`agent-design`, `master-dev`, `planner`)
  corresponden a composición aditiva con addons, no a drift byte a byte. No son
  objetivos de edición global de este punto; preservar su composición y validar
  semánticamente o excluirlos del mapa de copias directas, no sobrescribirlos.

En esa primera pasada no se creó baseline de despliegue ni se copiaron assets
tras detectar estas diferencias. Solo se registró el preflight y su helper temporal en
`/tmp/opencode/point2-workflows.py`. La política de no pisar cambios previos sigue
vigente. El usuario autorizó después reconciliar todo lo necesario y dejarlo
sincronizado, consultando solo decisiones que no pudieran resolverse con evidencia.

### 2.e. Reconciliación y ejecución — 2026-10-25

- **Baseline:** backup pinneado
  `~/.config/opencode/.stack-sync-backups/point2-20261025T194528Z/`, con fuentes y
  destinos previos separados, `point2-ledger.json` y `deployed-files.json`.
  Se preservaron los cambios previos de AGENTS en Higyrus/Aggregator y el estado
  de CLAUDE Higyrus; sin resets, staging ni alteración de índices Git.
- **Fuentes primero:** Core, Knowledge, Ticketing, adaptación Claude y overlays
  afectados. Se copiaron **79 assets concretos**, sin sync amplio, aplicación de
  snippets de settings, poda de extras ni instalación de dependencias.
- **Metadata:** reparadas las cinco skills globales. El registro nativo
  `opencode debug skill` confirmó sus nombres y resolución al mismo target que
  los symlinks Claude. Los otros cuatro cuerpos genéricos quedaron idénticos;
  el handoff recibió condiciones explícitas, manteniendo sus seis secciones mínimas.
- **Contratos:** 30 ubicaciones del formulario de contexto → 0 en los agentes
  relevados; dos referencias a memoria inexistente → 0. Persisten faltantes
  críticos, evidencia, validación y las políticas de memoria, sin adelantar punto 5.
- **Modos:** Higyrus conserva handoff para tickets, VB opcional y los otros siete
  sin handoff de implementación por defecto. Review interno no activa review
  formal. Rovo exige necesidad material y caller autorizado, no autenticación sola.
- **Adaptación Claude:** contratos requeridos legibles con `Read` desde el recurso
  aprobado cuando el rol no tiene `Skill`; no se amplían tools. `code-reviewer`
  respeta storage/ticket locales, sin fallback global cuando se prohíbe. No se
  modificaron presupuestos, snapshots ni la skill de procedimiento formal del punto 3.
- **Virtual Broker:** POM confirma Spring Boot 4.1.1/Java 21; package frontend
  confirma Next 15.5.x/React 19.2.x y Vitest. Su config de Vitest conserva unit
  server-side; Cypress conserva flujos de usuario. Se reconciliaron patrones útiles
  en las skills existentes, no copiando snippets genéricos ni versiones viejas.
- Se incorporaron `frontend/CLAUDE.md` y `backend/CLAUDE.md` al canónico y manifest
  VB porque el destino tenía guías anidadas que también afectaban el contexto.
  Ahora son breves referencias a contratos compartidos; sin crear skills/agentes.
  Root CLAUDE pasó de 13.806 a 7.918 bytes (369→79 líneas), frontend de 14.021 a
  1.432 (416→12), backend de 5.049 a 1.292 (136→11). Son tamaños de documentos,
  no tokens ahorrados por sesión; no todas las guías se cargan simultáneamente.
- **Gateway:** se preservó y backporteó la línea `external` ya vigente en destino
  y AGENTS canónico; no se alteró código ni configuración de rutas.
- **Aggregator:** cuatro symlinks repuestos sin borrar las tres skills propias.
  `.claude/skills` ya era alias a `../.agents/skills`: los nuevos links aparecen
  físicamente bajo `.agents/skills`, siguen apuntando a `.opencode/skills` y no
  duplican contenido. El manifest ahora posee solo sus cuatro subdirectorios,
  no todo el directorio con extensiones del producto.

### 2.f. Validación final y límites

- **Paridad:** 259 assets del mapa contrastados; los nueve manifests locales
  reportan pass, 0 diferencias y 0 obsoletos. Se usó el auditor existente con
  exclusión más conservadora de secretos en la invocación de QA, sin modificar
  su implementación. Core status: 70 sin diferencias; Claude status: 61.
- **Controles:** 81 frontmatter de agentes intactos byte a byte; 134 archivos
  protegidos de configuración, hooks/scripts e índices Git sin cambios. Modelos,
  tools y permisos efectivos antes/después coinciden en los siete perfiles
  comprobables sin instalar dependencias: global, Higyrus, VB, Market Data,
  Keycloak, Aggregator y OMS API.
- Gateway, Documento API y Perfil Inversor tenían dependencias locales de agentes
  sin preparar: se validó `opencode debug config` en sandboxes con los mismos
  metadatos/configs y SDK global existente, sin instalar ni modificar esos
  productos. No se presenta esa prueba como arranque real de sus clientes.
- **Pruebas:** 18 casos Bun con parser nativo 1.19.4 (incluidas 72 definiciones
  SKILL y nueve clases de workflow) y 12 Python (metadata/salida, auditoría de
  overlays y activación de handoff), todos pasados. Se agregaron regresiones
  portables en Core y Ticketing. `git diff --check` pasó.
- Un test temporal inicial no contemplaba la variante textual «no se habilitan»
  de OMS; se corrigió el matcher, no la política válida del proyecto. La captura
  de config grande por pipe truncó JSON; se cambió el capturador temporal a
  archivo anónimo, sin persistir ni exponer config cruda. No fueron fallos de apps.
- Sin sesión LLM real, A/B, login OAuth, consultas Jira/Confluence, builds/tests
  de aplicación ni operaciones CodeGraph. Las pruebas demuestran contratos,
  paridad y carga estructural; no obediencia perfecta ni causalidad de incidentes.
- Assets de agentes actualizados en productos por autorización específica; ningún
  archivo funcional de aplicación, secreto, índice o worktree creado/modificado.
  No hubo commits ni pushes. Cambios versionables siguen pendientes de commit.
- QA temporal en `/tmp/opencode/point2-workflows.py`, `point2-contracts.test.ts`,
  baseline/resultados/paridad JSON; no son assets instalados ni archivo durable.
  El resumen durable y el criterio de rollback quedan aquí.

### 2.g. Rollback específico

Usar el backup 2.e y revisar cambios posteriores antes de restaurar. Reponer solo
los destinos de `deployed-files.json` desde `targets/<owner>/...`; los cuatro
links Aggregator no existían: retirar solo esos links y, si corresponde, sus
directorios nuevos vacíos, preservando las tres skills nativas y el alias padre.
Restaurar fuentes correspondientes desde `sources/<owner>/...`, sin reset a HEAD
que deshaga el punto 1. Las dos guías anidadas VB no existían en canónico: retirar
solo esas fuentes nuevas y restaurar manifest previo; sus destinos sí tenían
guías que están respaldadas. Revertir los nuevos tests de este punto si se revierte
el contrato, no borrarlos como archivos ajenos. Mantener historial del plan y
ajustar estado, sin perder evidencia. Revalidar paridad/config y reiniciar clientes.

### 2.h. Segundo repaso read-only — 2026-10-25

El usuario aclaró que la publicación es exclusivamente canónica y pidió revisar
otra vez skills, activación del workflow y estilo. No se editaron prompts,
permisos ni assets de producto en este repaso; solo este registro y memoria curada.

**Carga comprobada más allá de metadata:** siete invocaciones reales del tool
`skill` en seis roles OpenCode con el runtime administrado y sus permisos reales:
planner/handoff, master-dev/debugging, master-dev/verificación, reviewer/revisión
por etapas, code-reviewer/review formal, knowledge-curator/gobernanza y
dev-test/verificación. Todas devolvieron skill_content y metadata correctos.

Se comprobó `allow` antes de cada llamada con el evaluador nativo: ningún `ask`
o `deny` se omitió. DB aislada temporal, sin launcher que fija la DB productiva,
sin cambiar configuración/permisos y sin ejecutar modelos (tokens input/output=0).
No se ejecutaron formatters, builds ni operaciones de aplicación. QA temporal:
`/tmp/opencode/second-pass-skill-loads.py` y su resultado JSON.

En Claude se mantiene la evidencia de referencias legibles y `Read` declarado,
con symlinks que resuelven a los mismos contratos; no se afirma una ejecución
LLM real por cada rol. Tampoco se probó selección automática en todos los pares
proyecto/rol: disponibilidad no implica obediencia ni activación correcta.

**Hallazgos para cerrar antes de prometer ausencia de desvíos:**

1. VB `.opencode/commands/ticket-plan.md:12` aún permite preparar handoff
   «si aporta claridad», mientras CLAUDE/skill local lo condicionan a pedido/
   adopción. Falta un criterio inequívoco de qué cuenta como pedido explícito.
   Recomendación: ID aislado no activa; comandos específicos actúan según el
   workflow que el proyecto habilita, sin decisión espontánea del modelo.
2. `revision-por-etapas/SKILL.md:37` todavía dice «si existe workflow de tickets»
   para priorizar verdict/result, sin distinguir handoff de implementación de
   code review solamente. No crea archivos por sí sola, pero deja una condición
   más amplia que la del contrato reparado. Recomendar limitarla al handoff
   aplicable/activo y archivos existentes, no exigirlos en tareas ad-hoc/review-only.
3. El planner global tiene `edit: deny`, pero el evaluador real devolvió `allow`
   para Bash `./gradlew spotlessApply`; el plugin convierte perfiles no denegados
   por defecto en Bash allow con excepciones. No se ejecutó ese comando. Es un
   límite técnico incompleto, no una carga fallida de skill ni un cambio introducido
   por el punto 2. Recortar shell necesita diseño aprobado en ambos runtimes,
   preservando helpers legítimos y sin afirmar que quitar una línea resuelve todo.
4. UI global y `diseno-ui-web` privilegian Material UI como referencia, sin una
   precedencia explícita del design system local. VB exige Ant Design; hay riesgo
   de deriva de estilo, no prueba de que haya ocurrido. Recomendar prioridad
   explícita de convenciones/design system del repo y MUI solo como referencia
   compatible/fallback, no reemplazo del stack.

Idioma/estilo de respuesta global siguen alineados: idioma de sesión, conclusiones
primero y brevedad; no se encontró una orden global de responder siempre en inglés.
La conformidad de código/UX requiere casos representativos, no solo inspección de
prompts. No hubo nuevas correcciones operativas ni commits/pushes en este repaso.

**Conclusión:** las skills reparadas sí se pueden cargar. El cierre inicial cubrió
despliegue, metadata y contratos revisados; no significa blindaje técnico o
conductual completo. Proponer addendum acotado y pruebas positivas/negativas del
workflow y estilo con alcance/costo acordados antes de avanzar al punto 3.

### 2.i. Addendum aprobado e implementado — 2026-10-25

El usuario aprobó ambos criterios pendientes y la implementación del addendum.
Nunca commits/pushes en productos AUNE: solo en los canónicos. No se inicia punto 3.

- **Activación:** en proyectos que admiten handoff, comandos específicos con ticket
  concreto cuentan como pedido explícito; no repreguntar ni decidir por conveniencia.
  ID aislado/archivo viejo/review-only no habilitan handoff. Las excepciones sin
  archivos respetan reglas del proyecto o requieren explicar el conflicto.
  Contratos globales de ambos clientes y VB alineados.
- **Referencias:** revisión por etapas solo prioriza handoff de implementación
  aplicable/activo y existente; no crea ni exige esos archivos en ad-hoc/review-only.
- **Estilo:** design system, tokens y convenciones locales primero; MUI es referencia
  compatible/fallback. Los dos roles UI se alinean; la skill UI ahora es compartida
  por symlink con OpenCode, no una segunda copia.
- **Shell técnico:** el planner solo admite Bash mediante `planner_shell.py` de Core:
  Git de lectura y helpers registrados por Knowledge/Ticketing. Read/Grep/Glob y
  consultas MCP existentes no cambian. No hay nuevas tools, agentes, skills o MCPs.
  Core no absorbe contratos Jira/corpus: los addons declaran sus entradas/argumentos.
- Core y planner local Higyrus pasan a Bash deny por defecto con solo dos patrones
  del ejecutor. `permission-autopilot` conserva esos deny. Un plugin valida el comando
  del turno ejecutor y falla cerrado ante identidad/política no resuelta; la cache
  se fija en chat.params, no en mensajes de cambio de agente todavía encolados.
- Claude mantiene su toolset/modelo, pero incorpora PreToolUse Bash scoped al planner
  que llama el mismo ejecutor. No se editan settings/hooks globales ni se autoaprueba
  ningún permiso. Un hook permitido devuelve 0 sin decisión allow; bloqueo devuelve 2.
- Se rechazan shell general, comandos compuestos, redirección, expansión, intérpretes
  libres, formateo, builds y Git mutador. Git desactiva locks opcionales, fsmonitor,
  pager, diff externo y textconv. Los helpers son scripts globales confiables,
  argumentos declarados y sandbox metadata existente; tmp no puede redirigir a apps.
- **Tradeoff:** para shell el planner debe usar el ejecutor, no una consola arbitraria.
  Es control de comandos y programas confiables, no un sandbox OS contra un helper
  comprometido/operador que altere la configuración ni una garantía sobre otros roles.
  Los helpers registrados conservan caches/consultas propias; no se usan para evadir
  guardas de secretos o acceder a credenciales crudas.
- **Pruebas:** Core 26 Python, Ticketing 2 Python, adaptador OpenCode 4 Bun y contratos
  cross-stack 6 Bun: **38 pasadas**, sin llamadas LLM. Incluyen comandos positivos/
  negativos, cambio de rol, identidad no resuelta, límite de repo, quoting literal,
  mutaciones Git, tmp symlink y helper Jira real sobre un fixture temporal offline.
  Una primera fixture carecía del archivo example vacío requerido por el helper;
  se corrigió solo la fixture, sin leer .env real ni modificar el helper.
- **Runtime:** siete cargas reales de skills/6 roles siguen pasando con allow; 0 tokens,
  DB temporal. Evaluación nativa planner: edit=deny y spotless Bash=deny (antes allow).
  Un Bash real vía ejecutor --help pasó y raw shell no creó marcador sintético.
  Global/Higyrus `opencode debug config` confirman Bash deny por defecto y solo el
  ejecutor admitido. Los modelos no cambian; guardas de secretos/settings permanecen.
- **Paridad:** Core status 72 sin diferencias, Claude status 61 sin diferencias y nueve
  manifests locales pass. Se recompuso el planner aditivo conservando bloques de
  Knowledge/Ticketing; no se reemplazó por una copia sin addons. Sin deps instaladas,
  formateos/builds/app tests, operaciones Jira/CodeGraph ni modificaciones funcionales.
- **Rollback:** backup pinneado
  `~/.config/opencode/.stack-sync-backups/point2-addendum-20261025T223009Z/` con 36
  assets de baseline y ledger. Restaurar fuentes/destinos previos revisando cambios
  posteriores; retirar solo nuevas guardas/registros/tests de este addendum, reponer
  la skill UI regular previa si se revierte el symlink y recomponer planner aditivo.
  No reset a HEAD ni borrado de artefactos propios del usuario. No publicar productos.
- QA temporal: `/tmp/opencode/point2-addendum-deploy.py`, `addendum-contracts.test.ts`,
  `addendum-runtime-check.py` y reportes; no se instalan ni son archivo durable.
  No hay evaluación de selección/obediencia LLM ni prueba end-to-end de Claude con
  modelo. Reiniciar ambos clientes y usar sesiones nuevas; no prometer obediencia 100%.

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
| 2026-10-25 | Punto 1, alcance | Usuario acordó formular AGENTS.md propio usando Claude como referencia, sin copypaste, y pidió alinear después la guía Claude con los principios resultantes. Se registran candidato y excepción acotada; no se activó ni desplegó ninguna guía. |
| 2026-10-25 | Punto 1, aprobación | Usuario autorizó avanzar con la implementación, exigiendo revisar bien CLAUDE.md y construir AGENTS.md sobre esa base. Se implementan guías canónicas y metadatos; despliegue limitado a archivos aprobados, sin controles técnicos ni puntos posteriores. |
| 2026-10-25 | Punto 1, cierre | Implementado y desplegado con paridad en seis archivos, 251 archivos operativos intactos, debug config equivalente, 11 tests pasados y un todo upstream. Backups y límites documentados en 1.e–1.f. Punto 2 no iniciado. |
| 2026-10-25 | Punto 1, ampliación Claude | Usuario autorizó podar la guía Claude tras aclarar que la primera entrega solo alineaba principios. Se reabre únicamente esa parte del punto 1, preservando controles; baseline y alcance en 1.g. |
| 2026-10-25 | Punto 1, cierre de ampliación | Claude 17.853→3.925 bytes, tres bloques comunes intactos, 207 archivos protegidos sin cambios, ocho casos sintéticos pasados y paridad/status sin diferencias. Detalle y rollback en 1.g. Punto 2 pendiente. |
| 2026-10-25 | Punto 2, alcance cross-stack | Usuario pidió equivalencia entre clientes, fuente única por symlinks y auditoría de todos los canónicos. Relevados nueve overlays y capas globales; hallazgos y propuesta en 2.a–2.c. Solo diagnóstico/documentación; implementación pendiente de aprobación. |
| 2026-10-25 | Punto 2, aprobación y preflight | Usuario autorizó canónicos → capas de agentes en productos. Preflight detuvo antes de editar por drift previo VB/Gateway y links ausentes en Aggregator; composición Core distinguida de drift. Resolver reconciliación, no sobrescribir. Detalle en 2.d. |
| 2026-10-25 | Punto 2, cierre | Usuario autorizó reconciliar; 79 assets desplegados, nueve manifests pass, 259 assets contrastados, 81 headers/134 archivos protegidos intactos, 30 tests pasados. Reconciliadas guías anidadas VB, Gateway y links Aggregator. Resultado/rollback en 2.e–2.g. Punto 3 no iniciado. |

## Próxima acción

Reiniciar clientes y usar sesiones nuevas tras el addendum 2.i. Esperar indicación
para explicar/pulir punto 3; no ejecutarlo automáticamente. Nunca publicar productos
AUNE: solo canónicos. Usar ejemplos de desvío como regresión, sin atribuir causalidad
por adelantado ni confundir carga de skills con cumplimiento conductual.
