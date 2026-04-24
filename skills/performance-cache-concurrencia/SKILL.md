---
name: performance-cache-concurrencia
description: Revisa impacto tecnico en performance, cache, transacciones y concurrencia con foco en costo y consistencia.
compatibility: opencode
---
## Que hago
- Obligo a evaluar costo, contencion y consistencia antes de cerrar un cambio sensible.
- Refuerzo analisis de cardinalidad, indices, scans, locks, round trips y puntos de bloqueo.
- Hago explicitar fuente de verdad, estrategia de refresh e invalidacion de cache.
- Pido considerar transacciones, idempotencia, orden de ejecucion y riesgos de concurrencia.

## Cuando usarme
- En cambios que tocan queries, ORM, transacciones o base de datos.
- En cache, colas, procesos concurrentes o flujos de alta carga.
- Cuando hay sospecha de degradacion de performance o condiciones de carrera.

## Salida esperada
- Impacto potencial en performance.
- Riesgos de cache, transacciones o concurrencia.
- Supuestos tecnicos que hay que validar.
- Mitigaciones o chequeos recomendados.
