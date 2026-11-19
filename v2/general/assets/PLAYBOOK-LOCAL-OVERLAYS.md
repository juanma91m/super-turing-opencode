# Auditoría y propuestas nativas V2

- `/check-local-overlays` y `/stack-doctor` usan `stack-layer-audit` en el directorio
  actual. `stack-layer-status` conserva un resumen económico, no auditoría total.
- Descubrimiento: CLI oficial fijado 2.2.7, `debug config --standalone`, con
  data/state/cache/DB temporales. No usar `debug agents` como lectura inocua: inicia
  MCP en este pin. El registro efectivo se lee del host ya abierto mediante API.
- Reporte: orden y procedencia de fuentes, declaraciones de agentes, inventario
  de comandos/skills, retención de cuerpo global, modo/modelo/visibilidad, testigos
  de permisos y guardas. No imprime prompts, config resuelta ni recursos shell.
- Testigos de permisos no prueban inclusión formal de wildcards, policies completas
  o aprobaciones guardadas. Un contexto organizacional aditivo requiere también
  evidencia del flujo real. Descubrir archivos actuales no prueba que no cambiaron
  desde el arranque; reiniciar y volver a comprobar tras cambios autorizados.
- Un warning requiere juicio, no autosync. Archivos completos del mismo nombre,
  roles nuevos, comandos/skills locales y cambios de autoridad necesitan revisión.
- `stack-layer-scaffold` sólo devuelve JSON propuesto y revisión requerida: cero
  writes. Preferir `AGENTS.md` si no cambia ejecución; ver la plantilla nativa.
- Ni esta herramienta ni los fixtures aprueban automáticamente la composición
  general → organización real → proyecto real. No reindexan CodeGraph ni copian
  credenciales. Aplicación, backup/rollback y activación final son pasos separados.
