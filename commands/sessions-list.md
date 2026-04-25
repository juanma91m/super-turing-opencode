---
description: Lista sesiones efímeras candidatas a limpieza.
agent: master-dev
subtask: false
---
Usá el helper global `bash ~/.config/opencode/scripts/session_cleanup.sh list $ARGUMENTS`.

Si no se pasan argumentos, listá sesiones hijas del proyecto actual.

Opciones útiles:
- `--older-than-minutes 30`
- `--all-projects`
- `--include-root`

Devolvé un resumen corto y los títulos/IDs más relevantes.
