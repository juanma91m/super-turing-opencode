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
- detectar drift entre el repo fuente `opencode-stack` y la implementación activa cuando aplique.

Checklist mínimo:
- `opencode` disponible y `opencode debug config` funcionando,
- `node`, `npm`, `npx`, `python3` disponibles,
- plugin async cargado,
- binario Engram presente y funcional si está configurado,
- Playwright Chromium presente si corresponde,
- Stitch key presente/ausente,
- comandos/agents/skills globales clave presentes,
- si existe `~/.local/src/opencode-stack`, revisar si hay drift contra `~/.config/opencode/`.

Reglas:
- no modificar nada; solo diagnosticar,
- si algo opcional falta, clasificarlo como advertencia y no como error fatal,
- separar hallazgos en: OK, warnings, errores, siguientes pasos.
