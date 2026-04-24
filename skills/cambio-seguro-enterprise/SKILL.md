---
name: cambio-seguro-enterprise
description: Prioriza cambios minimos, seguros y auditables en sistemas enterprise y legacy.
compatibility: opencode
---
## Que hago
- Refuerzo cambios pequenos, trazables y compatibles con el diseño existente.
- Priorizo entender entry points, flujo actual y patron ya usado antes de editar.
- Evito refactors amplios cuando no son necesarios para resolver el objetivo.
- Separo claramente fix funcional de cleanup cosmetico o mejoras deseables no requeridas.

## Cuando usarme
- En sistemas legacy o enterprise con riesgo de regresion.
- Cuando el cambio debe preservar comportamiento fuera del scope.
- Cuando hay que decidir la solucion mas simple pero suficiente.

## Salida esperada
- Objetivo y alcance real.
- Cambio minimo propuesto.
- Riesgos y compatibilidad.
- Validacion realizada y pendiente.
