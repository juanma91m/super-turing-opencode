# CLI nativa + historial del harness: incompatibilidad confirmada en2.2.7

## Conclusión operativa

**Actualización de alcance:** esta página demuestra la falta de equivalencia
universal; no significa que el harness no funcione en V2. Después el usuario delegó
la priorización para instalarlo lo más parecido posible a V1. Se eligió el contrato
de host gestionado completo en uso habitual, con diferencias de hosting explícitas.
Ver `CONTRATO-GESTIONADO.md` y `cutover-activate.py`: no se cambió el pin, no se
arregló ni se oculta esta limitación. No volver a frenar el corte gestionado esperando
una API que sólo sería necesaria para la equivalencia universal descartada como gate.

**No hay una integración soportada comprobada que conserve simultáneamente toda
la CLI nativa2.2.7 y la lectura almacenada del harness en todos sus hosts.** No
instalar el launcher parcial como `opencode`, no retirar Background ni pedir cierre
de V1 para compensarlo. No se cambió el runtime fijado.

La implementación de fuentes anidadas y el procedimiento de storage/rollback ya
pueden probarse independientemente. No solucionan esta incompatibilidad.

## Evidencia pública del pin, no imports privados

- [Plugin.Context publicado2.2.7](https://unpkg.com/@opencode/plugin@2.2.7/dist/promise/plugin.d.ts)
  no entrega un cliente HTTP ni el endpoint/autenticación del host.
  [App](https://unpkg.com/@opencode/plugin@2.2.7/dist/app.d.ts) sólo declara
  name/version/channel. [Host](https://unpkg.com/@opencode/plugin@2.2.7/dist/host.d.ts)
  resuelve/carga entrypoints de plugins, no intercepta el bootstrap de clientes.
  [RPC](https://unpkg.com/@opencode/plugin@2.2.7/dist/promise/rpc.d.ts) registra/llama
  contratos de plugins; no entrega un método documentado de stored messages ni
  una conexión HTTP que complete por sí sola el contrato faltante.
- [SessionDomain publicado2.2.7](https://unpkg.com/@opencode/plugin@2.2.7/dist/promise/session.d.ts)
  es un Pick explícito de SessionApi: incluye `context`, pero no `message`.
  `context` no enumera el historial almacenado completo después de compaction.
- [Standalone.start del tag2.2.7](https://github.com/anomalyco/opencode/blob/v2.2.7/packages/cli/src/services/standalone.ts)
  crea su propio proceso mediante `selfCommand()+serve --stdio --port0`, password
  y pipes. No entrega fd3 del harness. Su opción interna `command` no es un flag
  público de los clientes nativos ni un hook público del plugin.
- [ACP del tag2.2.7](https://github.com/anomalyco/opencode/blob/v2.2.7/packages/cli/src/commands/handlers/acp.ts)
  llama directamente a Standalone.start; no dispone de selección de host equivalente
  a `--server` en su contrato CLI.
- [ServerConnection](https://github.com/anomalyco/opencode/blob/v2.2.7/packages/cli/src/services/server-connection.ts)
  diferencia host explícito, standalone y servicio compartido; no son aliases.
- [TUI default](https://github.com/anomalyco/opencode/blob/v2.2.7/packages/cli/src/commands/handlers/default.ts)
  cambia `server.local`, controles de reconnect/restart y entrega de Env.session
  según `requestedServer`. Inyectar `--server` siempre **no es transparencia CLI**.

Son fuentes públicas consultadas como evidencia; el harness no las importa ni
invoca clases internas. La documentación actual es un índice; el pin se contrasta
contra sus tipos publicados, fuente etiquetada y binario oficial verificado.

## Reproductor ejecutable y resultado

```sh
cd /home/jmagnaterra/.local/src/opencode-stack
HOME=/home/jmagnaterra \
TMPDIR=/home/jmagnaterra/.local/share/opencode-v2-clean/general-composed-candidate/tmp/opencode \
node --test v2/general/test/transport-compat-native.test.mjs
```

Un mismo plugin/comando de fixture intenta la lectura pública de mensajes en dos
arranques reales del oficial2.2.7, con stores propios:

| Observación | Host propio con fd3 | CLI `api ... --standalone` sin reescribir flags |
|---|---:|---:|
| ctx.session.message disponible | no | no |
| ctx.session.context disponible | sí | sí |
| transporte fd3 del harness disponible | sí | no |
| lectura de mensajes almacenados del harness | sí | no |

Pass significa que reproduce y distingue la incompatibilidad, **no** que la resuelve.
0 modelos/MCP/tools de negocio/auth reales; no originales, piloto, trial o APIs
privadas. Las conversaciones de fixture no se imprimen.

## Qué queda descartado como solución definitiva

- Binario desnudo sin lectura almacenada, fallback `context`, SQL o reconstrucción
  privada de mensajes: perderían atribución/benchmark/métricas o su contrato.
- Alias de chat o `--server` forzado que cambie semántica local, ignore modos,
  flags, continuidad o servicio. Los rechazos actuales son un **borrador bloqueado**,
  no una variante aprobada para producción.
- Interceptar selfCommand/prototipos, copiar auth files, buscar daemons ajenos o
  sustituir el binario. Un adaptador particular de `serve` no resuelve ACP y toda
  la CLI; no seguir multiplicando adaptadores para ocultar esa frontera.

## Recomendación viable

Mantener V1 como entrada habitual y conservar el candidato sin nuevos pilotos.
Solicitar al proveedor una API pública de lectura almacenada en Plugin.Context
(por ejemplo, `session.message.list/get`, respaldada por el mismo servicio público),
o una capacidad de conexión pública equivalente válida en TODOS los modos.

Con esa API, atribución/benchmark/métricas pueden usar el contexto público del host
sin fd3 y la entrada puede conservar argv y hosting nativos, en vez de reemplazarlos.
Adoptar luego una distribución oficial revisada **sólo con autorización de cambiar
el pin y con sus pruebas de compatibilidad**. No se promete que exista hoy una
versión que lo corrija, ni se efectuó ese cambio/publicación/issue remoto aquí.

Con pin2.2.7 y exigencia de equivalencia universal, no hay secuencia comprobada de
activación integral de todos los hosts nativos. La activación GESTIONADA elegida
después tiene un gate propio, documentado y probado; su cierre se pide sólo cuando
el usuario vaya a ejecutar ese comando, no por esta limitación ya explicitada.
