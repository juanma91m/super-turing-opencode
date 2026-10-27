---
name: verificacion-antes-de-cerrar
description: "Usar para evaluar qué evidencia vigente y pertinente sostiene una afirmación material de corrección, validación o cierre, o por pedido explícito; no para confirmaciones sin cambios ni afirmaciones nuevas."
---
# Skill: verificacion-antes-de-cerrar

## Cuando usarme
- Por pedido explícito o cuando haga falta evaluar pertinencia, cobertura o vigencia de evidencia para una afirmación material.
- No por una confirmación sin cambios ni afirmaciones nuevas, ni por emitir una respuesta final. El deber de verificar sigue vigente, se cargue o no esta skill.

## Regla central
- Si no corriste la verificación en este trabajo y no leíste el resultado, no afirmes que está bien.
- Si existe comportamiento esperado, criterio o escenario explícito, la verificación debe conectarse con eso y no solo con un comando “verde”.

## Flujo obligatorio
1. Identificar qué comando o evidencia prueba realmente la afirmación o el comportamiento esperado.
2. Ejecutar la verificación suficiente para la afirmación y el alcance. Si ya se ejecutó y su resultado se leyó en este trabajo y sigue vigente para ese estado, no repetir por ritual.
3. Leer salida, exit code y fallos concretos.
4. Comparar resultado contra la afirmación que querías hacer.
5. Recién entonces reportar estado real:
   - si pasó, decir que pasó y con qué evidencia,
   - si no pasó, reportar fallo real, no deseo.

## Reglas
- “Debería funcionar”, “parece bien” o “seguro pasa” no cuentan como validación.
- Linter ok no implica build ok.
- Build ok no implica tests ok.
- Cambio aplicado no implica bug resuelto.
- Un test verde desconectado del comportamiento esperado tampoco implica cierre.
- Si cambios de código, formatter, configuración, dependencias o entorno invalidan la evidencia, revalidar lo afectado. No usar evidencia histórica o no inspeccionada como prueba vigente.
- Completa significa cubrir la afirmación: no exige por defecto toda la suite. Preservar las validaciones requeridas por usuario o contrato local.
- No habilita comandos fuera del rol ni salta confirmaciones. Si no hay acceso o no es viable verificar, declarar qué queda sin comprobar y por qué; no afirmar que pasó.
- No declarar éxito técnico antes de verificar con evidencia comprobada.

## Salida esperada
- Afirmación, evidencia, resultado, conclusión y pendientes relevantes; no un formulario vacío. Conservar formatos locales exigidos.
- Con Revisión por etapas: No cargarlas como paquete automático; revisar no sustituye ejecutar una prueba ni viceversa.
