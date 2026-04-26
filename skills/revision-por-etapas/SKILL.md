# Skill: revision-por-etapas

## Que hago
- Estructuro la revisión en dos etapas para evitar mezclar cumplimiento funcional con calidad técnica.
- Primero verifico si el cambio cumple lo pedido; después reviso riesgos, calidad y validación.
- Ayudo a que `reviewer` y `master-dev` den feedback más claro y accionable.

## Cuando usarme
- En revisiones técnicas de cambios implementados.
- Cuando existe plan, spec, verdict o handoff previo.
- Antes de cerrar tareas de implementación importantes.

## Etapa 1: cumplimiento contra intención
Preguntas guía:
- ¿Cumple el objetivo pedido?
- ¿Respeta plan, spec, `verdict.md` o alcance explícito?
- ¿Falta algo importante?
- ¿Agregó comportamiento no pedido o abrió scope nuevo?

## Etapa 2: calidad y riesgo técnico
Preguntas guía:
- ¿Hay riesgos de regresión?
- ¿Hay problemas de compatibilidad, performance, concurrencia o contratos?
- ¿La validación ejecutada es suficiente para el tipo de cambio?
- ¿Hay deuda, supuestos no probados o zonas frágiles?

## Reglas
- No mezclar las dos etapas en un bloque confuso.
- Si falla la etapa 1, marcarlo primero antes de discutir cosmética o micro-mejoras.
- Separar bloqueantes de no bloqueantes.
- Citar evidencia por cada observación importante.
- Si existe workflow de tickets, usar `verdict.md` y `result-dev.md` como referencias primarias de intención y cierre.

## Salida esperada
- etapa 1: cumplimiento,
- etapa 2: calidad/riesgos,
- evidencia,
- validaciones faltantes,
- observaciones no bloqueantes.
