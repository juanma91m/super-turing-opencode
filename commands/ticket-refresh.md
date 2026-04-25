---
description: Refresca el análisis de un ticket y limpia/actualiza tmp/<ticket>/ con evidencia vigente.
agent: planner
---
Refrescá el análisis del ticket $1.

Objetivo:
- releer el ticket o nueva información disponible,
- actualizar `tmp/$1/` si el proyecto usa ese workspace,
- eliminar o corregir hipótesis/evidencias obsoletas,
- dejar el workspace temporal consistente con el estado actual del análisis.

Reglas:
- no implementes código,
- si el proyecto no usa workflow con `tmp/$1/`, devolvé el refresh en la respuesta,
- si algo cambió, dejalo explícito,
- mantené el foco en información útil para llegar a un `verdict.md` sólido.
