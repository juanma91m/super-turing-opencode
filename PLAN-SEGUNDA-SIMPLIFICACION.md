# Plan de segunda simplificación del stack OpenCode

Fecha de apertura: 2026-10-25.

Estado: puntos 1–6 implementados, validados, sincronizados y publicados. El punto 2
incluye reconciliación autorizada y addendum de activación, shell restringido y
estilo local prioritario (2.h–2.i). Punto 6 conserva ocho subsecciones agrupadas en
cinco etapas A–E, más alineación semántica de los nueve overlays y tres ajustes
compartidos adicionales (6.g–6.u). Su promoción alcanzó 54 destinos; publicación
completada en trece canónicos mediante trece commits y catorce pushes, incluido
Core a GitHub y GitLab. Ledger, hashes y rollback en
`~/.config/opencode/.stack-sync-backups/point6-20261027T015258Z/`; los fixes locales
del wrapper GitHub también quedaron publicados. Nunca se publicaron productos AUNE.
El reinicio de clientes afectados sigue sin confirmación del usuario; no asumir
hot-reload. Punto 7.A cerrado, promovido y publicado (7.f–7.g): Knowledge
`0362aef`, Core `452ca97`, dos commits/tres pushes; hashes completos y verificación
en el ledger durable de 7.g. Reiniciar OpenCode; aún sin confirmación del usuario.
7.B implementado/validado (7.l) y promovido selectivamente con verificación del
stack activo completo y los nueve perfiles instalados (7.m). Publicación de
Background y Core autorizada; hashes/resultados finales en el ledger durable de
7.m, sin commit circular del plan. La delegación background válida se conserva.
7.C no propone otra poda editorial. Puntos 8–10 pendientes. No hay promociones
ni publicaciones de 6/7.A todavía por ejecutar.

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
| 5 | B — experimento | Memoria proporcional y cierre por hito | cerrado y publicado |
| 6 | B | Carga selectiva de heurísticas genéricas | desplegado y validado global + nueve overlays; publicación autorizada, resultado final en ledger; sin resultado operativo LLM medido |
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

**Experimento candidato:** revisar primero los triggers de
`analisis-tecnico-evidencia` y `cambio-seguro-enterprise` como etapa A; evaluar las
restantes por etapas acotadas, sin retirar skills ni cambiar todas en bloque.

**Ubicación:** Core: skills genéricas y referencias desde agentes.

**Responsabilidad restante:** evidencia, incertidumbre y validación permanecen
explícitas. No retirar de entrada checklists específicos de contratos o concurrencia.

**Beneficio a medir:** cargas y salida evitadas; las 161 cargas/162.610 bytes de la
skill relevada son un techo histórico, no un ahorro previsto.

**Validación:** tareas simples y ambiguas equivalentes; comparar hallazgos,
evidencia, supuestos y retrabajo. Resolver explícitamente cualquier skill no cargable.

**Rollback:** restaurar triggers y referencias, sin cambiar permisos.

Se conservan las ocho subsecciones **6.1–6.8** y una decisión por heurística, pero
se comparten relevamiento, propuesta y pruebas cuando aportan ahorro real:

| Etapa de revisión | Subsecciones | Criterio |
|---|---|---|
| A — Principios generales | 6.1 Evidencia + 6.2 Cambio seguro | Revisar cargas que repiten obligaciones de guías/roles, sin fusionar skills. |
| B — Revisión y cierre | 6.3 Verificación + 6.5 Revisión por etapas | Compartir escenarios, preservando responsabilidades distintas. |
| C — Riesgos técnicos específicos | 6.7 Contratos/datos + 6.8 Performance/cache/concurrencia | Revisar fronteras y doble carga, conservando ambos checklists. |
| D — Debugging | 6.4 | Procedimiento propio de reproducción, hipótesis y causa raíz. |
| E — Especificación y pruebas | 6.6 | Decisión independiente sobre criterios y estrategia de pruebas. |

El detalle 6.a–6.f especifica únicamente la **etapa A (6.1 + 6.2)**. La agrupación
no autoriza su implementación ni anticipa cambios de B–E. Si una heurística exige
un cambio material distinto, separarla de su grupo antes de implementar. Revisar
puede concluir en conservar, acotar la carga o diferir/descartar la propuesta.

**Promoción conjunta:** al pasar a B, el usuario pidió «despleguemos todo junto».
Se adopta como criterio operativo acumular los candidatos A–E para una promoción
consolidada al terminar la revisión, salvo que el usuario aclare otro alcance.
No se ejecuta un despliegue ahora ni se toma esa frase como permiso para instalar
componentes, sumar assets ajenos, publicar o modificar controles técnicos. El
manifiesto final de destinos y backups se delimita al preparar el lote consolidado.

### 6.a. Diagnóstico y decisión de alcance propuesta

Baseline de especificación al 2026-10-26. La implementación/validación canónica
fue autorizada después y se registra en 6.g; no incluye despliegue, publicación ni
ensayos con modelos. Los fixes posteriores al punto 5 del wrapper GitHub en ocho overlays son
trabajo independiente, ya sincronizado pero no publicado; no incluirlos en el
patch, los backups ni una eventual publicación del punto 6 por arrastre.

Hallazgos verificados en las fuentes canónicas:

- `analisis-tecnico-evidencia` tiene 20 líneas en Core. Su trigger «Antes de
  proponer una solucion tecnica» y la descripción actual abarcan casi cualquier
  tarea técnica. Las guías comunes y roles ya exigen distinguir evidencia,
  inferencias y faltantes; la obligación no depende de cargar esta skill.
- Los once agentes Core ya no la sugieren explícitamente. Esa poda existe y no
  debe rehacerse ni atribuirse como beneficio nuevo del punto 6.
- Claude conserva diez referencias planas en `base/agents/` y una en el adaptador
  `addons/knowledge/agents/knowledge-curator.md`. Esos once roles tienen `Read` y
  no anuncian `Skill`: explicitar lectura permitida, no agregar herramientas.
- Knowledge y Ticketing conservan una referencia plana en cada plantilla opcional
  `agents/plan.md` y `agents/build.md`: cuatro referencias adicionales. Son assets
  de sus addons, no del Core. No reabrir sus políticas de memoria o tickets.
- La skill Claude `base/skills/analisis-tecnico-evidencia/SKILL.md` es una copia
  regular: mismo cuerpo, sin el campo `compatibility: opencode`. Otras skills ya
  usan symlinks y el sync Claude preserva ese binding. Se propone extender ese
  patrón a las dos skills de la etapa A; Claude ya tolera esa metadata adicional.
- No se encontraron referencias explícitas a esta skill en los nueve overlays
  canónicos AUNE. No necesitan cambios para este candidato; sus reglas locales de
  análisis, dominio y validación siguen vigentes.

- `cambio-seguro-enterprise` tiene 21 líneas en Core. Sus triggers incluyen
  preservar comportamiento fuera de alcance o decidir la solución más simple:
  obligaciones ya explícitas en guías y roles, no exclusivas de un cambio complejo.
- Esta segunda skill tiene nueve referencias planas en Claude `base/agents/`
  (los mismos roles que Evidencia salvo `code-reviewer`) y una en
  `addons/knowledge/agents/knowledge-curator.md`. También es copia regular en
  `base/skills/`, con el mismo cuerpo Core salvo `compatibility: opencode`.
- No se encontraron referencias a Cambio seguro en agentes Core, plantillas
  Knowledge/Ticketing ni overlays canónicos AUNE. No agregarlas donde no existen.

Propuesta conjunta: acotar **solo estas dos heurísticas**, con **25 entradas** en
**15 archivos de roles/plantillas**: 21 entradas en once archivos Claude, más cuatro
entradas de Evidencia en plantillas Knowledge/Ticketing. No retirar skills del
catálogo, fusionar sus responsabilidades ni extender el recorte a otras heurísticas.

### 6.b. Contrato candidato de selección y responsabilidad restante

**Evidencia (6.1).** Descripción propuesta para la implementación a aprobar:

> Usar cuando evidencia incompleta o contradictoria requiera estructurar hechos,
> inferencias y supuestos para una decisión técnica, o se pida auditar esa
> evidencia; no para tareas rutinarias con evidencia suficiente.

La implementación debe alinear descripción, «Cuándo usarme» y salida de la skill:

1. **Cargar/aplicar** ante pedido explícito de la skill o de un análisis de
   evidencia, o cuando contradicciones/incertidumbre material requieran organizar
   evidencia para decidir. No exigir que el usuario nombre la skill.
2. **No cargar por reflejo** por estar en planning, entender código existente,
   proponer cualquier solución, trabajar en legacy o ejecutar un microcambio.
   Una duda resoluble con una lectura o prueba puntual no exige otro marco.
3. **Evitar acumulación:** si debugging, review u otra skill específica ya cubre
   ese análisis, no sumar esta solo para repetir sus pasos. Sigue disponible si
   hay una necesidad adicional real o el usuario la pide.
4. **Siempre conservar** evidencia verificable, separación entre hechos y
   supuestos, riesgos/faltantes relevantes y validación honesta, se cargue o no la
   skill. No deducir corrección del código existente ni ocultar incertidumbre.
5. La salida se adapta al problema; no imponer cuatro secciones vacías o una
   matriz formal a toda respuesta. Si se pide una matriz o hay contradicciones
   materiales, sí explicitar evidencia, inferencias, riesgo y qué falta resolver.
6. En las referencias de agentes, una condición breve remite al trigger de la
   skill; no copiar su checklist en quince prompts. En Claude, añadir el acceso
   por `Read` a `~/.claude/skills/analisis-tecnico-evidencia/SKILL.md` cuando no
   existe `Skill`, sin ampliar tools ni inventar loaders.

La guía global y los roles mantienen sus obligaciones actuales; no se añade otra
guía global ni un clasificador/plugin para decidir si se carga la skill. Esto es
guidance de selección, no enforcement técnico ni garantía de obediencia del LLM.

**Cambio seguro (6.2).** Descripción propuesta:

> Usar para delimitar cambios con riesgo de regresión o compatibilidad no trivial,
> cuando haga falta decidir alcance, comportamiento a preservar y validación, o
> por pedido explícito; no por la sola etiqueta enterprise/legacy ni por toda edición.

Su description, triggers y salida deben expresar:

1. Aplicarla cuando planificar o revisar un cambio exige decisiones no triviales
   sobre alcance, compatibilidad o comportamiento que debe preservarse; incluye
   riesgos plausibles aunque todavía no exista una regresión demostrada.
2. No cargarla por el nombre del repo/rol, por cualquier edición ni para repetir
   una estrategia de cambio seguro ya suficiente en el workflow o skill específica.
   El tamaño del diff no determina el riesgo: una línea puede cambiar auth o datos.
3. Mantener siempre cambio mínimo, comprensión del flujo y patrón previo,
   compatibilidad, preservación de trabajo ajeno y separación fix/cleanup, se
   cargue o no la skill. No introducir formularios, archivos ni aprobaciones extras.
4. Conservar una salida proporcional: decisión de alcance, comportamiento que se
   preserva y validación pertinente cuando aporten; no cuatro secciones vacías.
5. Condicionar sus diez referencias Claude con el mismo acceso por Read permitido
   que Evidencia; no ampliar tools ni copiar el checklist en cada prompt.

**Frontera entre ambas:** Evidencia organiza qué se sabe y qué permite concluir;
Cambio seguro delimita cómo modificar preservando comportamiento. Pueden aplicar
ambas si cada una cubre una necesidad real, pero no se cargan como pareja por
defecto. Un pedido explícito de una o ambas se respeta. Si un procedimiento
específico ya cubre el trabajo, no sumar marcos genéricos solo para duplicarlo.

### 6.c. Archivos y ownership de la eventual implementación

| Dueño | Alcance candidato |
|---|---|
| Core | `skills/{analisis-tecnico-evidencia,cambio-seguro-enterprise}/SKILL.md`; sus dos entradas de `README-AGENTS.md`; registro en `CHANGELOG.md` y este plan; regresiones focalizadas bajo `tests/` según el harness existente. No cambiar agentes Core ni guías comunes. |
| Claude | Evidencia: diez `base/agents/` (`planner`, `code-inspector`, `code-reviewer`, `reviewer`, `dev-test`, `merge-conflict-resolver`, `backend-java-developer`, `backend-python-developer`, `backend-typescript-developer`, `frontend-web-developer`) y `addons/knowledge/agents/knowledge-curator.md`. Cambio seguro: los mismos salvo `code-reviewer`, donde no existe esa entrada. Condicionar solo las 21 entradas de estas dos skills. |
| Claude, skills compartidas | Reemplazar las dos copias `base/skills/{analisis-tecnico-evidencia,cambio-seguro-enterprise}/SKILL.md` por symlinks a sus respectivos assets OpenCode siguiendo el patrón existente; registrar ambos bindings en `STACK-MANIFEST.json` y actualizar README/changelog. No crear otro mecanismo de composición. |
| Knowledge y Ticketing | Condicionar exclusivamente la referencia a Evidencia en sus cuatro plantillas `agents/{plan,build}.md`, más el registro documental correspondiente. No agregar Cambio seguro ni cambiar generadores, bloques de autonomía, reglas de memoria, hooks o lifecycle. |
| Overlays AUNE / productos | Lectura y comprobación de no regresión; **cero ediciones** por este candidato. Los fixes GitHub previos deben preservarse. |

Permisos, modelos, variantes, hooks, MCP, esquema de tools, targets de delegación,
catálogos y disparadores obligatorios de otras skills quedan fuera de alcance.
Resumen de decisiones de alcance:

| Heurística revisada | Decisión para esta entrega |
|---|---|
| `cambio-seguro-enterprise` | Incorporada a la etapa A con relevamiento propio y contrato distinto de Evidencia; no se fusionan las skills. |
| `verificacion-antes-de-cerrar` | Conservar contrato y triggers; no confundir evitar una carga con eliminar la obligación de verificar. |
| `debugging-sistematico` | Conservar: aporta procedimiento específico de hipótesis, reproducción y causa raíz. |
| `revision-por-etapas` / `sdd-tdd-bdd-pragmatico` | Conservar criterios y aplicación pragmática; no reabrir el handoff ni el addendum del punto 2. |
| `contratos-api-y-datos` / `performance-cache-concurrencia` | Conservar checklists específicos íntegros. |

### 6.d. Criterios de aceptación y validación sin modelos por defecto

Antes de editar, congelar baseline de archivos, bindings y headers efectivos de
los roles alcanzados. Preservar archivos ajenos y trabajo previo no publicado.

- Metadata válida y ambas skills descubribles por el loader real OpenCode; Claude recibe
  una fuente por skill mediante symlink resuelto, con el mismo contrato y acceso por Read
  en los roles sin Skill. La aprobación del candidato no permite ampliar tools.
- Las 25 entradas quedan condicionadas, no desaparecen obligaciones ni
  se retiran otras skills. Headers de los quince roles/plantillas byte-idénticos;
  comprobar además configuración efectiva de los roles OpenCode alcanzados.
- Revisar fixtures de selección/contraejemplos y asserts contractuales, sin hacer
  pasar un clasificador casero o un test textual por comportamiento del modelo:

| Caso | Contrato esperado |
|---|---|
| Cambio literal acotado o explicación con archivo/resultado suficiente | No exigir esta skill; seguir validando lo afirmado. |
| Planning con requerimiento claro y evidencia disponible | No cargarla solo por el nombre del rol o por proponer solución. |
| Falta un dato verificable con una consulta puntual | Obtenerlo o declarar el límite; no activar automáticamente una ceremonia. |
| Logs y código sostienen explicaciones incompatibles y la decisión depende de conciliarlos | Aplicar análisis explícito de evidencia e incertidumbre. |
| Usuario pide auditar hechos, inferencias y supuestos o nombra la skill | Aplicarla, con el formato pedido cuando corresponda. |
| Bug con repro y estrategia de debugging ya suficiente | Mantener skill/procedimiento específico; no sumar otra carga redundante. |
| Cambio API/SQL/cache o review formal | Mantener skills específicas, snapshot, contratos, checks y validación local; este candidato no los recorta. |
| Cambio acotado con alcance/compatibilidad ya resueltos | No exigir Cambio seguro solo por trabajar en legacy; conservar sus obligaciones. |
| Cambio con consumidores o comportamiento fuera de alcance cuya preservación exige una decisión no trivial | Aplicar Cambio seguro aunque la evidencia del comportamiento actual sea clara. |
| Diff de una línea con impacto sensible en auth/datos | No clasificarlo como trivial por tamaño; evaluar riesgo real y preservar skills específicas. |
| Incertidumbre material más decisión de compatibilidad no trivial | Ambas skills pueden aportar; justificar la necesidad diferenciada sin cargarlas como set fijo. |
| Pedido explícito de una o ambas skills | Aplicar las solicitadas sin usar el filtro de rutina para ignorar el pedido. |

- Ejecutar regresiones focalizadas, `git diff --check` y `opencode debug config`
  en sandbox con dependencias existentes; sin instalar ni llamar modelos. No
  exponer configuración resuelta cruda ni correr installers globales para validar.
- Comprobar que los otros cuerpos de skills y bloques de Knowledge/Ticketing
  permanecen iguales; registrar tamaño de skill, descripciones y referencias
  residentes por separado. Agregar condiciones puede aumentar algo el prompt
  estático: explicitarlo, no presentar toda poda como ahorro.

La aceptación técnica prueba metadata, contratos y ausencia de drift. **No prueba
menor consumo, latencia, retrabajo ni igual calidad del modelo.** Las 161 cargas y
162.610 bytes son históricos y no predicen ahorro con el modelo actual. No repetir
la microprueba del punto 5 ni presupuestar otro A/B por defecto; un ensayo real
necesita diseño, costo, límites y autorización propios.

### 6.e. Despliegue y rollback propuestos, aún no autorizados

Una aprobación inicial debería limitarse a **implementar/validar canónicos**.
Despliegue y publicación se autorizan después sobre el diff real:

- Promover solo las dos skills Core, los dos bindings Claude y las 21 entradas en
  once agentes Claude; documentación según el lifecycle de su dueño, sin sync amplio
  que mergee settings/hooks/permisos. Instalar el destino OpenCode antes de activar
  los dos symlinks Claude; verificar referencias resueltas, no links rotos.
- Las plantillas opcionales plan/build de addons se corrigen para instalaciones
  futuras. En activos existentes, si la entrada genérica sigue presente y coincide
  con la baseline, actualizar **solo esa entrada**; nunca reemplazar el archivo
  por una plantilla ni recrear agentes ausentes. Preservar headers y bloques
  compuestos del punto 5, y el estado habilitado/oculto de cada rol.
- No sincronizar overlays ni productos AUNE; los clientes reciben la skill global
  por sus rutas existentes. Tras una promoción, reiniciar los clientes afectados;
  no afirmar que una sesión abierta ya usa los triggers nuevos.
- Backup de los archivos/links exactos y ledger antes/después. Rollback restaura
  solo esos assets, incluidos copia versus symlink, sin revertir los fixes GitHub,
  bloques de autonomía, configuración ni trabajo ajeno. No Git writes en productos.

### 6.f. Estado y siguiente decisión

Etapa A aprobada, implementada y validada en canónicos; resultado en 6.g. No hay
un bloqueo técnico pendiente que justifique prolongarla por microoptimizaciones.
El usuario indicó avanzar a B si A estaba lista: se completa su especificación
en 6.h. La promoción de A queda acumulada para el lote conjunto; no se inicia
implementación B ni etapas C–E por el cierre de A.

### 6.g. Etapa A implementada y validada en canónicos

El usuario respondió «Perfecto. Avancemos» a la propuesta explícita de implementar
y validar solo los canónicos, dejando despliegue/publicación para después.

- **Implementado:** ambas skills con triggers selectivos y salida proporcional;
  25 entradas condicionadas en 15 archivos (21 Claude y cuatro plantillas addon),
  sin modificar sus headers ni el resto de sus cuerpos. No se fusionan skills ni
  se cargan como pareja fija. Pedidos explícitos y obligaciones permanentes siguen
  presentes; un diff pequeño no equivale a bajo riesgo.
- **Fuente compartida:** dos copias Claude convertidas a symlinks al asset
  OpenCode instalado, con manifest y documentación actualizados. Esos enlaces
  canónicos todavía leen la **versión activa anterior**, porque no se desplegó
  Core. El contenido candidato y el acceso Read de Claude se contrastaron en
  staging con dos enlaces a copias del candidato; no editar el activo a través de
  un enlace ni confundir el binding con una promoción ya realizada.
- **Archivos:** siete Core (incluido el plan preexistente y dos nuevos assets de
  tests), 16 Claude, tres Knowledge y tres Ticketing: 29 en cuatro canónicos.
  Ningún agente Core, guía común, generador, script de runtime o archivo producto
  cambió; se preserva el trabajo anterior de los overlays GitHub.
- **Regresiones:** 11 tests nuevos de contrato, cuatro de metadata/workflow y
  16 de code review/helper: **31 tests pasados**. Los doce escenarios del fixture
  vinculan expectativa con cláusulas del texto: no son doce decisiones de un LLM.
  El test del trigger amplio se ejecutó primero y falló con el texto previo.
- **Pruebas nativas:** `opencode debug config` antes/después en dos perfiles
  aislados (Knowledge y Ticketing, plan/build), con configuración efectiva sin
  cambios salvo los prompts autorizados; `opencode debug skill` cargó los dos
  candidatos desde la ruta staged esperada, con metadata y cuerpos correctos.
  No se instaló nada ni se lanzó Claude/modelos para estas pruebas.
