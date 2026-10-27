---
name: revision-por-etapas
description: "Usar para estructurar una revisión de cumplimiento y calidad cuando ese contraste no esté ya cubierto por el procedimiento aplicado, o por pedido explícito; no por la mera existencia de un plan, ticket o handoff."
---
# Skill: revision-por-etapas

## Cuando usarme
- Por pedido explícito o para estructurar una revisión real de cumplimiento y calidad que necesite este marco.
- No por la mera existencia de un plan, ticket o handoff; si el procedimiento aplicado ya cubre las etapas, no duplicarlo (por ejemplo, `code-review-branch-to-branch`).

## Etapa 1: cumplimiento contra intención
Preguntas guía:
- ¿Cumple el objetivo pedido?
- ¿Respeta plan, spec, `verdict.md` o alcance explícito?
- ¿Cubre los criterios de aceptación o escenarios clave, si existían?
- ¿Falta algo importante?
- ¿Agregó comportamiento no pedido o abrió scope nuevo?

## Etapa 2: calidad y riesgo técnico
Preguntas guía:
- ¿Hay riesgos de regresión?
- ¿Hay problemas de compatibilidad, performance, concurrencia o contratos?
- ¿La validación ejecutada es suficiente para el tipo de cambio?
- ¿Hay deuda, supuestos no probados o zonas frágiles?

## Reglas
- Cargues o no esta skill, el contraste de cumplimiento y calidad exigido por rol/proyecto sigue siendo obligatorio; no crear una revisión formal ad-hoc.
- No mezclar las dos etapas en un bloque confuso.
- Si falla la etapa 1, marcarlo primero antes de discutir cosmética o micro-mejoras.
- Separar bloqueantes de no bloqueantes.
- Citar evidencia por cada observación importante.
- Usar `verdict.md` y `result-dev.md` como referencias solo si hay handoff de implementación aplicable/activo y archivos existentes. No exigirlos ni crear carpetas en tareas ad-hoc, review interno sin handoff o proyectos que solo habilitan code review.

## Salida esperada
- Cumplimiento y criterios cubiertos/desviados antes de calidad/riesgos, evidencia, validaciones y no bloqueantes relevantes; no seis bloques vacíos. Conservar formatos locales exigidos, snapshot, conversación, rereview y storage del review formal.
- Con Verificación: No cargarlas como paquete automático; revisar no sustituye ejecutar una prueba ni viceversa.
