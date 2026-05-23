---
name: sdd-tdd-bdd-pragmatico
description: SDD, TDD, BDD, criterios de aceptación, Given-When-Then y estrategia de pruebas pragmática. Usar cuando convenga conectar especificación, comportamiento esperado y validación sin imponer ceremonias rígidas.
compatibility: opencode
---
## Que hago
- Conecto especificación, comportamiento esperado y evidencia de pruebas.
- Ayudo a transformar requerimientos en criterios de aceptación, escenarios clave y estrategia de validación cuando eso realmente aclara el trabajo.
- Refuerzo un TDD pragmático: test primero cuando el cambio y el harness lo vuelven barato y útil; characterization o regresión cuando no.
- Evito convertir SDD/TDD/BDD en burocracia o ritual vacío.

## Cuando usarme
- Cuando el usuario menciona SDD, TDD, BDD, criterios de aceptación, Given/When/Then, escenarios o pruebas de regresión.
- Antes de implementar si el alcance todavía está difuso.
- Cuando `planner`, `master-dev`, `reviewer` o `dev-test` necesitan trazar mejor la relación entre spec, cambio y validación.
- Cuando hace falta decidir si conviene test-first, repro-first o una validación más liviana.

## Heurística operativa

### SDD
- Definir objetivo, alcance, no alcance y riesgos.
- Si aporta claridad, bajar el pedido a:
  - criterios de aceptación,
  - escenarios clave,
  - estrategia de validación.
- Mantener la spec liviana: no documentar más de lo que ayuda a decidir o validar.

### BDD
- Expresar escenarios críticos en lenguaje natural o `Given / When / Then` cuando eso aclare precondición, acción y resultado esperado.
- No forzar Gherkin formal por reflejo.
- Priorizar pocos escenarios de alto valor antes que un catálogo exhaustivo.

### TDD pragmático
- Si el cambio es acotado y el harness es accesible, intentar primero con test o repro que falle.
- Si el sistema es legacy, lento o caro de probar de forma estricta, preferir una alternativa honesta:
  - failing repro acotado,
  - characterization test,
  - regression test después de reproducir,
  - validación manual o de integración explícita con evidencia.
- No inflar tests solo para decir que hubo TDD.

## Trazabilidad mínima por rol
- `planner`: objetivo, alcance, criterios o escenarios cuando sumen claridad, validación esperada.
- `master-dev` e implementadores: qué comportamiento cambia, qué prueba o repro lo cubre y por qué no se hizo test-first si no convenía.
- `reviewer`: cumplimiento contra criterios o escenarios antes de entrar en cosmética.
- `dev-test`: qué criterios o escenarios quedaron validados y cuáles pendientes.

## Reglas
- Build verde no prueba por sí solo comportamiento correcto.
- Un test que no representa el comportamiento esperado no reemplaza la spec.
- No forzar SDD/TDD/BDD en microcambios triviales.
- Si el costo de automatizar es alto, decirlo explícitamente y dejar la mejor evidencia alternativa.

## Salida esperada
- comportamiento esperado,
- criterios o escenarios relevantes,
- estrategia de prueba o validación,
- trazabilidad entre cambio y evidencia.
