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
- si el repo actual tiene `.opencode/` y existe tooling externo de overlays/ticketing instalado, puede auditar explícitamente overlays locales contra la capa global.

Checklist mínimo:
- `opencode` disponible y `opencode debug config` funcionando,
- `node`, `npm`, `npx`, `python3` disponibles,
- addons externos opcionales detectados cuando existan,
- MCP Context7 presente/habilitado para documentación externa de librerías/APIs,
- Playwright Chromium presente si corresponde,
- Stitch key presente/ausente,
- comandos/agents/skills globales clave presentes,
- si el repo actual tiene `.opencode/`, revisar `AGENTS.md` local si existe,
- si el directorio actual parece ser el repo fuente `opencode-stack` (por ejemplo, contiene `STACK-MANIFEST.json`), revisar drift contra `~/.config/opencode/`; si no, omitir ese check.

Reglas:
- no modificar nada; solo diagnosticar,
- no persistir memorias durables desde este comando,
- no pegar la salida cruda completa de `opencode debug config` si contiene secretos resueltos; resumir hallazgos y redactar valores sensibles,
- si algo opcional falta, clasificarlo como advertencia y no como error fatal,
- separar hallazgos en: OK, warnings, errores, siguientes pasos,
- si hay overlays locales y tooling externo de auditoría instalado, podés incluir una sección explícita `Auditoría de overlays locales` con un ítem por override relevante.

Formato esperado de salida:
- `## OK`
- `## Warnings`
- `## Errores`
- `## Auditoría de overlays locales` (si aplica)
  - por cada override: archivo local, equivalente global, estado (`OK`/`warning`/`error`), hallazgo principal y acción sugerida si corresponde
- `## Siguientes pasos`
