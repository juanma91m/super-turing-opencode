---
description: Toma tmp/<ticket>/verdict.md como insumo primario cuando existe y arranca la implementación con master-dev.
agent: master-dev
---
Implementá el ticket $1 usando `master-dev`.

Objetivo:
- si existe `tmp/$1/verdict.md`, tomarlo como insumo principal,
- leer primero las referencias de `Evidencias` dentro de ese verdict,
- si sigue faltando contexto, usar `tmp/$1/repo_findings.md` y luego `tmp/$1/analysis.md`,
- verificar que el veredicto siga siendo válido frente al código real,
- implementar el cambio mínimo suficiente,
- reportar riesgos o desvíos si aparecen,
- dejar `tmp/$1/result-dev.md` al finalizar cuando el proyecto use ese patrón.

Reglas:
- si el proyecto usa `verdict.md` y falta o está incompleto, frená y explicitá qué falta,
- no recorras `tmp/$1/` completo salvo necesidad real; priorizá `verdict -> evidencias -> repo_findings -> analysis`,
- no hagas `git add`, `git commit` ni push,
- cuidá performance y compatibilidad.
