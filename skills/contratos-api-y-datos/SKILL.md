---
name: contratos-api-y-datos
description: Refuerza analisis de contratos, integraciones y acceso a datos con foco en compatibilidad y costo operativo.
compatibility: opencode
---
## Que hago
- Pido revisar contratos REST y SOAP, errores, timeouts, idempotencia y trazabilidad.
- Refuerzo compatibilidad hacia atras en endpoints, payloads, serializacion y manejo de errores.
- Hago pensar el acceso a datos en terminos de cardinalidad, joins, filtros, indices, locks y costo.
- Evito cambios que rompan integraciones externas por detalles no validados.

## Cuando usarme
- En APIs, clientes externos, colas o integraciones entre sistemas.
- En consultas SQL, ORM o repositorios con riesgo de costo o bloqueo.
- Cuando el cambio impacta contratos o estructuras de datos compartidas.

## Salida esperada
- Contratos afectados.
- Riesgos de compatibilidad o integracion.
- Impacto en acceso a datos.
- Validaciones necesarias.
