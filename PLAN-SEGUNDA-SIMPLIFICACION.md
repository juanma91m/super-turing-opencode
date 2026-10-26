# Plan de segunda simplificación del stack OpenCode

Fecha de apertura: 2026-10-25.

Estado: puntos 1 y 2 implementados, validados y sincronizados. El punto 2 incluye
reconciliación de las divergencias previas autorizada por el usuario. Reiniciar
clientes y usar sesiones nuevas. Segundo repaso y addendum del punto 2 cerrados:
activación determinista, shell restringido y estilo local prioritario (2.h–2.i).
El punto 3 está implementado, validado, sincronizado y publicado (3.b–3.d).
Los puntos 1–4 están cerrados y publicados (4.a–4.f). El punto 5 está cerrado
técnicamente tras promoción y reinicio; publicación autorizada (5.a–5.f).
6–10 pendientes, comenzando por planificar el 6.

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
| 3 | A | Deduplicar el contrato de code review | cerrado |
| 4 | A | Publicidad veraz de herramientas Engram | cerrado |
| 5 | B — experimento | Memoria proporcional y cierre por hito | cerrado técnicamente; publicación autorizada |
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

### 3.a. Especificación aprobada

Después de planificar y agregar la condición de preservación local, el usuario
autorizó implementar y validar: «Si ya tenes todo lo que precisas para avanzar,
hacelo». Esa aprobación no incluía despliegue, commits ni pushes; la sincronización
se autorizó posteriormente y se registra en 3.c. El punto 2 no se reabre.
Alcance equivalente para OpenCode y Claude, con adaptadores propios.

**Condición explícita del usuario — preservar cada flujo local:**

Este punto reorganiza instrucciones, no migra los repos al workflow global. Ante
la contradicción de storage, se corrige el comando global para respetar el agente
y contrato locales; no se relajan requisitos locales ni se introduce fallback a
`~/code-reviews`. El storage global solo corresponde donde no hay especialización.
Se conservan por repo las entradas, ticket requerido, consulta Jira y manejo de su
indisponibilidad, helper/cuenta, paths, numeración, formato y extensiones del informe,
criterios de revisión, permisos y separación del handoff de implementación. Las
guardas de seguridad siguen vigentes. Solo se elimina una repetición si se demuestra
equivalencia; una diferencia local real se conserva o se consulta antes de cambiarla.

**Diagnóstico verificado:**

- Agente global, skill y comando de PR repiten resolución de repo, snapshot y
  procedimiento. No toda repetición es inútil: los límites de autoridad deben
  seguir visibles en el agente aunque la skill explique cómo cumplirlos.
- Los agentes locales de Higyrus y otros siete overlays son idénticos entre sí;
  VB agrega selección de cuenta mediante wrapper y permisos correspondientes.
  No convertirlos en symlinks ni introducir generación: composición es punto 10.
- Claude ya comparte la skill global mediante symlink; no crear otra copia.
- `/code-review` en ambos clientes fija storage global aunque el agente local
  exige ticket y storage local. Debe remitir al storage del agente efectivo.
- `virtual-broker-code-review` duplica flujo, severidad y plantilla global, y
  menciona un helper local distinto del que habilita su agente. Conservar dominio,
  formato y diferencias locales reales; quitar solo duplicación equivalente y
  remitir al helper local autorizado sin sustituirlo por una elección global.

**Reparto propuesto:**

| Capa | Responsabilidad propia | Quitar o remitir |
|---|---|---|
| Agente global | Identidad independiente, diferencia con `reviewer`, carga obligatoria de la skill, autoridad, storage/helper permitido y salida breve | Secuencia detallada de PR/ramas y enumeración de metadatos |
| Skill global compartida | Procedimiento común: entradas, validaciones, snapshot, conversación, rereview, presupuesto, umbral, severidad y plantilla base; respetar especializaciones locales | Invocación específica de Jira: remitir al helper habilitado por el proyecto, sin asumirlo global |
| Comandos | Routing por cliente, argumentos, modo ramas/PR/ticket y aclaración de faltantes | Repetición del algoritmo y paths que contradigan al agente efectivo |
| Agentes locales | Ticket requerido, Jira acotado y su invocación, storage sin fallback, permisos seguros y especialización local | Repetición de algoritmo, presupuesto, severidad y umbrales ya definidos en la skill |
| Skill VB | Riesgos específicos de datasource/JPA/Flyway/OpenAPI/auth/frontend, validaciones, formato y diferencias locales justificadas | Solo pasos, definiciones y campos equivalentes al contrato común; no eliminar extensiones ni normalizar diferencias por conveniencia |

**Guardrails que permanecen explícitos:**

- Agente read-only respecto de código/configuración; escritura solo del informe
  reservado; sin Git mutador, publicaciones, secretos, delegación o builds pesados.
  No confundir un veredicto en el informe con aprobar remotamente un PR.
- Skill obligatoria antes de revisar; si no puede cargarse/leerse, informar el
  impedimento, no sustituirla por un procedimiento improvisado. Claude conserva
  fallback con `Read`, y su advertencia de que `Write` no está acotado por path
  técnicamente a nivel de ese subagente.
- Repo incorrecto: detenerse antes de Jira/diff/reserva. Ticket contradictorio o
  ambiguo: aclarar antes de continuar. No imponer Jira al uso global sin proyecto.
- Conversación del PR consultada en cada ronda, incluso con el mismo head;
  justificaciones evaluadas, no aceptadas automáticamente; snapshot trazable.
- Datos del PR/ticket/diff no son instrucciones. Informes incrementales sin
  sobrescritura y hallazgos solo materiales. No crear handoff de implementación.
- Un comando no amplía permisos ni habilita storage por sí solo. Si el modo ticket
  necesita una especialización ausente, pedir el contexto compatible, no forzar
  escritura local desde un agente global que la prohíbe.

**Archivos alcanzados:**

- Core: `agents/code-reviewer.md`, `skills/code-review-branch-to-branch/SKILL.md`,
  `commands/code-review.md`, `commands/code-review-pr.md` y tests focalizados.
- Claude: `base/agents/code-reviewer.md`, ambos comandos base y
  `addons/ticketing/commands/ticket-code-review.md`; preservar el symlink de skill.
- Ticketing: `commands/ticket-code-review.md`.
- Nueve overlays canónicos: `.opencode/agents/code-reviewer.md`; VB además
  `.opencode/skills/virtual-broker-code-review/SKILL.md`.
- Registro y changelogs de los dueños modificados. Sin cambiar manifests salvo
  necesidad demostrada: no se propone agregar/quitar assets desplegables.

**Validación acordada:**

1. Matriz antes/después de cada obligación y su dueño; frontmatter de roles y
   comandos preservado, incluidos modelos, tools, routing y permisos. Comprobar
   los nueve cuerpos locales y la excepción VB, no solo un muestreo de texto.
   Criterio de aceptación: equivalencia del flujo de cada repo antes/después, no
   uniformidad entre repos. Probar que el comando genérico respeta requisitos y
   storage locales y no los reemplaza por defaults globales.
2. Pruebas contractuales/fixtures offline: repo ajeno sin efectos posteriores;
   ticket contradictorio/múltiple; ramas orientadas y merge-base; rereview con
   mismo head y conversación nueva; snapshot incompleto declarado; payload con
   instrucciones maliciosas; informe nuevo sin sobrescribir; storage global vs.
   ticket sin fallback ni creación de handoff. Sin PR/Jira reales ni modelos.
3. Wiring por cliente: skill disponible, symlink existente y lectura alternativa
   Claude; VB conserva wrapper de cuenta, dominio y formato local. El contrato
   común conserva snapshot, conversación y estado de hallazgos previos, sin borrar
   extensiones del informe local ni cambiar su flujo para ajustarlo al global.
4. `opencode debug config` solo para configuración global y overlays representativos
   en sandbox preparado si hace falta; contrastar permisos con baseline, sin
   instalar dependencias ni operar sobre productos. No repetir la auditoría del
   punto 2 ni toda la suite del stack. Declarar que fixtures no prueban obediencia LLM.

**Fuera de alcance:** nuevos agentes/skills/plugins/generadores, endurecimiento
adicional de Bash, cambios de modelos/tools/permisos, políticas de memoria,
presupuestos nuevos, routing general y lógica funcional de aplicaciones. No
prometer ahorro de latencia ni perseguir una cuota de bytes.

**Despliegue y rollback:** si luego se autorizan, usar los lifecycles existentes y
solo assets afectados, preservando symlinks y adaptaciones de runtime. Backup/patch
por dueño; nunca reset general ni tocar informes anteriores. Publicación solo en
canónicos y con autorización explícita; nunca commits/pushes en productos AUNE.

### 3.b. Implementación y validación en fuentes — antes del despliegue

