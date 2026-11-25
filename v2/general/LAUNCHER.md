# Launcher de pruebas del perfil general

Para uso habitual, ver el [contrato gestionado](../CONTRATO-GESTIONADO.md).
Esta interfaz separada sirve para validar un perfil antes de publicarlo.

## Separación de acciones

### Catálogo de modelos en producción

El entorno interactivo/servidor con binding `production-native-storage` ya no fija
`OPENCODE_DISABLE_MODELS_FETCH=1`: el runtime puede refrescar su catálogo público
nativo y ofrecer modelos nuevos sin editar los agentes. `generalEnvironment`
(checks offline/schema) y los perfiles de prueba conservan el catálogo
congelado para no hacer consultas externas implícitas durante verificaciones.

El refresco del catálogo no actualiza el binario. El flujo manual de producción
se describe en el [contrato gestionado](../CONTRATO-GESTIONADO.md); el launcher de
pruebas conserva su pin de fixture. No cambian modelos predeterminados, variantes,
permisos, proveedores habilitados, credenciales o historiales. No se heredan
endpoints de catálogo arbitrarios.

El refresco nativo es asíncrono: al consultar inmediatamente puede verse todavía
el catálogo previo. En la comprobación real pasó de 19 a 34 modelos OpenAI a los
siete segundos y aparecieron `gpt-6.2-sol`/`gpt-6.2-astra` y sus variantes fast y
ultrafast; cero inferencias. El inventario visible depende del catálogo remoto,
soporte del runtime y la conexión disponible, no sólo de este flag.

Este es un cambio de entorno de proceso, no de configuración recargable: un host
que ya arrancó con el flag anterior debe cerrarse y abrirse normalmente para
tomar el nuevo entorno. No matar servidores ajenos ni borrar cachés/datos. En la
instalación habitual el entry importa el launcher desde el Core seleccionado;
no se reescriben releases archivadas para activar este cambio de código.

| Acción | Efectos autorizados por el comando |
|---|---|
| plan / status | Selección/metadata/estado de assets; no host ni store de aplicación |
| check | Hashes, pin y CLI schema/fuentes con storage temporal; sin server/MCP/modelos |
| prepare --client-closed | Assets del candidato identificado, sin host, sin adoptar drift |
| install/update/rollback/recover | Revisiones de config sólo con flags explícitas; ver DISTRIBUTION.md |
| verify-live --candidate-only --client-closed | Servidor privado, startup MCP y metadata; estado nativo normal, sin inferencia ni tools de negocio |
| chat --candidate-only --client-closed --reuse-v2-storage | Lo anterior más sesión nueva y TUI real; sólo terminal interactiva, sin otro login |

Las flags van después de `--project <path>` y en el orden mostrado. Sólo
verify-live admite omitir `--reuse-v2-storage`; así usa data/state aislados del
candidato, **no** hace fallback a otro login. Chat exige reutilización explícita.

Contratos de la ventana ya ejecutada y futuras aperturas explícitas (cerrar otros
clientes V2 que comparten el store), no autorización de normalizar overlays/cortar:

```text
node v2/tools/general-composed.mjs verify-live --project /ruta/neutral/revisada --candidate-only --client-closed
node v2/tools/general-composed.mjs verify-live --project /ruta/neutral/revisada --candidate-only --client-closed --reuse-v2-storage
node v2/tools/general-composed.mjs chat --project /ruta/neutral/revisada --candidate-only --client-closed --reuse-v2-storage
```

## Preflight antes de DB/MCP/TUI

- Consentimiento y TTY se validan antes de selectores o stores. Chat no admite
  redirección/captura de transcript por esta interfaz ni una URL/DB/servidor ajeno.
- Runtime durable browser seleccionado por owner, binario oficial por bytes/pin,
  assets/marker íntegros y sin prepare implícito. No descarga, adopta o repara nada.
- Screening de candidatos de snapshots por nombres Git, no contenidos; no
  es detector de secretos ni sandbox de captura.
- Este incremento es **general-only**: config local/ancestral y assets ejecutables
  `.opencode` se rechazan por metadata antes del parser; las fuentes nativas se
  vuelven a contrastar. AGENTS aditivo sigue permitido. No desactivar descubrimiento
  ni ignorar capas no revisadas para lanzar un proyecto.
