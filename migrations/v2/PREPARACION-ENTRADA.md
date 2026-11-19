# Preparación de entrada y rollback — NO es corte

**Documento histórico de preparación.** La activación se ejecutó posteriormente,
el usuario arrancó 2.2.7 y la auditoría post-corte pasó. No usar las frases de
pendiente de este hito para repetir el corte. Estado vigente: `ESTADO-CORTE.md` y
`MANTENIMIENTO-POST-CORTE.md`; actualización portátil: `../../v2/install/README.md`.

Revisión: 2026-11-18. Único ejecutor V2; V1 permanece abierto intencionalmente.
No pedir su cierre por preparativos. La continuación posterior se consolidó en el
comando autónomo de corte: ver la decisión vigente y el contrato siguiente.
No se tocaron instalación activa, ownership Background, original/piloto/trial,
overlays de productos, pins archivados, PATH ni autenticación. Sin commits/pushes.

## Decisión práctica posterior y comando listo

El usuario delegó la decisión y priorizó harness completo lo más parecido posible
a V1, no más rondas técnicas. Se seleccionó `managed-harness-v1`: mismo camino de
host propio ya probado, sin perder atribución/benchmark/métricas/snapshots. La CLI
universal sigue no integrada y sus modos no soportados se anuncian/rechazan, no se
degradan silenciosamente. `CONTRATO-GESTIONADO.md` es el contrato vigente de este corte.

`cutover-activate.py` ahora integra captura/publicación final, preflight live ANTES
de retirar V1, lifecycle Background, auxiliares actuales, retiro verificado del npm
histórico fuera de autoload, entrada habitual y commit activo, sellado de rollback
y verificación instalada. Guardas exclusivas impiden nuevos clientes durante la
mutación. Fallos reconocidos posteriores intentan volver a preimages de instalación
sin restaurar DB o deshacer overlays previos; desconocidos se conservan sin forzar.
Rollback explícito adicional preserva historia nueva V2 y revierte los11 receipts.

Pruebas vigentes:90 Node Core+78 Node AUNE+26 Python cutover+1 fixture nativo de
transferencia pass. CLI real gestionada leyó stored history por fd3; standalone
real sigue reproduciendo la ausencia. Check real13 ubicaciones pasó, staged2.2.7,
guard adquirido/liberado y3451 preimages actuales iguales. No store final o corte
real ejecutados; V1/piloto siguen activos. Plan listo:
`/mnt/hd_linux/opencode-cutover-install-20261118-prepared/activation-plan.json`.
No más prompts entre agentes: cerrar ambos clientes sólo al ejecutar el comando
único de CONTRATO-GESTIONADO.md desde una terminal independiente.

## Resultado de la continuación —2026-11-18

- **Fuentes anidadas implementadas y probadas:** owner AUNE revisa la cadena dentro
  del proyecto aplicado y la composición sigue siendo nativa. Prueba oficial Git:
  prompts globales, AGENTS raíz/ancestro/hoja, deltas, roles/skills/commands/plugins
  locales; negativos antes del host. Se respetan límites nativos de AGENTS fuera
  de Git/HOME, no se inventa concatenación privada. Ningún overlay real reaplicado.
- **Procedimiento de storage/rollback implementado y probado**, no sólo planeado:
  `cutover-storage.py`, `native-transfer.py`, `cutover-rollback.py`. Unión nativa,
  familias/archivadas/inline, identidad Git/listas por proyecto y auth ficticia por
  pipe oficial, sin secretos al modelo/archivos. Pre/postimages, drift, auxiliares y
  recuperación explícita. Comandos y límites en `STORAGE-ROLLBACK-PROCEDIMIENTO.md`.
  El destino final y sus datos reales todavía NO se crearon.
- **Bloqueo de CLI confirmado, no falta de otro wrapper:** el oficial2.2.7 bajo
  --standalone no recibe fd3 y su Plugin.Context no ofrece stored message API.
  Forzar --server cambia semántica de TUI. Reproductor y recomendación viable en
  `CLI-2.2.7-INCOMPATIBILIDAD.md`. No se publica el subset ni se cambia el pin.
- **Última validación dirigida:21 casos Node+11 Python pass**, en corridas separadas.
  Incluye debug config oficial aislado y runtime/public API sobre fixtures; no
  aceptación de negocio ni nuevo ensayo real de recuperación V1. La cifra65/6 más
  abajo pertenece al hito anterior y no se suma como una nueva suite completa.
