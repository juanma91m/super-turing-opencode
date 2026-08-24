---
description: Revisa ramas por ticket Jira y guarda un informe incremental bajo tmp/<ticket>/code-review/.
agent: code-reviewer
subtask: false
---
Revisá el ticket `$1` comparando la rama origen `$2` contra la rama destino `$3`.

Aplicá `code-review-branch-to-branch` (incluye presupuesto operativo de review), consultá Jira una sola vez en modo `context`, no modifiques código y guardá el informe en el próximo `tmp/$1/code-review/code-review-N.md` reservado por el helper aprobado.

Si falta ticket o rama, pedí aclaración antes de iniciar.
