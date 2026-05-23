# Playbook: Code Pattern Checks

Guía operativa para integrar herramientas de búsqueda y chequeo estructural de código dentro del stack OpenCode.

## 1. Objetivo

Este playbook cubre dos familias de herramientas:

- **Semgrep**: reglas de análisis estático y checks repetibles.
- **ast-grep**: búsqueda estructural y apoyo a refactors/localización de impacto.

La idea no es correrlas en todos los tickets, sino activarlas cuando el cambio toca zonas sensibles o cuando su evidencia reduce riesgo real.

## 2. División global vs local

### Global

La capa global debería aportar:

- nombres estándar de comandos,
- wrappers globales que delegan al repo local si existe integración,
- playbooks y criterio de uso,
- permisos mínimos para wrappers read-only seguros.

### Local por proyecto

Cada repo especializado debería aportar:

- scripts ejecutables reales en `.opencode/scripts/`,
- reglas Semgrep en `.opencode/rules/semgrep/`,
- patterns o mapping de búsquedas estructurales para ast-grep,
- comandos locales que decidan qué agente las usa y con qué perfiles.

## 3. Qué hace cada herramienta

### Semgrep

Usarla para:

- detectar patrones peligrosos,
- checks de performance o testing repetibles,
- revisar zonas sensibles con reglas del proyecto,
- complementar review/validate con evidencia objetiva.

### ast-grep

Usarla para:

- localizar call sites por estructura,
- mapear impacto antes de implementar,
- preparar refactors repetitivos,
- encontrar patrones sintácticos sin depender de regex frágiles.

## 4. Comandos estándar del stack

### `/check-code-patterns`

- wrapper conceptual para ejecutar checks de Semgrep del proyecto actual,
- debería fallar con mensaje claro si el repo no ofrece integración local.

### `/find-code-pattern`

- wrapper conceptual para ejecutar búsquedas estructurales del proyecto actual,
- debería fallar con mensaje claro si el repo no ofrece integración local.

## 5. Ownership recomendado

### Planner

- no las corre por defecto,
- decide en `verdict.md` si el ticket necesita pattern checks o búsqueda estructural.

### Code-inspector

- principal usuario de `ast-grep` / `find-code-pattern`,
- ideal para mapear impacto y call sites.

### Reviewer

- principal usuario de `Semgrep` / `check-code-patterns`,
- usa findings como evidencia de review, no como verdad absoluta.

### Master-dev / Backend implementers

- pueden correr ambas cuando el cambio toca zonas sensibles,
- especialmente útil antes y después de modificar áreas de riesgo.

### Dev-test

- puede correr `check-code-patterns` como parte de validación **solo si el ticket lo amerita**,
- no volverlo obligatorio para cualquier ticket chico.

## 6. Cuándo activarlas

Buena señal para activarlas:

- cambios de performance,
- queries/JDO/SQL,
- contratos o integraciones,
- multi-cliente,
- pantallas o flujos con mucho coupling,
- refactors repetitivos,
- testing frágil o mocks complejos.

No conviene activarlas por reflejo en tareas triviales.

## 7. Artefactos sugeridos

Si el ticket es complejo, conviene guardar en `tmp/<ticket>/`:

- `pattern-checks.md` o `pattern-checks.json`
- `pattern-search.md`

Así los hallazgos quedan reutilizables para implementación/review/validación.

## 8. Estrategia de adopción

### Fase 1

- Semgrep para checks de alto valor y baja ambigüedad,
- ast-grep para búsqueda estructural,
- integración local por proyecto,
- sin CI obligatoria ni auto-rewrites.

### Fase 2

- más perfiles/reglas,
- integración opcional en validación automatizada,
- refactors guiados si el proyecto demuestra valor real.

## 9. Regla práctica

1. `planner` decide si hace falta
2. `code-inspector` usa `find-code-pattern`
3. `reviewer` usa `check-code-patterns`
4. `master-dev` / `backend-*` lo usan cuando el ticket toca zonas sensibles
5. `dev-test` solo lo incorpora a la validación cuando el caso lo justifica

## 10. Qué no hacer

- no meter reglas Higyrus en la capa global,
- no volver Semgrep/ast-grep obligatorios para todos los tickets,
- no tratar los findings como sustituto de criterio técnico,
- no usar ast-grep para auto-rewrites masivos en la primera fase.
