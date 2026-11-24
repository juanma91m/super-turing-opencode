# Contrato `managed-harness-v1`

Usa OpenCode oficial 2.2.7 sin modificarlo. La entrada inicia un host privado
loopback con transporte efímero fd3 y conecta la CLI nativa conservando argv,
cwd, señales y estado de salida. No inyecta una sesión nueva. Los clientes
pueden compartir perfil como lectores. General, addons y overlays conservan
sus responsabilidades y guardas.

Admite TUI, `mini`, `run`, `api`, `auth`, `models`, `stats`, `session`, `reload`,
`debug paths/config/agents/heap-dump`, `mcp list/auth/logout` y
`plugin list/check/update`. Chat exige readiness; las operaciones de auth y
mantenimiento no dependen de que chat esté autenticado.

No es un daemon persistente. El host termina al cerrar su frontend; `reload`
sólo afecta a esa invocación. `--server` externo, `--standalone`, `serve`,
`service`, `acp`, `pair` y mutadores sin integración de conexión se rechazan sin
abrir el almacén. No hay fallback que quite herramientas o guardas. Para iniciar
otro host, cerrá y reabrí el comando; continuar sesiones sigue siendo nativo.

El perfil y el almacén de producción son independientes. El instalador inicial
crea un almacén vacío mediante el host oficial. Los updates del mismo pin
reutilizan el almacén publicado, incluidos historial, snapshots y auth nativa.
No hay copia de auth ni conversor de otros layouts.
