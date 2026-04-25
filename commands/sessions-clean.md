---
description: Limpia sesiones efímeras de OpenCode sin crear otra sub-sesión.
agent: master-dev
subtask: false
---
Usá el helper global `bash ~/.config/opencode/scripts/session_cleanup.sh clean $ARGUMENTS`.

Si no se pasan argumentos, limpiá sesiones hijas del proyecto actual.

Opciones útiles:
- `--older-than-minutes 30`
- `--all-projects`
- `--include-root` (usar con cuidado)

Devolvé un resumen corto de cuántas sesiones candidatas había, cuántas se borraron y si falló alguna.