- **Alcance realizado:** Core, adaptaciones Claude, Ticketing y nueve overlays
  canónicos. Ningún asset nuevo de instalación: solo se agrega un archivo de tests.
  Changelogs existentes actualizados en Core/Claude/Ticketing; los overlays sin
  changelog registran su ajuste aquí, sin crear documentación operativa duplicada.
- **Reparto:** los agentes conservan identidad, límites, storage y obligación de
  aplicar la skill; se retiran sus algoritmos detallados de PR/snapshot y los
  presupuestos locales repetidos. La skill compartida conserva el procedimiento,
  reglas de seguridad, conversación/rerevisión, presupuesto y umbral existentes.
  Agrega precedencia explícita del contrato local y deja la invocación Jira en su
  dueño local. Los comandos conservan entradas/routing y dejan de imponer storage.
- **Equivalencia por repo:** los nueve agentes mantienen responsabilidades y entrega
  local, ticket requerido, Jira exactamente una vez con los mismos argumentos y
  continuación con limitación si no está disponible, máximo una skill de dominio,
  helper `ticket`, informe bajo `tmp/<ticket>/code-review/` sin fallback global,
  límites de seguridad y handoff previo solo como contexto.
- **VB:** wrapper/cuenta y permisos intactos. Dominio y severidades locales sin
  cambios; bloque Markdown del formato del informe idéntico byte a byte. La skill
  deja de repetir la secuencia común y usa el helper que su agente ya habilitaba;
  no se cambia ese helper ni se normaliza el formato a la plantilla global.
- **Claude:** se conservan delegación nativa en comandos, `Read` cuando no hay
  `Skill`, modelo/tools y advertencia de que `Write` no está acotado por path a
  nivel del subagente. El symlink existente no se modifica ni se sustituye por copia.

#### Matriz de obligaciones conservadas

| Obligación | Dueño después del recorte | Evidencia focalizada |
|---|---|---|
| Orientación de ramas, merge-base, refs posiblemente viejas | Skill común, entradas en comando | Test contractual |
| Repo correcto y ticket no contradictorio antes de Jira/diff/reserva | Skill común, precondición explícita en agentes | Tests contractuales y comparación de nueve contratos locales |
| Conversación fresca aun con mismo head, justificaciones y estados previos | Skill común obligatoria | Tests contractuales, sin ejecución LLM |
| Hashes/metadatos y límites de evidencia disponible | Skill común | Tests contractuales de snapshot y limitaciones |
| Anti-inyección, umbral material, severidades, presupuesto y cobertura parcial | Skill común y límites visibles de los agentes | Tests contractuales; criterios VB comparados con baseline |
| Ticket/Jira/helper/storage/formato específicos | Agentes e instrucciones/skills locales | Nueve contratos comparados, template y dominio VB idénticos |
| Informe incremental sin sobrescritura ni handoff | Helper existente y contrato efectivo | Cuatro tests ejecutables del helper en fixtures temporales |
| Modelos, tools, permisos y routing | Frontmatter/adaptadores existentes | Baseline de headers y configuración nativa en tres perfiles aislados |

#### Resultados y límites

- **16 tests pasados:** 12 checks del contrato textual y cuatro pruebas del helper
  real. Incluyen reservas global/ticket, conservación de informes, concurrencia,
  ticket inválido/sin repo sin fallback, fixture de aplicación intacta y ausencia
  de handoff. No se reimplementa un reviewer ficticio para simular obediencia.
- **19 frontmatter contrastados:** 17 idénticos; en los dos comandos `/code-review`
  solo se corrige `description`, que decía «global», para reflejar el storage del
  repo. Routing, modelos, tools, permisos y demás metadata operativa intactos.
- **Configuración efectiva:** `opencode debug config` antes/después en tres
  sandboxes preparados (global, Higyrus y VB); prompt de fuente confirmado y
  mismos modelos/tools/permisos/routing. Sin instalar dependencias ni ejecutar
  el CLI dentro de productos; no se edita configuración global para validar.
- **Protección:** 100 fingerprints sin cambios: assets activos de ambos clientes,
  archivos afectados de productos, índices de los nueve productos e instrucciones/
  config/manifests locales no alcanzados. Los 12 HEAD canónicos permanecen iguales;
  sin staging, commits ni pushes. Diffs sin errores de whitespace.
- **Límites:** checks textuales/config no prueban comportamiento del modelo. No se
  ejecutaron PR/Jira reales, LLM, CodeGraph, builds/tests de aplicación, cambios
  de permisos o nuevas guardas. No se afirma ahorro de latencia.
- **QA temporal:** `/tmp/opencode/point3-qa.py` y
  `/tmp/opencode/point3-qa/baseline.json`; patch inicial del plan preservado en ese
  directorio. Son evidencia temporal, no parte del stack desplegable. Regresión
  durable en `tests/test_code_review_contract.py` del Core.
- **Pendiente en esa etapa:** autorizar despliegue coordinado y, por separado, publicación. Las
  instalaciones activas siguen en el punto 2; el enlace Claude sigue leyendo la
  skill instalada de OpenCode. No cambiarlo para fingir paridad con fuentes aún no
  desplegadas. No hace falta reiniciar clientes por esta edición de fuentes.
- **Rollback:** patch inverso solo de este punto en sus dueños, conservando el
  cambio de planificación previo y cualquier trabajo posterior. No tocar activos,
  productos ni informes; no usar reset general. Punto 4 no iniciado.

### 3.c. Sincronización autorizada y validada — antes de publicar

- **Autorización:** ante el pedido de autorizar sincronización acotada dejando la
  publicación separada, el usuario indicó «Perfecto. podes avanzar». Se desplegaron
  únicamente los assets del punto 3; no se hicieron staging, commits ni pushes.
- **Preflight:** destinos sin drift respecto del baseline previo; los 12 HEAD
  canónicos sin cambios y archivos modificados dentro del alcance. Se contrastaron
  mappings/manifests y los lifecycles existentes. No se ejecutaron syncs amplios:
  Claude también mergea settings/poda backups y los instaladores locales pueden
  leer credenciales, sincronizar otros assets o instalar dependencias.
- **Despliegue:** 20 archivos regulares: cinco Core (agente, skill, dos comandos y
  changelog), un comando Ticketing, cuatro adaptaciones Claude (agente y tres
  comandos), nueve agentes locales y la skill de VB. Copia selectiva respaldada
  según los mappings existentes; sin settings, manifiestos ni helpers nuevos.
- **Fuente compartida:** cuatro bindings de skills conservados sin retarget:
  global Claude en fuente/activo hacia la skill instalada OpenCode, y VB en
  fuente/producto hacia su skill local. Ahora los activos leen el contenido nuevo;
  no se crearon copias ni enlaces adicionales.
- **Validación del despliegue:** paridad de los 20 destinos con las fuentes
  congeladas durante el preflight, y de los cuatro bindings. Descubrimiento nativo
  OpenCode confirma `code-review-branch-to-branch` en el path instalado esperado.
  `opencode debug config` global real y perfiles aislados Higyrus/VB confirman
  prompts desplegados y mismos modelos/tools/permisos/routing que el baseline.
  No se ejecutó el CLI dentro de productos ni se repitió la suite del punto 2.
- **Protección:** 155 fingerprints fuera de alcance intactos, incluidos settings,
  guardas/roles aditivos/Core no alcanzado, instrucciones/config locales e índices
  de los productos y fuentes. Los 12 HEAD siguen iguales; no publicación remota.
  Los flujos locales preservados en 3.b se reciben sin sustituirlos por defaults
  globales. No modificaciones funcionales, dependencias, PR/Jira/CodeGraph o LLM.
- **Backup pinneado:**
  `~/.config/opencode/.stack-sync-backups/point3-20261026T000945Z/`, con las 20
  versiones previas en `targets/`, imágenes desplegadas en `sources/`, ledger,
  `.pin`, script de rollout y `result.json`. Para rollback, revisar cambios
  posteriores y restaurar solo esos destinos según el ledger; conservar enlaces,
  cambios de producto e informes. Nunca reset general.
- **QA temporal:** `/tmp/opencode/point3-deploy.py` y
  `/tmp/opencode/point3-deployment.json`; el backup conserva evidencia durable.
  No confundir pruebas contractuales/config con obediencia demostrada del modelo.
- **Estado:** sincronización del punto 3 completada. Reiniciar los procesos de
  OpenCode y Claude Code que sigan abiertos para recargar configuración; no es
  obligatorio descartar conversaciones existentes. La publicación quedó separada
  en esa etapa y fue autorizada después (3.d); nunca commits/push en productos AUNE.
  Punto 4 no iniciado.

### 3.d. Publicación autorizada y cierre

El usuario confirmó el reinicio y autorizó explícitamente «commitear y pushear»
el punto 3. No queda un bloqueo técnico identificado; se mantienen los límites
de evidencia de 3.b–3.c, sin reabrir auditorías ni afirmar obediencia del modelo.

