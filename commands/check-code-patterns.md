---
description: Ejecuta checks de patrones de código del proyecto actual usando la integración local si existe.
agent: reviewer
subtask: false
---
Auditá patrones de código del repo actual.

Objetivo:
- ejecutar `bash ~/.config/opencode/scripts/check_code_patterns.sh $ARGUMENTS`,
- usar el output como baseline,
- distinguir findings reales de ruido o tolerancias aceptables,
- devolver una conclusión breve y accionable.

Reglas:
- no modificar código; solo revisar,
- si el repo no ofrece integración local, explicitarlo y sugerir la instalación/localización correcta,
- priorizar riesgos concretos antes que observaciones cosméticas.

Formato esperado:
- `## OK`
- `## Findings`
- `## Riesgos principales`
- `## Siguientes pasos`
