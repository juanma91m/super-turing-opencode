# Prueba incremental de alertas nativas

El operador confirmó con capturas `/alerts-test` y los avisos automáticos de
question, finalización y permiso, con formulario respondido y panel de permiso
visible. No repetir configuración ni reiniciar. En la última imagen está marcado
Allow once: falta seleccionar Reject y confirmar para cerrar la prueba humana
del rechazo. No se respondió ni aprobó el permiso desde las herramientas del agente.

## Modo actual: adaptador TUI → libnotify

El operador confirmó que notify-send directo entrega banner, mientras el
transporte de terminal no entregó avisos ni con OSC777. Se configuró el addon
`super-turing-opencode-notifier/v2/desktop` por API TUI pública. El emisor nativo
queda deshabilitado: no se prueban ambos a la vez y no se usa más el argumento
`--notification-protocol=osc777` en este modo.

Cerrar sólo workshop y abrir normalmente, sin repetir login:

```bash
node ~/.local/src/opencode-stack/migrations/v2/workshop.mjs verify
node ~/.local/src/opencode-stack/migrations/v2/workshop.mjs chat
```

verify ahora informa backend libnotify, notifications:true y
nativeNotifications:false. No confirma entrega desktop por sí solo.

**Primera prueba**, dentro de OpenCode, no del shell:

```text
/alerts-test
```

Es un comando local de la TUI: no invoca un modelo, no modifica archivos y debe
solicitar un banner genérico OpenCode V2. En este modo avisa **también estando
enfocado**, como el notifier V1 Linux; no hace falta Alt+Tab. Se suprime sonido.

Si eso funciona, probar question, finalización y permiso descritos abajo, sin
necesidad de desenfocar. El permiso sintético debe rechazarse. Reportar banner,
registro y duplicados. Click-to-focus/quiet hours/sonidos aún no migrados.
La prueba directa de notify-send ya pasó; la entrega de este addon aún necesita
confirmación humana. Auditoría/seguridad en el README del addon y
`v2/DESKTOP-ADAPTER.md`.

Las secciones siguientes conservan el diagnóstico del intento nativo anterior;
sus instrucciones de OSC/foco sólo aplican a aquel modo, no al libnotify actual.

## Estado actual de entrega GNOME

El operador confirmó formulario/respuesta, pero no recibe aviso de escritorio
ni entrada en el centro GNOME aun creando una pregunta nueva en segundo plano.
No se atribuye ya sólo al timing del foco. La entrega OS sigue fallando/no validada.

En una reproducción aislada del binario oficial con VTE_VERSION=8001 y foco
blurred, el renderer no selecciona protocolo. Con el override documentado OSC 777
sí emite bytes de notificación en el PTY; eso todavía no confirma entrega GNOME.
El diagnóstico y diferencias de alcance están en
`super-turing-opencode-notifier/v2/TRANSPORT-DIAGNOSIS.md`.

Próximo retest, sin persistir el override ni tocar el core:

```bash
node ~/.local/src/opencode-stack/migrations/v2/workshop.mjs chat --notification-protocol=osc777
```

Responder/cerrar primero la pregunta que quedó abierta y salir sólo del workshop.
En una conversación nueva repetir el caso question y Alt+Tab inmediatamente a
otra aplicación. Si no hay banner/registro, informar ese resultado; no darlo por
resuelto por el resultado del PTY ni probar protocolos distintos por intuición.

## Incidencia corregida: formulario question invisible

El operador reportó que `question` queda esperando sin mostrar opciones. La
reproducción de recorrido completo confirmó una pregunta pendiente en backend y
ningún formulario en TUI. Tras la confirmación de cierre del workshop se aplicó
el ajuste al adaptador; la entrega desktop todavía no está aprobada.

Controles sobre el mismo binario oficial 2.2.7, con DB/proveedor sintéticos:

- `smoke-question.mjs`: ahora muestra la pregunta, permite responder por teclado,
  entrega la respuesta al tool y comprueba que no queden forms pendientes.
- `--stock-control`: sin plugins custom, muestra y permite responder.
- `--omit-workshop`: con los otros cuatro adaptadores, muestra y responde.
- La omisión aislada de la transformación de `question` permitió localizar la
  causa. Esa omisión es ahora el comportamiento del adaptador real.
- `--regression-control`: una copia temporal restaura la transformación anterior
  y comprueba que reproduce la pregunta invisible, sin tocar el plugin del usuario.
- `--permission`: confirma que el panel de permisos aparece, se rechaza con el
  teclado, se vacía el pedido pendiente y no se entrega el contenido al modelo.

La causa acotada es la redecoración innecesaria de `question` desde el adaptador
del workshop: el builtin ya tiene `codemode:false`. Se excluyó `question` del
`editor.update` genérico, conservándola permitida y con su handler nativo.
No se modificó el host ni se ampliaron permisos. El operador cerró el cliente
antes del cambio; no se respondió ni canceló su formulario desde los tests.

