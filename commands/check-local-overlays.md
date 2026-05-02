---
description: Audita la capa local .opencode/ de un repo contra la base global usando el helper semiestructurado del stack.
agent: agent-design
subtask: false
---
Auditá la capa local `.opencode/` del repo actual.

Objetivo:
- ejecutar `bash ~/.config/opencode/scripts/check_local_overlays.sh --project-root "$PWD"`,
- usar ese resultado como baseline,
- si hace falta, complementar con juicio técnico breve sobre falsos positivos o gaps no capturados,
- devolver una salida clara con estado general del overlay local.

Reglas:
- no modificar nada; solo diagnosticar,
- si el repo no tiene `.opencode/`, informarlo como `OK` y no inventar hallazgos,
- si el helper marca `warning` o `error`, explicar en una línea si el hallazgo parece real, tolerable o falso positivo,
- usar el patrón institucional de overlays locales aditivos como criterio de evaluación.

Formato esperado de salida:
- `## OK`
- `## Warnings`
- `## Errores`
- `## Auditoría de overlays locales`
- `## Siguientes pasos`
