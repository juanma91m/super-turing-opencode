---
description: Revisa un Pull Request de GitHub por URL, número o rama con ticket/contexto opcional.
agent: code-reviewer
subtask: false
---
Revisá el Pull Request de GitHub `$1`.

Contexto o ticket opcional: `$2`.

Usá solo operaciones read-only aprobadas. Antes del diff, verificá que el repositorio del PR coincida con el `origin` actual y reconciliá el ticket explícito con título/head branch. Luego leé siempre comentarios y reviews; si es una rerevisión, contrastá las respuestas y justificaciones con el head actual y los hallazgos previos antes de aprobar o mantenerlos. Registrá los commits exactos revisados, aplicá `code-review-branch-to-branch` y guardá el informe incremental en el storage definido por el agente efectivo.
