---
description: Inicia o reinicia la fase de análisis de un ticket con planner y prepara tmp/<ticket>/ cuando el proyecto usa workflow de tickets.
agent: planner
---
Analizá el ticket $1 con `planner`.

Objetivo:
- iniciar o reiniciar la fase de análisis,
- si el proyecto usa Jira y workspace temporal, crear o actualizar `tmp/$1/`,
- usar helper de Jira o helper local del proyecto si está disponible y aprobado,
- identificar problema/objetivo, alcance, estado actual, primeras hipótesis, preguntas abiertas y evidencias iniciales.

Reglas:
- no implementes código,
- si el proyecto no usa workflow con `tmp/$1/`, no lo fuerces,
- si el requerimiento sigue ambiguo, terminá con preguntas concretas,
- si el proyecto adopta el patrón de handoff, dejá encaminado `tmp/$1/verdict.md` o explicitá qué falta para cerrarlo.