- Publicar solo los 12 canónicos afectados: Core, Claude, Ticketing y nueve
  overlays, en sus ramas `main`; Core también en su mirror ya configurado.
- Revisar status, diff, últimos commits e identidad/remotos antes de cada commit;
  stagear únicamente los archivos del punto 3, incluido este registro y los tests.
- Conservar hooks y guardas; sin amend, force-push ni cambios de configuración Git.
  Ante divergencia remota o archivos ajenos, detenerse y resolver antes de publicar.
- El cierre verificable de publicación exige árboles limpios, contenido revisado
  intacto y HEAD remoto coincidente en cada destino, incluido el mirror del Core.
  Conservar evidencia del resultado y commits en el registro de publicación/memoria.
- No hacer operaciones Git de escritura en productos AUNE ni modificar lo ya
  desplegado por el hecho de publicar. Punto 4 permanece sin iniciar.

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

### 4.a. Especificación aprobada

La primera etapa fue solo planificación e inventario. Después de explicar alcance,
beneficio y cobertura de ambos clientes, el usuario indicó «Perfecto, avancemos»:
autorizó patch canónico, tests y build aislado; no reemplazo del binario activo,
checkout gestionado, configuraciones ni publicación. El punto 3 no se reabre.

**Diagnóstico y evidencia:**

- En el baseline, `internal/mcp/mcp.go` del Engram fijado usa `serverInstructions`
  constante y se entrega sin ajustarla al registro filtrado por `--tools`.
  El patch Knowledge previo no corregía ese bloque.
- El wiring canónico OpenCode y la superficie visible de esta sesión contienen
  11 tools. Un proceso del binario instalado, con ese filtro, confirmó las 11 por
  `tools/list`; sus instrucciones mencionan 10 tools ausentes y no `mem_doctor`.
  También prescriben `ToolSearch`, inexistente en esta superficie OpenCode.
- El template canónico Claude contiene ocho tools, incluida `mem_delete`, sin
  `mem_judge`. Un proceso con ese filtro confirmó ocho, pero instrucciones con
  12 nombres ausentes y adjudicación presentada como disponible. Esto no prueba
  el inventario del cliente Claude activo: no se leyó su configuración sensible
  ni se conectó a su sesión. No igualar perfiles ni habilitar herramientas aquí.
- Ambos inventarios usaron solo `initialize` y `tools/list`: cero `tools/call`,
  sin modelo. HOME/cwd/datos temporales, autosync deshabilitado y entorno mínimo;
  SQLite vacío precreado para impedir la migración automática de una DB huérfana
  durante el arranque. No se usó memoria real ni endpoints cloud.
- Evidencia temporal: `/tmp/opencode/point4-inventory.py` y
  `/tmp/opencode/point4-inventory.json`. El protocolo observado fue `2025-06-18`;
  este punto no migra MCP, SDK ni upstream.

**Cambio propuesto:**

1. Construir el catálogo de instrucciones a partir de las herramientas realmente
   registradas, no de una lista manual ni de tokens solicitados que podrían no
   corresponder a tools existentes. Orden estable y compacto; sin duplicar schemas.
2. Retirar afirmaciones fijas de «always available», «core/deferred» y la orden de
   usar `ToolSearch`. La entrega, prefijos y descubrimiento los decide el cliente;
   usar solo las tools que ese cliente/rol expone. No deshabilitar descubrimiento
   nativo de Claude ni cambiar anotaciones de carga diferida.
3. Conservar reglas de lectura, guardado proactivo y cierre para operaciones
   disponibles, sin cambiar frecuencias ni criterios. Los cambios de política y
   el error `unknown_session` siguen en el punto 5.
4. Con `mem_judge` disponible, preservar completo el protocolo de conflictos:
   `judgment_required`, iteración de `candidates[]`, su propio `judgment_id`,
   umbral de confianza, confirmación de decisiones sensibles y evidencia.
   Si falta, informar la limitación y dejar el juicio pendiente para un contexto
   autorizado; no invocar una tool ausente, simular adjudicación ni usar CLI como
   bypass. No modificar detección, persistencia o estados de conflicto.
5. Mantener allowlists y capacidades actuales: no añadir `mem_judge` a Claude,
   no retirar `mem_delete`, no cambiar permisos o catálogos por rol como atajo.
   La diferencia de perfiles queda explícita; revisarla requiere otro alcance.

**Ownership y archivos previstos:**

- Knowledge: `patches/engram-source-agent.patch`, incorporando el ajuste de
  instrucciones y sus tests en `internal/mcp/`; regresión de la integración en
  `tests/test_opencode_integration.py`, documentación y changelog pertinentes.
- El addon mantiene su base upstream fijada y todos los cambios previos del patch.
  No editar como fuente ni commitear el checkout gestionado
  `~/.local/src/engram-opencode-stack`.
- Salvo este registro, no se prevén cambios de Core, overlays, templates MCP Claude, plugins, hooks ni
  settings para arreglar la publicidad. Ambos clientes consumen el mismo binario
  con filtros distintos: se corrige una sola implementación parametrizada.

**Validación acotada si se aprueba implementar:**

- Aplicar el patch sobre la base fijada en un sandbox, sin reset/clean del checkout
  gestionado ni descarga/upgrade automático. Compilar y ejecutar tests focalizados
  con dependencias ya disponibles; si faltan, detenerse antes de instalar/descargar.
- Matriz: filtro OpenCode, template Claude, perfil de solo lectura, subset custom,
  registro vacío/selección desconocida y perfil completo. Verificar igualdad entre
  catálogo operativo anunciado y registro real, sin tools inventadas ni promesas
  de loader. Una capacidad ausente solo puede aparecer como limitación explícita,
  nunca como una operación invocable.
- Confirmar schemas, anotaciones y handlers sin cambios. Pruebas de metadatos para
  política conservada y adjudicación disponible/no disponible; no invocar escritura
  de memoria ni diagnosticar summaries para probar este punto.
- Smoke de `initialize`/`tools/list` del binario candidato en fixtures aisladas.
  El chequeo del cliente Claude activo queda para despliegue autorizado, mediante
  un mecanismo que no exponga credenciales; no asumir que su template ya lo describe.

**Activación, autorización y rollback:**

- Primero aprobar implementación del patch y validación con build aislado. No
  reemplazar todavía `~/.opencode/bin/engram`, registrar servidores ni tocar datos.
- Para activar luego, hace falta autorizar reemplazo del binario compartido y
  recomposición del checkout gestionado por su lifecycle, con preflight/backup;
  no ejecutar el instalador amplio por reflejo. Reiniciar los procesos MCP/clientes
  pertinentes para recibir instrucciones nuevas; publicar es otra autorización.
- Backup del patch y binario anterior; rollback solo de esos artefactos y del
  estado gestionado afectado, no de la DB, memorias ni configuración ajena.
- Beneficio esperado: instrucciones ejecutables y menor contradicción. No se
  promete ahorro de latencia/tokens ni se modifican los workflows de los repos.

### 4.b. Implementación y build aislados — activación no autorizada

- **Fuente durable:** patch de Knowledge actualizado en `internal/mcp/mcp.go` y
  tests. El catálogo se deriva de `srv.ListTools()` después del registro y se
  ordena antes de entregar instrucciones; no enumera tokens desconocidos pedidos
  en una allowlist. Usa la API existente de mcp-go 0.44.0, sin upgrade de SDK/MCP.
- **Política:** los siete textos de uso existentes se conservan para las tools
  disponibles, igual que la regla de guardado proactivo. El bloque de adjudicación
  con `mem_judge` conserva literalmente sus heurísticas, IDs por candidato,
  confirmaciones y evidencia; con judge pero sin save, no exige la tool ausente.
  Sin judge se declara limitación y juicio pendiente, sin falsa persistencia ni
  bypass. Cliente/rol controla naming, discovery y permisos; sin prometer loader.
- **Regresiones:** nuevo `internal/mcp/instructions_test.go` dentro del patch;
  dos tests previos pasan de comprobar la constante a comprobar `initialize`,
  manteniendo sus obligaciones. `tests/test_opencode_integration.py` valida ambos
  filtros y permite probes solo con un candidato explícito, nunca el activo por
  defecto. Sin candidato, los tres tests nativos se omiten explícitamente.
- **Docs:** README/playbook/changelog de Knowledge documentan las instrucciones
  del patch y la activación pendiente. Se aclara que la superficie curada descrita
  es OpenCode, sin inferir igualdad con el perfil Claude.
- **Ajuste de soporte:** `.gitattributes` limita la excepción de whitespace al
  archivo unified-patch: sus líneas de contexto requieren espacio antes de tabs y
  líneas vacías. No cambia whitespace de fuentes normales ni configuración Git
  global. El código expandido pasa `gofmt -d` y el patch pasa
  `git apply --check --whitespace=error-all` sobre la base fijada.