- **Integridad:** headers de los 15 archivos byte-idénticos; fuera de sus entradas
  seleccionadas, sus cuerpos permanecen iguales. **588 fingerprints** de fuentes
  ajenas al alcance, instalaciones activas, overlays/productos e índices Git se
  mantienen; HEAD de los cuatro canónicos intacto y `git diff --check` correcto.

**Tradeoff estático medido, no ahorro operativo:**

| Texto | Antes (bytes UTF-8) | Después | Diferencia |
|---|---:|---:|---:|
| Skill Evidencia completa | 840 | 1.379 | +539 |
| Su descripción de catálogo | 109 | 202 | +93 |
| Su cuerpo on-demand | 652 | 1.096 | +444 |
| Skill Cambio seguro completa | 843 | 1.511 | +668 |
| Su descripción de catálogo | 79 | 245 | +166 |
| Su cuerpo on-demand | 687 | 1.187 | +500 |
| Suma de los 15 archivos de roles/plantillas | 39.032 | 43.368 | +4.336 |

La última fila agrega archivos distintos, **no es el incremento de cada request**;
el máximo por un agente Claude es +360 bytes. Las condiciones y rutas de lectura
explicitan selección y acceso, pero aumentan el texto. Las descripciones también
crecen y los cuerpos son más largos si se cargan. El candidato reduce duplicación
de mantenimiento y busca evitar cargas innecesarias: **no demuestra una reducción
de contexto, tokens, latencia ni retrabajo**. No se ejecutó un A/B ni corresponde
atribuirle el techo histórico de ahorro. Si este costo no se acepta, revisar el
wording antes de promover, no ocultarlo como si fuera una poda neta.

**Artefactos y rollback:** `/tmp/opencode/point6a-qa.py` y
`/tmp/opencode/point6a-candidate/{baseline,result}.json` conservan el chequeo,
snapshots anteriores y métricas de esta corrida; son temporales, no un archivo
durable. El plan conserva resultados y alcance. Un rollback canónico debe
restaurar solo ambas skills, las dos copias previas de Claude, sus 25 entradas y
documentación de esta etapa, conservando el plan previo y los fixes GitHub. No
resetear repos, restaurar índices ni ejecutar installers. Antes de una promoción
se requiere backup durable/ledger de los destinos exactos según 6.e.

**Estado:** cerrada técnicamente en canónicos, no desplegada ni publicada. El
tradeoff queda registrado, sin afirmar ahorro. Por indicación posterior del
usuario se pasa a especificar B y se difiere la promoción para hacerla conjunta.
Una regresión material permitiría reabrir A; no prolongarla solo por wording.

### 6.h. Etapa B — Verificación y Revisión por etapas

**Estado:** aprobada, implementada y validada solo en canónicos. El usuario respondió
«Perfectro. vamos por B!» a ese alcance explícito; resultado en 6.i, sin despliegue
ni publicación. Activos y candidato A se preservan.
Alcance: **6.3 `verificacion-antes-de-cerrar` + 6.5 `revision-por-etapas`**.

#### Diagnóstico y alcance

- Ambas skills tienen 45 líneas en Core y ya están compartidas con Claude por
  symlinks declarados. No crear copias ni tocar esos bindings/manifest.
- Verificación contiene triggers como «Antes de entregar resultado final o pedir
  review» y «Antes de cerrar una tarea». La obligación de evidencia es permanente,
  pero cargar el marco completo en toda confirmación no agrega necesariamente
  validación. «Completa y fresca» debe referirse a la afirmación y estado relevantes,
  no interpretarse como volver a correr una suite íntegra en cada respuesta.
- Revisión por etapas contiene un checklist específico de cumplimiento y calidad;
  se conserva. Su selección puede duplicar un procedimiento de review ya suficiente
  o activarse por la mera existencia de un plan/ticket, sin una revisión real.
- Claude tiene seis referencias a Verificación (`dev-test`, `reviewer`,
  `frontend-web-developer` y los tres backends Java/Python/TypeScript) y dos a
  Revisión (`reviewer`, `merge-conflict-resolver`): **ocho entradas en siete roles**.
  Todos tienen Read y no anuncian Skill. No añadir referencias a otros agentes.
- No hay referencias explícitas a estas skills en agentes Core, plantillas
  Knowledge/Ticketing ni overlays canónicos AUNE. Ninguno necesita cambios por B.
  El procedimiento formal de `code-reviewer` y el workflow local conservan prioridad.

#### Contrato candidato: Verificación (6.3)

Descripción orientativa:

> Usar para evaluar qué evidencia vigente y pertinente sostiene una afirmación
> material de corrección, validación o cierre, o por pedido explícito; no para
> confirmaciones sin cambios ni afirmaciones nuevas.

- Mantener siempre el deber de no afirmar éxito sin evidencia comprobada. No
  convertir la carga selectiva en permiso para omitir pruebas o inventar resultados.
- Seleccionar la skill cuando aporte evaluar pertinencia, cobertura o vigencia de
  la evidencia, no como paso rutinario por emitir una respuesta final.
- Aclarar el paso de ejecución: verificación suficiente/completa **respecto de la
  afirmación y el alcance**, sin exigir por defecto toda la suite/build pesado.
  Preservar las validaciones explícitamente requeridas por usuario o contrato local.
- Si la prueba ya se ejecutó y su resultado se leyó en este trabajo sobre el estado
  relevante, puede reutilizarse sin un rerun ritual. Código, formatter, configuración,
  dependencias o entorno que invaliden esa evidencia requieren revalidar lo afectado.
  No equiparar una evidencia histórica o no inspeccionada con una prueba vigente.
- Una skill no habilita comandos fuera del rol ni salta confirmaciones. Si no hay
  acceso o no es viable verificar, declarar qué queda sin comprobar y por qué; no
  afirmar que pasó ni ejecutar tests desde un rol read-only que no los permite.
- Conservar las distinciones lint/build/tests/comportamiento y la conexión entre
  prueba y criterio esperado. Una salida verde no prueba por sí sola el cambio.
- Salida breve con afirmación, evidencia, resultado y límites relevantes; no exigir
  un formulario vacío ni cambiar el formato requerido por el proyecto.

#### Contrato candidato: Revisión por etapas (6.5)

Descripción orientativa:

> Usar para estructurar una revisión de cumplimiento y calidad cuando ese contraste
> no esté ya cubierto por el procedimiento aplicado, o por pedido explícito; no
> por la mera existencia de un plan, ticket o archivo de handoff.

- Conservar íntegros los dos checklists y su orden: intención/alcance primero,
  calidad/riesgo después; si falla cumplimiento, señalarlo antes de cosmética.
- Acotar description/triggers a una revisión real que necesita ese marco. No cargar
  una segunda skill solo para repetir `code-review-branch-to-branch` o un workflow
  local ya suficiente. El usuario puede pedirla explícitamente.
- No hacer opcional el contraste de cumplimiento/calidad requerido por el rol o
  el proyecto, aunque no se cargue esta skill. No crear una revisión formal para
  una consulta ad-hoc que no la pidió.
- Mantener literalmente el guardrail actual de handoff aplicable/activo y archivos
  existentes: no exigir ni crear `verdict.md`, `result-dev.md` o carpetas por detectar
  un ticket o una referencia vieja. Las lecturas locales obligatorias siguen vigentes.
- Conservar evidencia por hallazgo material y separación bloqueante/no bloqueante.
  Adaptar presentación sin seis bloques vacíos; conservar formatos locales exigidos,
  snapshot, conversación, rereview y storage del review formal.

Las dos skills siguen separadas. Revisión evalúa alcance/calidad; Verificación
evalúa qué evidencia respalda una afirmación. No cargarlas como paquete automático
ni suponer que revisar sustituye ejecutar una prueba o viceversa.

#### Archivos, pruebas y promoción

| Dueño | Patch B candidato |
|---|---|
| Core | Dos `skills/{verificacion-antes-de-cerrar,revision-por-etapas}/SKILL.md`; sus entradas de README-AGENTS; CHANGELOG/plan; un test contractual focalizado (`tests/test_review_closure_contract.py`). No cambiar guías comunes ni agentes. |
| Claude | Solo las ocho entradas en los siete `base/agents/` ya identificados, condicionales y con acceso Read permitido; registro breve en README/CHANGELOG. No tocar headers, manifest, symlinks ni otras entradas, incluidas las de A. |
| Knowledge/Ticketing, overlays/productos | Cero ediciones. Preservar templates, autonomía, fixes GitHub, índices y configuraciones. |

Antes de implementar, congelar una baseline B que incluya **A como trabajo válido
preexistente**. No reutilizar a ciegas los fingerprints de QA A como si los archivos
que B cambia debieran seguir intactos; proteger el contenido A explícitamente y
marcar solo los nuevos paths/entradas autorizados. No resetear repos sucios.

| Caso contractual | Comportamiento que el texto debe preservar |
|---|---|
| Confirmación sin cambios ni nueva afirmación técnica | No forzar skill ni rerun; no inventar una validación nueva. |
| Se pretende afirmar tests pasados sin resultado comprobado | No declararlos pasados; verificar dentro de autoridad o explicitar el pendiente. |
| Evidencia ejecutada/leída en el mismo trabajo y aún vigente | Puede reutilizarse; no repetir la suite por cada cierre. |
| Formatter/código/config/entorno invalidan la prueba anterior | Revalidar lo afectado antes de sostener la afirmación. |
| Lint verde o test que no representa el criterio solicitado | No presentarlo como prueba de build ni de corrección funcional. |
| Reviewer sin permiso para ejecutar build/tests | Respetar el límite y declarar evidencia faltante, sin bypass. |
| Implementación se aparta del alcance aunque sus tests pasen | Señalar primero incumplimiento, sin ocultarlo tras calidad o tests verdes. |
| Review formal ya aplica el procedimiento completo | No duplicar cargas; conservar snapshot, conversación, formatos y rereview. |
| Consulta ad-hoc con ticket o handoff viejo | No crear handoff, carpetas ni workflow formal por reflejo. |
| Pedido explícito de una o ambas skills | Respetarlo con salida pertinente, sin equiparar revisión a ejecución. |

Pruebas: asserts de contrato/metadata y revisión de estos ejemplos, no un
clasificador ni una evaluación conductual del LLM. Ejecutar loader real de las dos
skills en sandbox y comprobaciones de configuración pertinentes, sin instalaciones
ni modelos. Reusar los tests existentes de handoff, metadata y review cuando cubran
una frontera modificada; no repetir toda la auditoría A sin cambios que la invaliden.
Verificar siete headers byte-idénticos, ocho entradas y cuerpos restantes intactos,
checklists y guardrail de handoff preservados, y assets A sin regresión.

Medir tamaño de descripciones, cuerpos y referencias por separado; buscar wording
acotado y no repetir el protocolo en siete prompts. El precedente A mostró costo
estático: no prometer que más condiciones equivalen a menos tokens o llamadas.

La promoción B se acumula con el lote conjunto. En el futuro bastaría promover
las dos skills Core (Claude ya las comparte) y las siete definiciones Claude;
documentación por lifecycle y backups focalizados, sin sync amplio ni settings.
Hasta entonces los links canónicos siguen leyendo la versión instalada anterior;
validar el contenido nuevo mediante staging, no editando a través del enlace.
Rollback B debe revertir solo su patch, **preservando A y los fixes GitHub**.

**Siguiente decisión:** B queda acumulada para el despliegue conjunto; por indicación
del usuario se podrá especificar C. C–E no se implementan automáticamente y no hay
autorización de modelos, publicación o despliegue inmediato por cerrar B.

### 6.i. Etapa B implementada y validada en canónicos

- **Cambios B:** dos skills con selección por necesidad real/pedido explícito;
  Verificación permite reutilizar prueba ejecutada y leída en el mismo trabajo si
  sigue vigente, exige revalidar lo invalidado y conserva límites del rol. Revisión
  evita la doble carga y conserva cumplimiento antes de calidad, sin crear handoff
  por archivos viejos. Ninguna hace opcional la obligación que ya exige el rol.
- **Roles:** ocho entradas condicionadas en siete archivos Claude, con Read ya
  disponible. Headers byte-idénticos y cuerpos fuera de esas entradas iguales a la
  baseline B, incluidas las entradas de A. No se tocaron bindings ni manifest.
- **Preservación:** los dos checklists de Revisión y su guarda literal de handoff
  activo/existente son byte-idénticos; se mantiene la regla central de Verificación
  y la separación entre lint, build, tests y comportamiento. Formatos locales,
  snapshot, conversación, rereview y storage del review formal conservados.
- **Scope:** B cambia 15 paths respecto de su propia baseline: seis Core y nueve
  Claude. No son 15 archivos adicionales a A: el acumulado A+B es **32 paths** en
  cuatro canónicos (Core 10, Claude 16, Knowledge tres, Ticketing tres). B no cambia
  Knowledge/Ticketing, agentes Core, guías comunes, runtimes ni productos/overlays.
- **Pruebas:** 15 tests nuevos de contrato más 31 regresiones focalizadas
  (metadata, review/helper y coexistencia A): **46 tests pasados**. Diez escenarios
  B vinculan expectativas a cláusulas; no son decisiones observadas de un modelo.
  El test del cierre rutinario falló primero contra la skill anterior.
- **Nativo:** `opencode debug config` antes/después en sandbox para `reviewer` y
  `dev-test` idéntico; `opencode debug skill` cargó ambas skills B desde las rutas
  de candidato, con cuerpos/metadata correctos. Dos enlaces de staging confirmaron
  el acceso Read de Claude al mismo contenido. No se lanzó Claude ni un LLM.
- **Integridad:** **603 fingerprints** protegidos incluyen el trabajo A, activos,
  fuentes ajenas, bindings e índices Git; todos iguales. HEAD de cuatro canónicos
  intacto, diff limitado a B respecto de su baseline y `git diff --check` correcto.
  Ningún staging/commit/push, instalación, despliegue, indexado o consulta remota.

**Tradeoff estático de B, bytes UTF-8:**

| Texto | Antes | Después | Diferencia |
|---|---:|---:|---:|
| Verificación completa | 1.980 | 2.613 | +633 |
| Su descripción | 123 | 209 | +86 |
| Su cuerpo on-demand | 1.798 | 2.345 | +547 |
| Revisión por etapas completa | 1.972 | 2.225 | +253 |
| Su descripción | 123 | 215 | +92 |
| Su cuerpo on-demand | 1.799 | 1.960 | +161 |
| Suma de siete roles Claude | 21.227 | 22.617 | +1.390 |

La suma de roles no representa el incremento por request; el máximo por rol de B
es +345 bytes. La salida deja de exigir bloques vacíos, pero se incorporan reglas
de selección, vigencia y acceso: **no hay poda estática neta ni ahorro operativo
demostrado**. No se ejecutaron modelos ni benchmarks. No atribuir menor cantidad
de cargas/reruns al hecho de que los tests textuales o la configuración pasen.

**Artefactos:** QA temporal `/tmp/opencode/point6b-qa.py` y
`/tmp/opencode/point6b-candidate/{baseline,result}.json`. La baseline B incluye A
como trabajo válido preexistente; no se reejecutó la auditoría A con un scope ya
obsoleto. El plan registra los resultados durables; `/tmp` no es archivo durable.
Rollback B restaura solo sus dos skills, ocho entradas, documentación y test,
preservando A y fixes GitHub; no resetear repos ni reemplazar roles completos.

**Estado:** B cerrada técnicamente en canónicos, añadida al lote pendiente de
promoción conjunta. Los links Claude siguen apuntando a la versión instalada
anterior hasta ese despliegue. Al cerrar B, C–E todavía no se habían iniciado.
No reabrir A/B por microiteraciones cosméticas; una regresión material sí lo ameritaría.

### 6.j. Etapa C — Contratos/datos y Performance/cache/concurrencia

**Estado:** aprobada, implementada y validada solo en canónicos; el usuario respondió
«Perfecto. avancemos» a ese alcance explícito. Resultado en 6.k, con A/B y activos
preservados, sin despliegue/publicación. Alcance: **6.7 `contratos-api-y-datos` + 6.8
`performance-cache-concurrencia`**, sin fusionar ni retirar sus checklists.

#### Diagnóstico y frontera entre las dos skills

- Cada skill tiene 21 líneas en Core. Sus bloques `Que hago` contienen checklists
  específicos, no solo obligaciones genéricas: compatibilidad/serialización y
  resiliencia en Contratos; cardinalidad/locks, cache e idempotencia en Performance.
  El solapamiento SQL no justifica borrar esas capacidades ni repartirlas de modo
  excluyente entre skills.
- Los triggers actuales de Contratos incluyen «En APIs, clientes externos, colas
  o integraciones»; los de Performance abarcan queries, ORM, DB, cache y colas.
  Deben referirse al cambio/pregunta o a un riesgo plausible, no a que el proyecto
  contenga esas tecnologías. No hace falta un incidente o benchmark previo para
  considerar un riesgo real de compatibilidad, costo o consistencia.
- Hay diez referencias planas en cinco roles Claude: `reviewer`, `code-reviewer`
  y los tres backends Java/Python/TypeScript. Todos tienen Read y no anuncian Skill.
  No añadir referencias a frontend, planner u otros roles donde no existen.
- Las dos contrapartes `base/skills/*/SKILL.md` Claude son copias regulares con el
  mismo cuerpo Core y sin `compatibility: opencode`. Aplicar el patrón compartido
  ya usado en A: dos symlinks al asset instalado OpenCode, no un mecanismo nuevo.
- No hay referencias explícitas en agentes Core ni plantillas Knowledge/Ticketing.
  En overlays AUNE aparecen ambas en la lista `Skills:` del backend Python de
  Market Data; fuente/producto coinciden. **Se conservan sin edición:** esa lista
  no declara carga obligatoria de todas y los triggers globales deben convivir con
  async, calidad/frescura, idempotencia y compatibilidad exigidas localmente. No
  usar esta poda para recortar reglas de pipelines, Alembic, APIs o validación local.

**Frontera operativa:** Contratos prioriza qué semántica/interfaz consumen otros y
qué compatibilidad debe preservarse; Performance prioriza costo, contención,
orden y consistencia de ejecución/estado. SQL, transacciones e idempotencia pueden
interesar a ambas: aplicar la que aporte el checklist necesario y ambas si hay dos
necesidades distintas. No repetir el mismo análisis ni cargarlas como paquete fijo.
Un workflow o skill de dominio que ya cubra esos riesgos puede ser suficiente;
eso no elimina la obligación de revisar los riesgos relevantes.

#### Contratos/datos (6.7): contrato candidato

Descripción orientativa:

> Usar al cambiar o revisar contratos de API/integración, datos compartidos o acceso
> a datos con riesgo relevante, o por pedido explícito; no por la sola presencia
> de APIs o DB en el proyecto.

- Alinear description y triggers con un impacto de interfaz, representación,
  consumidor o acceso a datos afectado por el cambio/pregunta. No exigir rotura
  demostrada para revisar compatibilidad.
- Preservar **literalmente** el bloque `Que hago`: REST/SOAP, errores, timeouts,
  idempotencia, trazabilidad, endpoints/payloads/serialización y el análisis de
  cardinalidad, joins, filtros, índices, locks y costo de acceso a datos.
- Preservar las cuatro viñetas originales de `Salida esperada`; aclarar que se
  reportan las aplicables, sin inventar una superficie DB ni bloques vacíos en un
  cambio que no la afecta. El formato requerido localmente mantiene prioridad.
- No cargarla por cada edición en backend ni para repetir un checklist local o
  de Performance ya suficiente. Respetar pedidos explícitos y contratos locales.
  Un cambio pequeño puede alterar semántica, auth, errores o consumidores.

#### Performance/cache/concurrencia (6.8): contrato candidato

Descripción orientativa:

> Usar cuando el cambio o síntoma pueda afectar costo de consultas, cache,
> transacciones, orden o concurrencia, o por pedido explícito; no por la sola
> presencia de backend, DB o cache en el proyecto.

- Seleccionar por superficie afectada o sospecha fundada de costo, bloqueo,
  inconsistencia, frescura o carrera. La falta de métricas no demuestra ausencia
  de riesgo y el tamaño del diff no reemplaza el análisis.
- Preservar **literalmente** `Que hago`: costo/contención/consistencia, cardinalidad,
  índices, scans, locks, round trips, fuente de verdad, refresh/invalidation,
  transacciones, idempotencia, orden y concurrencia. No convertirlo en una regla
  genérica que pierda esas preguntas concretas.
- Preservar las cuatro viñetas originales de salida y hacerlas proporcionales a
  lo afectado. Declarar supuestos o evidencia faltante, sin fabricar costos ni
  garantías de ausencia de carreras.
- No cargarla por la mera pertenencia al backend ni apilar Contratos por rutina.
  Tampoco habilita benchmarks, DBs, migraciones, infraestructura o índices: siguen
  rigiendo autoridad del rol, permisos y aprobaciones locales.

#### Archivos y límites del candidato C

