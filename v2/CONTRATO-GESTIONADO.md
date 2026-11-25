# Contrato `managed-harness-v1`

Usa el OpenCode oficial instalado en un prefijo npm privado, sin modificarlo
ni fijar su versión en el arranque de producción. La entrada inicia un host privado
loopback con transporte efímero fd3 y conecta la CLI nativa conservando argv,
cwd, señales y estado de salida. No inyecta una sesión nueva. Los clientes
pueden compartir perfil como lectores. General, addons y overlays conservan
sus responsabilidades y guardas.

Admite TUI, `mini`, `run`, `api`, `auth`, `models`, `stats`, `session`, `reload`,
`debug paths/config/agents/heap-dump`, `mcp list/auth/logout` y
`plugin list/check/update`. El arranque valida los plugins de guarda y los
agentes efectivos, pero no espera conexiones ni catálogos MCP. Los estados
nativos se ven en `/mcps`; el diagnóstico completo se puede solicitar aparte.

`/update` y `opencode upgrade` delegan en el actualizador oficial sin
recomponer el stack. El arranque posterior sigue validando fuentes, guardas y
registro efectivo. Si falla una capacidad necesaria, se diagnostica el
contrato, no se rechaza por el número de versión.

No es un daemon persistente. El host termina al cerrar su frontend; `reload`
sólo afecta a esa invocación. `--server` externo, `--standalone`, `serve`,
`service`, `acp`, `pair` y mutadores sin integración de conexión se rechazan sin
abrir el almacén. No hay fallback que quite herramientas o guardas. Para iniciar
otro host, cerrá y reabrí el comando; continuar sesiones sigue siendo nativo.

El perfil y el almacén de producción son independientes. El instalador inicial
crea un almacén vacío mediante el host oficial. Los updates de la capa gestionada
reutilizan el almacén publicado, incluidos historial, snapshots y auth nativa.
No hay copia de auth ni conversor de otros layouts.
