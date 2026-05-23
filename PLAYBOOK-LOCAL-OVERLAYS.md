# Playbook: Local Overlays `.opencode/`

Guía operativa para entender, crear, auditar y mantener capas locales `.opencode/` sobre la base global del stack.

## 1. Qué resuelve este playbook

Ayuda a evitar que un proyecto:

- pierda capacidades globales por accidente al overridear agentes, comandos o skills,
- mezcle contexto específico del repo en definiciones globales,
- genere drift silencioso entre la capa global y la capa local,
- use `.opencode/` cuando en realidad alcanzaba con `AGENTS.md`.

## 2. Piezas nuevas del stack global para overlays

### Patrón institucional

- `README-AGENTS.md` define el criterio oficial de overlays locales aditivos.

### Plantilla reusable

- `LOCAL-OVERLAY-TEMPLATE.md` da snippets y checklist para:
  - `AGENTS.md`
  - override de agente
  - override de comando
  - override de skill

### Helper semiestructurado

- `scripts/check_local_overlays.sh`
- `scripts/check_local_overlays.py`

Sirven para comparar `.opencode/` local contra la base global y emitir `OK` / `warning` / `error`.

### Comando focalizado

- `/check-local-overlays`

Usa el helper como baseline y devuelve una auditoría legible del overlay local.

### Diagnóstico amplio

- `/stack-doctor`

Si detecta `.opencode/`, ahora debe usar el helper de overlays como baseline obligatorio y luego completar el diagnóstico general.

## 3. Cuándo usar cada nivel

### Solo `AGENTS.md`

Usar cuando alcanza con documentar:

- stack,
- entry points,
- reglas de validación,
- restricciones locales,
- ownership entre agentes.

### `.opencode/agents/`

Usar cuando hace falta cambiar de forma ejecutable:

- prompt,
- permisos,
- tools,
- targets de `task`,
- formato esperado o guidance operativo del agente.

### `.opencode/commands/`

Usar cuando el workflow del repo necesita:

- otro helper,
- otros paths canónicos,
- otras precondiciones,
- otro wording operativo.

### `.opencode/skills/`

Usar cuando una heurística reusable necesita:

- checklist técnico local,
- dominio fuerte del proyecto,
- vocabulario o entry points específicos.

## 4. Cómo crear o ajustar un overlay local

### Paso 1

Decidir si realmente hace falta override.

Regla práctica:

- si alcanza con `AGENTS.md`, no crear archivo local,
- si la especialización tiene que afectar ejecución real, crear override.

### Paso 2

Si overrideás una definición global por nombre:

- mantener el mismo nombre base,
- tratar el archivo local como **overlay aditivo**,
- reinyectar explícitamente comportamiento global útil, porque OpenCode no hereda prompts/permisos/tools automáticamente.

### Paso 3

Usar `LOCAL-OVERLAY-TEMPLATE.md` como punto de partida.

## 5. Flujo recomendado de uso diario

### Cuando tocás la capa local `.opencode/`

1. revisar `AGENTS.md`,
2. ajustar overrides necesarios,
3. correr `/check-local-overlays`,
4. si el cambio es más amplio o afecta entorno/config global, correr `/stack-doctor`,
5. documentar cualquier recorte intencional.

### Cuando creás una capa local nueva

1. empezar por `/init-project-agent-layer <path>` en modo propuesta,
2. usar la plantilla local como base,
3. correr `/check-local-overlays`,
4. cerrar con `/stack-doctor`.

## 6. Cómo ejecutar las auditorías

### Opción A — Comando focalizado de OpenCode

```bash
opencode run --command check-local-overlays --agent agent-design --dir "$(pwd)" --dangerously-skip-permissions
```

### Opción B — Helper directo

```bash
bash ~/.config/opencode/scripts/check_local_overlays.sh --project-root "$(pwd)"
```

### Opción C — Diagnóstico amplio

```bash
opencode run --command stack-doctor --agent agent-design --dir "$(pwd)" --dangerously-skip-permissions
```

## 7. Cómo interpretar el resultado

### `OK`

- el override preserva adecuadamente la estructura global,
- o no hay `.opencode/` local,
- o el archivo local-only no genera señales objetivas de drift.

### `warning`

Se detectó algo que **podría** ser drift, por ejemplo:

- pérdida de allowlists seguras,
- pérdida de tools globales,
- skills globales útiles no reinyectadas,
- guardrails globales ausentes,
- headings/estructura relevante perdida en una skill,
- cambio de ownership no documentado en un comando.

### `error`

Se detectó una contradicción material con el contrato global, por ejemplo:

- `mode` incompatible,
- recorte fuerte del rol sin justificación,
- contradicción estructural importante con la definición global.

## 8. Qué chequea hoy el helper

### Agentes

- `mode`
- `tools`
- allowlists seguras de `bash`
- targets permitidos de `task`
- preservación mínima de skills globales
- presencia de ciertos guardrails/tokens clave

### Comandos

- `agent`
- `subtask`
- preservación mínima de `Objetivo:` y `Reglas:`
- tokens/guardrails globales relevantes

### Skills

- headings importantes
- ciertos grupos de guardrails/tokens clave

### Política local

- presencia de `AGENTS.md`
- principio de overlays aditivos documentado

## 9. Limitaciones actuales

El helper es **semiestructurado**, no semántico profundo.

Entonces:

- detecta muy bien drift objetivo,
- no entiende intención completa de un prompt como lo haría una revisión humana,
- puede requerir criterio del agente para distinguir warning real vs tolerable.

## 10. Cuándo ajustar el sistema y cuándo no

### Ajustar el helper o la documentación solo si aparece evidencia

- falsos positivos repetidos,
- drift real no detectado,
- nuevo tipo de override no cubierto,
- fricción operativa real en más de un repo.

### No avanzar por inercia si:

- el helper ya marca limpio,
- el equipo entiende el patrón,
- no hay warnings reales recurrentes.

## 11. Recomendación práctica

Usar este orden:

1. `AGENTS.md`
2. `LOCAL-OVERLAY-TEMPLATE.md`
3. `/check-local-overlays`
4. `/stack-doctor`

Ese flujo cubre diseño, implementación y auditoría con bajo costo y poco drift.