| Dueño | Alcance a aprobar |
|---|---|
| Core | Dos `skills/{contratos-api-y-datos,performance-cache-concurrencia}/SKILL.md`: description/triggers y guidance breve de selección/salida; dos bloques `Que hago` y ocho viñetas de salida byte-idénticos. README-AGENTS/CHANGELOG/plan y test focalizado `tests/test_contracts_performance_selection.py`. No cambiar agentes ni guías comunes. |
| Claude | Solo diez entradas en los cinco `base/agents/` identificados, condicionales y con Read permitido; dos copias de skills a symlinks siguiendo el patrón existente, altas de esos dos bindings en manifest y registro breve en README/CHANGELOG. No alterar headers, entradas A/B ni otros bindings/catálogos. |
| Knowledge/Ticketing | Cero ediciones; conservar plantillas, autonomía y políticas de memoria/tickets. |
| Overlays/productos | Cero ediciones, incluido backend Python Market Data y sus dos referencias. Mantener reglas de dominio y fixes GitHub previos; no sincronizar por este candidato. |

No se cambia lógica funcional ni se ejecutan tests/builds de aplicaciones. No
retirar otras skills, mover dominio al Core ni ampliar permisos/modelos/hooks/MCP.
Si apareciera un requisito local de carga obligatoria incompatible con el
candidato, detener ese recorte y volver a discutirlo; no hacer prevalecer el global.

#### Validación compartida y promoción diferida

Congelar baseline C con **A/B como trabajo válido preexistente**. Comparar cinco
headers y los cuerpos de roles fuera de las diez entradas, ambos checklists y
ocho viñetas de salida, listas/bindings previos del manifest y todos los overlays.
No aplicar a C los fingerprints antiguos que aún trataban estos assets como
inmutables; proteger A/B de forma explícita y delimitar solo el nuevo patch.

| Escenario contractual | Selección/garantía que el texto debe expresar |
|---|---|
| Texto puramente presentacional sin cambiar semántica compartida | No cargar ambas por el stack del repo. |
| Backend tiene SQL/cache pero el cambio no afecta esas superficies | No imponer el paquete; mantener validación normal. |
| Campo de payload, serialización o error visible para consumidores cambia | Contratos relevante aunque el diff sea pequeño. |
| Fuente, unidad, timestamp o significado de dato compartido cambia | Revisar compatibilidad y reglas locales; no tratarlo como detalle cosmético. |
| Query en loop, cardinalidad o filtros cambian costo con salida compatible | Evaluar Performance; el solapamiento SQL no exige repetir el mismo checklist. |
| TTL, invalidación o refresh cambia frescura/consistencia | Performance relevante; sumar Contratos si afecta una garantía consumida externamente. |
| Migración/schema compartido puede alterar compatibilidad y locks | Ambas pueden aportar por riesgos distintos; ninguna autoriza ejecutar migraciones. |
| Orden, duplicación, idempotencia o carrera plausible | Evaluar consistencia sin exigir un bug demostrado ni inventar benchmarks. |
| No hay métricas ni contexto suficiente para descartar riesgo | Consultar evidencia puntual o declarar incertidumbre; no declarar inocuidad por ausencia de datos. |
| Review formal o skill local ya cubre el riesgo | No doble carga rutinaria; mantener procedimiento, severidad y formato exigidos. |
| Market Data invoca su especialización local | Conservar async, deduplicación, frescura, contratos y validación; no imponer Java/JPA u otro dominio global. |
| Usuario pide una o ambas skills explícitamente | Aplicar lo solicitado sin fusionarlas ni alterar permisos. |

Los escenarios sustentan asserts de texto/metadata y revisión manual del contrato,
no un clasificador ni una evaluación de decisiones LLM. Validar loader real con
las dos skills staged y paridad de lectura Claude, headers/configuración pertinente,
checklists/viñetas literales, manifest aditivo y coexistencia A/B. Reusar solo las
regresiones que cubran una frontera afectada; sin modelos, red, instalaciones ni
repetición indiscriminada de auditorías. Medir descripciones, cuerpos y referencias
por separado; no prometer una poda neta ni ahorro de llamadas por agregar condiciones.

Acumular C para la promoción conjunta. Sus links Claude canónicos al principio
leerán la versión activa anterior: probar el candidato en staging, no editar el
activo mediante el enlace. Al promover, Core antes de activar los bindings Claude;
el overlay Market Data conserva sus referencias, sin cambios de archivos por C.
Rollback revierte solo C preservando A/B y fixes GitHub, nunca resets de repos o
reemplazo completo de agentes. D/E siguen pendientes y requieren alcance propio.

**Siguiente decisión:** C queda acumulada para promoción conjunta. Por indicación
del usuario se podrá especificar D; no implementarla, publicar ni desplegar por
cerrar esta validación.

### 6.k. Etapa C implementada y validada en canónicos

- **Implementado:** description/triggers por impacto o riesgo plausible y pedido
  explícito, no por stack; diez entradas condicionadas en cinco roles Claude. No
  se fusionan skills ni se obliga a cargar ambas. Que una ya cubra un riesgo puede
  evitar duplicar el análisis, sin eliminar capacidades de SQL o consistencia.
- **Preservación literal:** los dos bloques `Que hago` y las ocho viñetas de
  `Salida esperada` son byte-idénticos. Selección/salida proporcional y límites de
  autoridad se aclaran fuera de esos bloques. Cinco headers y cuerpos de roles
  fuera de las diez entradas iguales a la baseline, incluidas las entradas A/B.
- **Bindings:** dos copias Claude convertidas al patrón de symlink del asset
  instalado OpenCode; manifest validado como baseline más exactamente esas dos
  altas, sin cambiar listas previas ni otros campos. Los destinos activos siguen
  con la versión anterior; la coherencia del candidato se comprobó en staging, no
  editando a través del enlace ni afirmando que Claude ya usa los textos nuevos.
- **Dominio local:** backend Python Market Data, sus dos referencias y todos los
  demás overlays/productos intactos; reglas async/calidad/frescura y workflows no
  recortados. Ninguna edición C en Knowledge/Ticketing ni lógica de aplicación.
- **Scope:** 16 paths relativos a baseline C: seis Core y diez Claude. A+B+C
  acumulan **37 paths** (Core 13, Claude 18, Knowledge tres, Ticketing tres); no son
  16 archivos adicionales. No se amplían tools/modelos/permisos/hooks/MCP ni se
  instalan runtimes, ejecutan benchmarks/DBs o cambian índices.
- **Pruebas:** 12 tests nuevos C y 46 regresiones focalizadas A/B/metadata/review:
  **58 tests pasados**. Doce escenarios documentados son expectativas respaldadas
  por cláusulas, no decisiones medidas de un LLM. El test del trigger genérico de
  Contratos falló primero contra el texto anterior.
- **Nativo:** `opencode debug config` antes/después en sandbox para `reviewer` y
  `dev-test` idéntico; `opencode debug skill` cargó ambos candidatos desde la ruta
  staged correcta con metadata y cuerpos esperados. Dos enlaces staged confirmaron
  paridad de lectura para Claude; no se lanzó ese cliente ni modelos.
- **Integridad:** 603 fingerprints protegidos incluyen A/B, activos, bindings
  previos, fuentes fuera de alcance, overlays e índices Git. Todos iguales, HEAD
  de cuatro canónicos intacto, diff limitado a C y `git diff --check` correcto.
  Sin staging/commits/push, despliegue, indexado o consultas remotas.

**Tradeoff estático C, bytes UTF-8:**

| Texto | Antes | Después | Diferencia |
|---|---:|---:|---:|
| Contratos/datos completa | 926 | 1.475 | +549 |
| Su descripción | 108 | 174 | +66 |
| Su cuerpo on-demand | 744 | 1.225 | +481 |
| Performance/cache/concurrencia completa | 977 | 1.528 | +551 |
| Su descripción | 108 | 177 | +69 |
| Su cuerpo on-demand | 786 | 1.266 | +480 |
| Suma de cinco roles Claude | 17.984 | 19.809 | +1.825 |

El máximo por rol C es +365 bytes; la suma de cinco archivos no es el incremento
por request. Preservar checklists y añadir condiciones/rutas crece en bytes: **no
hay poda estática neta ni ahorro operativo demostrado**. Se reduce duplicación de
mantenimiento y se busca evitar cargas redundantes, sin prometer menos tokens,
latencia, retrabajo o igual calidad del modelo. No hubo modelos/benchmarks.

**Artefactos y rollback:** `/tmp/opencode/point6c-qa.py` y
`/tmp/opencode/point6c-candidate/{baseline,result}.json` conservan la corrida,
baseline y métricas temporales; este plan conserva resultados durables. El QA
reutiliza helpers temporales A/B parametrizados, sin tocar scripts del stack.
Rollback C restaura solo sus dos skills, diez entradas, dos copias/bindings,
altas de manifest, documentación y test, preservando A/B y fixes GitHub; nunca
resetear repos ni reemplazar agentes enteros. Preparar backup durable/ledger de
destinos al autorizar el lote de promoción.

**Estado:** C cerrada técnicamente en canónicos, acumulada con A/B para despliegue
conjunto; no se desplegó ni publicó. Al cerrar C, D/E todavía no se habían iniciado.
No hay bloqueo técnico para pasar a especificar D por indicación del usuario.

### 6.l. Etapa D — Debugging sistemático

**Estado:** alcance reducido aprobado, implementado y validado solo en canónicos
(6.m). Skill Core, A/B/C y activos intactos. Sin despliegue/publicación.

#### Decisión: conservar Core, aclarar solo el adaptador Claude

- **Conservar íntegra la skill Core:** sus 42 líneas ya describen bugs, fallos y
  fixes no resueltos, y aportan un procedimiento específico. No modificar nombre,
  description, triggers, ocho pasos, reglas ni salida; tampoco agregar otra capa
  genérica o reformularla para justificar una poda. Conservar es una decisión válida.
- Mantener leer error completo, reproducir, revisar cambios recientes, recorrer el
  flujo/fronteras relevantes, separar hechos/hipótesis, una hipótesis a la vez,
  experimento mínimo y fix sobre causa comprobada. El freno tras el tercer intento
  fallido sigue literal; no equivale a permiso para dos fixes a ciegas previos.
- **Ajuste útil y acotado:** cinco roles Claude listan la skill sin condición ni
  acceso explícito: `dev-test`, `frontend-web-developer` y backends Java, Python y
  TypeScript. Tienen Read y no Skill; condicionar esas cinco entradas y explicitar
  lectura permitida del contrato evita depender de una tool ausente o de herencia
  implícita. No ampliar herramientas, duplicar el procedimiento o tocar otros roles.
- El binding Claude ya es symlink declarado al asset OpenCode. No cambiarlo, crear
  otra copia ni modificar manifest. No se encontraron referencias explícitas en
  agentes Core, plantillas Knowledge/Ticketing ni overlays AUNE: cero cambios allí.
- Evidencia ya indica no apilar su marco genérico cuando debugging cubre el
  análisis; no reabrir A/B/C ni agregar otra regla residente para repetirlo.

#### Entrada candidata y fronteras de activación

Para esas cinco entradas, wording orientativo:

> `debugging-sistematico`: solo por pedido explícito o para diagnosticar fallos
> inesperados/fixes no resueltos; sin `Skill`, leer con `Read`
> `~/.claude/skills/debugging-sistematico/SKILL.md`.

- Un bug inesperado puede requerir este marco aunque sea pequeño o afecte un solo
  archivo. No reservarlo solo para incidentes complejos, multicapa o reincidentes.
- Ejecutar validación normal no activa otra investigación si no aparece un fallo.
  Un rojo esperado de TDD con causa ya evidenciada no necesita reiniciar el ciclo
  completo; si la causa es dudosa o el resultado inesperado, sí investigar.
- Una reproducción/evidencia ya suficiente se aprovecha, no se descarta por venir
  en el handoff o trabajo actual. No usar esto como excusa para aceptar una causa
  sin verificar, omitir un repro relevante o declarar corregido sin validación.
- Pedido explícito de la skill se respeta; diagnosticar no habilita a un rol a
  implementar, correr infraestructura, leer secretos o eludir permisos. Si no puede
  obtener evidencia autorizada, pedir contexto o declarar el impedimento.
- Debugging puede requerir además un checklist específico de contratos, cache o
  concurrencia por el riesgo real; no imponer A/B/C como set ni eliminar sus deberes.

#### Archivos y validación del candidato D

| Dueño | Alcance a aprobar |
|---|---|
| Claude | Cinco entradas en `base/agents/{dev-test,frontend-web-developer,backend-java-developer,backend-python-developer,backend-typescript-developer}.md`; registro breve README/CHANGELOG. No cambiar headers, demás entradas, bindings o manifest. |
| Core | Test focalizado `tests/test_debugging_activation.py`, registro CHANGELOG y estado del plan. **Cero cambios** a la skill, agentes, README-AGENTS o guías comunes. |
| Knowledge/Ticketing, overlays/productos | Cero ediciones; A/B/C, dominio y fixes GitHub preservados. |

Congelar baseline D con A/B/C como trabajo válido previo, incluidas sus entradas en
esos cinco roles. Comparar los cuerpos fuera de la entrada D, headers y skill Core
completa byte a byte; symlink/manifest idénticos y ningún asset A/B/C modificado.

| Escenario contractual | Criterio a preservar |
|---|---|
| Validación normal pasa | No cargar debugging por el solo hecho de correr tests/build. |
| TDD rojo esperado con causa ya evidenciada | No iniciar una investigación redundante; seguir el cambio y verificarlo. |
| Bug inesperado pequeño y sin causa confirmada | Aplicar diagnóstico; el tamaño no exime de investigar. |
| Fix falló o síntoma reaparece | Investigar causa y cambios recientes, no apilar parches. |
| Tercer fix falla | Frenar y cuestionar entendimiento/arquitectura, no intentar un cuarto por reflejo. |
| Fallo multicapa | Seguir fronteras relevantes con evidencia, no auditar toda la arquitectura. |
| Repro/contexto requieren operación no autorizada | Respetar límites, pedir evidencia o declarar impedimento; no bypass. |
| Pedido explícito de debugging o skill | Leer/aplicar dentro de autoridad, sin obligar a cargar marcos genéricos extras. |

Estas expectativas sustentan tests de texto/metadata y revisión, no un clasificador
ni prueba de obediencia LLM. Verificar cinco entradas legibles por Read y que el
contrato resuelto coincida con la fuente esperada; si falta el activo o diverge,
detenerse para reconciliar el alcance, no copiar sobre la instalación por reflejo.
Un chequeo puntual de discovery/lectura puede aportar; no repetir auditorías nativas
de A/B/C ni builds de aplicaciones cuando no cambian configuración o protocolos.

Medir el costo de esas cinco referencias: agregar condición/ruta no implica ahorro
estático. El archivo Core y su descripción/cuerpo deben tener delta cero. Sin
modelos/benchmarks, cambios de permisos, instalaciones o despliegue durante D.

Al validar este avance documental, el audit previo de C se detuvo por drift en
`keycloak/.git/index` respecto de su baseline; el diagnóstico de fingerprints solo
identificó ese path, sin diferencias en los demás assets protegidos. Origen no
atribuido; no restaurar ni modificar ese índice, ni afirmar que el audit anterior
pasó. Antes de implementar D, tomar una baseline actual que preserve trabajo ajeno;
si aparecen diferencias de agentes/contratos, reconciliarlas antes de editar.
La validación D de 6.m hizo esa nueva foto y preservó el índice actual; no cambió
la baseline C ni convirtió su audit histórico fallido en un pass.

La eventual promoción solo añade esos cinco roles Claude al lote consolidado y
documentación según lifecycle; Core no necesita desplegar una skill idéntica por D.
Rollback revierte únicamente D, preservando A/B/C, las otras entradas de los roles y
los fixes GitHub; no restaurar archivos completos desde un commit viejo.

**Siguiente decisión:** acumular D con A/B/C para la promoción conjunta y especificar
E cuando el usuario indique avanzar. No implementar E ni desplegar/publicar por
cerrar D.

### 6.m. Etapa D implementada y validada en canónicos

- **Implementado:** cinco entradas Claude condicionadas por pedido explícito o
  diagnóstico de fallos inesperados/fixes no resueltos, con Read ya disponible.
  Los cinco headers y cuerpos fuera de esa entrada son iguales a baseline D,
  incluidas todas las entradas de A/B/C. No se agregan tools ni un loader nuevo.
- **Conservado:** archivo Core completo de 42 líneas, **2.038 bytes antes/después**,
  con metadata, ocho pasos, reglas, freno tras tercer fix fallido y salida intactos.
  Su contenido coincide con el activo existente y el binding resuelve correctamente;
  no se cambió el symlink, manifest ni README-AGENTS Core. No hay skill que redesplegar
  por D ni alteración de sus triggers/procedimiento OpenCode.
- **Pruebas:** ocho tests nuevos D más 58 regresiones focalizadas A/B/C/metadata y
  review/helper: **66 tests pasados**. Ocho escenarios son expectativas apoyadas
  en cláusulas, no decisiones medidas de un modelo. El test de activación falló
  primero contra la referencia genérica anterior.
- **Chequeo puntual:** loader real cargó `debugging-sistematico` desde staging
  con metadata/cuerpo correctos y paridad de lectura Claude. No se lanzó Claude ni
  modelos, ni se repitió debug config de etapas anteriores: no cambian su esquema,
  agentes Core, configuración o protocolos.
- **Baseline actual:** preflight solo encontró el drift ya conocido del índice
  Keycloak respecto de C. Se congeló su estado actual, sin inspeccionar contenido
  de aplicación, restaurar la versión previa ni atribuir el origen del cambio.
  **610 fingerprints** de D —incluidos A/B/C, activos, bindings, overlays e índices—
  permanecen iguales al terminar. El índice Keycloak actual se preservó; el audit
  C anterior conserva su resultado fallido, no se reescribió la evidencia.
- **Alcance:** diez paths respecto de baseline D: tres Core (test/CHANGELOG/plan)
  y siete Claude (cinco roles/README/CHANGELOG), cero Knowledge/Ticketing/productos.
  A+B+C+D acumulan **38 paths** (Core 14, Claude 18, Knowledge tres, Ticketing tres).
  HEAD de cuatro canónicos e índices protegidos intactos; `git diff --check` correcto.

**Tradeoff medido:** skill, descripción y cuerpo Core tienen delta cero. Los cinco
roles pasan de 17.438 a 18.273 bytes (+835 agregados; +167 por rol), por condiciones
y rutas de lectura. No es un ahorro estático ni una reducción de llamadas/modelo
demostrada. No se ejecutan benchmarks, instalaciones, indexados o aplicaciones;
sin staging/commits/push ni despliegue.

**Artefactos y rollback:** `/tmp/opencode/point6d-qa.py` y
`/tmp/opencode/point6d-candidate/{baseline,result}.json` registran la foto actual y
validación temporales; el plan guarda resultados durables. Rollback D revierte solo
sus cinco entradas, test y documentación, preservando A/B/C y el índice Keycloak
actual; no restaurar roles enteros ni snapshots antiguos de productos. Los helpers
de QA temporales se parametrizaron, sin tocar scripts runtime del stack.

**Estado:** D cerrada técnicamente y acumulada para despliegue conjunto. Al cerrar
D, E todavía no estaba especificada; no hay bloqueo técnico para avanzar por
pedido del usuario. Activos no modificados y no hace falta reiniciarlos todavía.

### 6.n. Etapa E — SDD/TDD/BDD pragmático

**Estado:** alcance aprobado, implementado y validado solo en canónicos (6.o), con
A/B/C/D y activos preservados. La revisión/promoción conjunta sigue diferida (6.p).

#### Diagnóstico y decisión de conservación

- La skill Core tiene 58 líneas y ya expresa spec liviana, escenarios de alto
  valor, no forzar Gherkin, test/repro-first cuando aporta y alternativas honestas
  de characterization, regresión o validación manual/integración para legacy.
  No reescribir ese procedimiento ni reemplazarlo por un principio genérico.
- **Conservar metadata completa, incluida la descripción:** ya anuncia conexión
  spec-comportamiento-validación sin ceremonias rígidas. Delta de catálogo cero;
  no modificarla solo para uniformar el estilo con las etapas anteriores.
- Conservar literalmente `Que hago`, `Heurística operativa` (con SDD/BDD/TDD y sus
  alternativas), `Trazabilidad mínima por rol`, `Reglas` y `Salida esperada`.
- El primer trigger sí es demasiado literal: «Cuando el usuario menciona SDD,
  TDD, BDD, criterios de aceptación, Given/When/Then, escenarios o pruebas de
  regresión». Una mención incidental no equivale a pedir un nuevo marco cuando
  intención y validación ya están resueltas. Esto es una posibilidad del contrato,
  no un fallo de comportamiento medido con modelos.
- Los otros tres triggers ya están condicionados a ambigüedad, necesidad de
  trazabilidad o decisión de estrategia: **preservarlos**. No quitar criterios ni
  pruebas por ser un microcambio si usuario/proyecto los exige expresamente.
- Hay ocho entradas genéricas Claude: `planner`, `reviewer`, `code-reviewer`,
  `dev-test`, `frontend-web-developer` y los tres backends Java/Python/TypeScript.
  Tienen Read y no Skill; condicionar solo esas ocho y explicitar lectura permitida.
- Binding Claude ya compartido y declarado: no tocar symlink/manifest ni crear
  copias. No hay referencias por nombre en agentes Core o plantillas addon, pero
  los roles y Higyrus sí contienen obligaciones explícitas de SDD/BDD y test-first.
  Esas reglas locales y de rol permanecen; no interpretar ausencia del nombre como
  ausencia del contrato. No modificar overlays ni `workflow-ticket-handoff`.

#### Selección candidata y límites

Cambiar únicamente el primer trigger por una formulación como:

