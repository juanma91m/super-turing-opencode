---
description: Revisa un Pull Request de GitHub por URL, número o rama con ticket/contexto opcional.
agent: code-reviewer
subtask: false
---
Revisá el Pull Request de GitHub `$1`.

Contexto o ticket opcional: `$2`.

Usá solo operaciones read-only aprobadas. Antes del diff, verificá que el repositorio del PR coincida con el `origin` actual, reconciliá el ticket explícito con título/head branch y registrá los commits exactos revisados. Aplicá `code-review-branch-to-branch` y guardá el informe incremental en el storage definido por el agente efectivo.
