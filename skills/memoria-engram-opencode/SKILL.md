---
name: memoria-engram-opencode
description: Define como usar Engram en OpenCode con memoria curada, clasificacion por buckets, source_agent y purga segura.
compatibility: opencode
---
## Cuando usarme
- Cuando hay tools `mem_*` disponibles y conviene recuperar contexto previo antes de trabajar.
- Cuando una decision, discovery, bugfix, preferencia o patron merece memoria durable.
- Cuando una memoria vieja quedo obsoleta y hay que actualizarla o purgarla.

## Buckets canonicos
- `mem-global-user`: preferencias globales del usuario.
- `mem-global-engineering`: criterios tecnicos reutilizables cross-stack.
- `mem-tech-<stack>`: memoria reutilizable por tecnologia, por ejemplo `mem-tech-react`, `mem-tech-vaadin`, `mem-tech-spring-boot`.
- `<repo-canonico>`: memoria especifica del proyecto.

## Campos obligatorios
- `project`
- `scope`
- `type`
- `topic_key` (salvo `session_summary`)
- `source_agent`

## Source agent
- Guardar siempre `source_agent`.
- Convencion: persistirlo como `agent:<source_agent>`.
- Priorizar memorias de agentes afines, pero nunca como filtro excluyente si el contenido mas util viene de otro agente.

## Naturaleza de Engram
- Tratar Engram como working memory entre sesiones, no como auditoria completa ni historial detallado de iteraciones.
- Si una tarea necesita trazabilidad fuerte, intercambio por git o artefactos revisables por humanos, complementar con archivos del proyecto o documentacion local.

## Lectura en dos pasos
- Para contexto reciente: `mem_context` primero.
- Para busquedas tematicas: `mem_search` primero para ubicar candidatos.
- Si un resultado importa de verdad, hacer siempre `mem_get_observation` antes de razonar o decidir sobre el contenido completo.
- No tomar decisiones importantes basadas solo en previews truncados de `mem_search`.

## Roles de lectura y escritura
- `master-dev` debe ser, por defecto, el lector principal de memoria y pasar a subagentes solo el contexto ya destilado cuando eso alcance.
- Los subagentes deben escribir discoveries, decisions y bugfixes relevantes cuando ocurran en su trabajo.
- Los subagentes solo deberian buscar memoria por cuenta propia cuando el historial especializado probablemente aporte valor real o cuando trabajan de forma mas autonoma sobre una fase concreta.

## Convencion para workflows largos
- Si un flujo es multi-fase o necesita recuperacion, usar nombres deterministas para sus artefactos y estado.
- Formato recomendado: `workflow/<nombre>/<artifacto>` o una familia equivalente del dominio.
- Guardar el estado y los artefactos largos con `topic_key` estable para permitir reanudacion limpia y evitar duplicados.

## Que guardar
- Solo memoria durable, no obvia, reusable o valiosa entre sesiones.
- Preferencias estables del usuario.
- Decisions, architecture, pattern, learning, bugfix, constraint, integration, config.
- Session summaries solo como continuidad, no como reemplazo de memoria importante explicita.

## Que no guardar
- Prompts crudos.
- Logs o outputs de tools.
- Hipotesis temporales.
- Tareas triviales.
- Ruido conversacional.

## Promocion
- Si algo nace en un proyecto y tambien sirve fuera de el, guarda el caso local en el proyecto y una version abstraida en el bucket reusable correcto.
- Quita detalles innecesarios del repo al promover a `mem-tech-*` o `mem-global-engineering`.

## Purga e higiene
- Si un tema evoluciona, primero actualiza o registra la memoria vigente.
- Luego purga la memoria obsoleta con soft-delete por defecto.
- Hard-delete solo para ruido puro, duplicados accidentales, datos sensibles o memorias incorrectas sin valor historico.

## Bootstrap de lectura
- Siempre consultar primero `mem-global-user` y el proyecto actual cuando haya probabilidad real de contexto previo util.
- Luego consultar 1 a 3 buckets tecnicos relevantes a la tarea.
- No cargar toda la memoria global indiscriminadamente.
- Si `master-dev` ya recupero y sintetizo el contexto necesario, evitar que cada subagente repita las mismas busquedas salvo que haya una razon clara.

## Orden de precedencia
1. Instruccion explicita actual del usuario.
2. Memoria del proyecto actual.
3. Preferencias globales del usuario.
4. Memoria reusable del stack.
5. Memoria global de ingenieria.
