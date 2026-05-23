# Skill: verificacion-antes-de-cerrar

## Que hago
- Evito declarar exito sin evidencia fresca.
- Obligo a verificar con comandos reales antes de afirmar que algo está listo, corregido o pasando.
- Refuerzo honestidad operativa: evidencia antes que confianza.

## Cuando usarme
- Antes de decir que un bug quedó resuelto.
- Antes de cerrar una tarea o marcarla como terminada.
- Antes de afirmar que tests, build, lint o validaciones pasaron.
- Antes de entregar resultado final o pedir review.

## Regla central
- Si no corriste la verificación en este trabajo y no leíste el resultado, no afirmes que está bien.
- Si existe comportamiento esperado, criterio o escenario explícito, la verificación debe conectarse con eso y no solo con un comando “verde”.

## Flujo obligatorio
1. Identificar qué comando o evidencia prueba realmente la afirmación o el comportamiento esperado.
2. Ejecutar la verificación completa y fresca.
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
- Si un formatter modifica archivos, revalidar sobre ese estado final.
- No expresar cierre, satisfacción ni éxito antes de verificar.

## Salida esperada
- afirmación a verificar,
- comando o evidencia usada,
- resultado real,
- conclusión ajustada a evidencia,
- pendientes si algo no pudo verificarse.
