---
description: Ejecuta la validación técnica final del ticket con dev-test.
agent: dev-test
subtask: false
---
Validá técnicamente el ticket $1 con `dev-test`.

Objetivo:
- ejecutar la secuencia de validación correcta para este repo,
- dejar evidencia clara de validación,
- informar fallos reproducibles o pendientes,
- no cerrar con validación incompleta sin aclararlo.

Reglas:
- si el proyecto define formatter/lint/build/tests obligatorios, respetalos en ese orden,
- si el formatter o autofix cambia archivos, revalidá sobre ese estado final,
- no modifiques git ni cierres con evidencia insuficiente.
