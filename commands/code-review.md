---
description: Revisa una rama origen contra una rama destino y guarda un informe incremental global.
agent: code-reviewer
subtask: false
---
Revisá el desarrollo de la rama origen `$1` contra la rama destino `$2`.

Aplicá `code-review-branch-to-branch`, usá `merge-base`, no modifiques el repositorio y guardá el informe bajo `~/code-reviews/<identificador>/code-review-N.md` mediante el helper aprobado.

Si falta cualquiera de las dos ramas o la orientación es ambigua, pedí aclaración antes de revisar.
