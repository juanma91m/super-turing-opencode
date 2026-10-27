---
name: performance-cache-concurrencia
description: "Usar si el cambio o síntoma puede afectar costo de consultas, cache, transacciones, orden o concurrencia, o por pedido explícito; no por la sola presencia de backend/DB/cache."
compatibility: opencode
---
## Que hago
- Obligo a evaluar costo, contencion y consistencia antes de cerrar un cambio sensible.
- Refuerzo analisis de cardinalidad, indices, scans, locks, round trips y puntos de bloqueo.
- Hago explicitar fuente de verdad, estrategia de refresh e invalidacion de cache.
- Pido considerar transacciones, idempotencia, orden de ejecucion y riesgos de concurrencia.

## Cuando usarme
- Por pedido explícito o si el cambio/síntoma puede afectar queries, ORM, transacciones, cache, colas, orden, idempotencia o concurrencia.
- Por superficie afectada o riesgo plausible, no por la sola presencia de backend/DB/cache. No exigir un incidente o benchmark para considerar costo, bloqueo, frescura o carrera.

## Seleccion y alcance
- Priorizar costo, contención y consistencia; si Contratos o una skill local ya cubre ese riesgo, no duplicar el mismo análisis. No cargarlas como paquete fijo.
- Reportar solo ítems aplicables y preservar formatos y reglas locales. Sin métricas, declarar supuestos: no inferir inocuidad. No autoriza benchmarks, DBs, migraciones ni indexado.

## Salida esperada
- Impacto potencial en performance.
- Riesgos de cache, transacciones o concurrencia.
- Supuestos tecnicos que hay que validar.
- Mitigaciones o chequeos recomendados.