- Plan final REAL sólo metadata: original y piloto siguen abiertos, runtime pin
  verificado, destino ausente,13 raíces Git preparadas, reserva estimada~99GB y
  ~250GB libres. `/proc` tiene gaps de visibilidad explícitos; cierre humano sigue
  siendo obligatorio en ventana. No se abrió otra vez la DB original para probar.

**Conclusión del hito anterior bajo equivalencia universal:** fuentes/storage/rollback quedaron preparados;
la compatibilidad integral del pin no puede resolverse con los contratos públicos
comprobados. Mantener V1 hasta una solución oficial revisada/autorizada, no hasta
otra aprobación de alcance o un nuevo piloto. No existe aún activación exacta válida
con la entrada staged actual; no reemplazar ese faltante por un comando engañoso.

## Implementado en fuente, sin publicar producción

- Core `v2/general/production-storage.mjs`: contrato separado de producción,
  directorio físico privado `production-storage/{data,state}` y marker público
  `.production-storage.json`, fase `history-verified`. Binding sólo de data/state;
  no adopta original/piloto/trial ni inicializa/migra una DB. El marker **no existe
  todavía en un store definitivo**: no crearlo para saltar la aceptación de datos.
- Core `production-cli.mjs`: conserva argv, selección nativa de sesión/continue,
  cwd original para directorios relativos, exit status y señales. Host propio
  conserva `startOwnedServer` y fd3; no crea una sesión fresca por adelantado.
  Auth/history no dependen de readiness de chat. No es aún una CLI completa.
- Core `production-leases.mjs`: readers compartidos sin cuota accidental de clientes;
  lifecycle exclusivo bloqueado mientras haya readers, sin retirar leases stale.
  `prepareGeneral` ahora mantiene exclusivo durante checks/publicación completa.
- Owner AUNE `v2/production.mjs`: selecciona padres archivados y receipt de proyecto
  aplicado con pins exactos, sin clonar prompts. Readers del deployment se publican
  bajo su `lease.json` estable; protegen incluso frente a otro archive del mismo
  proyecto. Reread del deployment después de tomar las guardas.
- `cutover-backup.py`: preimages allowlisted de instalación/ownership Background,
  respaldo histórico npm y auxiliares; SQLite Backup API separada, sin cp de DB/WAL/
  SHM. No hay restauración automática ni migrador propio. El restaurador explícito
  posterior está en `cutover-rollback.py`, con cierre/postimages/journal obligatorios.

## Respaldo de instalación real preparado

`/mnt/hd_linux/opencode-cutover-install-20261118-prepared/`

- `install-rollback.json`: **3444 archivos regulares +7 enlaces internos npm**,
  **468408056 bytes**. SHA/modos originales por archivo; copias privadas0600,
  directorios0700. Conserva runtime administrado1.19.4, wrapper, estado/marker,
  plugins/assets y `before-plugin.ts` que el restore consume, además del backup
  histórico original1.14.39 completo. No es respaldo de DB/externos de aplicación.
- Engram actual e histórico **tienen distintos SHA**. Restore Background sólo
  preserva auxiliares ausentes: el corte debe reponer explícitamente los auxiliares
  actuales preservados, no dejar versiones históricas por arrastre. Semgrep también
  está preservado. No se modificaron los auxiliares actuales.
- `strict-inventory-verification.json`: recorrido estricto del npm histórico,
  3426 archivos/7 enlaces,0 omitidos/errores. El helper aborta ante error de scandir,
  symlink externo, entrada privada o node_modules no directorio.
- Se conserva el intento parcial interrumpido por timeout120s en
  `/mnt/hd_linux/opencode-cutover-install-20261118-interrupted-120s/`, sin receipt
  de éxito. No borrarlo ni usarlo como backup terminado. La ejecución posterior
  con presupuesto600s sí completó las verificaciones por archivo.
- Wrapper/runtime/estado de ownership actuales siguen coincidiendo con sus
  preimages. PID4925 conserva original DB/WAL/SHM; no se retiró ni se mató.