La auditoría previa del controlador de notificaciones no ejercitaba la cadena
completa tool → formulario → TUI → respuesta; el nuevo harness cubre esa brecha.
Ese recorrido y el panel de permisos están verificados con storage/modelo propios
y la TUI real. Retomar la prueba humana de question en **una conversación nueva**;
no asumir que el snapshot de una herramienta antigua pendiente queda reparado.
No repetir login ni borrar la DB. La notificación OS aún necesita prueba humana.

## Estado y alcance

Se habilitaron **notificaciones, sin sonido**, sólo en el `cli.json` del workshop.
No se cargó el notifier V1 ni se agregó un plugin externo. `opencode.notifications`
viene con la TUI oficial 2.2.7. El audit/helper V2 pertenece al repo canónico
`super-turing-opencode-notifier/v2/`; la base conserva su configuración y launcher.

Se preservan login, Context7, once agentes, quince skills, atajos y permisos. No
se amplía el shell ni se toca la instalación V1. Se forwardean únicamente tres
metadatos adicionales de terminal (TERM_PROGRAM, TERM_PROGRAM_VERSION, VTE_VERSION)
en el launcher interactivo; no overrides OPENTUI ni claves del entorno.

El renderer solicita la notificación a la terminal: depende de GNOME/VTE y de
los ajustes de escritorio. La prueba de controlador en memoria no demuestra
que aparezca un banner en esta máquina. No cambiar No molestar, instalar helpers
ni emitir pruebas al OS desde automatización.

## Arranque

Cerrá y reabrí sólo el workshop, sin repetir login:

```bash
node ~/.local/src/opencode-stack/migrations/v2/workshop.mjs verify
node ~/.local/src/opencode-stack/migrations/v2/workshop.mjs chat
```

`verify` muestra `alerts.notifications: true` y `alerts.sound: false`.
`desktopDelivery: not checked by verify` es deliberado: la entrega OS no se
deduce de un JSON válido ni de que el proceso arranque.

Para cada caso, enviá el mensaje y **pasá inmediatamente a otra aplicación con
Alt+Tab**, no sólo a otra conversación de OpenCode. Nativo no solicita banner
si sigue enfocado o todavía no conoce el estado de foco. Mirá también el centro
de notificaciones si no aparece un popup. No se reproduce audio del motor nativo;
el escritorio/terminal aún puede aplicar su propio sonido de notificación.

## 1. Finalización

Con master-dev, en una conversación nueva:

> Escribí diez recomendaciones generales para revisar código. No uses herramientas ni modifiques archivos.

Al finalizar, esperamos la notificación de tarea terminada cuando la terminal
está desenfocada. Que no aparezca mientras estás mirando la terminal es normal.

## 2. Pregunta estructurada

> Usá la herramienta question para preguntarme si veo las alertas del piloto. Ofrecé Sí y No y esperá mi respuesta. No uses shell ni modifiques archivos.

Esperamos formulario y notificación de entrada pendiente. Volvé a la terminal y
respondé allí. Una pregunta escrita sólo en texto no equivale a form.created;
si no llamó question, no usar ese caso para juzgar la notificación de formularios.

## 3. Permiso, sin archivos reales sensibles

Se preparó `.ssh/notification-probe.txt` **dentro del proyecto sintético**, no en
tu `~/.ssh`. Contiene únicamente una frase de prueba, sin claves/credenciales.
El prefijo activa el ask conservador que ya existía; no se agregan grants.

> Dentro de este proyecto sintético hay un archivo de prueba sin credenciales llamado .ssh/notification-probe.txt. Usá únicamente read para intentar leerlo y esperá mi decisión de permiso. No uses otro mecanismo ni modifiques archivos.

Esperamos un pedido de permiso y la notificación. Elegí **Rechazar**, no
"Permitir siempre". Si el modelo se negó antes de usar read, no es evidencia de
un fallo del notifier: falta la llamada que crea el evento.

El fixture es readonly y el modelo no puede editarlo. Aparecerá como directorio
no versionado adicional en Git; es un asset de prueba, no una clave del usuario.

## Qué reportar y límites

Indicá cuáles casos mostraron banner, si el clic volvió a la ventana/tab correcta
y si alguna alerta se duplicó. No compartas diálogos de login ni datos privados.
Las notificaciones pueden mostrar título de sesión/formulario o un error truncado;
no probar con contenido sensible ni asumir que el escritorio lo oculta.

Quiet hours/notify.json, sonidos antiguos y click-to-focus GNOME exacto no están
migrados ni declarados equivalentes. La evaluación y diferencias están en el
README V2 del addon Notifier. No deprecar el addon hasta decidir esos gaps.

## Reproducibilidad sin escritorio

```bash
node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-workshop.mjs
node migrations/v2/smoke-question.mjs
node migrations/v2/smoke-question.mjs --permission
node migrations/v2/smoke-question.mjs --regression-control
node migrations/v2/smoke-question.mjs --transport
node migrations/v2/smoke-question.mjs --transport-osc777
```

El smoke de permisos usa su propia DB y un marcador SSH sintético. Se rechaza la
aprobación y se comprueba que el contenido no llegó al modelo. El audit de la
fuente TUI exacta vive en `super-turing-opencode-notifier/v2/check-native.mjs`.
La prueba humana de entrega desktop queda pendiente, no aprobada por los tests.
