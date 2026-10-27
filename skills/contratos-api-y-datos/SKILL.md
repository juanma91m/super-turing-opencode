---
name: contratos-api-y-datos
description: "Usar al cambiar o revisar contratos de API/integración, datos compartidos o acceso a datos con riesgo relevante, o por pedido explícito; no por la sola presencia de API/DB."
compatibility: opencode
---
## Que hago
- Pido revisar contratos REST y SOAP, errores, timeouts, idempotencia y trazabilidad.
- Refuerzo compatibilidad hacia atras en endpoints, payloads, serializacion y manejo de errores.
- Hago pensar el acceso a datos en terminos de cardinalidad, joins, filtros, indices, locks y costo.
- Evito cambios que rompan integraciones externas por detalles no validados.

## Cuando usarme
- Por pedido explícito o al cambiar/revisar contratos de API/integración, semántica/datos compartidos o acceso a datos con riesgo de costo o bloqueo.
- Por impacto del cambio o pregunta, no por la sola presencia de API/DB. No exigir una rotura demostrada: un cambio pequeño puede afectar consumidores.

## Seleccion y alcance
- Priorizar compatibilidad y representación de lo consumido; el checklist SQL sigue vigente. Si una skill local o Performance ya cubre el riesgo, no duplicar el mismo análisis. No cargarlas como paquete fijo.
- Reportar solo ítems aplicables, sin bloques vacíos ni inventar una DB afectada; preservar formatos y reglas locales. La skill no amplía permisos.

## Salida esperada
- Contratos afectados.
- Riesgos de compatibilidad o integracion.
- Impacto en acceso a datos.
- Validaciones necesarias.