> Cuando el usuario pide aplicar o explicar SDD/TDD/BDD, diseñar criterios/escenarios
> o definir estrategia de pruebas; no por citar un test o una regresión con intención
> y validación ya resueltas.

Añadir guidance breve fuera de los bloques conservados, sin nuevos formularios:

- No cargar el marco por cada mención de tests/escenarios/regresión ni duplicar
  una estrategia ya suficiente. Si el pedido es ambiguo o falta definir cómo se
  prueba el comportamiento, sigue siendo pertinente sin requerir palabras clave.
- Pedidos explícitos de metodología, criterios, escenarios o regresión y requisitos
  del proyecto se respetan, incluso en cambios pequeños. Si el costo/harness exige
  apartarse de lo pedido, explicitarlo y acordar una alternativa; no degradar
  silenciosamente TDD requerido a una validación que el usuario no aceptó.
  Cumplir un pedido de test concreto con estrategia ya fijada no exige agregar
  otra spec formal por reflejo.
- **Aplicar esta skill no activa handoff**, no inventa tickets ni exige archivos.
  Ad-hoc sin workflow habilitado se resuelve en la respuesta; proyectos que sí
  requieren handoff mantienen su contrato completo. SDD/BDD no convierte code
  review en implementación ni habilita comandos/escritura fuera del rol.
- Mantener trazabilidad proporcional: comportamiento/criterio, cambio y evidencia
  pertinente, sin apartados vacíos. Los formatos y lecturas locales obligatorias
  conservan prioridad. No crear plugins, agentes o documentos para cada microtarea.

Entrada orientativa para cada uno de los ocho roles Claude:

> `sdd-tdd-bdd-pragmatico`: solo por pedido explícito o si falta definir
> criterios/escenarios o estrategia de pruebas; sin `Skill`, leer con `Read`
> `~/.claude/skills/sdd-tdd-bdd-pragmatico/SKILL.md`.

Esto no exige cargar Debugging, Evidencia o Revisión como paquete. Un rojo esperado
de TDD no es por sí solo un fallo inesperado; una anomalía real sigue requiriendo
investigación y un cambio probado sigue necesitando evidencia de verificación.

#### Archivos, pruebas y preparación del cierre de punto 6

| Dueño | Alcance a aprobar |
|---|---|
| Core | `skills/sdd-tdd-bdd-pragmatico/SKILL.md`: solo primer trigger y guidance breve de selección/alcance; metadata, otros tres triggers y bloques operativos literales intactos. Test focalizado `tests/test_sdd_activation.py`, CHANGELOG/plan. No cambiar agentes, README-AGENTS, guías comunes o manifests. |
| Claude | Ocho entradas en los roles existentes, README/CHANGELOG. Headers, otras entradas A/B/C/D, binding y manifest intactos. |
| Knowledge/Ticketing, overlays/productos | Cero ediciones: activación de handoff, helpers, roles locales, artefactos y cierres por ticket preservados. |

Baseline E debe congelar A/B/C/D como trabajo válido y preservar el estado actual
de índices/productos, incluido Keycloak. No restaurar la baseline vieja C ni
reutilizar fingerprints con scope obsoleto para bloquear cambios E autorizados.

| Escenario contractual | Criterio que debe expresar el candidato |
|---|---|
| Microcambio con intención y prueba ya claras | No generar spec/Gherkin/archivos ni cargar el marco por rutina. |
| Conversación menciona un test o regresión existente | No equivale a pedir otra metodología. |
| Requerimiento ambiguo sin criterio de aceptación | Usar criterios/escenarios cuando cierren ambigüedad, sin depender de palabras clave. |
| Hay que decidir test-first, repro-first o evidencia alternativa | Aplicar el marco preservando los límites del harness/rol. |
| Usuario pide TDD o escenarios explícitamente, aunque sea un cambio pequeño | Respetar pedido; no descartarlo por el filtro de rutina. |
| Legacy con harness costoso o inaccesible | Characterization/regresión/manual con evidencia cuando sea compatible; informar y acordar cualquier desvío del pedido explícito. |
| Rojo esperado de test-first | No activar automáticamente una investigación redundante; sí investigar resultados inesperados. |
| Tarea ad-hoc con un ticket aislado o archivos viejos | No habilitar handoff por cargar SDD/BDD. |
| Higyrus con workflow activo o requisito local de test-first | Mantener handoff y reglas locales, sin universalizarlas a los otros repos. |
| Review formal con criterios ya dados | Contrastar cumplimiento; no crear implementación/handoff ni duplicar el procedimiento de revisión. |
| Formatter u otro cambio invalida prueba previa | Revalidar lo afectado según B, sin quitar evidencia por no cargar esta skill. |

Validar metadata sin cambios, literalidad de los bloques/otros triggers y ocho
headers/cuerpos fuera de su entrada. Probar lectura staged y discovery puntual con
el contenido candidato; sin nueva tool Skill, configuraciones o hooks. Reusar las
regresiones de A–D, metadata, review y handoff que cubran estas fronteras; escenarios
textuales no prueban comportamiento de un LLM. Sin modelos/benchmarks, builds de
aplicación, instalaciones ni indexado. Medir cuerpos y referencias, con descripción
de catálogo invariable; no prometer ahorro por añadir condiciones/rutas.

La promoción E se acumula con A–D: actualizar primero el asset Core antes de usarlo
por sus bindings Claude existentes; copiar solo roles efectivamente cambiados y
documentación del dueño, sin sync amplio ni settings/permisos. Rollback solo E,
preservando etapas previas e índices actuales. No publicar productos AUNE.

**Siguiente decisión:** revisar el inventario consolidado, backups y autoridad del
despliegue conjunto antes de promover (6.p). E está validada; terminarla no ejecuta
puntos 7–10 ni publica o despliega automáticamente. No toda skill revisada cambió.

### 6.o. Etapa E implementada y validada en canónicos

- **Implementado:** solo el primer trigger distingue pedido/necesidad de una mera
  mención, más guidance breve de selección/alcance. Ocho entradas Claude quedan
  condicionadas y legibles con Read existente; los ocho headers y cuerpos fuera
  de esa entrada —incluido A–D— permanecen iguales a baseline E.
- **Preservado literalmente:** metadata completa y descripción; los otros tres
  triggers; `Que hago`, `Heurística operativa` (SDD/BDD/TDD), `Trazabilidad mínima
  por rol`, `Reglas` y `Salida esperada`. Se conserva el binding/manifest existente,
  sin copias ni tool Skill nuevas. No hay delta en agentes o README-AGENTS Core.
- **Contrato:** pedidos explícitos/requisitos locales prevalecen, incluso en
  microcambios; cualquier desvío por costo/harness se explicita y acuerda. La carga
  no activa handoff, tickets o archivos ni convierte review en implementación.
  Se conserva el workflow completo donde sí es requerido, sin universalizarlo.
- **Pruebas:** once tests nuevos E y 66 regresiones A–D/metadata/review/helper:
  **77 tests pasados**. Los escenarios contractuales no prueban selección real de
  un LLM; el test de mera mención falló primero con el trigger anterior.
- **Chequeo puntual:** loader real cargó el candidato desde staging con metadata
  y cuerpo esperados, más paridad de lectura staged Claude. No se lanzó Claude ni
  modelos, se instalaron dependencias o se repitieron configuraciones nativas sin
  campos alterados. No hubo builds/tests de aplicaciones ni indexados.
- **Integridad:** 607 fingerprints congelan A–D, activos, bindings, overlays e
  índices actuales. Todos iguales; preflight E no detectó drift adicional respecto
  de D y preservó el índice actual Keycloak, sin restaurar snapshots C. HEAD de
  cuatro canónicos intacto, diff limitado a E y `git diff --check` correcto.
- **Scope:** 14 paths relativos a baseline E (cuatro Core y diez Claude), cero
  Knowledge/Ticketing/productos. El acumulado A–E es **40 paths**: Core 16, Claude
  18, Knowledge tres y Ticketing tres. No son 14 archivos adicionales a D.

**Tradeoff E, bytes UTF-8:** skill 3.058 → 3.818 (+760), cuerpo 2.772 → 3.532
(+760); descripción 211 → 211 y metadata completas sin cambios. Los ocho roles
pasan de 32.706 a 34.098 bytes (+1.392 agregados, +174 por rol). Se explicita
selección/autoridad, no se demuestra ahorro de tokens, llamadas o latencia.

**Artefactos:** `/tmp/opencode/point6e-qa.py` y
`/tmp/opencode/point6e-candidate/{baseline,result,lot-review}.json` son temporales;
este plan conserva los resultados durables. Rollback E revierte solo su primer
trigger/guidance, ocho entradas, test y documentación, preservando A–D e índices
actuales; sin resets ni sustitución de agentes enteros.

**Estado:** E cerrada técnicamente y acumulada con A–D, sin despliegue, staging,
commit o push. No hace falta reiniciar todavía. El siguiente trabajo es revisar
y preparar el lote de promoción, no empezar el punto 7.

### 6.p. Revisión consolidada de promoción — ejecutada después según 6.u

Las ocho heurísticas se revisaron y A–E están implementadas/validadas en fuentes.
Siete skills Core cambian; Debugging se conserva íntegra. Se condicionan 52 entradas
Claude en once roles y cuatro entradas de plantillas opcionales addon (56 en 15
archivos), sin cambiar modelos, variantes, tools, permisos, hooks o workflows.

**Balance estático total frente a las baselines anteriores a cada etapa:**

| Medida | Antes / delta | Después |
|---|---:|---:|
| Suma de las ocho skills completas | 12.634 bytes | 16.587 bytes (+3.953) |
| Suma de sus descripciones de catálogo | +572 bytes | No son tokens medidos |
| Suma de los 15 archivos de roles/plantillas | +9.778 bytes | Máximo +1.244 por un rol |

El agregado de 15 archivos no es el incremento por request ni todo ese texto es
residente a la vez. Sin embargo, **sí hay crecimiento estático**, también en las
descripciones que pueden anunciarse. La intención es selección más explícita,
menos duplicación de mantenimiento y evitar cargas/reruns rituales, **no una poda
neta ni una mejora operativa demostrada**. Tests y discovery prueban contratos,
metadata y preservación, no obediencia/calidad o ahorro del modelo. Revisar este
tradeoff antes de promover; no aprobarlo por el solo conteo de tests verdes.

**Inventario de fuentes preparado:** 40 paths en cuatro canónicos. Incluye cinco
módulos de tests nuevos y un fixture, el plan y documentación; **no son 40 destinos
de instalación**. Plan/tests no se instalan como instrucciones. Los fixes GitHub
anteriores de overlays siguen separados de este lote y sin publicar por arrastre.

**Destinos candidatos definidos antes del preflight; resultado real en 6.u:**

1. Siete skills globales Core efectivamente cambiadas; no redesplegar Debugging
   idéntica. Documentación administrada solo según su lifecycle; no regenerar
   opencode.json, catálogos de herramientas o plugins por este cambio textual.
2. Once definiciones Claude afectadas y hasta cuatro bindings nuevos de A/C según
   estado real del destino. Verificar antes presencia, headers/Read, composición y
   delta exacto respecto de las baselines; preservar guardrails/overrides locales.
   Un rol opcional ausente no se crea/habilita silenciosamente. No sync amplio que
   mergee settings/hooks/permisos. B/D/E ya comparten fuente: no relink por rutina.
3. Si los activos opcionales plan/build contienen la entrada genérica de Evidencia
   reconocida, actualizar solo esa entrada. No copiarlos desde templates ni activar,
   recrear o cambiar su visibilidad; preservar bloques Knowledge/Ticketing del 5.
4. Cero destinos producto AUNE por punto 6. Sus referencias locales y los fixes
   GitHub ya desplegados se conservan; nunca staging/commit/push en productos.

**Cobertura estructural global/local comprobada antes de promover:** ante la consulta del
usuario se auditaron los nueve canónicos de overlays y sus nueve productos
instalados (Higyrus, VB, Market Data, Keycloak, Gateway, Aggregator, Documento API,
Perfil Inversor y OMS API). En esa baseline, los 59 agentes locales por lado
coincidían fuente/producto; tras 6.r, VB tiene un delta canónico intencional pendiente
de sync. No usar la paridad histórica como comprobación del estado instalado actual.
No se encontraron overrides locales de las ocho skills genéricas, agentes Claude
locales que tapen los globales ni fuentes extra de skills declaradas en configs
locales; se siguieron también aliases de directorios sin recorrer ciclos.
Market Data conserva sus dos referencias explícitas en backend Python, sin exigir
un set obligatorio ni perder dominio. Punto 6 modifica la capa global y plantillas
opcionales globales de addons: **ningún overlay específico fue editado por A–E**.
No hace falta replicar archivos globales dentro de los nueve proyectos. **Esta
auditoría no demuestra alineación semántica de sus prompts/skills locales** (6.q).
Esto no
supone herencia de prompts OpenCode homónimos: sus roles/workflows locales se
preservan y comparten las skills globales, no se reemplazan por prompts Claude.
Si una adaptación transversal futura sí requiere overlay, revisar los nueve y
aplicarla donde corresponda sin copiar stacks o reglas de negocio entre proyectos.
Auditoría read-only: `/tmp/opencode/point6-overlay-coverage.py`; no prueba selección
conductual del LLM ni constituye un despliegue. Los fixes GitHub previos sí fueron
locales y ya cubren los nueve (ocho ajustados, VB ya compatible), fuera de este lote.

Preparar inventario final origen→destino y backup durable pinneado/ledger de los
assets existentes, incluyendo tipo archivo/link y permisos. Ante drift relevante
parar y reconciliar sin restaurar índices o descartar trabajo ajeno. Promover Core
antes de los bindings/roles Claude; comprobar paridad administrada, metadata,
configuración efectiva pertinente y guardrails sin modelos ni instalaciones.
Definir rollback de solo el lote y reinicio de clientes únicamente tras promover.

La implementación A–E no autorizaba por sí sola escrituras activas ni publicación.
La aprobación de la promoción/publicación se obtuvo después y se registra en 6.u,
con el lote real delimitado. No ejecutar modelos/benchmarks ni empezar 7–10 por
cerrar este candidato técnico.

### 6.q. Cobertura semántica de overlays — pendiente antes de promover

El usuario señaló correctamente que el overlay OpenCode de Virtual Broker puede
contener instrucciones propias equivalentes a las heurísticas revisadas. La
ausencia de skills locales homónimas o de referencias a sus nombres **no basta**
para concluir que sus prompts reciben todos los criterios de A–E. La auditoría
6.p confirmó resolución/paridad estructural, no esta equivalencia de comportamiento.
Se pausa la promoción hasta delimitar la alineación local necesaria.

**Inspección VB previa a su patch:** AGENTS.md, CLAUDE.md, siete agentes locales
y las skills de validación/build y code review. No hay planner local: ese rol usa
la base global. Los siete overrides restantes no heredan automáticamente cuerpos
de prompts globales, y una skill local de validación no recibe el texto de la
skill global Verificación por el solo hecho de tener un propósito similar.

Hallazgos previos a los ajustes VB implementados en 6.r:

- `virtual-broker-validacion-y-build/SKILL.md:16–17` se dispara «Antes de cerrar
  una implementación» o cuando valida dev-test. Es un trigger local amplio que
  la nueva Verificación global no reemplaza; evaluar selección por necesidad de
  decidir validación/evidencia y evitar recargas rutinarias.
- `agents/dev-test.md:32–38` ya limita el alcance a la validación mínima del cambio;
  no obliga a una suite completa. Conviene explicitar reutilización de prueba
  ejecutada/leída aún vigente y revalidación tras cambios invalidantes, sin omitir
  checks obligatorios ni ampliar ejecución de comandos pesados.
- `agents/reviewer.md:41` dice usar handoff «si existe». Hacer explícita su
  aplicabilidad al trabajo actual, sin convertir archivos viejos en intención
  vigente ni activar handoff por su mera presencia.
- AGENTS.md ya prohíbe set fijo y mantiene handoff opcional; backend/frontend ya
  condicionan test/repro-first al cambio y harness. **Conservar esas partes**.
  No reescribir por uniformidad ni introducir ocho listas nuevas de skills.

**Trabajo solicitado y completado en 6.s:** revisión semántica de los otros ocho canónicos,
con matriz por repo/rol/skill local: hereda global, ya compatible o requiere patch
local mínimo. Revisar selección, reutilización de evidencia, proporcionalidad,
handoff aplicable y no duplicación, no solo nombres de skills. Un problema
transversal se contrasta en todos; no corregir solo VB por ser el primer ejemplo.
Preservar cada stack, permisos, validaciones obligatorias, handoff/reader locales,
reglas de dominio y el procedimiento formal de review. Los cambios de política de
memoria o estrategia CodeGraph siguen fuera del punto 6, salvo alcance nuevo aprobado.

Los ajustes de acceso Read específicos de Claude permanecen globales mientras no
haya agentes Claude locales. No copiarlos mecánicamente a overlays OpenCode, ni
copiar skills globales para resolver un problema de wording local. Registrar
archivos/cambios concretos y pedir aprobación del alcance local antes de editar;
productos solo se sincronizan cuando ese despliegue se autorice, sin Git writes.

**Estado:** VB tiene su patch canónico validado en 6.r; los otros ocho y las tres
bases compartidas se validaron en 6.t sobre el alcance aprobado de 6.s. Todos sin
sync. A–E previas, activos y productos se preservan. La cobertura es de contrato,
metadata y composición, no prueba de conducta LLM. Publicación/despliegue pendientes.

### 6.r. Virtual Broker — alineación semántica local validada, sin sync

El usuario autorizó avanzar directamente con VB tras identificar los tres ajustes
locales. Se implementó en su fuente canónica, no en el producto instalado.

- **Skill local de validación:** seleccionada por pedido o necesidad de decidir
  comando/evidencia, cobertura, vigencia o restricciones; no por cada cierre o por
  el rol. Se reutiliza prueba ejecutada/leída en este trabajo solo si cubre lo
  requerido y sigue vigente; se revalida lo invalidado sin omitir checks exigidos.
- **dev-test:** conserva validación mínima por cambio; ejecuta lo faltante en el
  orden de checks obligatorios y pruebas relevantes. Se explicitan reutilización y
  cambios invalidantes (código, formatter, config, dependencias, entorno).
- **reviewer:** ticket/Jira debe ser aplicable al trabajo actual; handoff exige
  workflow de implementación aplicable/activo y archivo existente. ID/archivo viejo
  no activa handoff ni crea artefactos. Sigue read-only y sin validación final propia.
- **Conservado:** AGENTS/CLAUDE y guías anidadas, handoff opcional por defecto,
  test-first condicional existente, stack/datasources/seguridad, reglas de memoria y
  CodeGraph, code review formal, helpers, permisos, modelos y variantes. No se copian
  las ocho skills ni instrucciones de acceso Claude a prompts OpenCode.
- **Cinco paths VB:** `.opencode/agents/{dev-test,reviewer}.md`,
  `.opencode/skills/virtual-broker-validacion-y-build/SKILL.md`, `README.md` y
  `tools/test_workflow_contract.py`. El test queda fuera del manifest de despliegue.
  Core solo registra este estado en el plan; no se modifica el candidato global A–E.
- **Pruebas:** diez tests locales de contrato pasados; el de reutilización falló
  primero con el texto anterior. Los ejemplos son cláusulas verificadas, no
  decisiones medidas de un LLM. No se ejecutó Maven, npm, Cypress o una aplicación.
- **Nativo:** `opencode debug config` antes/después en sandbox conserva default
  agent y configuración efectiva de los siete agentes salvo prompts autorizados;
  los dos headers cambiados son byte-idénticos. Loader real carga el candidato
  local y los ocho globales A–E desde sus rutas staged, verificando sus cuerpos,
  no solo presencia de nombres. El alias Claude local resuelve al mismo candidato.
- **Guardas:** cinco bloques completos de la skill (Backend, Frontend,
  confirmaciones, evidencia mínima y salida) literalmente intactos. 663 fingerprints
  preservan los globales, assets fuera de alcance, productos, aliases e índices.
  HEAD de los cuatro globales y VB intacto; `git diff --check` correcto. No cambios
  globales activos, sync, Git staging/commits/push, permisos o llamadas remotas/modelos.

**Texto, bytes UTF-8:** skill local 2.257 → 3.126 (+869); dev-test 2.467 → 2.705
(+238), reviewer 3.020 → 3.205 (+185). Son aclaraciones de alcance/vigencia, no
poda estática ni ahorro de ejecución demostrado. No se recortan comandos, evidencia
o validaciones obligatorias para aparentar ahorro.

**Cross-stack y despliegue:** el symlink canónico `.claude/skills/` comparte la
skill local actualizada; el alias instalado del producto sigue apuntando a su
propia copia anterior. No hay sincronización implícita. Una futura promoción VB
alcanza solo tres assets runtime, con backups y autorización; no instalar tests o
README en la aplicación ni hacer Git writes allí. El producto no cambió en esta fase.

**Artefactos:** `/tmp/opencode/point6-vb-qa.py` y
`/tmp/opencode/point6-vb-candidate/{baseline,result}.json`, temporales. El plan y
README/test canónicos conservan el contrato/resultados durables. Rollback VB revierte
solo estos patches preservando A–E, fixes GitHub previos y trabajo ajeno; no resets.

**Cobertura al cerrar VB:** primer overlay alineado en canónico; los otros ocho
seguían pendientes y se revisaron después en 6.s. No extrapolar el patch VB ni
reescribir partes ya compatibles por simetría.