Rollback previsto: con clientes afectados cerrados, preservar primero el estado
posterior; verificar manifest/hashes y reponer exclusivamente los preimages con
sus modos, incluido estado/marker, plugin previo consumido y backup histórico
movido por lifecycle. **No restaurar una DB V2 sobre el original V1.** No se ha
ejecutado rollback real ni creado un restaurador automático que adopte drift.

## Evidencia vigente de preparación

- **65 casos Node dirigidos y6 Python pass**, en corridas separadas:8 nuevos Core,
  6 profile,2 storage,12 launch,2 identity native,14 releases,21 deployment AUNE;
  6 backup Python. No es toda la suite ni pruebas de negocio/modelos reales.
- Prueba de rollback ejecuta las funciones reales del lifecycle Background sólo
  sobre árboles sintéticos: consumo de before-plugin/backup histórico, regresión
  de auxiliar antiguo y reconstrucción de preimages/hashes/modo ejecutable.
- Un primer comando de regresión usó HOME aislado de la sesión y falló buscando
  metadata oficial/config fuente. Reejecución con HOME real explícito y stores
  sintéticos pasó; no se cambió el pin ni se leyó auth para esconderlo.
- `opencode.staged --version` real: `opencode v2.2.7`; `session --help` nativo OK.
  Wrapper staged bajo el directorio de respaldo, **no** `~/.opencode/bin/opencode`.
- `selection-offline.json`: selección/preflight offline fuera de AUNE, raíz AUNE
  y Higyrus; padres257 assets, receipt exacto/guardas/fuentes comprobados.0 hosts/
  modelos/DB original. No implica aceptación semántica integral de la jerarquía,
  autenticación vigente ni nueva aceptación live de los once overlays.
- Reviewer cerró los cinco hallazgos iniciales de cwd/auth/race/deployment/parser;
  corrección adicional de errores de enumeración cubierta por test y comprobación
  estricta del inventario real. **No aprobación del corte.**

## Bloqueos reales: no reemplazarlos por un subset

1. **Hosting CLI completo/transportes:** modos `--server`, `--standalone`, `serve`,
   `service`, `acp`, `pair` y mutadores nativos sin conexión explícita todavía no
   están integrados. El preparativo los rechaza; **no instalarlo así**. En2.2.7
   Standalone.start usa selfCommand y crea su propio host/pipes, sin fd3 del harness.
   No se encontró una vía pública comprobada que cubra todos esos modos. Inyectar
   `--server` también cambia semántica local de TUI; no afirmar equivalencia total.
   No cambiar runtime, usar APIs privadas/context fallback o perder atribución/
   benchmark/métricas para declarar terminado. Referencias públicas del tag:
   `packages/cli/src/{services/standalone.ts,util/process.ts,commands/handlers/acp.ts}`
   y documentación oficial `https://opencode.ai/docs/cli/commands`.
2. **Directorios anidados: cerrado en implementación.** El selector conserva la
   raíz del receipt y pasa la ubicación concreta al source-guard, que revisa cadena
   y snapshots de raíz/ubicación, sin generalOnly:false ni ensamblado de prompts.
3. **Procedimiento de store/rollback: cerrado en implementación; datos de ventana
   pendientes.** Exige original y piloto cerrados para la captura final actualizada;
   usa Backup API/worker nativo/publicación explícita. El trial aprobado no se toca.
   La autenticación y externos reales no quedan certificados por el fixture.

La vía nativa de transferir V2 es `session export/import`, una sesión por vez,
padres antes de hijos, IDs conservados y conflicto si ya existe; no hace merge
incremental. Excluye mensajes incompletos y no replica todo el estado externo.
No usar `--sanitize`, no confiar sólo en exit0 del import ante409 ni renombrar el
piloto como `opencode-next.db`. Para preservación, conservar piloto íntegro y
comprobar límites nativos sobre el destino autorizado, sin convertir conversaciones
a resúmenes. No se ejecutó export/import real en esta preparación.

## Siguiente gate

Gate vigente: ejecutar el contrato gestionado elegido, no resolver primero la CLI
universal. Preparación/pruebas terminadas; cerrar V1 y el control V2 únicamente
para correr el comando autónomo de CONTRATO-GESTIONADO.md. Comprueba cierre/datos/
preimages y readiness antes del retiro, preserva auxiliares y publica el commit
activo sólo después de verificar la entrada habitual. No se ejecutó todavía sobre
la instalación real: no declarar el corte por las pruebas sintéticas/staged.
