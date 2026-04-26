# Skill: debugging-sistematico

## Que hago
- Obligo a investigar la causa raiz antes de proponer fixes.
- Evito el parcheo por intuicion, los cambios apilados y la validacion vaga.
- Refuerzo un flujo de depuracion basado en evidencia, hipotesis y pruebas minimas.

## Cuando usarme
- Ante bugs, tests rotos, builds fallando o comportamiento inesperado.
- Cuando ya hubo uno o mas intentos de fix sin cerrar el problema.
- Cuando hay varias capas involucradas y no esta claro donde se rompe el flujo.

## Flujo obligatorio
1. **Leer errores completos**: mensaje, stack trace, lineas, paths, codigos.
2. **Reproducir**: definir pasos concretos y confirmar si falla siempre o bajo que condicion.
3. **Revisar cambios recientes**: diff, commits, config, dependencias, entorno.
4. **Seguir el flujo real**: entrada -> capas intermedias -> salida. En sistemas multi-capa, agregar evidencia en cada frontera antes de tocar codigo.
5. **Separar hechos e hipotesis**: no confundir sintoma con causa.
6. **Formular una sola hipotesis**: explicar por que esa seria la causa raiz.
7. **Probar minimamente**: un cambio o experimento chico para confirmar o refutar la hipotesis.
8. **Recién después** implementar el fix real sobre la causa raiz.

## Reglas
- No proponer ni aplicar fixes sin investigacion previa.
- No apilar varios cambios a la vez “a ver si alguno funciona”.
- Si el problema cruza varias capas, capturar evidencia en cada boundary antes de decidir.
- Si el tercer intento de fix falla, frenar y cuestionar si el problema es de arquitectura o de entendimiento del sistema.
- Si no entendés una parte crítica, decilo explícitamente.

## Salida esperada
- sintomas observados,
- reproduccion,
- hechos confirmados,
- hipotesis vigente,
- experimento o evidencia usada para confirmarla,
- causa raiz,
- fix propuesto o aplicado,
- validacion.