### 6.s. Ocho overlays restantes — especificación del lote aprobado

El usuario pidió revisarlos juntos, no ocho ciclos de aprobación ni ocho parches
a ciegas. Se completó una pasada de los ocho canónicos: **52 definiciones locales**
(los ocho code-reviewer son byte-idénticos, revisados una vez como contrato común),
guías de ambos clientes, siete skills locales de validación y los contratos de
handoff/memoria Higyrus relevantes. Aggregator no tiene skill de validación local:
sus comandos se gobiernan desde AGENTS/CLAUDE. Se contrastaron productos sin escribir.

**Baseline previa a implementar:** los ocho mantenían paridad fuente/producto en
agentes, guías/config y skills locales inventariadas. Sus cambios canónicos preexistentes
son `code-reviewer.md` y README del fix GitHub previo, ya sincronizados; no son
patches nuevos de esta revisión ni deben descartarse. No se ejecutaron tests/builds
de aplicaciones, Jira/GitHub, modelos, instalaciones o indexados. Solo se edita el
plan; inventario/fingerprints temporales en `/tmp/opencode/point6-remaining-sweep.json`
y script read-only `/tmp/opencode/point6-remaining-sweep.py`.

#### Matriz por repo: qué falta y qué conservar

| Repo | Ajuste mínimo propuesto | Preservación / particularidad |
|---|---|---|
| Higyrus | `dev-test` + skill `higyrus-validacion-y-build`: selección/reutilización de evidencia vigente; `reviewer`: verdict aplicable al trabajo y workflow activo, no cualquier archivo existente. | Mantener secuencia mínima spotlessApply/build/tests, spotless obligatorio antes del build final, cobertura multi-cliente y memoria por ticket resuelto. Master-dev/planner ya guardan workflow activo y test-first proporcional: no reescribirlos. |
| Market Data | `dev-test`: validar lo faltante/reutilizar lo vigente; `reviewer`: contraste breve de intención/criterios antes de riesgo; `master-dev`: handoff vigente solo en workflow habilitado. | Mantener pytest por componente, pnpm según frontend afectado, frescura/timestamps/async/idempotencia y APIs v1/v2. Skill de validación ya acotada; lista de skills del backend no obliga a cargar seis, se conserva. |
| Keycloak | `reviewer`: ticket/handoff aplicable, activo y existente; `master-dev`: un hilo con ticket no basta para habilitar handoff. La validación reutilizable debe llegar por el dev-test global, no crear uno local. | Solo cuatro agentes locales; dev-test se hereda del Core y está habilitado como target. Conservar reader local obligatorio, permisos/certs, revisión por tipo de cambio y confirmación de Maven/Docker. Skill de validación ya proporcionada al riesgo. |
| Higyrus Gateway | `dev-test`: evidencia vigente y validación faltante; `reviewer`: intención antes de riesgos; `master-dev`: handoff solo habilitado/aplicable/actual. | Mantener Maven, rutas/filtros/auth/orden reactivo/cache y Jib opt-in. Catálogo de validación ya específico, no copiar el formulario VB. |
| Aggregator | Mismos tres roles (dev-test/reviewer/master-dev), más alinear el texto de ejecución con el requisito local de usar `mise`. | Conservar exactitud financiera, módulo afectado, ampliar solo por riesgo y comandos gobernados en AGENTS. Hay una discrepancia de comandos/permisos detallada abajo; no resolverla ampliando Bash ni creando una skill nueva. |
| Documento API | `dev-test`: reutilizar prueba válida y ejecutar faltante; `reviewer`: primero alcance/criterios aplicables; `master-dev`: handoff habilitado y actual. | Mantener Gradle acotado, integridad DB/filesystem/OMS, autorización, PII y confirms de dependency-check/Jib/deploy. Skill de validación ya específica. |
| Perfil Inversor | Mismos tres roles: validación vigente, intención antes de calidad y handoff no activado por presencia. | Mantener invariantes de evaluación, historia, activación concurrente, auth y Maven/Spotless check; no convertir la poda en permiso para Flyway destructivo o autofix. |
| OMS API | Mismos tres roles: evidencia reutilizable, revisar primero objetivo y handoff actual solo con flujo habilitado. | Mantener modos FIX/OMS, state machine/outbox/idempotencia, alcance de Jest/build/e2e y opt-in de infraestructura, migraciones y autofixes. Skill de validación ya acotada. |

**Partes ya compatibles, sin patch por simetría:** separación de hechos/riesgos y
cambio mínimo, checklists técnicos/domain-specific, SDD/TDD condicional cuando se
declara, guards de aplicaciones/secretos y formato breve de los roles cortos. Las
skills de validación de seis repos distintos de Higyrus ya son catálogos por capa/
tipo de cambio y no imponen carga por cada cierre; no reescribirlas solo para añadir
la misma explicación en todas. Code-reviewer conserva íntegro el procedimiento
formal, ticket, Jira una vez, snapshot, conversación/rereview e informe incremental.
La ausencia de un hallazgo no prueba conducta LLM; la decisión es de contrato textual.

#### Brecha compartida detectada — corregir donde se define la base

La revisión de Keycloak mostró una brecha que el patch de skills A–E no reescribía:
Core `agents/dev-test.md:30–36` todavía ordena formateo/build/tests en secuencia sin
explicitar reutilización. Claude `base/agents/dev-test.md:18–24` conserva lo mismo.
Core `agents/reviewer.md:36` aún toma `verdict.md` por existencia, como los reviewers
Higyrus/Keycloak. No crear un clone Keycloak para esconder un problema heredado.

Se amplió explícitamente el alcance aprobado a **tres definiciones base**:

1. Core `agents/dev-test.md`: evidencia ejecutada/leída aún vigente, ejecutar solo
   lo faltante/revalidar lo invalidado; mantener checks requeridos y autoridad.
2. Claude `base/agents/dev-test.md`: criterio semántico equivalente, sin cambiar
   tools, modelo, hooks ni entradas A–E ya aprobadas.
3. Core `agents/reviewer.md`: contrato/criterios aplicables al trabajo actual y
   handoff solo con flujo activo y archivo existente; mantener read-only.

Este complemento fue aprobado e implementado en 6.t; no estaba cubierto por la
inyección de skills ni está desplegado todavía. El reviewer Claude ya contrasta intención
antes de calidad y no nombra verdict/handoff en ese paso: no cambiarlo por simetría.
Políticas de memoria, reader y estrategia CodeGraph quedan fuera de este lote.

#### Excepción Aggregator: `mise` frente a instrucciones antiguas

AGENTS/CLAUDE:41–42 exige tareas `mise` y prohíbe invocar `./gradlew` directamente.
El cuerpo de `agents/dev-test.md:24` aún recomienda `classes`, `testUnit`,
`testIntegration` o `scripts/build.sh`; los headers de master-dev/backend/dev-test
conservan allows Gradle antiguos. Son hechos del overlay, no comprobación de que
los comandos reales fallen: no se ejecutó ninguno.

El patch textual propuesto debe remitir a las tareas `mise` que define el contrato
local, sin inventar equivalencias ni introducir un helper nuevo. **Este alcance
preserva headers/permisos**: no añadir allows Mise, cambiar Bash general ni retirar
permisos por arrastre. La allowlist legacy se registra como hallazgo separado; no
prometer que cambiar wording implementa un bloqueo técnico de Gradle. Un recorte o
enforcement adicional requiere autorización explícita y diseño acotado propios.

#### Lote candidato único para aprobar y validar

- **23 archivos runtime locales:** siete dev-test (todos salvo Keycloak), ocho
  reviewer, siete master-dev (todos salvo Higyrus) y una skill de validación Higyrus.
  Más documentación/tests focalizados de cada dueño, sin instalar esos tests en
  productos. No cambiar backends/frontend ni roles de soporte ya compatibles.
- **Tres archivos runtime compartidos** listados arriba, con documentación/test
  focalizados según Core/Claude. No modificar las otras skills A–E ni crear roles.
- Headers y guardrails íntegros, salvo cualquier excepción futura autorizada por
  separado. Preservar bloques obligatorios de Higyrus y reader local Keycloak; no
  opcionalizar memoria/handoff ni habilitarlo en los seis repos review-only.
- Congelar una baseline consolidada que preserve A–E globales, VB, fixes GitHub
  preexistentes, índices y cambios ajenos. No usar las fotos antiguas para resetear
  árboles. Comparar equivalencia semántica, no igualdad de stacks o comandos.
- Validaciones: reutilización vs cambio invalidante, checks faltantes, evidencia no
  inspeccionada, handoff viejo/ID aislado, flujo Higyrus activo obligatorio, cierres
  con memoria, herencia global Keycloak y no reactivación de handoff en review-only.
  Tests contractuales, headers/config nativa en sandbox y paridad de skills/aliases;
  no modelos, builds de aplicación, migraciones, servicios o índices.

**Estado:** lote aprobado, implementado y validado solo en canónicos (6.t), sin
cambios de permisos ni despliegue. La baseline consolidada preserva A–E, VB y fixes
previos. Los resultados se revisaron juntos, no en ocho rondas por proyecto.

### 6.t. Lote complementario de ocho overlays y tres bases — validado sin sync

- **Implementado:** 23 archivos runtime locales y tres compartidos, exactamente el
  alcance de 6.s. Siete dev-test locales reutilizan prueba ejecutada/leída vigente
  y validan faltantes/invalidaciones; ocho reviewers contrastan intención aplicable
  antes de riesgos y handoff requiere workflow activo/archivo existente; siete
  master-dev no activan handoff por ticket o presencia de archivos.
- **Higyrus:** selección de su skill por necesidad de secuencia/cobertura, sin
  recarga solo por cerrar. Secuencia mínima, comandos, spotless obligatorio antes
  del build final, reglas y salida se preservan literalmente en cinco bloques.
  Las líneas de cierre con memoria del ticket se mantienen: reutilizar una prueba
  no exime de verdict/result ni de persistir/actualizar memoria cuando el flujo cierra.
- **Keycloak:** no se creó dev-test local; sigue resuelto desde Core. El sandbox
  incorporó la base candidata como fallback para comprobar composición, no un
  override canónico nuevo. Reader obligatorio y restricciones de seguridad siguen.
- **Aggregator:** cuerpos de master-dev/dev-test remiten exclusivamente a las tareas
  `mise` de AGENTS; no se inventan tareas ni se ejecutó ninguna. Los allows Gradle
  legacy se conservaron literalmente con los headers: no hay permisos nuevos ni
  enforcement de shell añadido, y la discrepancia de allowlist sigue registrada.
- **Bases compartidas:** secuencia de dev-test Core y Claude con mismo criterio de
  evidencia vigente/faltante/revalidación; reviewer Core exige contrato aplicable
  y handoff activo/existente. Memoria, hooks, tools y demás entradas A–E intactos.
- **Regresiones de cada dueño:** ocho helpers locales `tools/test_workflow_contract.py`
  (25 tests en total), tres tests compartidos nuevos Core y las regresiones previas.
  Resultado conjunto: **115 tests pasados** = 80 Core + 25 locales de los ocho +
  10 VB. Son contratos de texto/metadata, no respuestas observadas de un modelo.
- **Nativo:** nueve perfiles sandbox antes/después (ocho proyectos y una base), con
  sus configuraciones efectivas iguales fuera de prompts. Se validaron las 52
  definiciones locales, el fallback candidato Keycloak y las dos definiciones base
  OpenCode; Claude se verifica por header, contrato y secuencia equivalente, no se
  lanzó ese cliente. Dependencias existentes, sin installs, modelos ni apps.
- **Integridad:** 26 frontmatters runtime byte-idénticos. Se verificó preservación
  de líneas de dominio, reader, CodeGraph y guardas fuera de las cláusulas editadas.
  949 fingerprints mantienen A–E/VB, productos, activos, aliases, fuentes fuera de
  alcance e índices actuales. HEAD de 13 canónicos intacto, `git diff --check` correcto.
  Ningún sync, staging/commit/push, Jira/GitHub, build de aplicación, migración o índice.

**Scope de fuente:** 47 paths respecto de la baseline nueva: cinco Core, tres Claude
y 39 en los ocho overlays (runtime + README + test de cada dueño). Knowledge,
Ticketing y VB no cambian en este lote. Se preservan los patches GitHub preexistentes,
incluidos README ya sucios; no se restauró a HEAD ni se descartó trabajo ajeno.
En los 13 canónicos hay 95 paths Git sucios acumulados: 87 corresponden al punto 6
y ocho code-reviewer previos al fix GitHub, que siguen fuera de sus nuevos parches.
Estos conteos no son destinos de despliegue: tests/plan/README de overlays no se
copian a aplicaciones por la promoción runtime.

**Tradeoff:** los 26 textos runtime pasan de 47.736 a 54.016 bytes (+6.280 sumados),
no un incremento por cada request. Headers/descripciones se mantienen, se agregan
condiciones de alcance y evidencia. No se afirma poda estática neta ni ahorro real
de modelos, latencia o retrabajo. No se ejecutaron benchmarks ni corridas LLM.

**Artefactos y rollback:** `/tmp/opencode/point6-batch-qa.py` y
`/tmp/opencode/point6-batch-candidate/{baseline,result}.json` son temporales; el plan,
READMEs y tests fuente conservan el resultado/contrato durable. La baseline incluye
todo el trabajo previo y estado actual de índices, no la foto vieja C de Keycloak.
Rollback solo del lote complementario, sin roles enteros desde commits antiguos,
resets de repos ni restauración de productos. Backups durables de destinos se
preparan al autorizar la promoción conjunta.

**Estado:** cobertura global/local del punto 6 validada en canónicos para los nueve
repos; ninguno se sincronizó en esta etapa. Antes de darlo por desplegado falta
inventario exacto origen→destino, preflight de composición/drift, backup/rollback y
promoción conjunta global + local autorizada. No avanzar automáticamente al punto 7.

### 6.u. Promoción conjunta global + nueve overlays y publicación autorizada

El usuario pidió continuar con sincronización, commits y pushes. Se revisaron
status/diff/log, archivos exactos, composición activa y remotos de 13 canónicos.
GitHub se verificó como `juanma91m`, por cuenta explícita sin cambiar la activa;
SSH usa `github-juanma91m-v2`. GitLab confirmó `juanma.91m`; el Core conserva su
mirror habitual. Todos los main remotos coincidían con el HEAD local del preflight.

- **54 destinos:** 48 archivos, cuatro nuevos enlaces compartidos y dos parches de
  una entrada en agentes opcionales existentes. Siete skills Core, dos agentes
  Core y documentación administrada, once agentes Claude, cuatro bindings A/C y
  los assets runtime locales de los nueve proyectos. No se copiaron plan/tests ni
  README de overlays a aplicaciones; no se regeneró opencode.json ni settings/hooks.
- **Composición:** Core dev-test/reviewer y roles Claude coincidían con sus bases
  previas reconocidas antes de sustituir texto. En plan/build solo cambió la entrada
  de Evidencia; headers, bloques Knowledge/Ticketing del 5 y extras preexistentes
  permanecieron. No se crearon roles ausentes ni se activaron builtins deshabilitados.
- **Backups:** snapshot durable pinneado
  `~/.config/opencode/.stack-sync-backups/point6-20261027T015258Z/` con ledger,
  antes/después por destino y tipo archivo/link/modos. Promoción atómica de cada
  archivo, Core antes de enlaces Claude. Rollback disponible solo para ese ledger,
  comprobando ausencia de ediciones posteriores, nunca reset de un repo o índice.
- **Paridad:** los 54 destinos coinciden con su artefacto aprobado. Loader real
  global encuentra las ocho skills actuales y las ocho referencias Claude globales
  resuelven al mismo asset; aliases locales de validación Higyrus/VB comparten el
  contenido ya actualizado del producto. No son solo nombres presentes.
- **Validación:** configuración efectiva global sin cambios fuera de prompts;
  nueve perfiles de proyecto construidos desde los assets instalados en sandboxes
  con dependencias existentes, todos válidos, sin instalaciones en productos.
  115 tests focalizados pasados tras la sincronización (80 Core + 25 locales del
  lote de ocho + 10 VB). No se lanzó Claude, una aplicación ni modelos/benchmarks.
- **Integridad:** 947 assets protegidos preservados en despliegue, incluidos índices
  de canónicos/productos y configuración sensible solo por fingerprint; ningún
  cambio a settings, hooks, providers, permisos, Corpus/DB/Engram/binario o índices.
  Las únicas escrituras de producto son los assets de agentes explícitamente
  autorizados; no Git staging/commit/push allí. El estado actual Keycloak se conservó.

**Publicación autorizada:** 95 archivos revisados, un commit por cada canónico:
Core, Claude, Knowledge, Ticketing y los nueve overlays. Incluye los ocho
code-reviewer del fix GitHub que ya estaban sincronizados pero pendientes de
publicación; no son lógica de aplicación ni cambios ajenos. Stage solo del
inventario exacto, escaneo de secretos/private, hooks normales, sin amend/force.
Core se publica a GitHub y GitLab; los demás al remoto canónico previsto. Verificar
árboles limpios y main remoto igual, conservar hashes/resultados finales en
`publication.json` del backup y memoria sin otro commit circular solo de hashes.

**Reinicio requerido:** configuración se carga al iniciar. Cerrar/reabrir los
OpenCode y Claude afectados después de esta promoción; una sesión abierta puede
conservar instrucciones/catálogos anteriores. Publicar no exige otro reinicio
adicional. La evidencia es de contratos/configuración/paridad, no demuestra ahorro
operativo o conducta LLM. Se conserva el balance estático y sus límites de 6.p.

### 6.1. `analisis-tecnico-evidencia`

**Estado:** implementado y validado en canónicos dentro de la etapa A; sin
despliegue/publicación. Contrato en 6.a–6.f y resultado/tradeoff en 6.g.

- **Objetivo:** evitar su carga rutinaria antes de cualquier solución técnica;
  reservarla para análisis de evidencia material o pedido explícito.
- **Revisión:** description, triggers, formato proporcional, quince referencias
  y fuente compartida OpenCode/Claude, con ownership de Core y addons preservado.
- **No perder:** distinción entre hechos e inferencias, incertidumbre relevante,
  trazabilidad y validación, incluso cuando no se cargue la skill.
- **Cierre:** compartir pruebas con 6.2 según 6.d, registrar decisión propia y
  decidir después sobre despliegue; no avanzar automáticamente a la etapa B.

### 6.2. `cambio-seguro-enterprise`

**Estado:** implementado y validado en canónicos dentro de la etapa A; sin
despliegue/publicación. Contrato en 6.a–6.f y resultado/tradeoff en 6.g.

- **Objetivo de revisión:** distinguir el aporte específico de compatibilidad y
  riesgo legacy de las obligaciones generales de cambio mínimo ya presentes en
  roles y guías. No cargarla solo porque un repo sea enterprise.
- **Revisión propuesta:** estrechar triggers y salida; condicionar sus diez
  referencias Claude y compartir la fuente por symlink, sin agregar referencias
  a agentes donde no existe ni tocar checklists específicos.
- **No perder:** análisis del flujo previo, compatibilidad, alcance acotado,
  separación entre fix y cleanup y preservación de trabajo ajeno.
- **Validación:** casos compartidos de 6.d, distinguiendo microcambio con alcance
  resuelto de cambio con compatibilidad no trivial, incluso si el diff es pequeño.
  Registrar resultado propio sin fusionarla con Evidencia ni cargar ambas por rutina.

### 6.3. `verificacion-antes-de-cerrar`

**Estado:** implementada y validada en canónicos dentro de B (6.i). Despliegue
conjunto pendiente; contrato activo todavía sin cambios.

- **Objetivo de revisión:** evaluar si cargar el marco completo en todo cierre
  agrega algo frente al deber permanente de respaldar afirmaciones con evidencia.
  No convertir una eventual carga selectiva en verificación opcional.
- **Revisión propuesta:** seleccionar por evaluación de evidencia material, no por
  cualquier respuesta final; aclarar pertinencia, vigencia, reutilización legítima
  y límites del rol, sin debilitar el deber permanente de verificar.
- **No perder:** no declarar éxito sin evidencia comprobada; vincularla con el
  comportamiento esperado y distinguir lint, build, tests y validación funcional.
- **Validación:** escenarios de 6.h, incluidos cierre sin novedades, prueba ya
  vigente, cambio invalidante y comando verde que no demuestra lo solicitado.

### 6.4. `debugging-sistematico`

**Estado:** D implementada y validada en canónicos (6.m). Skill Core conservada
íntegra; cinco referencias Claude aclaradas, sin despliegue.

- **Objetivo de revisión:** comprobar si su selección es proporcional al problema,
  sin degradar investigación de causa raíz ni permitir fixes por intuición.
- **Revisión propuesta:** entrada condicional y Read explícito en los cinco roles
  existentes, sin tool nueva, binding ni cambio del procedimiento. No apilar
  Evidencia cuando el diagnóstico ya cubre ese análisis.
- **No perder:** lectura del error, reproducción, hipótesis explícita, prueba
  mínima, análisis de fronteras relevantes y freno ante fixes fallidos reiterados.
- **Validación:** escenarios de 6.l, incluyendo rojo esperado, bug pequeño,
  reincidencia, freno al tercer fix y operación de reproducción no autorizada.

### 6.5. `revision-por-etapas`

**Estado:** implementada y validada en canónicos dentro de B (6.i). Checklists y
guarda de handoff conservados; despliegue conjunto pendiente.