- Esto bloquea intencionalmente AUNE/overlays no revisados. Su port y aceptación
  nativos pertenecen a pasos3/4; no hay flag para afirmar ficticiamente que pasaron.
  Tampoco es un sandbox contra plugins o procesos confiables del mismo UID.

### Punto de extensión para owners nativos

`checkCandidate(plan, runtime, {sourceGuard})` permite que un owner especializado
revise sus fuentes antes del parser y después de `nativeSources`. El callback debe
terminar **sincrónicamente**; async/thenables se rechazan. Se invoca con
`{phase:'before',plan}` y `{phase:'after',plan,sources}`; el resultado after puede
incorporar metadata allowlisted al reporte, nunca secretos o config resuelta.
No se combina con `generalOnly:true` ni modifica ese contrato. La selección y
revisión de capas, expectativas locales y deployment quedan en el owner, no en
Core. Screening de snapshots e integridad de assets se mantienen en ambos casos.
`inspectLiveCandidate` devuelve además `audit` técnico para contraste del owner;
el reporte público general conserva su alcance y no afirma aceptación de proyectos.

El auditor comprueba el contrato de `debug config --standalone` con storage
temporal y salida validada; no exige un número de versión al host activo.
Una capacidad ausente o una salida incompatible impide certificar la auditoría.
Este chequeo no selecciona ni autentica el ejecutable. Producción resuelve el
paquete oficial en su prefijo npm privado; las herramientas de prueba que
requieren reproducir un pin siguen verificándolo por separado.

Este mecanismo es de herramientas source-owned, no un plugin nuevo del perfil:
no cambia por sí solo los assets/revisiones runtime archivados. La regresión Core
actual suma79 Node+3 Python pass, incluido rechazo previo al parser y convivencia
con el launcher general-only existente.

## Servidor, auditor y sesión

El launcher crea un único servidor nativo propio por stdio en loopback/puerto
efímero. Password Basic aleatorio sólo en memoria/env; no en argv, reportes, archivos
de configuración, memoria curada o logs. Drena logs del host sin persistirlos.
No se conecta al daemon compartido o a una URL provista por el caller.
Transporte de escritorio allowlisted se conserva tanto en servidor (MCP visible/
OAuth) como en TUI, sin copiar su contenido ni heredar keys/preloads/overrides.

Excepción de paridad, no credenciales generales: con runtimeHome seleccionado,
serverEnvironment conserva mecanismos libpq admitidos por el helper, incluidos
PGPASSWORD y PGSSL*/Kerberos. Sólo helper literal psql-readonly los recibe del hook;
no TUI/shell genérica/config/argv/reportes/modelo. No se sourcean envs ni leen secretos
desde el agente. Validado con psql falso, no DB real.
La restricción describe el hook de shell, no sandbox de plugins/MCP confiables o
herencia interna del SDK; el servidor conserva ese entorno de conexión.

El SDK Plugin.Context2.2.7 no expone session.message aunque HTTP sí. Para benchmark,
el padre entrega URL/PID/password efímero de su host por pipe fd3 al servidor después
de readiness. Flag env sólo contiene el número de descriptor, no un secreto nuevo;
no archivo de auth, discovery de daemon, endpoint del caller o API interna. El
adapter valida PID/loopback, lee/cierra una vez y retiene conexión sólo RAM. GETs
de mensajes ocurren dentro del servidor bajo permisos; proyección previa al modelo
o métricas persistidas. Fuera de ese launcher falla cerrado, sin fallback a otro host.

Espera plugins/catálogos MCP y lee metadata de agentes/integraciones. Respeta los
plazos startup/catalog explícitos, no un timeout del auditor
más corto que el contrato nativo. Plugins
externos y MCP inesperados fallan; los disabled explícitos se respetan. Audit usa
los mismos contratos de retención de prompts/modos/modelos/permisos/guards/tools.
`ready` no es calidad semántica ni aceptación de general→AUNE→proyecto.
También verifica que plugins desactivados estén ausentes y proveedores declarados
denegados no figuren en modelos utilizables; ver DORMANT-PROVIDERS.md.

### Readiness del catálogo MCP — 2026-11-24

`Connected` no prueba que el registro nativo ya publique las herramientas. El
launcher anterior tomaba un solo runtimeAudit después de ese estado y podía
rechazar un catálogo todavía incompleto. Ahora vuelve a muestrear, dentro del
presupuesto startup/catalog restante, únicamente si faltan tools revisadas de
MCP habilitados y conectados. No reintenta OAuth, tools de negocio ni inferencia;
no suprime findings y al vencer el plazo sigue devolviendo no-listo.

