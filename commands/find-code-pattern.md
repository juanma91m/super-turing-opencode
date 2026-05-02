---
description: Ejecuta búsquedas estructurales de código del proyecto actual usando la integración local si existe.
agent: code-inspector
subtask: false
---
Buscá patrones estructurales en el repo actual.

Objetivo:
- ejecutar `bash ~/.config/opencode/scripts/find_code_pattern.sh $ARGUMENTS`,
- usar el resultado para mapear call sites o zonas de impacto,
- devolver solo los matches y su implicancia técnica.

Reglas:
- no modificar código ni configuración,
- si el repo no ofrece integración local, explicitarlo y sugerir la instalación/localización correcta,
- no inventar impacto no respaldado por matches reales.

Formato esperado:
- objetivo,
- patrón buscado,
- matches relevantes,
- implicancia técnica,
- información faltante si aplica.
