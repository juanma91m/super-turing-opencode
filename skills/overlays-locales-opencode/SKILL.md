---
name: overlays-locales-opencode
description: Resume el patrón institucional de overlays locales .opencode/ con foco en cuándo overridear, cómo preservar lo global y cómo auditar drift.
compatibility: opencode
---
## Cuando usarme
- Antes de crear o cambiar `.opencode/agents/`, `.opencode/commands/` o `.opencode/skills/`.
- Cuando hay que decidir si alcanza con `AGENTS.md` o hace falta un override ejecutable.
- Cuando hace falta auditar drift entre la capa global y la local.

## Decisión rápida
- Usar solo `AGENTS.md` si alcanza con documentar stack, entry points, reglas, ownership o fuentes preferidas.
- Usar `.opencode/agents/` si cambia prompt, permisos, tools, targets o formato ejecutable.
- Usar `.opencode/commands/` si cambia helper, paths, precondiciones o wording operativo.
- Usar `.opencode/skills/` si una heurística reusable necesita checklist técnico o dominio fuerte del proyecto.

## Principio rector
Todo override local debe ser **aditivo**:

- preservar responsabilidad global útil,
- preservar guardrails y permisos seguros por defecto,
- agregar stack, dominio, entry points, riesgos y reglas locales,
- recortar comportamiento global solo con motivo claro y documentado.

## Checklist mínimo por override
- `mode` correcto,
- `tools` reinyectadas si el global las define,
- permisos seguros preservados explícitamente cuando sigan aplicando,
- responsabilidades y límites globales reinyectados,
- skills globales útiles mantenidas junto a skills locales,
- recortes documentados en `AGENTS.md` local o en la propuesta.

## Reglas importantes
- OpenCode no hereda automáticamente prompts, permisos ni tools entre global y local del mismo nombre.
- Si un helper o permiso solo tiene sentido para un repo, habilitarlo en la capa local y no en la global.
- Si un merge por capas necesita reemplazar un bloque entero, preferir un sentinel explícito tipo `__replace__`.

## Auditoría recomendada
- `/check-local-overlays` para auditoría focalizada.
- `/stack-doctor` para diagnóstico más amplio cuando el repo tiene `.opencode/`.

## Señales de drift
- pérdida de allowlists seguras,
- desaparición de skills globales relevantes,
- guardrails globales ausentes,
- cambio de contrato no documentado,
- override local que reemplaza el rol global en vez de refinarlo.
