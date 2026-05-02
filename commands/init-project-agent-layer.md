---
description: Inspecciona un proyecto y propone o crea una capa local de agentes/OpenCode especializada sobre la base global.
agent: agent-design
subtask: false
---
Inicializá una capa local de agentes/OpenCode para el proyecto ubicado en: `$ARGUMENTS`

Objetivo:
- inspeccionar la estructura y el stack del proyecto objetivo,
- proponer una capa local mínima y coherente sobre la base global,
- seguir el patrón de especialización por mismo nombre cuando un agente o skill global se sobrescribe localmente,
- generar `AGENTS.md`, `.opencode/agents/`, `.opencode/commands/`, `.opencode/skills/` y wrappers locales solo si realmente hacen falta.

Flujo obligatorio:
1. validar que la ruta exista,
2. inspeccionar repo, stack, módulos y entry points,
3. arrancar en **modo propuesta** (no escribir todavía),
4. preguntar lo mínimo indispensable antes de aplicar, incluyendo:
   - si el proyecto usa Jira,
   - si quiere workflow de tickets con `tmp/<ticket>/`,
   - si quiere comandos `/ticket-*`,
   - si quiere wrappers/helpers locales,
5. recién con confirmación explícita, crear la capa local.

Reglas de diseño:
- reutilizar lo global por defecto y dejar local solo el delta,
- si se especializa un agente o skill global, mantener el mismo nombre base,
- si se crea un override local con el mismo nombre que un agente, skill o comando global, preservar explicitamente sus capacidades y guardrails globales salvo pedido expreso del usuario; no asumir herencia automatica,
- para cada override propuesto, revisar explicitamente este checklist: `mode`, `tools`, permisos seguros, responsabilidades globales, limites globales, formato de salida y skills utiles que deban reinyectarse,
- si un override local va a recortar alguna capacidad global, explicitarlo antes de aplicar y pedir confirmacion del usuario,
- si el proyecto usa Jira y adopta workflow de tickets, ofrecer la estructura `tmp/<ticket>/verdict.md` / `result-dev.md` y wrappers locales como en Higyrus,
- si usa Jira, asumir que el usuario luego deberá completar un `.env` compatible con los helpers globales (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`),
- no pisar archivos existentes sin avisar claramente,
- usar `LOCAL-OVERLAY-TEMPLATE.md` como referencia base cuando convenga proponer snippets o archivos iniciales,
- si conviene, proponer dry-run/preview de archivos a crear o modificar.

Entrega esperada:
- diagnóstico del proyecto,
- propuesta de capa local,
- preguntas mínimas necesarias,
- y, si el usuario confirma, aplicación controlada de los archivos.