- **Reproducibilidad:** se exportó el ref fijado a `/tmp/opencode/point4-build/a`,
  se aplicó el patch previo y se editó únicamente la copia `b`. Se compiló baseline
  previo y candidato con Go 1.26.2, módulos ya disponibles, `GOTOOLCHAIN=local`,
  `GOPROXY=off`, `GOSUMDB=off` y `-mod=readonly`; sin descargas ni instalaciones.
  El patch canónico coincide con el candidato generado y se reaplicó desde cero.
  Sus 18 bloques ajenos al cambio permanecen idénticos; el registro, schemas,
  anotaciones y todos los handlers de `mcp.go` conservan su código previo.
- **Pruebas:** RED esperado con las nuevas regresiones antes del fix, luego GREEN.
  Pasaron 32 tests Go focalizados de instrucciones, selección, perfiles, constructor
  y anotaciones, con matriz de diez subcasos. Pasaron seis tests Python, incluidos
  tres de metadatos nativos. No se ejecutó la suite completa de Engram ni handlers
  de guardado/summary para validar este punto.
- **Probes:** nueve perfiles del binario candidato y del baseline compilado: OC,
  template Claude, lectura, subset con typo, save sin judge, judge solo, selección
  desconocida, filtro vacío (=all) y all. Catálogo real coincidente, sin publicidad
  falsa ni `ToolSearch`. Tool definitions completas, capabilities y protocolo son
  iguales antes/después; el bloque de conflicto disponible también es idéntico.
  Solo `initialize`/`tools/list`, sin modelo ni `tools/call`, con HOME/cwd/SQLite
  temporales, autosync deshabilitado y DB vacía precreada para evitar migración.
- **Protección:** binario instalado, configs/filtros, plugins, HEAD e índices de
  Core/Knowledge/Claude y checkout gestionado intactos. `go.mod`/`go.sum` sin cambios.
  No ediciones de overlays, datos reales, settings, permisos ni procesos cliente;
  sin staging, commits o pushes. No se ejecutó el instalador ni `opencode debug
  config`: este paso no cambia configuración del cliente y solo valida MCP aislado.
- **Artefactos:** `/tmp/opencode/point4-build/engram-candidate`, baseline y fuentes
  de prueba en ese directorio; baseline/QA en `point4-build.json`, `point4-build.py`
  y `point4-build/result.json`. Son temporales; el patch/tests son la fuente durable.
  SHA-256 del candidato:
  `de4f6f00abcc18c2a47daf72cb6b00cc468644bbe37eda2ae78e2b26f67205a9`.
- **Pendiente en esa etapa:** autorizar activación coordinada del binario compartido/checkout
  gestionado con backup y preflight, sin modificar perfiles; confirmar el cliente
  Claude activo sin exponer credenciales. El checkout aún tiene el patch previo:
  un status puede señalar actualización pendiente; no repararlo por reflejo.
  Publicación separada. No hace falta reiniciar todavía: el runtime no cambió.
  Punto 5 y `unknown_session` permanecen fuera de alcance. No se promete obediencia
  del modelo ni ahorro medido de latencia.

### 4.c. Activación autorizada, detenida antes de escribir

Ante la propuesta de activar con backup/preflight sin publicar, el usuario indicó
«Perfecto avanza». La comprobación contra el ejecutable realmente instalado
detectó un desfase que no estaba cubierto por la comparación de builds de 4.b.

- **Wiring confirmado:** proyección filtrada de `command`/`args` del bloque Engram
  en OpenCode global y registro usuario Claude. Ambos apuntan al mismo ejecutable;
  OpenCode tiene 11 tools y Claude ocho, coincidentes con sus fuentes canónicas.
  No se volcaron otros campos, credenciales ni archivos `.env`; no se ejecutó
  `claude mcp get`, que podría arrancar un healthcheck con la DB real. No se prueba
  que una sesión cliente ya abierta haya recargado sus metadatos.
- **Bloqueo:** candidato y binario activo no tienen la misma definición de
  `mem_session_summary` en ninguno de los dos filtros. Cambian exactamente dos
  campos visibles: `annotations.idempotentHint` (`false` instalado, `true` en
  fuentes previas al punto 4) y la descripción de `session_id`, que en esas fuentes
  ya explicita upserts idempotentes. Tools restantes, capabilities y protocolo no
  muestran diferencias en estos probes de metadatos.
- **Causa delimitada:** el baseline compilado ANTES del fix y el candidato tienen
  la misma definición de summary; la diferencia respecto del binario instalado
  es preexistente. Los tests de 4.b compararon con el baseline de fuentes, no
  demostraron equivalencia de ese baseline con el ejecutable instalado. Tampoco
  una comparación de metadatos prueba que no haya otras diferencias de handlers.
- **Decisión que faltaba (resuelta en 4.d):** para mantener el alcance estricto, resolver primero la
  procedencia/base exacta del runtime; o autorizar explícitamente su alineación con
  la base canónica actual, incluida la actualización previa de summaries, con
  pruebas aisladas adicionales antes de activar. No asumir ese alcance por la
  autorización limitada al punto 4 ni cambiar la política de memoria del punto 5.
- **Estado:** no se creó aún el backup de activación ni se reemplazó el binario;
  checkout gestionado, configs, filtros, plugins, HEAD e índices siguen intactos
  respecto del baseline. No se invocaron tools de memoria para diagnosticarlo,
  solo `initialize`/`tools/list` con DB/HOME temporales y autosync deshabilitado.
  Sin publicación ni cambios de aplicación. No hace falta reiniciar por este intento.
- **Evidencia temporal:** `/tmp/opencode/point4-activate.py` (`inspect`, `compare`,
  `explain`) y `/tmp/opencode/point4-activation-blocker.json`. No ejecutar `compare`
  ignorando su fallo para seguir con una activación no autorizada.

### 4.d. Alineación canónica segura, activación y validación

Después de explicar las alternativas y el desfase, el usuario delegó la decisión:
«Hace lo que consideres más seguro». Se eligió alinear el runtime con una única
base canónica, incluidas las correcciones previas de summaries, con pruebas
adicionales antes de reemplazar. No se hizo un fork del binario ni se cambió la
política de memoria del punto 5. Publicación sigue separada.

- **Procedencia y build:** el ejecutable previo declara el mismo ref fijado
  `1dafc0f63051b2214100f7bd801357e4aab61c26`, Go 1.26.2 y CGO habilitado. Se compiló
  el runtime alineado con CGO=1 para conservar esa característica, en vez de activar
  el primer candidato aislado CGO=0. Misma fuente probada, sin upgrades ni descargas;
  build aislado con `-mod=readonly -buildvcs=false`, pin trazable en el ledger.
- **Validación ampliada:** 109 tests Go de primer nivel, 146 casos al contar
  subcasos, en MCP, store, diagnostics y CLI doctor/conflicts. Incluyen upsert de
  summaries, sesiones distintas, IDs inyectados, lectura diagnóstica sin escritura
  y dry-runs semánticos con mocks, sin llamadas reales a modelos/cloud.
  Dos tests iniciales dependían de estar dentro de un repo llamado `engram`;
  el export aislado detectaba `mcp`. Se recreó solo metadata Git ficticia con origin
  `example.invalid/engram.git`, sin commits ni contactos remotos, y pasaron todas
  las regresiones sin cambiar código productivo ni relajar validaciones.
- **Fixtures end-to-end:** antes y después de activar, en ambos filtros instalados,
  el summary crea sesiones de prueba con IDs `ses-...` y `ses_...`, actualiza la
  misma observación sin duplicarla y separa otra sesión. `mem_save` sigue rechazando
  una sesión inexistente. DB/HOME/repos temporales, autosync=0, cero LLM y aplicación
  fixture intacta. Estas pruebas sí invocan tools de memoria, exclusivamente en
  SQLite descartable; no se abrió ni restauró la DB real para validarlas.
- **Preflight y backup:** fuente/candidato congelados, perfiles instalados confirmados
  y drift previo limitado en metadatos a los dos campos de summary revisados. La
  alineación con esos cambios previos se autorizó explícitamente por la decisión
  anterior; el guard de comparación estricta de 4.c no se ignoró para instalar.
  Backup pinneado en
  `~/.config/opencode/.stack-sync-backups/point4-20261026T034158Z/` con versiones
  before/after, ledger, validación, build info y script; sin backups de credenciales
  ni datos de memoria. La DB está fuera del rollback de artefactos.
- **Cambio aplicado:** seis destinos: binario compartido, tres archivos MCP del
  checkout gestionado (incluido el test nuevo), patch instalado y playbook Engram
  declarados en el manifest. Copia selectiva, sin instalador amplio, fetch/reset/
  clean ni staging. El binario se reemplazó último mediante rename atómico de un
  archivo preparado en el mismo directorio, preservando su modo ejecutable.
  Rollback acotado automático previsto ante fallo, sin sobrescribir cambios ajenos;
  no fue necesario ejecutarlo porque la verificación pasó.