- **Objetivo de revisión:** determinar cuándo aporta una estructura adicional de
  revisión y cuándo el rol o el workflow formal ya cubren ese procedimiento.
- **Revisión propuesta:** acotar triggers y dos referencias Claude a una revisión
  real no cubierta; mantener los dos checklists y evitar doble carga con el
  procedimiento formal, sin reabrir el contrato del punto 3.
- **No perder:** primero contrastar alcance/intención y luego calidad/riesgo;
  separar bloqueantes de mejoras opcionales y sostener hallazgos con evidencia.
- **Validación:** escenarios de 6.h: review ad-hoc sin handoff, implementación contra
  spec existente y PR formal con snapshot/rereview. No exigir ni crear verdicts
  en repos o tareas sin handoff de implementación activo.

### 6.6. `sdd-tdd-bdd-pragmatico`

**Estado:** implementada y validada en canónicos dentro de E (6.o). Metadata,
bloques y otros triggers literales intactos; promoción conjunta pendiente (6.p).

- **Objetivo de revisión:** evitar que cada microcambio dispare especificación,
  Gherkin o ceremonia test-first, manteniendo trazabilidad cuando reduce riesgo.
- **Revisión propuesta:** distinguir pedido/necesidad real de una mención incidental
  de tests; conservar los otros tres triggers y la práctica actual. Añadir selección
  y Read en los ocho roles sin activar handoffs ni alterar pedidos explícitos.
- **No perder:** criterios/escenarios útiles, conexión spec-cambio-evidencia,
  regresión y alternativas honestas para harness legacy costoso. Respetar pedidos
  explícitos de TDD/BDD y requisitos locales, aunque la tarea sea pequeña.
- **Validación:** casos de 6.n, incluidos microcambio claro, requerimiento ambiguo,
  pedido explícito, harness costoso y convivencia con handoff/review locales.

### 6.7. `contratos-api-y-datos`

**Estado:** implementada y validada en canónicos dentro de C (6.k), con checklist
y salida literales intactos. Despliegue conjunto pendiente.

- **Objetivo de revisión:** comprobar que se selecciona por un contrato o acceso
  a datos realmente afectado, no solo porque el proyecto tenga APIs o una DB.
- **Revisión propuesta:** description/triggers selectivos, preservación literal de
  checklist/salida, cinco referencias Claude y fuente compartida por symlink. No
  borrar el solapamiento SQL ni las referencias/reglas locales de Market Data.
- **No perder:** compatibilidad de endpoints/payloads, errores, timeouts,
  idempotencia, trazabilidad y costo de consultas. Las reglas locales de JDO,
  JPA, SQL u otras tecnologías permanecen en sus overlays.
- **Validación:** escenarios y checks de 6.j, desde cambio sin superficie afectada
  a payload compartido, cliente externo o consulta con riesgo de costo/bloqueo.

### 6.8. `performance-cache-concurrencia`

**Estado:** implementada y validada en canónicos dentro de C (6.k), con checklist
y salida literales intactos. Despliegue conjunto pendiente.

- **Objetivo de revisión:** evaluar carga por superficies sensibles o evidencia
  de riesgo, sin imponerla por el mero uso de backend, persistencia o cache.
- **Revisión propuesta:** selección por riesgo plausible/superficie afectada, cinco
  referencias Claude y fuente compartida, preservando checklist/salida. No
  convertir la falta de bug o métricas en ausencia de riesgo ni recortar dominio.
- **No perder:** cardinalidad, índices, scans, locks, I/O, transacciones,
  idempotencia, orden, consistencia e invalidación/frescura de cache.
- **Validación:** escenarios de 6.j, incluido cambio ajeno a esas superficies,
  query en loop, carrera y cache con fuente de verdad/refresh ambiguos.

**Regla de avance de 6.1–6.8:** completar relevamiento y alcance exacto por etapa
acordada, compartir propuesta y pruebas, pedir aprobación e implementar/validar
solo lo autorizado. Registrar una decisión por heurística; separar del grupo
los cambios que requieran otro alcance. Conservar una skill sin cambios es válido.
Despliegue, publicación y cualquier ensayo real con modelos necesitan autorización
propia; no repetir suites amplias ni benchmarks por cada subsección por reflejo.

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

### 7.a. Diagnóstico y matriz inicial

**Estado del relevamiento inicial:** solo planificación y documento; ese pedido
no autorizaba implementación. Aprobación posterior y resultado de 7.A en 7.f.

Se contrastaron fuentes de Core/Knowledge/Background/Documents y la adaptación
Claude. `opencode debug agent` sin `--tool` aportó metadata global de nueve roles
en OpenCode `1.19.4--202610232249`. Los nombres MCP se tomaron del filtro configurado
de once herramientas, sin iniciar ni invocar el servidor. La evaluación offline
usó las funciones puras reales V1 `evaluate`/`disabled`, no una aproximación por
nombres. Evidencia temporal: `/tmp/opencode/point7-audit/matrix.json`; las
conclusiones relevantes se conservan aquí, no dependen de que sobreviva `/tmp`.

| Roles globales revisados | Engram: permiso/visibilidad calculados | Cuatro tools aisladas: catálogo | Ocho tools editoriales: catálogo |
|---|---|---|---|
| `knowledge-reader` | 11 allow/visibles, incluidos 5 mutadores | Visibles; runtime restringe a `master-dev` | Ocultas |
| `master-dev` | 11 allow/visibles | Visibles; caller autorizado, sujeto a las demás guardas | Ocultas |
| `planner`, `agent-design` | 11 allow/visibles por rol | Visibles; runtime restringe a `master-dev` | Ocultas |
| `code-inspector`, `reviewer`, `code-reviewer`, `dev-test` | 11 allow/visibles por rol | Visibles; runtime restringe a `master-dev` | Ocultas |
| `documenter` | 11 allow/visibles | Visibles; runtime restringe a `master-dev` | Visibles |

Esta matriz **no prueba llamadas MCP ni requests reales**, ni convierte permisos
técnicos amplios en autoridad del rol. Las restricciones del prompt, sesiones,
guardas internas y herramientas de lanzamiento se evalúan por separado. El caso
del reader sí tiene una brecha concreta: su contrato prohíbe escribir, pero no hay
deny MCP que materialice esa prohibición. No presentar el caso Background como
la misma brecha: allí ya existen guardas de caller/targets/profundidad en runtime.
Tampoco afirmar que se corrigió el contrato de todos los demás roles read-only
por corregir únicamente el reader.

**Clasificación Engram actual:**

- Mutadores presentes: `mem_save`, `mem_session_summary`, `mem_update`,
  `mem_judge`, `mem_review`. Este último combina `list` y `mark_reviewed`: no
  habilitarlo entero como lectura por el nombre ni por su primera operación.
- Lecturas/utilidades restantes: `mem_search`, `mem_context`,
  `mem_get_observation`, `mem_suggest_topic_key`, `mem_current_project`,
  `mem_doctor`. El doctor ejecuta diagnósticos, sin modo de reparación en su
  handler. No se necesita modificar Engram para separarlos en este cliente.
- `mem_delete` no está en el filtro OpenCode de once; no contarlo entre los cinco
  esquemas retirables. El filtro Claude es distinto y no se normaliza.

**Cobertura local de fuentes, no certificación de configuración instalada:** se
revisaron nombres y cláusulas pertinentes de herramientas, permisos, delegación,
memoria y routing en los 59 agentes de los nueve canónicos y sus `opencode.json`.
Ninguno define un `knowledge-reader` homónimo ni declara las cinco restricciones
MCP o las cuatro de lifecycle. Las configuraciones locales no agregan reglas para
esas familias. No hace falta copiar el reader global en nueve overlays.

| Overlay | Agentes revisados | Contrato relevante que preservar |
|---|---:|---|
| Higyrus | 11 | Lectura directa del coordinador; curator local separado; `planner`, `master-dev` y `dev-test` conservan sus obligaciones de memoria y cierre de ticket |
| Virtual Broker | 7 | `master-dev` permite `task → knowledge-reader` y lo exige para cambio no trivial o antecedente probable; handoff opcional |
| Market Data | 7 | Reader permitido desde `master-dev`; especialistas Python y frontend, sin agregar targets aislados |
| Keycloak | 4 | Reader permitido y requerido en cambios no triviales/antecedentes; `dev-test` global, sin crear clon local |
| Higyrus Gateway | 6 | Reader permitido; contratos y permisos locales sin recortes |
| Aggregator | 6 | Reader permitido; tareas `mise`, dominio y allowlists existentes intactos |
| Documento API | 6 | Reader permitido; no confundir este dominio de documentos con Addon Documents |
| Perfil Inversor | 6 | Reader permitido; contratos locales y review formal intactos |
| OMS API | 6 | Reader permitido; especialista TypeScript sin ampliar targets aislados |

En ocho `master-dev` locales está explícito el target reader; Higyrus conserva
su ruta especializada con lectura directa y curator. Eso no permite inferir
delegación Background a reader: la matriz de `delegate` es otro control y no lo
incluye. La instalación opcional de Knowledge puede componer targets adicionales;
las verificaciones posteriores deben examinar el resultado efectivo, no asumir
herencia automática ni equiparar `task` con `delegate`.

### 7.b. Alcance recomendado: tres decisiones separadas

**7.A — reader MCP, implementado/validado solo en canónicos y sandbox (7.f).**

- Agregar en `Knowledge/agents/knowledge-reader.md`, bajo `permission`, cinco
  denegaciones por nombre real OpenCode: `engram_mem_save`,
  `engram_mem_session_summary`, `engram_mem_update`, `engram_mem_judge`,
  `engram_mem_review`, cada una `deny` para cualquier argumento.
- Usar permisos explícitos, no solo wording ni un flag cosmético: en V1 la
  denegación completa retira el schema y el ejecutor MCP consulta ese permiso
  antes de llamar al servidor (`session/tools.ts`, `ctx.ask`). Verificar ambas
  propiedades; ocultar un schema por sí solo no alcanza como prueba de rechazo.
- No agregar allows de lectura: conservar el acceso heredado y cualquier
  restricción existente, sin reemplazar el ruleset completo. Mantener modelo,
  variant, Bash deny-default con dos wrappers de consulta/estado, edit/task deny,
  cuerpo, lectura Qdrant y las políticas proporcionales del punto 5.
- Retirar también `mem_review(action=list)` del reader: el permiso V1 aquí se
  resuelve por nombre de herramienta y patrón `*`, no discrimina ese argumento.
  Es una renuncia deliberada a una operación opcional mixta, no a búsqueda/contexto.
  No crear endpoint, wrapper ni bifurcación de Engram para recuperarla en este lote.
- La adaptación Claude ya enumera cuatro tools MCP de lectura/utilidad; conservarla
  sin ampliar su catálogo ni copiar seis herramientas de otro filtro. Contrastar
  la equivalencia de no mutación y la recuperación disponible, no igualdad de nombres.
- No modificar globalmente el filtro MCP ni las instrucciones de registro del
  servidor. Estas seguirán describiendo las once herramientas registradas; la
  autorización y los schemas del reader serán un subconjunto. No prometer que
  desaparecen todas las menciones textuales a mutadores del contexto.
- Tradeoff explícito: deny de cinco herramientas actuales es menor y no introduce
  allows; no es una política fail-closed para cualquier herramienta futura.
  Un test debe fallar ante cambios del inventario curado sin reclasificarlo.
  Una allowlist de namespace exigiría resolver precedencia y restricciones
  heredadas; no introducirla de forma encubierta en este alcance.

**7.B — lifecycle aislado, implementado/validado y promovido (7.l–7.m).**

Objetivo: ocultar `delegate_isolated`, `delegation_accept`, `delegation_apply` y
`delegation_discard` fuera de `master-dev`, sin tocar matriz read-only, lectura de
resultados, navegación, cancelación, continuación o tareas same-session. Ownership
Background, no distribuir una lista mantenida manualmente entre Core y 59 overrides.

Antes de implementar hay que especificar y probar un mecanismo de composición
propio del addon que alcance roles globales/locales y nativos, preserve denies
explícitos de usuario/proyecto/sesión y no habilite a `master-dev` donde ya estaba
restringido. Las guardas existentes, targets Java/frontend/master, profundidad,
sesión raíz, estado accepted, checks de patch/workspace y revisión manual quedan.
No ampliar a Python/TypeScript por existir esos especialistas en overlays.

El relevamiento inicial mostró catálogo redundante. La especificación está en
7.h–7.k y los resultados aprobados en 7.l–7.m. No se ensancharon permisos,
reescribieron overlays ni intervino el runtime base. Si un cambio posterior lo
requiere, volver a propuesta en vez de aceptar el atajo. La autorización de
promoción/publicación posterior está registrada en 7.m.

**7.C — no añadir poda editorial en este lote.**

Documents ya instala `tools: false` global para sus ocho herramientas mediante
`scripts/configure_tool_visibility.py`; `documenter` las habilita explícitamente.
La matriz inicial no muestra ocho schemas editoriales sobrantes en roles de
código. El comando `publicar-documento` no fija agente y usa otro workflow de
skill/wrappers; `master-dev` no tiene un target `documenter` explícito en Core ni
en los nueve headers locales revisados. No retirar esos wrappers ni habilitar
targets por inferencia. Conservar el flujo actual; si se desea rediseñar routing
de requests mixtos, especificarlo con Documents y punto 9 antes de recortar.
No atribuir ahorros nuevos a una ocultación que ya estaba aplicada.

### 7.c. Archivos y ownership del primer candidato

Solo después de aprobar 7.A:

- Knowledge: `agents/knowledge-reader.md` (cinco permisos),
  `tests/test_opencode_integration.py` (clasificación, reglas y regresiones),
  `README.md` (contrato efectivo y limitación de `mem_review`).
- Core: este plan, para registrar ejecución/evidencia. Sin editar agentes Core,
  manifests ni scripts globales de política de tools para un contrato de Knowledge.
- Contrastar sin editar: reader Claude, `scripts/manage_agent_autonomy.py`,
  filtros MCP y nueve overlays. Un hallazgo que exija cambiar un flujo local o
  añadir un archivo runtime sale del lote y vuelve a aprobación.

Fuera: binario/patch de Engram, DB/memoria activa, indexación Qdrant/CodeGraph,
plugins/hooks, herramientas editoriales, Background, modelos, políticas del
curator y permisos de otros roles. No crear agentes, skills ni comandos.

### 7.d. Validaciones exigidas; resultados y fronteras comprobadas en 7.f

Una pasada consolidada al implementar, sin modelos ni intentos mutadores contra
la memoria activa:

1. Tests del inventario de once herramientas y partición 5 mutadoras/6 restantes;
   `mem_review` se clasifica completa como mixta. Detectar nuevos nombres, no
   aprobar automáticamente el drift. Claude mantiene su allowlist de cuatro.
2. Cargar el candidato en sandbox mediante loader nativo y `opencode debug config`;
   inspeccionar metadata efectiva de reader con `debug agent` sin `--tool`.
   Aplicar `evaluate`/`disabled` reales: cinco deny/ocultas; otras seis sin cambio
   respecto del baseline, sin convertir restricciones previas en allow.
3. Rechazo de cada mutador con argumentos válidos, incluido summary y
   `mark_reviewed`, usando ruta de permisos real y servidor/contador de prueba
   aislado: ninguna llamada debe alcanzar el backend. No confundir un rechazo
   por payload inválido o herramienta inexistente con enforcement de permisos.
4. Pruebas positivas de búsqueda/contexto/original y de recuperación por wrappers
   existentes, con fixtures/stubs de datos aislados. Confirmar que ni inventar un
   summary ni editar archivos ni llamar storage/seed son fallbacks del reader.
   Capturar qué frontera prueba cada fixture; no afirmar obediencia LLM.
5. Nueve perfiles sandbox con assets locales canónicos, dependencias existentes y
   referencias absolutas: reader global sin shadow, rutas permitidas de `task`
   conservadas (incluidas VB/Keycloak), memoria local Higyrus y curator intactos.
   Contrastar assets instalados antes de una eventual promoción autorizada;
   no ejecutar instaladores ni crear paquetes/índices en productos para auditar.
6. Diff de configuración: solo esas cinco reglas del reader pueden cambiar;
   headers restantes, filtros de servidor, políticas de los otros roles, Claude,
   Background/Documents, nueve canónicos/productos e índices sin cambios.
   Regresiones focalizadas Knowledge; no repetir suites de todo el stack por reflejo.

Resultado estático candidato: reader pasa de once a seis schemas Engram, **si la
composición final lo confirma**. Medir nombres/cantidad y bytes serializados de
schemas con metadata aislada; tokens solo con tokenizer apropiado. No extrapolar
a contexto total, costo, latencia ni calidad. No hace falta una corrida real de
modelo para demostrar permisos; cualquier ensayo conductual requiere otro diseño
y autorización. El resultado medido de 7.A y sus limitaciones se registran en 7.f.

### 7.e. Promoción, rollback y puerta de aprobación

El usuario autorizó **implementar/validar 7.A solo en canónicos y sandbox**, con
cobertura de todos los overlays específicos. 7.B sigue pendiente de especificación
y 7.C sin poda. La aprobación no
incluye sincronización, commits/pushes, cambios en productos o ensayos con modelos.

Si luego se autoriza desplegar: usar instalación selectiva del dueño Knowledge,
backup y ledger del reader activo; verificar configuración global y los nueve
perfiles antes/después, sin copiar nueve readers ni regenerar otros addons.
Reiniciar OpenCode y usar sesión nueva. Claude no requiere reinicio por 7.A si no
cambia ningún asset suyo; el reinicio pendiente de 6 es una cuestión independiente.

Rollback de 7.A: revertir solo el patch aprobado del reader/tests/docs y, si fue
promovido, restaurar solo su copia previa según ledger, comprobando drift antes
de sobrescribir. Sin reset general ni cambios de DB. Restaurar el baseline
también reintroduce la brecha conocida de mutadores en reader: no presentarlo como
una vuelta a un estado técnicamente read-only ni compensarlo ampliando permisos.

### 7.f. Implementación y validación de 7.A — 2026-10-27, canónicos y nueve overlays

**Aprobación:** el usuario aceptó 7.A y recordó aplicar el alcance en todos los
overlays específicos. Se comunicó antes de editar la interpretación operativa:
fuente compartida de Knowledge y comprobación efectiva de los nueve perfiles,
sin nueve copias locales innecesarias, sin despliegue/publicación. No se autorizó
7.B, recortes editoriales, ensayos con modelos ni cambios funcionales de productos.

**Implementado:** exactamente cinco líneas `engram_mem_*: deny` en el header de
`Knowledge/agents/knowledge-reader.md`. La comparación contra baseline prueba que
al quitar esas cinco líneas el archivo es idéntico, incluido cuerpo, modelo,
variant, wrappers, edit/task y reglas Playwright/Stitch. Se amplió
`tests/test_opencode_integration.py` y se documentó el contrato en `README.md`.
Core solo cambia este plan; ningún archivo runtime de los nueve overlays cambia.

**Cobertura efectiva, no solo búsqueda de nombres:**

- Preflight con `opencode debug config` y `debug agent knowledge-reader` en nueve
  sandboxes compuestos con los 59 agentes locales canónicos, configuración y
  referencias absolutas de cada repo, definición reader compartida y dependencias
  ya existentes. Se repitió sobre el candidato: Higyrus, Virtual Broker, Market
  Data, Keycloak, Gateway, Aggregator, Documento API, Perfil Inversor y OMS API.
- En **cada uno de los nueve**: cinco mutadores deny/ocultos y las otras seis
  herramientas Engram allow/visibles, calculado con funciones reales V1 sobre
  las reglas nativas obtenidas. Una restricción adicional de sesión de lectura
  sigue ganando; no se agregó ningún allow. Ningún reader local homónimo en
  canónicos ni productos. Las reglas de los demás roles y los cuerpos de todos
  los agentes del perfil permanecen iguales al baseline.
- Targets `task` y rutas especializadas intactos: VB/Keycloak conservan reader,
  Higyrus conserva lectura directa/curator y memoria obligatoria del cierre;
  Keycloak no recibe clon de `dev-test`. No se amplían targets aislados de Python
  o TypeScript ni se mezclan las matrices `task`/Background.
- La comparación nativa detectó orden variable de descubrimiento de skills en
  los allows `external_directory`. Se normalizaron **solo tramos contiguos de
  reglas con el mismo permiso y la misma acción**, conservando patrones,
  multiplicidad y límites de precedencia allow/ask/deny. No se ordenó el ruleset
  completo ni se descartaron permisos para hacer pasar el diff.

**Pruebas ejecutadas:**

- Integración Knowledge: **11 pasadas, una omitida**. Incluye inventario 5/6,
  cinco denies exactos sin nuevos allows, límites previos, allowlist distinta
  Claude, metadata MCP con nueve filtros aislados y wrappers reales con backend
  Python de fixture. La omitida requiere binario baseline explícito para contrastar
  un cambio de binario; no se cambió Engram y no se inventó un baseline equivalente.
- Política de memoria: **12 pasadas**; autonomía, lectores read-only, autoridad,
  persistencia proporcional y cierres locales siguen vigentes. Total final:
  **23 pasadas + una omitida**, no acumular reruns como tests adicionales.
