---
description: Inspecciona un proyecto y propone o crea una capa local de agentes/OpenCode especializada sobre la base global.
agent: agent-design
subtask: false
---
Inicializá una capa local de agentes/OpenCode para el proyecto ubicado en: `$ARGUMENTS`

Objetivo:
- inspeccionar la estructura y el stack del proyecto objetivo,
- proponer una capa local mínima y coherente sobre la base global,
- si el proyecto usa librerías o APIs externas relevantes, proponer también una sección local de `Fuentes de documentación preferidas` con IDs canónicos de Context7 cuando haya evidencia suficiente,
- seguir el patrón de especialización por mismo nombre cuando un agente o skill global se sobrescribe localmente,
- generar `AGENTS.md`, `.opencode/agents/`, `.opencode/commands/`, `.opencode/skills/` y wrappers locales solo si realmente hacen falta.

Flujo obligatorio:
1. validar que la ruta exista,
2. inspeccionar repo, stack, módulos, entry points y manifests/dependencias relevantes,
3. arrancar en **modo propuesta** (no escribir todavía),
4. preguntar lo mínimo indispensable antes de aplicar, incluyendo:
   - si el proyecto usa Jira,
   - si quiere workflow de tickets con `tmp/<ticket>/`,
   - si quiere comandos `/ticket-*`,
   - si quiere wrappers/helpers locales,
   - si va a usar un addon externo de memoria/retrieval y, si aplica, si prefiere una autonomía `conservadora` o `agresiva`,
5. recién con confirmación explícita, crear la capa local.

Reglas de diseño:
- reutilizar lo global por defecto y dejar local solo el delta,
- para sembrar documentación externa, consultar `CONTEXT7-TECH-CATALOG.md` como baseline reusable y usar solo tecnologías detectadas realmente en el proyecto,
- si el catálogo da un match **high**, puedes proponer el ID directamente; si da `medium`, proponelo con nota visible de drift/validación; si da `low/none`, no inventes un ID canónico,
- si Context7 ofrece variantes versionadas y la versión real del proyecto es conocida, priorizá esa línea exacta por sobre un ID genérico,
- si se especializa un agente o skill global, mantener el mismo nombre base,
- si se crea un override local con el mismo nombre que un agente, skill o comando global, preservar explicitamente sus capacidades y guardrails globales salvo pedido expreso del usuario; no asumir herencia automatica,
- para cada override propuesto, revisar explicitamente este checklist: `mode`, `tools`, permisos seguros, responsabilidades globales, limites globales, formato de salida y skills utiles que deban reinyectarse,
- si un override local va a recortar alguna capacidad global, explicitarlo antes de aplicar y pedir confirmacion del usuario,
- si propones una sección `Fuentes de documentación preferidas`, incluir solo librerías relevantes para ese repo y separar al menos entre `Alta confianza`, `Usar con cautela` y `Cuando no haya match confiable` cuando aplique,
- si el proyecto usa Jira y adopta workflow de tickets, ofrecer la estructura `tmp/<ticket>/verdict.md` / `result-dev.md` y wrappers locales como en Higyrus,
- si el proyecto usa un addon de memoria/retrieval, ofrecer una decisión explícita de autonomía:
  - `conservadora`: lectura automática cuando haya probabilidad real de contexto útil y escritura durable solo para hallazgos claramente reutilizables,
  - `agresiva`: lectura automática en tickets/cambios no triviales y persistencia obligatoria de cierres relevantes con resumen funcional+técnico,
- si usa Jira, asumir que el usuario luego deberá completar un `.env` compatible con los helpers globales (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`),
- no pisar archivos existentes sin avisar claramente,
- usar `LOCAL-OVERLAY-TEMPLATE.md` y `CONTEXT7-TECH-CATALOG.md` como referencias base cuando convenga proponer snippets o archivos iniciales,
- si conviene, proponer dry-run/preview de archivos a crear o modificar.

Entrega esperada:
- diagnóstico del proyecto,
- propuesta de capa local,
- preguntas mínimas necesarias,
- y, si el usuario confirma, aplicación controlada de los archivos.