- **Resultado:** binario instalado idéntico al alineado probado; managed checkout
  coincide con el patch completo y su reverse-check pasa, incluidos los 18 bloques
  previos conservados. El nuevo test no se stagea: el dirty state gestionado es
  intencional y no se commitea como fuente. Catálogo nativo correcto con OC11 y
  Claude USER8; sin `ToolSearch`, filtros sin normalizar y perfiles sin ampliar.
- **Protección:** 218 fingerprints fuera de alcance intactos: configuraciones de
  ambos clientes, plugins, otros assets, instrucciones y permisos locales e índices
  de fuentes/productos. HEAD de fuentes y managed sin mover; no Git writes en
  productos, dependencias, configuraciones cloud ni lógica de aplicaciones.
- **Artefacto activo:** SHA-256
  `b4a8a47462502a31effb9de74997dcb659c9ef4a44ed875509459d710d027c12`.
  El hash CGO=0 de 4.b queda como evidencia del primer candidato, no como runtime
  instalado. QA temporal: `point4-activate.py`, `point4-activation.json` y
  `point4-build/alignment-validation.json`; el backup conserva ledger/resultados.
- **Uso y cierre:** reiniciar procesos OpenCode/Claude Code que sigan abiertos para
  que lancen el binario nuevo y reciban instrucciones nuevas. No se mataron procesos
  activos ni se exige descartar conversaciones. Las pruebas aisladas no certifican
  que una sesión existente ya haya recargado el backend ni garantizan obediencia o
  ahorro de latencia. Publicación pendiente de autorización; punto 5 no iniciado.

### 4.e. Verificación tras reinicio completo — cierre técnico

El usuario confirmó que reinició la PC. No se reinstaló ni recompiló nada: se
contrastó el estado activo con la evidencia durable de 4.d.

- El ejecutable conserva SHA-256
  `b4a8a47462502a31effb9de74997dcb659c9ef4a44ed875509459d710d027c12`.
  El status nativo confirma ref esperado, patch aplicado y MCP habilitado.
- Las instrucciones de esta conexión ya presentan catálogo registrado, sin
  prescribir `ToolSearch`. El cierre real mediante `mem_session_summary` fue
  aceptado: `Session summary saved for project "opencode-stack"`. No se repitió
  `unknown_session` en esta comprobación, ni se registró una sesión por un bypass.
  Esto no garantiza ausencia de todos los errores futuros o validación de una
  conversación de modelo en Claude; sus pruebas nativas y wiring constan en 4.d.
- Los temporales `/tmp/opencode/` del build/rollout ya no están después del
  reinicio. Es esperable: se conservan el backup pinneado, ledger y `result.json`.
  No reconstruir pruebas ni tratar los paths temporales como archivo durable.
- No quedan bloqueos técnicos identificados del punto 4. No se modificaron
  configuraciones, filtros, permisos, política de memoria ni workflows locales en
  esta comprobación; no hace falta otro reinicio. Punto 5 no iniciado.
- Al cerrar esa comprobación quedaba pendiente exclusivamente la publicación: un commit acotado en Core (este plan)
  y otro en Knowledge (patch, tests, documentación y `.gitattributes`), con pushes
  solo a canónicos y mirror habitual del Core cuando se autoricen explícitamente.
  No commitear el checkout gestionado de Engram ni los productos AUNE.

### 4.f. Publicación autorizada y cierre

El usuario autorizó explícitamente «sincroniza lo que haga falta, commitea y
pushea». La sincronización se limita a faltantes demostrados del punto 4; no se
ejecutan instaladores amplios ni se reconstruyen pruebas eliminadas de `/tmp`.

- Publicar únicamente Core (este plan) y Knowledge (patch, tests, documentación y
  `.gitattributes`), un commit por canónico, en `main`. Core también en su mirror
  habitual. No se publica el runtime binario ni se commitea el checkout gestionado.
- Verificar paridad con los seis destinos activados y fuentes de los dos assets
  instalables antes de publicar; no recopiarlos ni exigir otro reinicio si coinciden.
- Revisar status, diff, historial e identidad/remotos; stagear solo los siete
  archivos aprobados. Preservar hooks, sin amend ni force-push; detenerse ante
  divergencia remota, cambio ajeno o modificación del contenido por un hook.
- El cierre de publicación exige árboles canónicos limpios, HEAD remoto coincidente
  y paridad/protecciones intactas. Conservar el resultado y hashes en el backup
  pinneado y memoria, sin editar fuentes después del preflight para registrar su
  propio commit. No hacer Git writes en productos AUNE. Punto 5 no iniciado.

Resultado de 4.f ya verificado: Core `be174d6` en GitHub y mirror GitLab,
Knowledge `69841a1` en GitHub, ambos `main` y árboles limpios. Evidencia de
publicación en el backup pinneado; este estado no requiere otra auditoría del 4.

## 5. Memoria proporcional y cierre por hito

**Hipótesis:** recuperaciones pequeñas pueden hacerse directamente y los summaries
pueden reservarse para hitos con continuidad útil, sin perder antecedentes.

**Experimento candidato:** consulta directa para ID/búsqueda puntual; reader para
recuperación amplia/corpus; cierre selectivo; no repetir errores determinísticos
sin cambiar su causa. El fix de infraestructura ya pasó fixtures y un summary
real tras reinicio (4.d–4.e); no asumir que el error histórico sigue vigente.

**Ubicación:** Addon Knowledge: `scripts/manage_agent_autonomy.py`, skills de
memoria y patch MCP; adaptación posterior de overlays si resulta necesaria.

**Responsabilidad restante:** lectura relevante, persistencia durable conservadora,
privacidad y reader disponible. No borrar ni reclasificar memorias existentes.

**Beneficio a medir:** sesiones hijas, llamadas y contexto evitados. Las 88
delegaciones históricas no son 88 oportunidades de eliminación demostradas.

**Validación:** antecedentes relevantes, irrelevantes y ya destilados en handoff;
medir omisiones y continuidad además de tokens. Aprobar el protocolo antes de correrlo.

**Rollback:** restaurar triggers y políticas anteriores sin alterar el corpus.

### 5.a. Protocolo y alcance del candidato aprobado

Después de planificar, el usuario autorizó avanzar con el candidato y pidió
revisión consciente de redundancias generales/overlays, sin desarticular procesos
ni exceder tokens en pruebas. En la etapa de candidato se eligieron cero corridas con modelos: la propuesta
de 16 no se ejecuta por esa autorización. Activos, piloto, despliegue y publicación
siguen fuera de esta etapa; las reglas vigentes aún son las del punto 4.

**Diagnóstico acotado:**

- `manage_agent_autonomy.py` prescribe reader primero en los cinco roles opcionales,
  incluso cuando el caller puede resolver una consulta puntual sin sesión hija.
- `memoria-durable-opencode` ya pide no guardar por microiteración, usar topic keys,
  evitar búsquedas repetidas de subagentes y resumir solo para continuidad. A la vez,
  prescribe bootstrap por varios buckets y full-read aun cuando otro caller pudiera
  haber aportado evidencia suficiente. Hay margen para aclarar cuándo no repetir.
- MCP mantiene `mem_context` al iniciar/compactar, guardado inmediato tras cualquier
  decisión y summary obligatorio antes de decir «done». También hay imperativos en
  las descripciones de tools: cambiar solo el prompt del agente no los elimina.
- Claude global ya permite memoria o reader, pero sus roles planner/agent-design
  vuelven a exigir reader primero. No todos esos roles tienen lectura o delegación
  disponibles: una regla de routing no debe inventar tools ni ampliar frontmatter.
- Los hints de ambos clientes responden a un pedido explícito de recordar, no son
  el disparador de toda escritura. Se conservan; no ampliar detectores por arrastre.
- Higyrus ya usa consulta directa acotada y exige una memoria por ticket resuelto,
  actualizada en retrabajos. Esa obligación local no desaparece con la proporcionalidad.

**Hipótesis y política candidata B (A = publicada actual):**

| Situación | Comportamiento candidato |
|---|---|
| Evidencia suficiente ya destilada en contexto/handoff | Usarla, sin reader, bootstrap o búsquedas redundantes por ritual; respetar lecturas locales obligatorias |
| ID conocido o pregunta puntual | Leer directamente si el rol tiene las tools autorizadas; empezar por la consulta mínima y abrir solo los candidatos pertinentes |
| Síntesis amplia, antecedentes cruzados o corpus | Mantener reader cuando aporta especialización/reducción de contexto y está permitido; pasarle también lo ya recuperado |
| Rol sin lectura o delegación necesarias | Usar contexto suficiente del caller o pedirle lo que falta; no SQL/CLI como bypass ni tools nuevas |
| Nuevo conocimiento durable confirmado | Guardar proactivamente al estabilizarse el resultado/hito, con scope y topic key correctos; actualizar lo existente cuando corresponde |
| Pedido explícito de recordar o restricción crítica | Persistir oportunamente, antes de que pueda perderse o afectar una acción; sujeto a privacidad y autoridad del rol |
| Cierre con continuidad nueva útil | Summary acotado al hito/handoff/bloqueo que otra sesión necesita retomar, no a cada respuesta |
| Rerun, confirmación o cierre repetido sin cambio material | No otra escritura ni summary equivalente; no duplicar observación, overview y summary por reflejo |