- El binario nativo ejecutó una tool de prueba temporal que usa `ctx.ask` y un
  contador/backend en memoria, con HOME/XDG/config/DB aislados y sin credenciales:
  seis rechazos por `PermissionDeniedError` (cinco tools; `mem_review` se prueba
  con ambas acciones), seis lecturas/utilidades que alcanzan el fixture y control
  positivo de doce payloads que sí alcanzan el fixture al quitar los cinco denies.
  No se cuenta un error de schema o herramienta inexistente como rechazo válido.
- Siete checks nativos adicionales: consulta/estado Bash permitidos; storage,
  seed, CLI alternativo, edición y delegación a curator rechazados. Los wrappers
  reales de consulta/estado también preservan sus argumentos en un entorno
  aislado con backend de fixture, sin embeddings ni conexión Qdrant.
- **1.504 fingerprints protegidos** sin cambios: otros assets canónicos/globales,
  overlays/productos y sus índices. HEAD canónicos intactos; `git diff --check`
  correcto. Solo tres archivos Knowledge y este plan editados; instalación
  activa todavía conserva el reader anterior, sin promoción implícita.

**Medición estática:** registro MCP sigue en once, catálogo reader queda en seis.
La metadata real se consultó en proceso Engram aislado con `initialize/tools/list`,
sin invocar tools. JSON compacto UTF-8 de definiciones completas: **14.260 → 4.482
bytes**; mapa de input schemas: **7.128 → 2.261 bytes**. Son subconjuntos de metadata,
no captura de un request a proveedor, tokens medidos ni ahorro total de contexto.
Las instrucciones globales del servidor siguen describiendo sus once tools.

**Límites de evidencia:** `debug agent --tool` prueba el `ctx.ask` del contexto debug
nativo; el fixture no es el adaptador MCP completo de una sesión LLM. La relación
con el ejecutor MCP se verificó en fuente (`ctx.ask` antes de `execute`), y la
ocultación con el evaluador V1 real. No se ejecutaron llamadas mutadoras contra
Engram, lectura Qdrant real ni flujos de modelos. Por tanto no declarar probado
un recorrido MCP end-to-end, ausencia conductual de bypass/fallbacks, latencia,
calidad o ahorro operativo. Esto no bloquea el cambio declarativo comprobado.

Artefactos temporales: `/tmp/opencode/point7a-qa.py` y
`/tmp/opencode/point7a-candidate/{baseline,probed,profiles,matrix,result}.json`.
Contienen metadata seleccionada/hashes, no dumps de providers/credenciales. La
evidencia durable útil es esta sección y los tests canónicos, no la permanencia
de `/tmp`. El QA no instala paquetes, no ejecuta comandos funcionales de productos
ni altera los índices. Los tests de contrato/nativos son reproducibles mediante
`python3 -m unittest discover -s tests -p test_opencode_integration.py -v`, con
opt-ins `ENGRAM_CANDIDATE_BIN`, `OPENCODE_READER_NATIVE`,
`OPENCODE_TEST_DEPENDENCIES`, `OPENCODE_TEST_TMP` y `CLAUDE_READER_SOURCE` definidos
según el entorno; sin opt-in los checks nativos/de metadata se omiten explícitamente.

**Pendiente:** aprobación de promoción selectiva de Knowledge y, separadamente,
publicación canónica si se desea. Al promover el reader global, volver a comprobar
los nueve destinos/perfiles sin crear overrides nuevos. Rollback acotado en 7.e;
reinstalar/rebuild de Engram no es parte de este cambio. 7.B aún necesita propuesta.

### 7.g. Promoción selectiva y publicación autorizada de 7.A — 2026-10-27

**Aprobación posterior:** el usuario autorizó la secuencia propuesta de respaldo,
promoción del reader, verificación de los nueve perfiles y commit/push únicamente
de Knowledge y Core. 7.B queda para después; nunca se publica un producto AUNE.
Esta sección actualiza el pendiente histórico de 7.f, sin ampliar su implementación.

**Destino único promovido:** `~/.config/opencode/agents/knowledge-reader.md`,
idéntico a la fuente canónica; exactamente cinco reglas nuevas. No se ejecutó el
instalador completo, no se cambió el marker del addon ni `opencode.json`, no se
reconstruyó Engram ni se tocaron MCP, plugins, modelos, Claude o bases/corpus.
No se copiaron este plan, tests ni README a la instalación ni a productos.

**Backup durable pinneado:**
`~/.config/opencode/.stack-sync-backups/point7a-20261027T032508Z/`.
Contiene `before.md`, `after.md`, `ledger.json` con hashes/modo/alcance,
`profiles-before.json`, `profiles-after.json`, `matrix.json`, `verification.json`
y `rollback.py` autónomo. Su dry-run verificó integridad y destino, sin restaurarlo.
Para una restauración expresamente autorizada: `python3 <backup>/rollback.py
--apply`; rechaza drift y solo repone el reader anterior. La advertencia es
importante: ese baseline reintroduce la brecha MCP del reader. Reiniciar después
de restaurar; no modificar DB, fuentes o índices para volver atrás.

**Verificación post-promoción:**

- `opencode debug config` y metadata `debug agent` válidos en global y nueve
  sandboxes de perfiles construidos **desde los assets instalados de productos**,
  sin inyectar un reader candidato. El loader tuvo que consumir el global activo.
- Nueve inventarios de agentes/configuración/guías contrastados con sus canónicos:
  **59 agentes locales**, sin reader homónimo ni drift en esos assets. En todos
  los perfiles reader mantiene cinco deny/ocultas y seis allow/visibles; el resto
  de metadata, cuerpos, targets y controles queda igual al baseline instalado.
  Se conserva la normalización acotada de orden de skills explicada en 7.f.
- **1.503 fingerprints protegidos** durante la promoción, excluyendo únicamente
  el reader autorizado; incluyen productos, índices y otros assets globales y
  canónicos. **Cero escrituras de producto.** Verificar los productos no requirió
  instalar dependencias ni ejecutar `debug config` dentro de sus worktrees.
- Regresiones post-sync: **23 pasadas + una omitida**, con el mismo motivo y
  fronteras que 7.f. El test nativo sigue aislando contexto, DB y backend de fixture.
  No se cuentan estas repeticiones como tests distintos ni se ejecutaron modelos.
- Fuente/instalación en paridad. Catálogo del rol once→seis; las mediciones de
  metadata y límites de evidencia siguen siendo los de 7.f, sin alegar un request
  MCP end-to-end o ahorro operativo demostrado.

**Publicación autorizada:** tres archivos de Knowledge y este plan en Core,
mediante dos commits en `main`; Knowledge a GitHub y Core a GitHub y GitLab.
Owner/cuenta GitHub `juanma91m`, alias SSH `github-juanma91m-v2`; Core GitLab
conserva `juanma.91m`. Identidad de commit existente preservada, sin `auth switch`,
tokens persistidos ni cambios de Git config. Los tres HEAD remotos estaban iguales
a sus bases locales antes de publicar. Preparar ledger de publicación en el mismo
backup y registrar allí hashes, resultados y árboles limpios al concluir; no
editar/commitear otra vez este plan solo para insertar su propio hash final.

**Activación y siguiente paso:** cerrar/reiniciar OpenCode global y proyectos y
usar sesiones nuevas; la sesión que estaba abierta no se actualiza por editar el
archivo. Claude no cambia por 7.A. Confirmar publicación mediante su ledger y
memoria de cierre; después, solo planificar 7.B cuando el usuario lo pida, sin
implementar ni correr ensayos por el mero cierre de 7.A.

### 7.h. Diagnóstico específico de 7.B — 2026-10-27

**Estado del relevamiento inicial:** el usuario pidió solo planificar; ese pedido
no autorizaba implementar, desplegar, publicar o lanzar delegaciones. La aprobación
posterior y sus resultados están en 7.l.
Core y Background estaban limpios al abrir esta planificación. 7.A ya publicado;
su ledger confirma dos árboles limpios y los tres HEAD remotos de cierre iguales.

Alcance: cuatro herramientas de Background, exactamente `delegate_isolated`,
`delegation_accept`, `delegation_apply` y `delegation_discard`. El plugin fuente y
el instalado coinciden; la superficie sigue registrada globalmente y sus guardas
ya impiden el caller no autorizado. Es una poda de catálogo con defensa en capas,
no un reemplazo del enforcement por instrucciones o por ocultar schemas.

Relevamiento fresco, sin modelos ni ejecución de herramientas: metadata de trece
nombres de rol y evaluación pura V1 real sobre sus reglas. `plan` no está
disponible en la configuración efectiva de esta inspección; no se lo reactivó
para obtener un resultado. Evidencia temporal:
`/tmp/opencode/point7b-audit/report.json`.

| Baseline global revisado | Cuatro herramientas aisladas |
|---|---|
| `master-dev` | Allow/visibles; conservar exactamente sus restricciones y guardas existentes |
| `planner`, `agent-design`, `knowledge-reader`, `reviewer`, `code-inspector` | Allow/visibles, aunque los handlers/validator restringen el caller |
| `build` (hidden pero existente), `general` | Allow/visibles; hidden no equivale a disabled ni a permisos read-only |
| `explore`, `compaction`, `title`, `summary` | Ya deny/ocultas por sus reglas; no atribuir cuatro schemas ahorrados de nuevo |
| `plan` | No disponible en este baseline; preservar disable y probar el nativo habilitado solo en fixture |

Se contrastaron **1.501 fingerprints** con el ledger de publicación de 7.A, sin
divergencias. Los nueve canónicos/productos conservan sus **59 agentes** en
paridad, todos tienen `master-dev` local y ninguno declara estas cuatro tools
en el header. La revisión semántica de 7.a sigue vigente: las reglas de dominio,
handoff, memoria y delegación no se reemplazan por una nueva base genérica.
Higyrus 11, VB 7, Market Data 7, Keycloak 4 y Gateway/Aggregator/Documento API/
Perfil Inversor/OMS API 6 cada uno. Implementar debe volver a contrastar los
nueve perfiles efectivos; paridad actual no prueba un candidato futuro.

**Frontera de composición confirmada en fuente del runtime instalado:**

- `config/config.ts` carga global, Markdown y overlays/overrides antes del hook.
  `project/bootstrap.ts` inicializa plugins antes de consumidores derivados.
  `plugin/index.ts` ejecuta los callbacks `config(cfg)` sobre esa configuración
  resuelta. No hace falta tocar archivos locales para una política transversal
  del addon ni consultar `client.app.agents()` desde ese callback (evitar recursión).
- `ConfigAgentV1` ya normaliza `tools` a permisos durante el parseo. El hook debe
  cambiar **`permission`**, no confiar en añadir `tools: false` después del parseo.
  `Agent.state` aplica permisos del agente después de los globales.
- `Permission.evaluate/disabled` toman la última regla coincidente. Reemplazar
  una propiedad existente con spread/assign **no la mueve al final**: un `*` o
  `delegation_*: allow` posterior puede ganar. Hay que reinsertar las cuatro
  reglas concretas después de las demás, conservando el orden ajeno.
- Los siete nativos se crean en `agent/agent.ts`, no todos existen en `cfg.agent`.
  Recorrer solo los archivos declarados deja fuera `general` y otros nativos.
  La lista actual es `build`, `plan`, `general`, `explore`, `compaction`, `title`,
  `summary`; ese pequeño contrato con el host requiere prueba de inventario.

Context7 se consultó como referencia, pero devolvió también diseño de plugins V2;
no se toma como prueba de este flujo V1. La fuente `1.19.4--202610232249` es la
evidencia aplicable. No inferir compatibilidad universal ni hot-reload.

### 7.i. Candidato mínimo: una política aditiva del addon, sin nuevos allows

En `Background/plugin/background-agents.ts`, agregar un helper puro **no exportado**
y un callback `config` que únicamente compongan los permisos de esas cuatro tools:

1. Formar el conjunto de nombres de `cfg.agent` más los siete nativos conocidos.
   Es una enumeración dinámica de roles configurados, no una lista de proyectos
   o especialidades dentro del plugin global. Así un agente futuro declarado
   recibe la política sin agregarlo manualmente a 59 overrides.
2. **No tocar `master-dev`**, ni crearlo si no existe. Su definición, `tools`,
   permisos globales/locales/de sesión, modelo y prompt quedan iguales. No hay
   deny global con excepción allow ni se clona un master para rescatarlo.
3. Saltar roles con `disable: true`, sin activarlos, cambiarles hidden o añadir
   primarios. Para un nativo existente en el host pero sin configuración propia,
   crear solo su override mínimo de permisos; hereda su identidad nativa, no un
   prompt copiado. Los demás campos/configuraciones de roles se conservan.
4. Para cada otro rol, mantener en orden todas las entradas actuales de
   `permission` salvo las cuatro claves exactas afectadas; volver a anexar esas
   cuatro como `deny` completo. No ordenar el mapa completo, no cambiar `*`,
   `delegation_*`, Bash, edit, task o permisos MCP. Las cuatro excepciones
   allow/ask previas dejan de aplicar en un caller que runtime ya no autoriza.
5. Hacer la transformación idempotente y local al `cfg` de esa instancia. No
   escribir Markdown/JSON ni acceder a FS, sesiones o SDK desde el helper/hook.
   No exportar otra función desde el módulo plugin legacy: su loader interpreta
   los exports función como factories de plugins, no como helpers de tests.

**Resultado candidato:** cuatro schemas fuera de los roles no autorizados que
hoy los ven; `master-dev` conserva su situación previa, incluida una posible
restricción del usuario. Los roles que ya los tenían ocultos no aportan otro
recorte. No se garantiza cubrir futuros nativos no declarados: un cambio del
inventario del host debe fallar en pruebas y exigir reclasificación, no ampliar
la lista ni conceder autoridad silenciosamente.

**Controles que permanecen literalmente intactos:**

- Validator de launch: caller `master-dev`, target existente y uno de
  Java/frontend/master, profundidad raíz y API worktree; no fallback `git worktree`.
- Guards de caller de accept/apply/discard y validaciones de sesión/ownership,
  `review_pending`/`accepted`, workspace limpio, patch check, artifacts/cleanup;
  nada de auto-apply/merge/commit. No añadir Python/TypeScript a targets.
- Máscaras `tools: false` de las sesiones hijas, incluso una hija `master-dev`,
  y restricciones adicionales de sesión/mensaje. La excepción del rol no
  rehabilita trabajo aislado anidado ni restaura una tool deshabilitada.
- Las otras nueve tools Background: `delegate`, `delegation_open/read/tail/list`,
  `delegation_cancel/continue`, `same_session_task_list/read`; sus matrices,
  concurrencia, notificaciones, cola y TUI no cambian. No usar `delegation_*: deny`.
- Los cinco denies MCP de reader (7.A) y todos los workflows de memoria/handoff,
  guías, skills, modelos y permisos locales. No se necesita ningún override nuevo.

Los handlers custom no piden necesariamente `ctx.ask` como el adaptador MCP de
7.A. Por eso estos denies prueban visibilidad/filtro de solicitud, **no sustituyen
las comprobaciones de caller dentro de las tools**. Una exposición forzada por
otro override no debe convertir una invocación no autorizada en una mutación.
El hook tampoco es una política inmutable frente a otro plugin que cambie luego
la configuración o a un override explícito de sesión: comprobar la composición
final del stack actual y conservar el rechazo runtime aun si reaparece el schema.

**Wording y clientes:** no se cambia `DELEGATION_RULES`, la skill ni su trigger en
este lote. Hallazgo adyacente: el hook actual espera `input.agent`, pero el emisor
V1 inspeccionado de `experimental.chat.system.transform` pasa solo sessionID/model;
su guarda puede omitir la inyección. No reparar eso agregando consultas por turno
o un patch del host en 7.B, ni prometer que este cambio poda todo anuncio textual.
Las descripciones de las tools registradas siguen existiendo. Si se quiere
reparar esa inyección, requiere otro alcance con evidencia y aprobación.

Claude no porta este plugin ni el rol primario `master-dev`; usa capacidades
nativas de su runtime. Contrastar README/allowlists para no introducir esas cuatro
tools en Claude, pero no crear un addon Background equivalente ni tocar settings,
hooks o prompts Claude por simetría nominal. No se cambia su autoridad.

### 7.j. Archivos y pruebas propuestos

**Cinco archivos Background y este plan Core**, solo después de aprobar:

- `plugin/background-agents.ts`: constante acotada/helper privado/hook `config`;
  mantener registro y handlers, validator, lifecycle y hooks existentes.
- `test/catalog-visibility.test.mjs` nuevo: transformación real, precedencia,
  idempotencia, inventario de tools/nativos y regresiones positivas/negativas.
  Sin exportar helpers como plugins para hacerlos testeables ni copiar la lógica
  de decisión en el test. Lo recoge `node --test test/*.test.mjs` existente.
- `README.md` y `docs/validation.md`: visibilidad versus autoridad, contrato y
  comandos/opt-ins de pruebas. Playbook/skill actuales y TUI permanecen intactos.
- `manifest/addon.json`: únicamente agregar el hash del plugin server stock
  previo, `bdf92ff644d4636a114f85cfd23d783266523ad8834c91d4270ba18485ded839`, a
  `compatibleInstalledHashes` de `background-agents`. El lifecycle del dueño
  rechaza `modified` desconocido y exige backup para sustituir ese hash conocido;
  no permitir cualquier plugin modificado, no cambiar TUI, versiones o patches.
- Core: este plan para resultados. Ningún agente/manifest de los nueve overlays,
  Knowledge, Documents o Claude se edita; si aparece un shadow/drift material o
  hace falta otro archivo runtime, volver a alcance en vez de copiar todo.

**Validación en un lote consolidado, sin modelos/delegaciones reales:**

1. Unit tests del helper/hook real con permisos ausentes y normalizados desde
   allow/ask/deny, reglas exactas/objetos, `*`/`delegation_*` en ambos órdenes,
   entradas existentes antes del wildcard y configuración aditiva. Cuatro deny
   finales; entradas ajenas y su orden intactos; segunda aplicación idéntica.
   `master-dev` con permisos ausentes/allow/ask/deny o `tools[tool] = false` queda igual;
   si falta, no se inventa. Roles deshabilitados, nativos e internos conservan
   native/mode/hidden/disable; un rol configurado nuevo no es una excepción.
2. Prueba del inventario de siete nativos y las trece tools registradas (cuatro
   afectadas/nueve intactas). Si cambia el host o el registro, falla explícitamente.
   Test de sustitución managed: hash stock conocido se puede respaldar/sustituir
   en fixture y hash desconocido sigue rechazado. Regresiones existentes del addon.
3. Sandbox con el plugin candidato **completo** y dependencias ya disponibles:
   `opencode debug config` más `debug agent` deben demostrar que el callback real
   se ejecuta después de los overrides y antes de derivar permisos. No sustituirlo
   por inyección manual de los cuatro denies mediante config/fixtures.
   Contrastar el filtro V1 real de tools y sus reglas; probar cambio de rol
   master→planner→master y proyectos sin que se mezclen políticas.
4. Global + **nueve perfiles locales** desde canónicos y, antes de cualquier futura
   promoción, desde assets instalados; cubrir los 59 agentes y masters locales.
   Cuatro deny/ocultas en cada rol no autorizado efectivo, master sin delta,
   nativos habilitados y deshabilitados, excepciones más restrictivas heredadas,
   sesión deny y mensaje/tools false. Solo las cuatro reglas por rol pueden
   variar; targets `task`/read-only, 7.A y contratos locales intactos.
5. Llamadas directas a los handlers/validator reales con managers/clientes de
   fixture: no-master falla aunque se lo fuerce por fuera del catálogo; **ninguna
   mutación de worktree, Git, sesión o estado** debe ejecutarse. El validator puede
   consultar agentes antes del rechazo: no confundir lectura SDK con mutación.
   Master autorizado alcanza el manager de fixture; targets no admitidos,
   launch anidado y estados inválidos siguen rechazados. Comprobar las guardas
   existentes de apply/cleanup con datos aislados, no aplicar patches reales.
6. Diff y fingerprints de 7.A, TUI, configuración global persistida, once tools
   Engram, archivos/índices de productos y restantes canónicos sin cambios.
   Sin instalar paquetes, rebuild de host, API worktree real, reindex o benchmarks.

Ninguna prueba del candidato se ejecutó durante la planificación; ver resultados
posteriores en 7.l. La matriz inicial no prueba un lifecycle end-to-end. Los fixtures deben
declarar su frontera; no presentar source matching como obediencia de modelos.
Medir schemas realmente retirados y bytes serializados por rol solo después;
no multiplicar cuatro por todos los roles ni extrapolar costo/latencia/calidad.

### 7.k. Aprobación, promoción y rollback de 7.B

**Alcance aprobado posteriormente:** implementar y validar 7.i–7.j solo en
canónicos/sandbox, manteniendo las guardas y cubriendo los nueve overlays, sin
quitar delegaciones background válidas. No incluye promoción, commits/pushes o
ensayos con modelos. Un fallo de orden/composición que exija
nuevos allows, host patch o editar 59 agentes vuelve a aprobación, no a un atajo.

Si después se autoriza promover: backup pinneado y ledger del plugin server,
promoción selectiva mediante el contrato managed de Background, comprobar paridad
y salud/state del dueño sin correr `enable`/reapply completos por reflejo. No
rehacer la adopción del runtime o regenerar sus backups/DB. Si el estado managed
requiere metadata de actualización, delimitar sus campos en ese preflight.
Verificar global y los nueve perfiles instalados sin inyectar un candidato y
reiniciar OpenCode con sesiones nuevas; Claude no cambia por 7.B.

