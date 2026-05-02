# Local Overlay Template for OpenCode Projects

Esta plantilla sirve como base para crear una capa local `.opencode/` sin perder capacidades globales por accidente.

Para el flujo operativo completo de uso diario, auditoría y mantenimiento, ver también `PLAYBOOK-LOCAL-OVERLAYS.md`.

## Principio rector

Un override local debe ser **aditivo**:

- preservar comportamiento global útil,
- agregar stack, dominio, workflows y restricciones del proyecto,
- recortar capacidades globales solo cuando haya motivo claro y quede documentado.

OpenCode **no hereda automáticamente** prompts, permisos ni tools entre definiciones globales y locales del mismo nombre.
Si un archivo local sombrea uno global, hay que reinyectar explícitamente lo que se quiera conservar.

## Cuándo usar cada nivel

### Solo `AGENTS.md`

Usar cuando alcanza con:

- describir stack,
- entry points,
- reglas de validación,
- restricciones de negocio o de seguridad,
- aclarar ownership entre agentes.

### Override local en `.opencode/agents/`

Usar cuando hace falta cambiar de forma ejecutable:

- prompt del agente,
- permisos,
- tools,
- formato esperado,
- comando/skill sugerida con fuerte especialización local.

### Override local en `.opencode/commands/`

Usar cuando el workflow del repo necesita:

- otro helper,
- otras precondiciones,
- otro wording operativo,
- artefactos o paths canonicos del proyecto.

### Override local en `.opencode/skills/`

Usar cuando una heurística reusable necesita:

- contexto técnico fuerte del proyecto,
- checklist específico de capa/dominio,
- vocabulario local consistente.

## Checklist mínimo por override

Antes de dar por bueno un archivo local que sombrea uno global, revisar:

1. `mode`
   - ¿Coincide con el rol global?
2. `tools`
   - ¿Reinyecta tools globales si siguen aplicando?
3. permisos seguros
   - ¿Conserva allowlists seguras del global?
4. responsabilidad
   - ¿Preserva el rol global y solo agrega especialización?
5. límites
   - ¿Sigue manteniendo guardrails globales útiles?
6. formato de salida
   - ¿No rompe el contrato esperado por el caller?
7. skills sugeridas
   - ¿Mantiene skills globales relevantes y suma las locales?
8. drift documentado
   - Si algo se recorta, ¿queda explicado en `AGENTS.md` local o en la propuesta?

## Plantilla base para `AGENTS.md`

```md
# <Proyecto> — instrucciones locales de agentes

Estas instrucciones aplican solo dentro de este repo y especializan el comportamiento de los agentes sin modificar la capa global.

## Principio de overlays locales

- todo override local en `.opencode/` que sombree un agente, skill o comando global debe preservar el comportamiento global, sus guardrails y permisos seguros por defecto,
- usar override local para agregar, refinar o especializar contexto del proyecto; no para recortar funcionalidad global salvo decisión explícita del usuario,
- como OpenCode no hereda prompts/permisos automáticamente entre global y local, cada override local debe reinyectar de forma explícita el comportamiento global que se quiera conservar.

## Stack real del proyecto

- ...

## Entry points relevantes

- ...

## Reglas no negociables

1. ...
2. ...
```

## Plantilla base para override de agente

```md
---
description: <especialización local del agente>
mode: <primary|subagent>
model: openai/gpt-5.4
variant: xhigh
tools:
  apply_patch: <true|false si aplica>
  bash: <true|false si aplica>
permission:
  edit: <allow|deny>
  bash:
    "*": <ask|deny>
    # reinyectar allowlists seguras globales si siguen aplicando
  task:
    "*": deny
    # targets adicionales solo si corresponde
---
Eres `<nombre-del-agente>`, <rol global preservado> especializado para <proyecto>.

Responsabilidad:
- <reinyectar responsabilidad global>
- <agregar especialización local>

Contexto / especialización local:
- <stack>
- <dominio>
- <entry points / riesgos>

Modo de trabajo:
- <reinyectar guidance global útil>
- <agregar reglas operativas del proyecto>

Límites / reglas:
- <preservar límites globales>
- <agregar restricciones locales>

Skills sugeridas:
- <skills globales relevantes>
- <skills locales>

Entrega esperada:
- <preservar contrato de salida global>
```

## Plantilla base para override de comando

```md
---
description: <descripción local>
agent: <agent-name>
subtask: <true|false si aplica>
---
<Instrucción principal>

Objetivo:
- <preservar objetivo global>
- <agregar paths/artefactos/workflow local>

Reglas:
- <preservar guardrails globales>
- <agregar restricciones locales>
```

## Plantilla base para override de skill

```md
# Skill: <nombre>

## Que hago
- <reinyectar heurística global útil>
- <agregar heurística local>

## Cuando usarme
- <casos globales que siguen aplicando>
- <casos locales>

## Reglas / checklist
- <preservar guardrails globales>
- <agregar checks del proyecto>

## Salida esperada
- <preservar contrato global>
- <agregar foco local>
```

## Señales de drift frecuentes

- el override local pierde tools o allowlists seguras globales,
- desaparecen guardrails de memoria, async, validación o handoff,
- se cambia el formato esperado de salida sin documentarlo,
- el prompt local reemplaza totalmente la responsabilidad global en vez de refinarla,
- se agrega un permiso repo-local en global en vez de dejarlo en el proyecto.

## Cierre recomendado

Después de crear o ajustar la capa local:

1. revisar `AGENTS.md`,
2. revisar overrides por nombre contra su equivalente global,
3. correr `opencode debug config` desde el repo,
4. si existe `/check-local-overlays`, usarlo como diagnóstico focalizado del overlay local,
5. si existe `stack-doctor`, usarlo como diagnóstico final más amplio,
6. documentar recortes intencionales si los hubiera.