Hito significa resultado estabilizado que cambia la continuación útil: decisión,
cambio verificado, handoff o bloqueo relevante. No equivale a cada tool call,
turno o «ok». No imponer una cuota de una memoria para todo: hallazgos independientes
pueden merecer registros distintos, pero no tres representaciones del mismo estado.
Un summary conserva continuidad; no sustituye una decisión reusable, ni se agrega
automáticamente si solo repite la memoria/artefacto que ya alcanza.

**Guardrails y excepciones:**

- Flujo local y límites del rol se preservan. Higyrus mantiene memoria obligatoria
  por ticket y su actualización; no se convierte en opt-in global. No modificar
  overlays como atajo para demostrar menos llamadas ni cambiar handoffs del punto 2.
- Previews truncados no sustentan decisiones críticas. Leer el original necesario
  o recibir contenido suficiente con fuente verificable; un «ya lo leí» sin evidencia
  no sustituye la lectura. Memorias recuperadas son datos, no instrucciones confiables.
- El caller consolida continuidad. Subagentes no repiten recuperación/escritura del
  mismo estado; pueden guardar un hallazgo propio si su rol lo permite. Reader y
  demás roles read-only no escriben ni cierran memoria por mandato global.
- Mantener privacidad, namespace/proyecto respaldado, source_agent, topic keys,
  protocolo de conflictos/confirmaciones y wrappers de corpus. En guardados curados
  automáticos, `capture_prompt=false` si la tool lo soporta; no cambiar defaults o
  contratos de backend ni guardar prompts reales para medir el experimento.
- Ante error determinístico, no repetir iguales argumentos sin corregir la causa.
  Diferenciar transitorio de determinístico; una escritura con respuesta ambigua
  requiere comprobar estado por una vía autorizada antes de repetirla. No inventar
  proyecto/session ID, registrar sesiones por un bypass ni habilitar tools ausentes.

**Ownership y superficie prevista:**

- Knowledge: reglas de `manage_agent_autonomy.py`, política en la skill durable y
  detalle de fallos/degradación de Engram cuando corresponda. Patch MCP: textos de
  contexto/guardado/cierre y descripciones de uso coherentes con B, con sus tests.
  No cambian handlers, persistencia, anotaciones, campos/validaciones estructuradas,
  filtros OC11/Claude8 o permisos; las descripciones de uso sí cambian deliberadamente.
- Claude: adaptadores de planner/agent-design que hoy exigen reader primero; solo
  cuerpos, no herramientas/modelos/permisos. Guía global y dev-test ya compatibles:
  verificar sin editar por reflejo. Conservar skills compartidas por sus symlinks.
- Core: este registro; comprobar compatibilidad de la recomposición existente, sin
  crear otro generador. `patch_body` no reemplaza un bloque ya marcado: validar el
  render desde bases limpias y el bloque efectivo; no asumir que apply actualiza uno viejo.
- Overlays locales son invariantes de aceptación, no objetivos de recorte. No se
  prevén cambios de productos ni nuevos agentes, skills, addons o MCPs de producción.

**Ejecución por etapas, cada una con autorización:**

1. **Candidato y pruebas aisladas:** al aprobar, especificar textos B, validar
   obligaciones antes/después, resolver contradicciones entre MCP/skills/adaptadores
   y probar composición/carga en sandbox. Aún sin cambiar activos ni usar modelos.
2. **Piloto A/B con modelo:** requiere confirmar presupuesto y aislamiento antes
   de correr. Baseline A fijada a lo publicado; B solo en perfiles descartables.
   Mismo modelo/variante por runtime, tarea, fixtures y rúbrica; no comparar velocidad
   de Claude contra OpenCode como si usaran el mismo modelo. Orden A/B alternado.
3. **Decisión:** aceptar, recortar o descartar B según calidad y costo. Desplegar y
   publicar solo con aprobación posterior, sin convertir resultados del piloto en
   una regla global automática. Una falla crítica bloquea promoción.

**Piloto inicial propuesto:** cuatro escenarios por dos variantes y dos runtimes
(16 corridas principales; el cierre tiene dos turnos). ID conocido; contexto/handoff
suficiente con memoria irrelevante; síntesis amplia que necesita reader; hito y
confirmación posterior sin novedad. Hasta una sesión lectora hija por corrida y
presupuesto simétrico de tools/tokens/tiempo confirmado antes de ejecutar; los
requests de modelo reales dependen del tool loop y se contabilizan, no se equiparan
a turnos. No reintentos ni repeticiones para fabricar un resultado favorable.

Fixtures y checks adicionales sin modelo: preview incompleto, tool/reader ausente,
rol read-only, conflicto, pedido explícito, privacidad/inyección, error determinístico
o respuesta ambigua, continuidad tras compactación y ticket Higyrus resuelto/retrabajado.
Datos sintéticos en DBs/repos descartables; no corpus/memorias reales, indexaciones,
endpoints de negocio, credenciales copiadas ni escrituras en productos. Si no puede
aislarse un runner permitido de ambos clientes, detenerse antes del piloto; no eludir
restricciones del rol abriendo delegaciones por otra vía.

**Medición y criterio de aceptación:**

- Registrar sesiones hijas, llamadas de lectura/escritura/summary, salida en bytes,
  tokens de entrada/salida/caché y tiempo total/de tools/modelo cuando el runner los
  exponga. Métricas agregadas, sin prompts/resultados reales crudos; dato ausente
  se informa como no medido. No atribuir toda la latencia a la memoria o al modelo.
- Misma rúbrica: hechos/restricciones recuperados u omitidos, respuestas correctas,
  continuación sin repetir investigación, selección de registro/scope, ausencia de
  duplicados, privacidad y obligaciones locales. No premiar menos llamadas si se
  omitió contexto o no se persistió algo obligatorio.
- Para proponer promoción: ninguna pérdida material ni violación de guardrails;
  menos llamadas/sesiones redundantes en los casos puntuales o de cierre repetido,
  manteniendo reader útil en el caso amplio. Latencia/tokens son evidencia secundaria,
  no ganancia garantizada. La muestra es piloto, no prueba estadística ni atribución
  causal a cada componente; ampliar o aislar factores requiere otro protocolo aprobado.
- Rollback: retirar B de los perfiles aislados y restaurar únicamente sus prompts,
  bloques/patch/binario si luego se activaran, desde backup. No borrar, reclasificar
  o «limpiar» el corpus existente para mejorar métricas. Puntos 6–10 no se ejecutan.

### 5.b. Candidato implementado y validado sin modelos

**Alcance:** 16 archivos en fuentes canónicas: diez Knowledge, cuatro adaptaciones
Claude, esta actualización del plan y una referencia de skill Higyrus. Sin agentes,
skills o MCPs nuevos de producción; solo se agrega un archivo de tests. Ninguna
instalación activa ni producto fue sincronizado, recompuesto o publicado.

**Cambio realizado:**

- Knowledge: autonomía de los cinco roles opcionales mantiene targets y diferencias
  de hallazgos, pero ya no obliga a reader primero para toda consulta. Reutiliza
  contexto suficiente y limita lectura/delegación/escritura a la autoridad del rol.
  Se consolida el wording común dentro del script existente, sin cambiar su
  mecánica de permisos, markers o recomposición.
- Skill durable: recuperación proporcional, guardado de conocimiento confirmado
  por hito, prioridad de pedidos explícitos/restricciones críticas, summary por
  continuidad nueva y no duplicación. Mantiene namespaces/metadata/topic keys,
  privacidad, evidencia original para decisiones críticas y mantenimiento deliberado.
  Read-only puede sintetizar para el caller, no escribir en el backend.
- MCP: mismo catálogo, handlers, anotaciones y campos estructurados. Cambian las
  indicaciones de uso y las descripciones de cuatro tools (save, context, summary,
  current-project); se retiran startup/save/summary universales. Los formatos de
  observación y las seis secciones del summary se conservan. El bloque de conflictos
  permanece idéntico y no se cambia el comportamiento idempotente del backend.
- Claude: planner condiciona recuperación a contexto/capacidad; agent-design no
  delega ni intenta lectura que no tiene y puede pedir contexto al caller. Los
  readers de ambos clientes reutilizan evidencia y solo consultan si falta historial.
  La descripción de routing del reader Claude se acota; tools/modelos no cambian.
