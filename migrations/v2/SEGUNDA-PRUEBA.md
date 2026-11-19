# Segundo piloto: agentes base y proyecto sintético

Este documento conserva el alcance del piloto 2, ya confirmado. El workshop
actual se amplió después únicamente con [Context7](./CONTEXT7-PRUEBA.md); por eso
su `verify` ahora informa un MCP en lugar de cero. No repetir el setup anterior
para quitarlo ni sobrescribir el perfil actual.

## Resultado humano y atajos

El operador confirmó el flujo real el 2026-11-12 con capturas: `master-dev` leyó
y modificó `app/message.txt`, y el checker devolvió `valid: true`; `planner` leyó
el archivo y consultó status/diff mediante el broker, sin mostrar escrituras.
La salida de `verify` confirmó conexión, once agentes y quince skills base.
Esta evidencia no prueba todos los workflows de especialistas ni las integraciones
todavía ausentes.

El reporte de Tab resultó ser un **cambio de defaults nativos**, no un fallo de
la migración: V2 usa Shift+Tab para avanzar de agente y Tab para completar
sugerencias. Para conservar el uso anterior se configuró sólo el `cli.json` del
workshop (y su plantilla):

```json
{
  "keybinds": {
    "agent.cycle": "tab",
    "agent.cycle.reverse": "shift+tab",
    "prompt.autocomplete.complete": "ctrl+space"
  }
}
```

Tab avanza, Shift+Tab retrocede y Ctrl+Space completa sugerencias. Enter sigue
siendo el selector nativo de sugerencias. Se mueve el completado para evitar la
colisión con Tab. No se cambian permisos, agentes, auth, runtime ni V1.

`python3 migrations/v2/workshop-keybind-check.py` reproduce los defaults y
valida ambos sentidos y el completado en PTY con un workshop sin auth y proveedor
loopback inactivo. No envía prompts ni usa OpenAI. Falta confirmar los nuevos
atajos en la terminal real del operador: cerrar y reabrir sólo el workshop con el
mismo comando; no repetir login ni modificar producción.

Fuentes: https://opencode.ai/v2/docs/cli/keybinds y
https://opencode.ai/v2/docs/cli/config .

## Alcance

Se cargan los once agentes y las quince skills de la base canónica, conservando
modos, prompts y defaults de variantes salvo la traducción de tres referencias
ejecutables de Background. Los archivos usan la compatibilidad V1 soportada del
loader V2; no se mezclan frontmatters ni se fabrican permisos a partir de texto.

Adaptadores públicos V2: `.env`, permisos controlados, broker del planner e
identidad/atribución. Una quinta extensión **exclusiva del piloto** limita los
archivos y comandos del proyecto sintético. No es parte de la política portable.

- Sólo implementadores pueden escribir `app/message.txt`.
- Planner y los otros cuatro roles read-only conservan `edit: deny`.
- Shell sólo admite status/diff y un checker confiable. Planner debe pasar por
  el broker canónico, que rechaza shell libre y no modifica la aplicación.
- El checker lee texto como datos; no importa ni ejecuta el archivo editable.
- Sin MCP, addons, delegación, adjuntos ni acceso a repos reales.
- No hay commit: el repo sintético tiene únicamente un índice de referencia.

Las skills no habilitan por sí mismas herramientas o integraciones. Los helpers
de GitHub/SSH/PostgreSQL/handoff y las capacidades propias de especialistas no
incluidas siguen pendientes; no considerar probados esos workflows completos.

## Login y preservación

El nuevo HOME/config/cache y proyecto viven en
`~/.local/share/opencode-v2-clean/workshop/`. Se reutilizan los directorios
**data/state del piloto V2 autenticado** para usar las credenciales y locks de
refresh que administra OpenCode. No se copian/exportan/resuelven secretos desde
los helpers, ni se toca almacenamiento V1. Las sesiones de ambos pilotos comparten
la DB V2: esto no es una copia independiente ni un backup.

Cerrá sólo el cliente del primer piloto antes de abrir el segundo para no operar
dos configuraciones sobre ese estado simultáneamente. No necesitás cerrar V1 ni
volver a iniciar sesión. No se detiene ninguna instancia automáticamente.

## Arranque

Desde el repo base:

```bash
node migrations/v2/workshop.mjs verify
node migrations/v2/workshop.mjs chat
```

`verify` comprueba modelos/permisos efectivos, cinco adaptadores, once agentes,
quince skills base, cero MCP y conexión guardada. También compara los hashes del
config y fixture iniciales para detectar una modificación accidental del piloto 1.

## Prueba manual corta

1. Con `master-dev`:
   > Leé app/message.txt. Cambiá su contenido a «Hola desde V2» con salto de línea final. Ejecutá el checker permitido y reportá su resultado.
2. Cambiá manualmente a `planner` en el selector nativo:
   > Leé app/message.txt y consultá git status mediante tu broker. Explicá qué cambió, sin editar archivos ni ejecutar shell libre.
3. Opcional, con `master-dev`:
   > Usá agent_attribution y decime qué agentes/modelos aparecen, sin reproducir mensajes.

El checker debe indicar `valid: true`; planner debe mantenerse en lectura. No se
espera que los subagentes aparezcan como agentes primarios: se preservaron los
modos canónicos y la delegación está cerrada. No hay patch de variantes: las
selecciones manuales de la TUI mantienen la semántica nativa, además de los
defaults configurados high/medium.

## Evidencia automática

```bash
node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-workshop.mjs
```

El smoke usa DB/provider propios, sin compartir auth ni llamar a OpenAI: valida
la separación read-only/writer en los once agentes, read/write/checker, shell del
planner, rechazo de escape y comando destructivo, escritura fuera del proyecto,
atribución sin cuerpos, deny de sesión y aprobación sensible rechazada.

La política de riesgo se extrajo a `lib/permission-policy.ts`, compartida por los
adaptadores V1/V2 y declarada en el manifest. Tests comparan sus exports V1 contra
la implementación previamente comprometida. V2 además conserva los asks de los
wrappers `sh/bash/zsh -c`, que no cubría el hook regex V1. No se ha desplegado el
refactor V1 en producción. La futura distribución V2 debe preservar el layout
`v2/plugins/`, `lib/` y `scripts/` requerido por sus imports relativos.

`agent_attribution` usa por ahora el contexto visible al modelo y lo declara en
su salida; no promete reconstruir historial completo tras compaction. Completar
esa equivalencia por API pública queda pendiente, sin alterar el host.

Como en el piloto inicial, **no es sandbox OS**. No abrir repos reales, usar
terminal integrada, instalar paquetes ni ejecutar upgrades. El flujo humano
master/planner está confirmado; los nuevos atajos aún requieren retest manual.
Los smokes no equivalen a validar otros workflows ni el despliegue productivo.
El operador confirmó luego el funcionamiento de Tab/Shift+Tab; Ctrl+Space se
explicó como completado de sugerencias, no como cambio de agente.