Cada muestra usa un nonce nuevo pero la misma sesión diagnóstica propia. Sólo
retira sus receipts y esa sesión al salir. Errores de permiso/retención de prompt,
servidores desconocidos, disabled o fallidos no se convierten en éxito/reintentos
de catálogo. El set MCP se revalida entre muestras.

La transición Connected→registro incompleto→registro completo se reprodujo con
un fixture de la API pública: fallaba antes y pasa después. Pruebas de deadline
conservan el finding permanente. La validación real posterior pasó 13/13 con una
muestra por ubicación; no demuestra la causa interna de cada respuesta Rovo
anterior ni ausencia universal de fallos futuros del servicio remoto.

**Pin:** no existe tool.list HTTP en el OpenAPI 2.2.7. Para leer el registro completo
se usa `stack-runtime-probe`, comando público nativo, no endpoint privado o prompt
de inferencia. Sólo master-dev/agent-design, UUID exacto y sin adjuntos ni paths:
escribe un recibo nonce-bound de metadata en la caché propia (wx/0600, sin symlinks).
No puede ejecutar una tool arbitraria ni resolver auth. No agrega shell/Edit.
El launcher crea una sesión diagnóstica titulada, ejecuta el comando sin modelo y
retira **esa sesión propia** y su recibo. No borra otras sesiones ni promete secure
erase de registros nativos internos. El namespace cache vacío puede permanecer.

Para OpenAI, `readyForChat` exige conexión nativa presente por metadata. No se leen
tokens ni se prueba refresh/inferencia: una conexión existente puede expirar.
Si falta, se detiene antes del TUI; no OAuth, auth login o proveedor alternativo.

Chat crea una sesión nueva con agente/modelo/variant efectivos del coordinador y
se adjunta con `--server` y `--session` al **mismo** host ya verificado. No reabre
automáticamente una sesión existente. Config CLI conserva permisos interactivos,
tabs por cwd y new_location launch. HOME/config/cache/tmp siguen propios; sólo
data/state se vinculan al almacén de pruebas seleccionado con la flag de reuse y validación de markers/paths.
Un fallo del TUI puede dejar el draft nuevo; no es transacción o rollback de DB.

## Cierre, exclusión y fallos

Lease exclusiva `.candidate-launch.lock` bloquea otro candidato y operaciones de
distribución durante la ejecución; prepare no puede eludir un store versionado.
Una transacción de distribución pendiente bloquea check/live/prepare hasta recovery
explícita. El estado se vuelve a validar bajo lease para no abrir otra revisión.
La lease no excluye por sí sola a otros clientes que usen el mismo almacén: el operador
debe cerrarlos antes del reuse. La confirmación humana no detecta procesos.

Al salir/error se cierra el host propio y se retira sólo la lease del mismo inode.
SIGINT/SIGTERM del launcher se reenvían únicamente a su TUI. No búsquedas por nombre,
cancelación OAuth ajena, kill de procesos externos o cambios a servicios instalados.
Tras crash/SIGKILL puede quedar lease: no se adopta/borra automáticamente. Se necesita
reconciliar explícitamente su ownership y el cierre del cliente antes de retirarla.
No es un lock transaccional frente a otros programas del mismo usuario.

verify-live devuelve metadata de readiness y termina su host. Chat rehúsa estado
parcial; fallo MCP/auth no habilita modo degradado silencioso. Native startup puede
escribir locks, metadatos de refresco, sesiones o archivos propios de los addons; no
confundir «sin tools de negocio/inferencia del launcher» con cero efectos físicos.

## Evidencia

- verify-live real con22 roles y5 MCP **simulados**: conectados, auditor pass,
  ningún tool call funcional/backend de negocio o solicitud de modelo.
- TUI oficial real en PTY con mock: sesión fresca en store V2 temporal reutilizado,
  anterior conservada,0 inferencias; cierre de worker/host, sesión diagnóstica,
  recibo y lease comprobados. No transcript guardado ni QA humano nuevo solicitado.
- Caso nativo OpenAI sin credenciales en store temporal: detención antes del TUI y
  sin login/fallback. No se ensayó refresh de cuentas reales.
- Rechazos por flags/TTY, lease concurrente/reemplazada, prepare activo, actor/nonce
  del probe, MCP fallido y plugin local no revisado (no ejecutado).