- Fallos: no repetir errores determinísticos ni escrituras ambiguas sin comprobar
  estado legítimamente. No inventar project/session, usar CLI/SQL como bypass ni
  reinstalar/reparar por reflejo. Los hints de pedidos explícitos no se modifican.

**Poda y preservación por capa:**

| Elemento revisado | Recorte/corrección | Lo que se conserva |
|---|---|---|
| Skill durable | Bootstrap fijo de tres grupos/buckets y repetición de reglas de lectura/cierre | Taxonomía, metadata, fuentes completas, promociones, privacidad y autoridad |
| Tool save | Dos ejemplos completos y listado de categorías repetido por el campo type | What/Why/Where/Learned, título, tipos estructurados y prioridad de hallazgos durables |
| Tool summary | Guidelines genéricas duplicadas por template/condiciones | Seis secciones, continuidad, evidencia y no sustitución de observación local obligatoria |
| Reader Claude | Lista de cuatro skills sugeridas para una tarea ya delimitada | Rol read-only, wrappers, evidencia destilada y acceso existente a esas skills si hicieran falta |
| Higyrus skill de ticket | Dos referencias inexistentes a memoria-escritura/higiene reemplazadas por memoria-durable existente | Todo el workflow desde Cuándo usarme, una memoria por ticket, topic key, formato y retrabajos, idénticos |
| VB y Keycloak | Sin recorte del reader local obligatorio | Consulta explícita al reader en sus master-dev como excepción local |
| Otros seis overlays y roles locales | Sin cambios por parecer «inferibles» | Memoria pertinente, dominio, helpers, handoffs, permisos y cierres respectivos |

El relevamiento automático acotado incluyó 228 archivos de instrucciones en los
tres stacks fuente y nueve overlays, con revisión manual de los contratos afectados.
No se borran guardas por ser repetidas: un override homónimo no hereda automáticamente
el cuerpo ni permisos globales. Poda más amplia de heurísticas/catálogos queda en
6–7, no se utiliza para alterar el alcance de este candidato.

**Validación y evidencia:**

- 12 tests Python de política y seis de integración/metadatos, más diez tests Go
  focalizados (matriz de diez subcasos). Todos pasaron sin requests de evaluación a
  modelos. Los tests contractuales comprueban wording/wiring, no simulan un LLM ni
  prueban que vaya a obedecer o consultar menos en una tarea real.
- Probes nativos de nueve filtros con el candidato: nombres registrados correctos,
  parámetros, anotaciones, capabilities, protocolo y conflicto iguales al binario
  activo salvo las cuatro descripciones de uso deliberadamente cambiadas. Solo
  initialize/tools-list con DB/HOME temporales y autosync=0, sin tools de escritura.
- Patch reaplicado limpiamente desde el pin existente; 19 bloques previos ajenos
  idénticos y todo el código de handlers conservado. Build Go offline/CGO=1 con
  módulos ya disponibles; sin upgrade, descargas o cambio del checkout gestionado.
- Recomposición existente desde bases limpias y `opencode debug config` en sandbox:
  prompts nuevos cargados, mismos modelos/tools/permisos para agent-design,
  master-dev, planner y reader; bloques Ticketing intactos. Se comprobó la limitación
  de apply sobre bloques ya marcados, no se afirmó que un apply in-place los actualice.
- 207 frontmatter contrastados: solo cambia description del reader Claude; ninguna
  herramienta, modelo o permiso. Symlinks compartidos y alias Higyrus de Claude
  preservados. 456 fingerprints de activos/productos/índices/managed intactos; HEADs
  sin mover y sin staging/commits/push. Las obligaciones locales no se normalizaron.
- Texto medido, no tokens: skill durable de 8.000 a 6.576 bytes; instrucciones más
  descripciones MCP de OC 8.014 a 7.913 y Claude 5.323 a 5.227. Algunos cuerpos
  crecen para aclarar autoridad/errores y no todos se cargan juntos. No se atribuye
  una reducción de contexto total ni ahorro de tokens/latencia a esas cifras.

**Artefactos y siguiente decisión:** QA temporal en `/tmp/opencode/point5-qa.py` y
`point5-candidate/` con baseline, audit, composición, métricas y result. Candidato
aislado SHA-256 `319895e58c7be806c13644180373c30ec8d4c013faf8f3ebe8043a8f02c2deff`.
La fuente durable son patch, reglas, skills y tests canónicos, no los temporales.
Los activos siguen en 4: no hace falta reiniciar. No se ejecuta el piloto de 16
corridas sin otro presupuesto/aprobación, ni se promueve B automáticamente por
estos checks. La siguiente decisión puede autorizar una promoción conservadora
aceptando explícitamente esta limitación de evidencia, o mantenerlo aislado; una
evaluación con modelos, despliegue y publicación requieren sus autorizaciones.
Rollback solo del diff de este candidato, preservando el plan previo y cualquier
trabajo ajeno; jamás borrar memorias/corpus ni resetear repos para demostrar ahorro.

### 5.c. Piloto mínimo autorizado — detenido en el control de consumo

El usuario eligió la opción de prueba mínima: dos escenarios A/B en un runtime,
cuatro corridas principales, en lugar de las 16 propuestas originalmente. Se
seleccionó OpenCode y se verificó el runner antes de realizar la primera petición.
La autorización no habilita gasto sin un presupuesto efectivo ni relajar guardas.

- **Escenarios previstos:** consulta puntual de memoria y cierre/confirmación sin
  novedades. Mismo modelo/variante, fixtures y permisos por par A/B, sin reintentos.
  No se crearon sesiones de evaluación, hijos, perfiles ni un proxy para ejecutarlas.
- **Runtime observado:** `1.19.4--202610232249`. `steps` limita rondas y su permiso
  se reinicia con una nueva entrada; no es un presupuesto total de tokens/costo.
  El CLI run tampoco ofrece por sí solo un tope monetario total.
- **Bloqueo concreto:** en la fuente de este runtime,
  `packages/opencode/src/plugin/openai/codex.ts:569–573`, el hook `chat.params`
  asigna `output.maxOutputTokens = undefined` para el provider OpenAI. Por ello no
  puede asumirse que `limit.output` o `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX` lleguen
  al proveedor como límite de generación, aunque request.ts los prepare antes.
- `opencode auth list` confirmó que el acceso disponible a OpenAI es OAuth. Solo
  se consultó el listado no sensible y código público local, no tokens ni archivos
  de credenciales. No se cambió auth, provider, plugins, runtime ni permisos.
- **Resultado:** cero peticiones a modelos de evaluación y ninguna métrica A/B
  nueva. Las cifras estáticas y pruebas determinísticas de 5.b siguen vigentes,
  pero no demuestran ahorro conductual. Contar cuatro corridas no equivale a
  limitar cuatro peticiones: el tool loop y un lector pueden generar más.
- **Pendiente de decisión:** usar un mecanismo/proveedor que permita comprobar
  un tope efectivo, o aceptar explícitamente una promoción conservadora y observar
  tareas habituales, sin corridas artificiales ni pretender evidencia causal A/B.
  No montar una capa de autenticación/proxy ni modificar el plugin sólo para evitar
  este control; no activar B por el hecho de haber autorizado el piloto.

### 5.d. Microprueba real de primera decisión — cuatro peticiones, sin promoción

Después de explicar el bloqueo de 5.c, el usuario delegó el criterio y aceptó un
gasto pequeño, manteniendo su restricción de no consumir excesivamente la cuota.
Se redujo el alcance a primera decisión del modelo: no se modificó el plugin
OpenAI para fingir un cap que no aplica ni se creó un proxy de autenticación.

- **Diseño:** dos escenarios (observación conocida y confirmación de hito ya cerrado),
  variantes A/B, solo OpenCode `1.19.4`, `openai/gpt-6.1-sol`, esfuerzo `low` en todos.
  Orden A-lookup, B-lookup, B-ack, A-ack. Fragmentos de autonomía + instrucciones y
  descripciones MCP reales por variante, sobre el mismo caller mínimo y fixture.
  No se cargó el agente completo ni los overlays: no es una prueba de producción.
- **Superficie acotada:** cinco tools de memoria iguales por par y task para mostrar
  la opción de reader, permisos endurecidos idénticos A/B. Metadatos extraídos de
  ambos binarios, transporte MCP sintético y sin datos reales. Guard cargado junto
  al env-guard intercepta antes de cualquier tool/task; no hijos ni mutaciones.
- **Consumo controlado:** una petición de generación permitida por proceso, máximo
  cuatro, sin reintentos; otra generación se bloquea antes del provider. `steps=2`
  conserva tools en el primer paso, pero el guard impide pagar el siguiente. Corte
  de proceso a 40 s. Sin techo duro de tokens por OAuth: umbrales posteriores de
  10.000 tokens reportados para continuar tras el primer par y 20.000 globales.
  El primer par consumió 5.892 y permitió continuar. No hubo timeout.
