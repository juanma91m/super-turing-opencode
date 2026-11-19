# V2 gestionado — contrato práctico de instalación habitual

**Estado 2026-11-19: activación inicial realizada y arranque real confirmado.**
Los comandos fechados de activación de abajo son historial/recovery de esta
máquina, no un instalador portable ni una instrucción de repetir el corte.
Actualizaciones: `../../v2/install/README.md` y el adapter opt-in de cada owner.

## Decisión vigente

El usuario delegó la decisión técnica y priorizó pasar su harness a V2 con todo lo
más parecido posible a V1, sin otra ronda de elecciones. Se elige el host gestionado
ya comprobado: **harness completo en su uso habitual**, no equivalencia universal
con cada modo de hosting de la CLI nueva. No se cambia el pin oficial2.2.7.

Esta decisión sustituye como gate de este corte la exigencia de cubrir TODOS los
hosts nativos. `CLI-2.2.7-INCOMPATIBILIDAD.md` conserva evidencia válida sobre esa
equivalencia no resuelta; no impide publicar el contrato gestionado elegido ahora.
No atribuir al usuario una elección técnica por cada modo: la priorización fue
delegada al agente y las diferencias se explicitan aquí.

## Se conserva

- General → AUNE scoped → los11 proyectos, con composición nativa; sin clonar
  prompts. Roles, modelos/variantes, skills, comandos, broker, guardas, MCP y helpers.
- Snapshots/undo, contexto/role attribution almacenada, benchmark CodeGraph y
  Ticketing metrics mediante el transporte opaco fd3 del host propio. No context
  fallback, SQL de mensajes o reconstrucción privada de conversaciones.
- Apertura TUI normal (`opencode [directorio]`), continuidad/selección nativa de
  sesión, prompts/archivos/formatos y flags compatibles: argv no se descarta, no se
  crea una sesión fresca por adelantado, cwd/exit code/señales se conservan.
- `run`, `mini`, `api`, `auth`, `models`, `stats`, `session`; diagnósticos compatibles
  (`debug paths/config/agents/heap-dump`), `mcp list/auth/logout` y
  `plugin list/check/update`. Operaciones explícitas de auth/historia no exigen que
  chat ya esté autenticado. Nuevos clientes pueden compartir perfil como readers;
  no se publica la cuota accidental de un único cliente del candidato.
- Historial definitivo separado de original/piloto/trial, con transferencia nativa,
  backup y rollback; no sanitizar ni reemplazar por resúmenes. Los límites de native
  export/import, mensajes incompletos y recursos externos siguen documentados.
- Background/Stitch excluidos como se pidió; auxiliares actuales Engram/semgrep
  preservados al retirar ownership de Background.

## Diferencias de hosting, no ocultas

La entrada usa un backend privado propio y conecta el frontend nativo con
`--server`. No simula que es el daemon/local TUI nativo: reconnect/restart local
y Env.session no tienen semántica idéntica. Para reiniciar esa instancia, salir y
reabrir el comando; la selección explícita de sesión/continue sigue siendo nativa.
`reload` alcanza sólo el host de esa invocación, no cambia otras TUI abiertas.
La instancia privada termina al salir del frontend; no se promete que sus trabajos
background continúen después de cerrar la TUI. No es el servicio persistente nativo.

`--server` externo, `--standalone`, `serve`, `service`, `acp`, `pair` y mutadores sin
integración de conexión **no se redirigen a un host que perdería herramientas**:
se rechazan con un mensaje claro ANTES de abrir storage. La ayuda nativa se conserva
con aviso de estos límites. No es soporte completo de todos los modos nuevos ni
un SDK patch; el binario oficial no se modifica. No sumar fallbacks de archivos de
auth, discovery de daemons o protocolos privados para ocultar la frontera.

## Activación inicial ejecutada — procedimiento histórico

Plan privado: `/mnt/hd_linux/opencode-cutover-install-20261118-prepared/activation-plan.json`.
Los11 receipts y el respaldo real de instalación ya están comprobados. El comando
no necesita una sesión agente activa: **cerrar V1 y los V2 que usen el piloto**,
incluido el control, y ejecutarlo en una terminal independiente:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /home/jmagnaterra/.local/src/opencode-stack/migrations/v2/cutover-activate.py activate --plan /mnt/hd_linux/opencode-cutover-install-20261118-prepared/activation-plan.json --clients-closed --confirm
```

Hace captura final mediante Backup API, migración/unión/auth por mecanismos nativos
en copias aisladas, publicación del store, verificación live gestionada sin
inferencias ANTES de retirar V1, lifecycle Background, auxiliares actuales,
preservación del npm histórico fuera de rutas autoload y publicación del wrapper.
Retiene pre/postimages, bloquea nuevos clientes de perfiles durante la mutación,
usa una entrada de mantenimiento y activa `active.json` sólo al completar checks.
Verifica la entrada habitual/versión sin modificar PATH. Muestra fases/heartbeat;
que el proceso esté vivo no certifica progreso del migrador. Puede tardar minutos.

**No abrir clientes hasta terminar.** Si pasa, el resultado dice
`managed-v2-activation-completed`, `installed-and-verified`, `opencode v2.2.7`;
después usar `opencode` normalmente. Si falla antes del retiro, V1 sigue como estaba.
Si falla después, intenta devolver sólo imágenes conocidas de instalación al estado
pre-corte, sin tocar DB o overlays previos. Drift desconocido impide forzar esa
recuperación: preservar todo y leer el stage report; no repetir a ciegas.

Una preparación interrumpida ANTES de mutar instalación admite `continue` explícito
con las mismas flags, selección y fuentes idénticas; no recaptura ni repite lifecycle
automáticamente. Si la instalación ya mutó, revisar/rollback, no `continue` forzado.

## Rollback explícito de instalación habitual y proyectos

Con original/piloto/producción cerrados, este único comando preserva primero la
historia nueva V2, preflightea/revierte los11 receipts sin pisar trabajo local y
restaura instalación/ownership V1 exactos; la DB V2 no se restaura sobre V1:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /home/jmagnaterra/.local/src/opencode-stack/migrations/v2/cutover-activate.py rollback --plan /mnt/hd_linux/opencode-cutover-install-20261118-prepared/activation-plan.json --clients-closed --confirm
```

La entrada se restaura al final, no sobre runtime a medio reponer. Datos V2 y
pre/postimages quedan conservados; no se promete que V1 lea mensajes V2. Config
gestionada propia queda inactiva y auditada, no se borra por arrastre. Los bloques
locales de exclusión de snapshots se preservan aparte de los receipts.

## Evidencia vigente

- 90 Node Core,78 Node AUNE,26 Python cutover y1 fixture nativo de transferencia pass.
- CLI nativa real en modo gestionado comprueba stored history con fd3; standalone
  real reproduce su ausencia, no se etiqueta como corregida.
- Fixtures de activación: copia/historia intactas, auxiliares actuales, retiro npm,
  commit de entrada, fallos antes/después del lifecycle, abort rollback conocido,
  drift/solapamiento rechazados y rollback con historia nueva preservada.
- Plan real y check13 ubicaciones offline pasaron; staged --version2.2.7, guard de
  perfiles adquirido/liberado y3451 preimages actuales iguales al respaldo. Final
  storage/entry/Background reales estaban pendientes en ese hito. Después se
  completó el corte; usar el estado vigente y los recibos finales, no esta cronología.
