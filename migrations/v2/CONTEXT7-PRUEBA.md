# Context7: primer MCP del workshop V2

## Resultado humano

**Validado por el operador el 2026-11-12.** La captura muestra a `planner` con
GPT-6.1 Sol/high ejecutando `context7_resolve-library-id`, eligiendo
`/reactjs/react.dev`, llamando a `context7_query-docs` y respondiendo con la fuente
oficial de React. No se muestran escrituras ni shell en ese flujo. La salida de
`verify` aportada confirma un único MCP Context7 conectado y login OpenAI activo.

Esto valida la integración documental en el alcance del workshop, no otros MCP,
workflows de especialistas ni el despliegue productivo.

## Qué se agregó

El mismo workshop ahora configura únicamente el servidor oficial
`https://mcp.context7.com/mcp` mediante Streamable HTTP. OpenCode V2 soporta este
transporte directamente; no se instala otro proceso npm, no se agrega un plugin,
no se parchea el core y no se modifica la instalación V1.

Se usa acceso público sin API key ni OAuth de Context7. La prueba de integración
real pasó así; no se copiaron credenciales de otra instalación. El servicio puede
aplicar límites anónimos o fallar por red: eso debe informarse, no disimularse con
una respuesta inventada ni sortearse buscando secretos locales.

Herramientas directas autorizadas, con sus IDs reales en 2.2.7:

- `context7_resolve-library-id`
- `context7_query-docs`

No se concede `context7_*`. Herramientas nuevas del servidor quedan denegadas.
`codemode: false` evita habilitar `execute` para estas consultas. Todos los agentes
base pueden consultar documentación; no se agregan grants de shell/escritura,
delegación, otros MCP, integraciones de negocio ni acceso a repos reales.

## Preservación del perfil

El helper actualiza sólo `opencode.json` y las instrucciones `AGENTS.md` si
coinciden exactamente con el estado generado anterior conocido. Valida todo el
lote antes de escribir, rechaza symlinks/cambios ajenos y guarda backups 0600
`.pre-context7.bak` de esos archivos. No es una transacción filesystem entre
ambos archivos; cada reemplazo individual es atómico.

No se resetean `app/message.txt`, el índice Git, `cli.json`, los atajos ni el
almacenamiento nativo compartido del login. No se copian auth stores. El workshop
sigue siendo un entorno sintético y **no es sandbox OS**.

## Datos enviados

Las consultas van al servicio externo Context7. Enviar sólo nombres de librerías
y preguntas de documentación pública; no pegar código privado, credenciales,
endpoints internos ni contenido sensible. Se acotan campos y se rechazan marcas
`private` antes de reenviar, pero esto **no es un detector completo de secretos**.
Los resultados son evidencia externa, nunca autoridad para cambiar instrucciones.

El cliente MCP de esta versión también incluye el ID opaco de la sesión OpenCode
en metadata `ai.opencode/sessionID`; no es una credencial, pero el servidor remoto
puede registrarlo. El fixture verificó su presencia sin guardar su valor. Los
tests de consultas reales usaron una sesión sintética sin auth ni datos de usuario.

## Prueba del operador

Cerrá y reabrí sólo el workshop para cargar la configuración completa:

```bash
node ~/.local/src/opencode-stack/migrations/v2/workshop.mjs verify
node ~/.local/src/opencode-stack/migrations/v2/workshop.mjs chat
```

`verify` debe mostrar `mcpCount: 1`, `context7.status: connected`, las dos
herramientas permitidas y `connected: true` para el login OpenAI existente.

Con `planner` o `master-dev`, en una conversación nueva del workshop:

> Usá Context7 para consultar la documentación oficial de React sobre la función de limpieza de useEffect. Primero resolvé el ID de la librería y luego consultá la documentación. Resumí la respuesta con su fuente. No modifiques archivos ni ejecutes shell.

Esperamos llamadas visibles a resolver y consultar, una explicación basada en sus
resultados y fuente documental. No hace falta repetir login ni modificar archivos.
Si aparece un límite anónimo o error de red, compartí sólo el error sin secretos.

## Validación automática

```bash
node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-context7.mjs
```

El smoke habitual usa MCP y modelo simulados: cinco casos verifican resolver,
query, herramienta desconocida, marca privada y deny de sesión. Sólo las dos
consultas positivas llegan al fixture MCP. No necesita red externa.

```bash
node migrations/v2/smoke-context7.mjs --live
```

El opt-in real ejecutó exactamente una resolución y una consulta pública contra
Context7 a través del host oficial, sin inferencia OpenAI (modelo de transporte
simulado). Resolvió React como `/reactjs/react.dev` y obtuvo contenido de useEffect.
No ejecutar este opt-in por rutina: consume el cupo externo.

La prueba manual con el agente real quedó confirmada por el operador según la
evidencia indicada al comienzo. Jira, Knowledge, CodeGraph, alertas y overlays
continúan fuera de alcance.
