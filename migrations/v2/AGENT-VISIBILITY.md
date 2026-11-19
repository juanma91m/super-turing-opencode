# Visibilidad de Plan y Build en el workshop V2

## Diagnóstico

El operador informó que Plan y Build reaparecieron al usar el workshop. La
composición Knowledge activa sus definiciones fallback con `disabled: false`,
necesarias para compatibilidad y rutas explícitas como `/memory-init → plan`.
Al no preservar `hidden`, los defaults nativos los vuelven visibles. No fue un
permiso nuevo requerido por el lector documental ni corresponde deshabilitarlos
para resolver una preferencia de presentación.

La fuente exacta 2.2.7 confirma `hidden` y `disabled` como propiedades separadas.
La TUI filtra su selector/ciclo con `mode !== "subagent" && !hidden`. Hidden no
es una ACL: no elimina el agente de la API ni impide un comando explícito.

## Corrección preparada, pendiente de aplicar

La preferencia es machine-local del workshop, no una política de Documents o
Knowledge. `.builtin-agent-visibility.json` guarda sólo owner/profile y los IDs
plan/build. `prepareWorkshop` la aplica **después** de los addons al documento
final y a la baseline padre conocida usada para upgrades. Así un addon posterior
no reintroduce visibilidad ni rompe la comparación de bytes del predecesor.

`builtin-visibility.mjs` cambia únicamente `agents.plan.hidden` y
`agents.build.hidden` a true. Conserva disabled, modelos, modos, permisos, roles,
default_agent, comandos y herramientas. No oculta automáticamente el default;
si está seleccionado un builtin como default exige reconciliación explícita.

El updater exige baseline conocida, valida el lote antes de escribir, hace
backup `.pre-builtin-visibility.bak` y no acepta drift arbitrario. No lee auth
stores ni inicia MCP o consultas de negocio. Atomicidad por archivo, no transacción
FS global. Marker inválido/symlink se rechaza sin imprimir valores. Es idempotente.

Con el cliente del workshop cerrado:

```bash
node "$HOME/.local/src/opencode-stack/migrations/v2/documents-read.mjs" hide-builtins --client-closed
node "$HOME/.local/src/opencode-stack/migrations/v2/documents-read.mjs" chat
```

Si el primer comando falla, detenerse. No editar a mano ni repetir el instalador,
OAuth o la conversión documental. La nueva configuración se carga al reiniciar.
Chat/verify comprueban hidden efectivo por `/api/agent`; el plan muestra el estado
del marker sin abrir MCP. Aún falta confirmar el selector real del operador tras
aplicar; el cliente abierto no fue modificado ni detenido desde esta sesión.

## Validación

```bash
KNOWLEDGE_API_NATIVE=1 node --test migrations/v2/test/*.test.mjs
```

84 tests OK, incluidos cinco de visibilidad:

- Delta exacto de dos flags, backup, no-op y propiedades/permisos intactos.
- Preferencia conservada en una actualización posterior de addon.
- Drift/default oculto/markers inválidos rechazados y ack de cierre antes de acceso.
- Control negativo nativo reproduce plan/build visibles sin preferencia.
- Con preferencia, API nativa conserva ambos con hidden true, los demás atributos
  compilados idénticos; el filtro stock de selector los excluye y mantiene planner/
  master-dev. `/memory-init` ejecuta plan y una ruta explícita build sigue funcionando
  con modelo ficticio, sin tools de memoria/indexación ni cuentas reales.

Pasaron también 19 casos Documents reader, 24 Playwright + headless loopback real,
23 CodeGraph + catálogo real, 21 Ticketing y cinco OAuth loopback. No se modificó V1.

Fuentes:
- https://github.com/anomalyco/opencode/blob/v2.2.7/packages/schema/src/config/agent.ts
- https://github.com/anomalyco/opencode/blob/v2.2.7/packages/tui/src/context/local.tsx
- https://github.com/anomalyco/opencode/blob/v2.2.7/packages/tui/src/component/dialog-agent.tsx
