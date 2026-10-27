---
name: cambio-seguro-enterprise
description: "Usar para delimitar cambios con riesgo de regresión o compatibilidad no trivial, cuando haya que decidir alcance, comportamiento a preservar y validación, o por pedido explícito; no por la sola etiqueta enterprise/legacy ni por toda edición."
compatibility: opencode
---
## Cuando usarme
- Por pedido explícito de esta skill o ante decisiones no triviales de alcance, compatibilidad o comportamiento a preservar al planificar o revisar un cambio.
- Considerar riesgos plausibles, sin exigir una regresión demostrada. El tamaño del diff no determina el riesgo: una línea puede afectar auth o datos.

## Cuando no cargarla por rutina
- No por la etiqueta enterprise/legacy, por cualquier edición ni si alcance y estrategia ya están suficientemente resueltos.
- Si el workflow o una skill específica ya cubre la estrategia, no duplicarla. No cargarla como pareja fija con Evidencia; ambas pueden aportar si sus necesidades son distintas.

## Contrato y salida
- Cargues o no esta skill: comprender entry points, flujo y patrón previo; elegir el cambio mínimo compatible, preservar trabajo ajeno y separar fix de cleanup o mejoras no requeridas.
- Explicitar alcance, comportamiento que se preserva, riesgos y compatibilidad; respaldar el cambio con validación pertinente y declarar lo pendiente.
- Salida proporcional, no cuatro secciones vacías; sin formularios, archivos ni aprobaciones adicionales. Respetar los contratos y permisos del proyecto.
