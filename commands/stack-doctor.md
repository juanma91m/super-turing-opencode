---
description: Diagnostica el estado del stack OpenCode activo y detecta faltantes, drift o problemas de configuración.
agent: agent-design
subtask: false
---
Ejecutá un diagnóstico del stack OpenCode activo.

Objetivo:
- verificar que el sistema de agentes esté bien instalado y consistente,
- chequear dependencias base del entorno,
- validar configuración efectiva, plugins, MCPs y assets del stack,
- detectar drift entre el repo fuente `opencode-stack` y la implementación activa cuando aplique,
- si el repo actual tiene `.opencode/`, auditar explícitamente los overlays locales contra la capa global.

Checklist mínimo:
- `opencode` disponible y `opencode debug config` funcionando,
- `node`, `npm`, `npx`, `python3` disponibles,
- addons externos opcionales detectados cuando existan,
- MCP Context7 presente/habilitado para documentación externa de librerías/APIs,
- Playwright Chromium presente si corresponde,
- Stitch key presente/ausente,
- comandos/agents/skills globales clave presentes,
- si el repo actual tiene `.opencode/`, ejecutar **siempre al inicio** `bash ~/.config/opencode/scripts/check_local_overlays.sh --project-root "$PWD"` como baseline obligatorio de la auditoría,
- si el repo actual tiene `.opencode/`, revisar `AGENTS.md` local si existe,
- listar overrides locales por nombre en `.opencode/agents/`, `.opencode/commands/` y `.opencode/skills/`,
- comparar cada override local con su definición global equivalente cuando exista,
- clasificar cada override como `OK`, `warning` o `error`,
- marcar al menos como `warning` si un override parece haber perdido tools, permisos seguros, skills útiles o guardrails globales sin documentación,
- marcar como `error` si un override recorta o contradice el contrato global de forma material y no está explícitamente justificado,
- si el directorio actual parece ser el repo fuente `opencode-stack` (por ejemplo, contiene `STACK-MANIFEST.json`), revisar drift contra `~/.config/opencode/`; si no, omitir ese check.

Reglas:
- no modificar nada; solo diagnosticar,
- no persistir memorias durables desde este comando,
- no pegar la salida cruda completa de `opencode debug config` si contiene secretos resueltos; resumir hallazgos y redactar valores sensibles,
- si algo opcional falta, clasificarlo como advertencia y no como error fatal,
- separar hallazgos en: OK, warnings, errores, siguientes pasos,
- si hay overlays locales, incluir una sección explícita `Auditoría de overlays locales` con un ítem por override relevante.
- si el helper y tu evaluación manual divergen, explicitar la diferencia y por qué.

Formato esperado de salida:
- `## OK`
- `## Warnings`
- `## Errores`
- `## Auditoría de overlays locales` (si aplica)
  - por cada override: archivo local, equivalente global, estado (`OK`/`warning`/`error`), hallazgo principal y acción sugerida si corresponde
- `## Siguientes pasos`