- **Aislamiento:** HOME/config/cache/state y DB de conversaciones descartables;
  se reutilizó autenticación OAuth normal del SDK sin copiar credenciales. Fuentes,
  configs y runtime activos intactos según los 456 fingerprints. Los logs técnicos
  habituales del SDK y su eventual renovación de token no son un cambio de cuenta
  o configuración. El harness no guardó headers, credenciales, razonamiento ni logs raw.

| Escenario/variante | Primera decisión observada | Entrada | Salida | Razonamiento reportado | Total | Tiempo de corrida |
|---|---|---:|---:|---:|---:|---:|
| Consulta A | Selecciona task/knowledge-reader, detenido antes de abrir hijo | 2.886 | 134 | 0 | 3.020 | 6,223 s |
| Consulta B | Selecciona mem_get_observation(17), detenido antes de leer | 2.850 | 22 | 0 | 2.872 | 4,163 s |
| Confirmación B | Respuesta textual sin tools | 2.859 | 8 | 0 | 2.867 | 4,783 s |
| Confirmación A | Respuesta textual sin tools | 2.895 | 10 | 13 | 2.918 | 4,179 s |

- **Totales:** cuatro generaciones completadas, 11.677 tokens reportados: 11.490
  entrada, 174 salida y 13 razonamiento; caché reportada cero. A suma 5.938 y B
  5.739: diferencia descriptiva de 199 tokens (-3,35 %) en esta microprueba.
  No incluye preparación ni esta conversación, y no permite conocer un porcentaje
  de cuota semanal. OAuth no informa aquí un precio monetario útil para ese cálculo.
- **Lectura de resultados:** señal favorable a lectura puntual directa en B; no se
  ejecutó el reader ni se midió su costo ahorrado. No hubo mejora nueva observada en
  confirmación: A también evitó tools. B fue más lenta en esa corrida de confirmación;
  las cuatro duraciones incluyen arranque y red, no prueban mejora de latencia.
  Los exits de lookup son cortes intencionales por el guard, no fallos del candidato.
- **Límites:** una muestra por condición, variante low, política aislada y tools no
  ejecutadas. No se comprobó la respuesta factual de la consulta, calidad end-to-end,
  memoria persistida, obligaciones locales en un modelo o comportamiento con el rol
  completo/variante habitual. No usar estos datos como prueba estadística, ahorro
  operacional general o promoción automática. Los checks de preservación siguen
  siendo los determinísticos de 5.b.
- **Estado al cerrar la microprueba:** límite de cuatro agotado; no habrá más corridas bajo esta autorización.
  Artefactos temporales en `/tmp/opencode/point5-micro/summary.json` y result por
  corrida; harness `point5-micro.py` y guards/fixture asociados. Este registro conserva
  las métricas durables. No se desplegó, sincronizó, stageó ni publicó el candidato.
  Siguiente decisión: revisión/promoción conservadora aceptando explícitamente esas
  limitaciones, o mantener aislado. No se recomienda gastar más por reflejo.

### 5.e. Promoción conservadora y despliegue autorizados

Tras explicar el alcance y las limitaciones de la microprueba, se propuso promover
con backup, desplegar de forma acotada y verificar sin modelos, dejando publicación
separada. El usuario indicó «Ok, avanza». No se toma el -3,35 % descriptivo de 5.d
como ganancia global ni prueba de calidad end-to-end.

- **Preflight:** fuente/artefacto coincidentes con el candidato validado; binario
  anterior alineado del punto 4, patch previo y activos sin drift. Se contrastaron
  contratos de tools antes/después: solo cambian las cuatro descripciones previstas,
  no inputs, anotaciones, capabilities, protocolo, handlers ni filtros.
- **Autonomía:** render existente desde Core para agent-design/master-dev/planner,
  conservando Ticketing. Los archivos opcionales plan/build sí estaban instalados:
  se reemplazó solo su bloque Knowledge publicado y conocido, reutilizando las
  funciones existentes, sin regenerar sus templates ni tocar header/resto de cuerpo.
  Apply in-place no se utilizó como si actualizara bloques ya presentes.
- **Destinos:** 17 archivos: cinco roles OpenCode de autonomía, cinco assets
  Knowledge (reader, dos skills, patch y playbook), tres roles Claude, la skill de
  cierre Higyrus, dos archivos MCP gestionados y el ejecutable compartido. Manager
  canónico se conserva en su repo según el marker/lifecycle existente; no se inventó
  un asset instalado fuera del manifest. README/changelogs/tests no se copiaron sobre
  archivos de otros dueños.
- **Enlaces:** seis bindings preservados, sin retarget: skills durable/Engram en
  fuente Claude bajo `addons/knowledge/skills/` y activos Claude, más alias de la
  skill de ticket en fuente/producto Higyrus. La promoción actualiza sus targets,
  no crea copias paralelas ni usa `base/skills/` como ubicación supuesta de Knowledge.
- **Backup y activación:** pinneado
  `~/.config/opencode/.stack-sync-backups/point5-20261026T163329Z/`, con before/after,
  ledger, script y resultados/evidencia del candidato. Se reemplazó cada archivo
  atómicamente, binario último; rollback acotado automático disponible ante fallo,
  sin sobrescribir cambios de terceros. No fue necesario ejecutarlo. No instalador
  amplio, reset/clean, descarga, cambio de cuenta/auth o publicación.
- **Verificación:** 17 targets en paridad; patch gestionado completo y reverse-check
  correctos; paths de tracked/untracked del managed conservados. Native config global
  valida seis roles (los cinco anteriores y reader) con mismos modelos, variantes,
  tools/permisos y flags de activación. Metadatos nativos OC11/Claude USER8 muestran
  política nueva y coinciden con candidato, sin mandatory-before-done ni tool nueva.
- **Protecciones:** 440 fingerprints fuera de alcance intactos, incluidos configs,
  plugins, instrucciones/permisos locales e índices de fuentes/productos. Frontera
  activa deliberadamente excluye los targets y contenidos de aliases que deben
  actualizarse; los links se verificaron aparte. No staging/commits/push. VB/Keycloak
  conservan reader requerido y Higyrus su memoria por ticket/retrabajo; no se
  reinterpretaron como opcionales por la regla global.
- **Artefacto activo:** SHA-256
  `319895e58c7be806c13644180373c30ec8d4c013faf8f3ebe8043a8f02c2deff`.
  Pruebas del despliegue: cero corridas de modelos nuevas, solo configuración y
  initialize/tools-list con fixtures temporales; no escrituras de memoria de prueba
  en la DB real. El presupuesto de cuatro generaciones de 5.d no se amplió.
- **Uso y pendientes:** reiniciar procesos OpenCode/Claude Code abiertos para relanzar
  MCP y recargar roles/skills; no hace falta reiniciar la PC ni descartar conversaciones.
  No se mataron procesos. La sesión actual puede seguir con metadatos previos hasta
  esa recarga; observar trabajo habitual, sin nuevos benchmarks automáticos. Publicación
  pendiente de autorización; punto 6 no iniciado.
- **Evidencia:** `/tmp/opencode/point5-deploy.py` y `point5-deployment.json` son
  temporales; el backup conserva ledger/result y resultados del candidato para no
  depender de `/tmp` tras un reinicio. Rollback restaura solo los 17 artefactos del
  ledger, nunca una DB, corpus, repo entero o cambios locales del producto.

### 5.f. Reinicio confirmado y publicación autorizada

El usuario confirmó el reinicio de todos sus OpenCode abiertos y luego pidió
«Publica y decime si aun hay punto 6 para planificar». No hay otro bloqueo técnico
identificado; se conserva la limitación de evidencia del microensayo, sin nuevas
corridas de modelos ni reinstalaciones para publicar.

- Publicar solo cuatro canónicos, un commit por repo en `main`: Core (este plan),
  Knowledge (diez archivos), Claude (cuatro) y overlay Higyrus (una referencia de
  skill). Total 16 archivos. Core también en su mirror habitual.
- Contrastar paridad de los 17 destinos/aliases con el ledger pinneado, revisar
  status/diff/log/identidad/remotos y congelar los archivos aprobados. No stagear
  cambios ajenos, el binario ni el checkout gestionado. Sin amend, force o bypass
  de hooks, ni cambios de configuración Git.
- Verificar árboles canónicos limpios y HEAD remoto coincidente, manteniendo el
  runtime/roles desplegados y protecciones intactos. Guardar hashes/resultados de
  publicación en el backup y memoria, no mediante otra edición circular del plan.
- No Git writes en productos AUNE. La publicación no necesita otro reinicio.
  El punto 6 sigue pendiente: heurísticas genéricas por tipo de tarea, con su
  especificación y aprobación propias; no se ejecuta por cerrar el 5.

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
