# Primera prueba incremental de V2

## Resultado del primer piloto

**Validado por el operador el 2026-11-12.** La captura aportada muestra respuesta
`PILOTO_OK`, una llamada a `read` y la respuesta con la marca `READ_OK_…` del
fixture. La salida de `verify` aportada confirma `connected: true`, modelo
`openai/gpt-6.1-sol#high`, dos guardas, cero MCP/skills y `v2-pilot` como único
agente primario visible.

Esta evidencia confirma login, inferencia real y uso de lectura en el alcance
mínimo. No prueba otros agentes, integraciones, shell, escrituras ni aptitud para
producción. No volver a ejecutar el chequeo PTY pre-login sobre este perfil ya
autenticado; las credenciales y la sesión del piloto se conservan.

## Qué incluye

- OpenCode oficial `2.2.7`, sin compilar ni modificar el core.
- Un único agente primario: `v2-pilot`, con `openai/gpt-6.1-sol#high`.
- Conversación y `read` únicamente sobre `fixture-readme.txt`, un archivo sintético
  del perfil. La marca aleatoria está en el archivo, no en el prompt ni el system.
- Guardas de `.env*` y de alcance del piloto mediante APIs públicas.
- Perfil persistente independiente en `~/.local/share/opencode-v2-clean/pilot/`.

No incluye shell, escritura, delegación, Background, MCP, skills, adjuntos ni
agentes/overlays productivos. Autopilot y el broker del planner todavía no se
necesitan: las capacidades que administran están denegadas. El resto del stack se
agrega después de esta prueba, de forma incremental.

Es aislamiento de configuración/estado, **no un sandbox OS**. No abrir repos reales,
usar la terminal integrada, ejecutar upgrades/instaladores ni pegar secretos.
El programa conserva tu UID.
La instalación habitual V1 y sus datos permanecen intactos.

## En tu terminal

Desde `~/.local/src/opencode-stack/`:

```bash
node migrations/v2/pilot.mjs login
node migrations/v2/pilot.mjs verify
node migrations/v2/pilot.mjs chat
```

1. `login` usa el método oficial **ChatGPT browser**. Abrí la URL que muestre el
   cliente si el navegador no se abre solo. No compartas URL/códigos/tokens en el
   chat. No copiamos credenciales de V1 ni del piloto descartado.
2. `verify` debe mostrar `connected: true`, `guardCount: 2`, `mcpCount: 0`,
   `skillCount: 0` y `primaryAgents: ["v2-pilot"]`. `connected` indica conexión
   guardada; la autenticación/inferencia efectiva se confirma con la prueba.
3. `chat` abre exclusivamente el perfil del piloto con servidor privado.

El login necesita el puerto OAuth 1455 libre. Si está ocupado, el helper se
detiene: no mata procesos ni cancela el login de otra instancia. El chequeo es
preflight, no una reserva atómica; no ejecutar logins simultáneos.

## Prueba corta

Primero:

> Respondé únicamente PILOTO_OK.

Después:

> Usá read para leer fixture-readme.txt y respondé únicamente el valor de read_probe.

Esperamos una llamada visible a `read` y una respuesta `READ_OK_...` tomada del
archivo. Luego podés comprobar el rechazo, sin pedir ningún archivo real:

> Intentá leer ../archivo-inexistente.txt. No uses otros mecanismos y explicá si fue bloqueado.

Ese intento puede ser rechazado por el propio modelo antes de invocar una tool;
no cuenta como prueba técnica adicional de la guarda. Los rechazos forzados ya se
prueban automáticamente contra el host oficial.

Para cerrar, usá la salida normal de OpenCode. No necesitás reiniciar V1. Si se
cambian archivos del piloto, cerrá y volvé a ejecutar `chat`; no continuar sobre
una instancia que cargó otra configuración.

## Verificación técnica sin proveedor real

```bash
node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-pilot.mjs
node migrations/v2/pilot.mjs verify
python3 migrations/v2/pilot-tui-check.py
```

El smoke usa un proveedor sintético loopback y un perfil distinto del real.
Comprueba lectura nativa del fixture, bloqueo nativo `.env*`, rutas ajenas,
ausencia de ejecución de shell/escritura, deny de sesión, rechazo de adjuntos,
fixture intacto y ausencia del archivo centinela de shell. No consulta OpenAI ni
otros servicios reales. El PTY sólo comprueba el render inicial antes del login;
no envía prompts ni graba la terminal. Después de autenticar, el QA de UI es manual.

La prueba humana de login, inferencia y lectura reales se completó con la
evidencia del operador indicada al comienzo. No confundir ese resultado con los
checks automáticos loopback ni extrapolarlo a capacidades todavía no incorporadas.