Rollback: retirar únicamente el patch canónico aprobado y, si se promovió,
restaurar el plugin server y metadata managed afectados según el ledger, rechazando
drift antes de sobrescribir. Las denegaciones del hook son una composición en
memoria: no hay 59 Markdown ni una excepción global allow que deshacer. Al volver
al plugin anterior reaparecerán los cuatro schemas donde estaban visibles;
sus guards runtime deben seguir protegiendo igual que antes. No tocar artifacts,
delegaciones/worktrees existentes, productos, 7.A ni índices; no reset general.
Reiniciar también después de restaurar para descartar la composición en memoria.

### 7.l. Implementación y validación de 7.B — 2026-10-27, sin promoción

**Aprobación:** tras aclarar que `master-dev`, `planner` y los demás callers
autorizados siguen pudiendo delegar a background según su matriz, el usuario
autorizó avanzar. Se anunció alcance solo canónicos/sandbox, sin deploy/publish.

**Archivos exactos:** los cinco Background previstos en 7.j y este plan Core.
Plugin: **24 líneas añadidas**, helper privado de composición y hook `config`.
El resto de su código es **literalmente igual** al baseline al quitar esos dos
fragmentos: guards, launch/accept/apply/discard, matrices, colas, notificaciones,
sesiones hijas, TUI e inyección de instrucciones no se editaron. Manifest: solo
el hash stock previo acordado. README/validation y test nuevo completan el lote.
No se modificó ningún agente local, Knowledge, Claude o instalación activa.

**Regresiones ejecutadas:**

- `OPENCODE_BACKGROUND_NATIVE=1`, dependencias existentes y source host explícitos
  con `node --test test/*.test.mjs`: **18 tests pasados, cero omitidos**. Incluyen
  seis anteriores y doce nuevos; no sumar reruns como tests extra.
- Helper real sobre reglas ausentes/escalars/objetos, orden de wildcards y claves
  concretas, roles configurados futuros e idempotencia. Master y disabled mantienen
  sus objetos/valores; master ausente no se inventa, nativos reciben solo permisos.
- Plugin completo evaluado con imports/I/O de fixture: trece tools registradas,
  cuatro afectadas y nueve intactas. Matriz read-only completa contrastada con
  todos sus pares permitidos; planner conserva inspector/reviewer/UI designer.
- Handlers/validator reales con managers/clientes de fixture: exposición forzada
  desde no-master rechazada antes de mutaciones; master sigue alcanzando managers.
  Targets Python/TypeScript, launch anidado, estados inválidos, workspace sucio y
  patch inválido siguen rechazados. Control positivo de aceptación revisada.
  Sin lanzar una delegación, crear worktree ni aplicar un patch real.
- Sustitución managed en fixture: backup obligatorio para hash conocido y hash
  desconocido rechazado. Hash manifest ligado al stock real comprobado en preflight.
- Native fixture aislado carga el **plugin candidato completo**, ejecuta `debug
  config` y `debug agent`, verifica los siete nativos y el caso adversarial de
  planner con allows amplios previos. Master conserva sus ask/denies y flags false.
  Source host confirma inventario nativo. No hay nuevos exports del plugin para tests.

**Global + los nueve overlays específicos, en una pasada consolidada:**

1. Baseline y candidato en diez perfiles nativos aislados: global y Higyrus, VB,
   Market Data, Keycloak, Gateway, Aggregator, Documento API, Perfil Inversor y OMS.
   Se usan configuración global efectiva seleccionada y los 59 agentes locales
   canónicos, contrastados con instalados. El plugin se carga completo; no se
   inyectaron los cuatro denies manualmente para hacer pasar la prueba.
2. `opencode debug config` más servidores nativos efímeros en loopback con solo
   `GET /agent` obtuvieron **todos** los permisos/identidades de cada perfil, no
   solo un master y un planner. Tras remover las cuatro reglas del resultado de
   no-master, la metadata efectiva y cuerpos quedan iguales al baseline. Los diez
   masters son idénticos y los disable/defaults/native/hidden se preservan.
   No se ejecutaron estos comandos dentro de los worktrees de productos.
3. Filtro **V1 real** `session/llm/request.ts:resolveTools`, junto a
   `Permission.disabled/merge`, aplicado a esa metadata nativa: **253 registros
   perfil×rol**, 203 retiran exactamente cuatro schemas y 50 no pierden ninguno
   (masters o roles que ya los tenían ocultos). Son registros repetidos por perfil,
   **no 203 agentes únicos ni una medida de llamadas ahorradas**. Las otras nueve
   tools mantienen su visibilidad previa en cada registro.
4. Las restricciones adicionales de sesión y las máscaras de mensaje/hija para
   master se conservan. Seleccionar master→planner→master con el filtro real sobre
   el catálogo del mismo perfil no mezcla permisos. Es una prueba de selección
   determinista, no una sesión conversacional ejecutada con un modelo.
5. **1.503 fingerprints protegidos** intactos, incluidos 7.A, TUI, configuraciones,
   guías/skills/scripts de productos y sus índices, además de HEAD canónicos.
   `git diff --check` correcto. Ningún allow nuevo ni archivo runtime local clonado.

**Medición estática acotada:** el registro conserva trece tools Background. En
los roles afectados, el subconjunto filtrado pasa de **13 → 9**, y en master
permanece **13 → 13**. Metadata JSON del mapa de definiciones (ID, descripción,
parameters), obtenida por `GET /experimental/tool` del servidor aislado:
**7.448 → 5.041 bytes** en el caso afectado. No son tokens, request de proveedor,
contexto total ni ahorro operativo; no volver a contabilizar roles que ya tenían
cero schemas Background. Ninguna métrica de latencia/calidad está demostrada.

**Fronteras y límites:** los sandboxes clonan solo configuración de roles/controles
sin providers, credenciales ni MCPs activos, y cargan únicamente el plugin server
Background candidato. La configuración global seleccionada ya estaba compuesta;
no se afirma haber ejercitado todas las interacciones futuras entre plugins.
El binario real carga/transpila el TS y sirve metadata; no es un typecheck de todo
el host ni un lifecycle end-to-end. Los fixtures sustituyen SDK/I/O; no prueban
obediencia LLM, una transición TUI real ni worktrees reales. El desajuste del hook
`system.transform` registrado en 7.i quedó intacto y fuera del cambio.

Evidencia temporal: `/tmp/opencode/point7b-qa.py` y
`/tmp/opencode/point7b-candidate/{baseline,profiles-after,request-matrix,result}.json`,
`before-plugin.ts`, catálogo y fixtures aislados. Las conclusiones durables son
esta sección y los tests canónicos; no depender de `/tmp` para retomar el trabajo.

**Pendiente:** autorización para promoción selectiva y, por separado, publicación
canónica. La instalación activa conserva el plugin stock anterior; no hay motivo
de reinicio nuevo por estos cambios aún no desplegados. La comprobación futura
debe usar el stack activo completo y los nueve perfiles instalados, sin inyección
de candidato, además de backup/ledger y salud managed según 7.k. El reinicio de
7.A sigue sin confirmación; no repetir su deploy. Nadie pierde background válido.

### 7.m. Promoción selectiva y publicación autorizada de 7.B — 2026-10-27

**Aprobación posterior:** usuario autorizó la promoción selectiva y el posterior
commit/push únicamente de Background y Core, con nueva comprobación de los nueve
perfiles instalados y sin publicar productos AUNE. Actualiza el pendiente histórico
de 7.l; no agrega capacidades ni amplía permisos del runtime.

**Dos archivos máquina, un solo plugin:**

- `~/.config/opencode/plugins/background-agents.ts`, idéntico al candidato.
- `~/.local/state/opencode-addons/opencode-background-tasks/state.json`, solo
  cuatro campos de `plugins[id=background-agents]`: `sourceHash`, `installedHash`,
  `state` y `backupPath`. El resto del JSON conserva exactamente sus valores.

Se usó `installManagedFile` del dueño con su allowlist de hashes y backup
obligatorio; resultado `replaced_compatible`, y `loadState/saveState` para actualizar
esa entrada del servidor. No se ejecutó `enable`, reapply o adopción completos.
No se tocó marker, launcher, runtime binario, versión/patch del host, TUI,
playbook/skill, metadata de adopción, storage, binarios auxiliares, DB o corpus.
Tests, documentación y este plan no se copiaron a la instalación ni a productos.

**Backup durable pinneado:**
`~/.config/opencode/.stack-sync-backups/point7b-20261027T144600Z/`.
Incluye `before-plugin.ts`, `after-plugin.ts`, `before-state.json`, `after-state.json`,
`ledger.json` con hashes/modos/alcance, `profiles-before/after.json`, catálogo,
`request-matrix.json`, `verification.json` y `rollback.py` autónomo. El dry-run
validó integridad y los dos destinos, sin restaurar nada. Para restauración
expresamente autorizada: `python3 <backup>/rollback.py --apply`. Rechaza drift
de cualquiera de ambos archivos **antes** de sobrescribir; no restaurar metadata
completa si hubo cambios ajenos posteriores. Reiniciar tras una restauración.

**Verificación post-sync, no solo del candidato aislado:**

- `opencode debug config` y servidores nativos efímeros con metadata `GET /agent`
  cargaron el **stack global activo completo**, más los nueve perfiles desde assets
  instalados de productos. No hubo inyección del plugin candidato ni composición
  manual de sus denies. Los procesos se cerraron al concluir las lecturas.
- Los 59 agentes locales, configuraciones y guías se contrastaron con sus
  canónicos antes de armar cada sandbox; **cero escrituras de producto** y sin
  ejecutar validaciones dentro de sus worktrees. Se mantuvo la normalización
  acotada de orden de reglas equivalentes explicada en 7.f.
- En los diez perfiles, masters idénticos y solo cuatro denies nuevos en los
  demás roles activos; native/hidden/disable/defaults, cuerpos y controles iguales.
  Filtro V1 real: 253 registros perfil×rol, 203 pierden exclusivamente los cuatro
  schemas indebidos y 50 no pierden ninguno. Las otras nueve tools conservan
  visibilidad previa; restricciones de sesión/mensaje y selección de roles intactas.
- Regresiones post-sync: **18 tests pasados, cero omitidos**. Matriz read-only,
  callers/targets, roles nativos, idempotencia, guardas directas, lifecycle con
  fixtures y sustitución managed verificados con las mismas fronteras de 7.l.
  No contar las repeticiones como pruebas adicionales.
- Salud managed antes/después idéntica: **adopted, sin drift/problemas**, launcher
  correcto, restore disponible y Engram/Semgrep preservados. No reinstalar ni
  reconstruir el runtime para aplicar esta política del plugin.
- **1.507 fingerprints protegidos** sin cambios durante la promoción; incluyen
  7.A, productos/índices y los binarios/marker/launcher managed. Los dos destinos
  autorizados se validan aparte por sus hashes esperados. No hubo modelos,
  delegaciones, worktrees o aplicación de patches reales de ensayo.

**Publicación autorizada y registro final:** cinco archivos Background y este
plan Core, mediante dos commits en `main` y tres pushes: Background a GitHub,
Core a GitHub y GitLab. GitHub owner/cuenta `juanma91m`, alias SSH
`github-juanma91m-v2`; GitLab Core conserva `juanma.91m`. Identidad de commit
existente preservada; sin modificar remotes/config ni usar `auth switch`.
Las tres ramas remotas coincidían con sus bases locales en el preflight.
Guardar en este backup `publication-plan.json` y `publication.json` con hashes,
resultado remoto y árboles limpios al concluir, sin otro commit solo para insertar
el hash propio de este plan. Las escrituras Git autorizadas son solo canónicas;
la verificación de publicación debe preservar los demás índices.

**Activación:** cerrar/reiniciar OpenCode global y proyectos y abrir sesiones
nuevas. Con `serve/attach`, reiniciar también el servidor que conserva las instancias
del plugin. Las sesiones/procesos anteriores no se actualizan por publicar o
copiar el archivo. Claude no cambió por 7.B. Nadie pierde una delegación background
válida; el próximo punto no se implementa automáticamente al cerrar este.

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
| 2026-10-26 | Punto 6, especificación | Usuario pidió planificar. Relevados trigger amplio, quince referencias y copia Claude separada; candidato limitado a `analisis-tecnico-evidencia`, fuente compartida y referencias condicionales (6.a–6.f). Solo documento; implementación, despliegue, publicación y corridas de modelos pendientes de autorización. |
| 2026-10-26 | Punto 6, desglose | Usuario pidió subsecciones por heurística. Se agregan 6.1–6.8 con objetivo, relevamiento, guardrails y escenarios de validación. 6.1 remite al candidato 6.a–6.f; 6.2–6.8 requieren especificación/aprobación individual y pueden concluir sin cambios. No se implementa ninguna heurística por este desglose. |
| 2026-10-26 | Punto 6, etapa A | Usuario aceptó agrupar revisiones y pidió avanzar con A. Se completa especificación conjunta de Evidencia + Cambio seguro: dos fuentes compartidas, 25 entradas en 15 archivos y pruebas conjuntas con decisiones distintas. Etapas B/C/D/E registradas sin ejecutarlas. Solo plan; alcance combinado pendiente de aprobación antes de implementar/validar canónicos. |
| 2026-10-26 | Punto 6, implementación A | Usuario autorizó implementar/validar canónicos. Dos skills, 25 entradas y dos bindings compartidos implementados; 31 tests pasados, loader/config nativos y 588 fingerprints protegidos. Se registra crecimiento estático, no ahorro demostrado (6.g). Sin despliegue, publicación ni modelos; B–E pendientes. |
| 2026-10-26 | Punto 6, avance a B | Usuario pidió desplegar todo junto y pasar a B si A estaba lista. Se cierra A técnicamente sin microiteraciones cosméticas, se difiere promoción para el lote consolidado (interpretación operativa comunicada) y se especifica B en 6.h: dos skills, ocho entradas en siete roles Claude, sin bindings nuevos ni cambios en addons/productos. Solo plan; implementación B pendiente de aprobación. |
| 2026-10-26 | Punto 6, implementación B | Usuario autorizó B solo canónicos. Se implementan dos skills y ocho entradas preservando A/checklists/handoff; 46 tests pasados, loader/config nativos y 603 fingerprints intactos (6.i). Se registra crecimiento estático, no ahorro demostrado. A+B preparados para promoción conjunta; sin deploy/publicación/modelos, C–E pendientes. |
| 2026-10-26 | Punto 6, especificación C | Usuario pidió avanzar tras cerrar B. Relevadas dos skills con checklist propio, diez referencias Claude y dos copias no compartidas; se especifica C en 6.j preservando checklists/viñetas y referencias locales Market Data sin editar overlays. Solo plan; implementación/validación C pendiente de aprobación, promoción conjunta diferida. |
| 2026-10-26 | Punto 6, implementación C | Usuario autorizó C solo canónicos. Dos skills, diez entradas y dos bindings compartidos; checklists/salidas y A/B intactos. 58 tests, loader/config nativos, manifest aditivo y 603 fingerprints protegidos (6.k). A+B+C acumulados, sin deploy/publicación/modelos; D/E pendientes. |
| 2026-10-26 | Punto 6, especificación D | Usuario pidió avanzar tras C. Se decide conservar íntegra la skill Core de debugging y proponer solo cinco entradas Claude condicionales con Read, más regresiones/documentación (6.l). Binding ya compartido, sin cambios de manifest, addons/overlays ni A/B/C. Solo plan; implementación pendiente de aprobación, promoción conjunta diferida. |
| 2026-10-26 | Punto 6, implementación D | Usuario autorizó alcance reducido D. Cinco referencias aclaradas, skill Core y A/B/C intactos; 66 tests, lectura/loader puntual y 610 fingerprints preservados con baseline actual, incluido índice Keycloak sin restaurarlo (6.m). A/B/C/D acumulados, sin deploy/publicación/modelos; E pendiente. |
| 2026-10-26 | Punto 6, especificación E | Usuario pidió avanzar tras D. Se especifica E (6.n): conservar metadata, bloques operativos y otros triggers; distinguir pedido real de mera mención, aclarar no activación de handoff y condicionar ocho entradas Claude con Read. Binding existente y workflows locales intactos. Solo plan; implementación pendiente de aprobación y despliegue conjunto diferido. |
| 2026-10-26 | Punto 6, implementación E y revisión de fuentes | Usuario autorizó E solo canónicos. Primer trigger/guidance y ocho entradas actualizados, metadata/bloques literales intactos; 77 tests, loader/Read y 607 fingerprints preservados (6.o). A–E acumulan 40 paths; revisión estática muestra crecimiento, no ahorro demostrado (6.p). Sin despliegue/publicación/modelos; siguiente paso preparar promoción focalizada consolidada. |
| 2026-10-26 | Punto 6, publicación completada | Tras autorización, 54 destinos promovidos y 115 tests post-sync; 95 archivos publicados en trece canónicos con trece commits y catorce pushes. Core publicado en GitHub y GitLab, incluidos fixes locales GitHub pendientes. Árboles canónicos limpios y HEAD remotos iguales al cierre. Ledger/hashes/rollback en backup `point6-20261027T015258Z`; ningún producto publicado. Reinicio de clientes solicitado, no confirmado. |
| 2026-10-26 | Punto 7, planificación | Usuario pidió planificar y continuar. Metadata de nueve roles, evaluador V1 offline y revisión focalizada de 59 agentes en nueve overlays distinguen brecha MCP reader, catálogo aislado redundante con guardas runtime y ocultación editorial ya aplicada. Candidato 7.A: cinco denies solo en reader Knowledge; 7.B requiere diseño/aprobación aparte y 7.C no propone otra poda. Solo documento; implementación, pruebas del candidato y despliegue pendientes. |
| 2026-10-27 | Punto 7.A, implementación | Usuario aprobó y exigió cobertura de todos los overlays específicos. Cinco denies en reader Knowledge, tests/README y plan; 23 tests pasados + uno omitido, nueve perfiles nativos con 59 agentes locales contrastados, evaluador V1 y contador de permisos aislado. 1.504 fingerprints protegidos e índices intactos. Once→seis schemas en reader, sin copias locales ni promoción. Detalle/fronteras en 7.f; despliegue/publicación pendientes, 7.B no aprobado. |
| 2026-10-27 | Punto 7.A, promoción y publicación autorizada | Usuario autorizó avanzar con promoción y commits/pushes canónicos. Reader global promovido; global+nueve perfiles desde assets instalados verificados, 59 agentes y 1.503 fingerprints protegidos, cero escrituras de producto, 23 tests pasados + una omisión. Backup/rollback y ledger final de publicación en `point7a-20261027T032508Z`; alcance dos canónicos/tres remotos, sin cambios en 7.B. Reinicio de OpenCode requerido. |
| 2026-10-27 | Punto 7.A, publicación verificada | Knowledge `0362aef` y Core `452ca97` publicados en sus tres remotos, dos árboles limpios y HEAD remotos iguales. Ledger final durable `point7a-20261027T032508Z/publication.json`. No repetir promoción/publicación; reinicio sigue sin confirmación del usuario. |
| 2026-10-27 | Punto 7.B, especificación | Usuario pidió planificar. Fuentes V1 y metadata de trece nombres de rol distinguen roles visibles, ocultos y plan no disponible; nueve overlays/59 agentes en paridad y 1.501 fingerprints sin drift desde 7.A. Se propone hook `config` aditivo del dueño Background: cuatro denies finales por rol excepto master, sin allows globales/excepciones, nativos cubiertos y guards intactos. Cinco archivos Background + plan, pruebas en 7.j y puerta de aprobación 7.k. Solo documento; sin candidato, deploy, Git writes o modelos. |
| 2026-10-27 | Punto 7.B, implementación | Usuario autorizó tras aclarar que nadie pierde background válido. Cinco archivos Background + plan implementados/validados: 18 tests sin omisiones, plugin completo en global+nueve perfiles sandbox, 59 agentes locales y 253 registros perfil×rol; 203 retiran solo cuatro schemas, 50 sin pérdida. Masters/matriz read-only/otras nueve tools/7.A intactos, 1.503 fingerprints protegidos, guards/lifecycle literal. Sin deploy/publicación/modelos; detalle y límites en 7.l. |
| 2026-10-27 | Punto 7.B, promoción y publicación autorizada | Usuario autorizó promover y publicar los dos canónicos. Plugin server y cuatro campos de su entrada managed actualizados con API del dueño y backup. Stack activo completo + nueve perfiles instalados verificados, 59 agentes y 1.507 fingerprints protegidos, cero escrituras de producto, 18 tests sin omisiones; salud managed idéntica adopted/sin drift. Backup/ledger final en `point7b-20261027T144600Z`, publicación dos commits/tres remotos; detalle en 7.m. Reiniciar OpenCode/servidor si aplica. |

## Próxima acción

**7.B implementado, validado y promovido** con stack global completo+nueve perfiles
instalados (7.l–7.m). Completar la publicación ya autorizada y registrar hashes,
estado remoto y árboles limpios en ledger durable y memoria, sin commit circular.
Reiniciar OpenCode y el servidor `serve` si aplica; sesiones nuevas.
Los puntos 1–6, fixes GitHub y 7.A están publicados; no repetir esas operaciones.
Reiniciar OpenCode y usar sesiones nuevas para activar 7.A; aún sin confirmación.
7.C no añade poda editorial. No tocar memoria activa en ensayos ni correr modelos
por arrastre. Nunca publicar productos AUNE.
No confundir relevamiento de fuentes, configuración o fixtures con llamadas
efectivas probadas, obediencia de modelos o ahorro operativo demostrado.
