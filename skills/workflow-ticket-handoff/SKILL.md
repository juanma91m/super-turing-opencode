# Skill: workflow-ticket-handoff

## Que hago
- Refuerzo un workflow reusable para trabajo guiado por tickets.
- Evito que planning, implementacion y validacion lean o escriban `tmp/<ticket>/` de forma caotica.
- Hago explicito el handoff canonico entre planner, implementador y validador.

## Cuando usarme
- Cuando el trabajo esta asociado a un ticket y el proyecto adopta workspace temporal en `tmp/<ticket>/`.
- Antes de implementar si existe `tmp/<ticket>/verdict.md`.
- Cuando hay que decidir por donde leer contexto o que artefacto dejar al cerrar.

## Reglas base
- Este workflow aplica **solo** para trabajo asociado a tickets; no lo fuerces en tareas ad-hoc sin ticket.
- El planner mantiene `tmp/<ticket>/` vivo y curado mientras dura el analisis.
- El archivo canonico de handoff es `tmp/<ticket>/verdict.md`.
- `verdict.md` debe incluir al menos:
  - `Problema / Objetivo`
  - `Alcance`
  - `Estado actual`
  - `Causa / Hipótesis vigente`
  - `Solución propuesta`
  - `Validación esperada`
- El implementador debe leer primero `verdict.md` y luego solo la evidencia referenciada o estrictamente necesaria.
- Si el proyecto usa contexto auxiliar, `repo_findings.md` y `analysis.md` son apoyo; no reemplazan a `verdict.md`.
- Al terminar la implementacion, el implementador debe dejar `tmp/<ticket>/result-dev.md` con al menos:
  - `Cambio realizado`
  - `Deuda técnica detectada`
  - `Riesgos / impacto`
  - `Validaciones manuales recomendadas`
- El validador tecnico corre al final; no redefine el plan.

## Orden recomendado de lectura para implementacion
1. `tmp/<ticket>/verdict.md`
2. Archivos referenciados en `Evidencias`
3. `tmp/<ticket>/repo_findings.md` si existe
4. `tmp/<ticket>/analysis.md` si sigue faltando contexto
5. Resto del workspace solo si hace falta

## Salida esperada
- handoff claro entre agentes,
- menos ruido al retomar tickets,
- foco en evidencia vigente,
- cierre con artefactos consistentes.
