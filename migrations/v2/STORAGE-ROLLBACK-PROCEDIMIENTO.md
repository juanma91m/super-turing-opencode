# Storage definitivo y rollback — procedimiento histórico del corte ejecutado

La activación inicial ya terminó y el store definitivo está activo. Este archivo
documenta herramientas de bajo nivel/recuperación del corte de esta máquina, no
un instalador para otra notebook. No recapturar ni restaurar bases por actualizar
documentación; ver el updater conservador en `../../v2/install/README.md`.

Revisión:2026-11-18. Implementado/probado sobre stores sintéticos con oficial2.2.7.
No se repitió la recuperación real aprobada del trial, no se capturó otra vez el
original/piloto real y no se cambió la entrada habitual o Background.

**Contrato vigente: activación gestionada**, ver `CONTRATO-GESTIONADO.md`. La CLI
universal sigue limitada según CLI-2.2.7-INCOMPATIBILIDAD.md, pero dejó de ser gate
del corte práctico delegado por el usuario. `cutover-activate.py` integra estos
pasos con retiro Background, auxiliares, entrada y rollback. Preferir su comando
único; los comandos siguientes quedan como herramientas de bajo nivel/recovery,
no deben ejecutarse en paralelo ni usarse para saltar gates.

## Contrato y herramientas

- `cutover-storage.py plan|prepare|resume|publish --spec ...`: manifest público
  explícito y privado0600, runtime oficial fijado, fuentes originales separadas y
  `runRoot` NUEVO. `plan` sólo metadata, sin abrir DB ni crear destinos.
- `prepare`: exige confirmación y ausencia de descriptores observables sobre ambos
  stores. SQLite Backup API original→backup y piloto→backup; semilla y working copy
  también por Backup API. No cp de DB/WAL/SHM vivos, immutable, checkpoint forzado,
  merge SQL o conversor propio. Integridad/FK/checksums de los respaldos.
- `native-transfer.py`: worker sin red externa, en Bubblewrap obligatorio. Sólo
  working copies, binario público, script, perfiles neutros y metadata Git explícita
  readonly; NO original/piloto/trial, sus backups, worktrees, `.env`, auth files,
  configuración/plugins de productos o servicios externos.
- El worker deja actuar al migrador nativo normal y usa exclusivamente list/message/
  export/import públicos. Familias padres→hijos; idénticos existentes se verifican;
  IDs divergentes, mensajes no exportados por estar pendientes, cursor repetido,
  identidad de proyecto diferente o respuesta>512MiB detienen publicación.
  No sanitize, edición de DTOs de conversación, merge/reemplazo o exit0 tomado como
  prueba de importación. Se comprueban mensajes, campos soportados y listado unión.
- `projectRoots` expone únicamente `.git`, gitdir/common-dir físicos readonly al
  namespace, incluidos los punteros de worktrees. Es necesario para que el import
  nativo resuelva el MISMO projectID y las sesiones aparezcan en listas por proyecto.
  No se montan fuentes de aplicación ni índices CodeGraph; los comandos Git
  deshabilitan hooks/fsmonitor y locks opcionales mediante configuración explícita.
  No agrega permisos de proyecto al harness. Una raíz faltante/incompatible falla
  en vez de publicar sesiones bajo otra identidad.
- Presupuesto absoluto≤3600s, una consulta por host, watchdog y observador CPU/espacio
  independiente del request cada5s/reserva20GiB.120s es telemetría, no un retry que
  cancele una migración viva. Sólo se cierran procesos propios; parcial retenido.
- `authTransfer:native-pipe` es explícito: `auth export`→pipe OS→`auth import` de los
  clientes oficiales propios. No login, archivos de secretos, tokens al modelo ni
  copia de env/auth files. Conserva las reglas nativas de conflictos y selección;
  **no certifica validez del proveedor**. `none` omite esa acción deliberadamente.
  Sólo se probó con una credencial ficticia; no se transfirió auth real ahora.
- `publish` exige las fuentes aún cerradas/sin avance desde la captura y el reporte
  nativo aprobado. Publica el marker `history-verified` que admite el binding de
  producción. **Publicar storage no instala ni activa una entrada.**

La observación de `/proc` no ve procesos que el OS niega: `plan` informa esa
limitación y cuenta los gaps; no la elude ni sustituye el cierre humano. Un WAL
no vacío cuenta como avance; WAL vacío/SHM de coordinación no son mensajes nuevos.
No se promete cero efectos físicos de coordinación SQLite por usar origen ro.

## Preparación consultable con V1 abierto

```sh
CORE=/home/jmagnaterra/.local/src/opencode-stack
B=/mnt/hd_linux/opencode-cutover-install-20261118-prepared
SPEC="$B/final-storage.prepared.json"
python3 "$CORE/migrations/v2/cutover-storage.py" plan --spec "$SPEC"
```

Ese manifest fija original/piloto reales, metadata Git de los owners actuales y
`runRoot=/mnt/hd_linux/opencode-cutover-final-20261118`. El directorio final aún NO
se creó. El binding del entry staged se alineó a `runRoot/production-storage`, sin
activarlo. Si el inventario de sesiones necesita otra raíz Git, revisar el manifest
antes de la captura final; no inferir identidad ni cambiar tablas a mano.

## Ventana futura: captura final, operación nativa y publicación

Primero debe estar elegido/probado el contrato de entrada; se eligió el gestionado.
Desde una terminal independiente, cerrar ordenadamente V1 y los clientes que usen
el piloto, incluido el control V2. Se requiere el cierre del piloto para que la
captura sea el estado final actualizado, no porque SQLite no permita backup online.
No lanzar otro ejecutor ni matar procesos/borrar leases.

```sh
# Sólo en esa ventana, con el manifest revisado y runRoot nuevo:
python3 "$CORE/migrations/v2/cutover-rollback.py" verify-current \
  --receipt "$B/install-rollback.json"
python3 "$CORE/migrations/v2/cutover-storage.py" prepare --spec "$SPEC" \
  --v1-closed --pilot-closed
python3 "$CORE/migrations/v2/cutover-storage.py" publish --spec "$SPEC" \
  --v1-closed --pilot-closed
```

Si cambió la instalación desde su respaldo, `verify-current` rechaza: preservar el
estado actualizado antes de cualquier lifecycle; no adoptar drift. Si falla la
operación nativa, conservar el parcial y leer sólo los recibos metadata. Sin nuevo
backup ni reset automático, una continuación explícita soportada es:

```sh
python3 "$CORE/migrations/v2/cutover-storage.py" resume --spec "$SPEC" \
  --v1-closed --pilot-closed
```

Resume sólo admite ese mismo owner/selección y fuentes todavía idénticas. Un
conflicto divergente o identidad Git incorrecta NO se arregla sobrescribiendo:
preservar la copia fallida, corregir el plan y elegir un `runRoot` nuevo deliberado.
No tocar el trial aprobado, cursores nativos o tablas, ni borrar historia para pasar.

## Integración de instalación: comando gestionado preparado

La entrada habitual no se activa copiando el staged a mano. El único comando
gestionado documentado en CONTRATO-GESTIONADO.md verifica los datos y el harness
antes de tocar V1, ejecuta el lifecycle, mantiene auxiliares actuales y no publica
el commit activo hasta terminar checks. No afirma equivalencia con todos los hosts
nativos. El original/piloto/trial siguen intactos; corte real todavía pendiente.

La operación ya implementada para DESPUÉS del lifecycle Background y ANTES de
arrancar clientes repone únicamente los auxiliares actuales si reconoce el estado
histórico restaurado (o ya actual); no instala ni altera otros binarios:

```sh
F=/mnt/hd_linux/opencode-cutover-final-20261118
ORIGINAL=/home/jmagnaterra/.local/share/opencode/opencode.db
PRODUCTION="$F/production-storage/data/opencode/opencode.db"
python3 "$CORE/migrations/v2/cutover-rollback.py" auxiliaries \
  --receipt "$B/install-rollback.json" --original-db "$ORIGINAL" \
  --production-db "$PRODUCTION" --clients-closed --confirm
```

## Rollback exacto de archivos, con historia nueva V2 preservada

Una vez instalada una entrada V2 válida, pero antes de abrir clientes, se sella su
postimage. Se guardan sólo los paths allowlisted del receipt V1; no DB/auth/envs:

```sh
python3 "$CORE/migrations/v2/cutover-rollback.py" seal \
  --receipt "$B/install-rollback.json" --destination "$B/post-cutover-v2" \
  --original-db "$ORIGINAL" --production-db "$PRODUCTION" \
  --clients-closed --confirm
```

Si se solicita volver a V1, cerrar clientes de los recursos afectados y preservar
la historia de producción actual, además de su store que permanecerá separado:

```sh
R="$F/rollback-data-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 700 "$R"
python3 "$CORE/migrations/v2/cutover-backup.py" sqlite-backup \
  --source "$PRODUCTION" --destination "$R/opencode.db"
python3 "$CORE/migrations/v2/cutover-rollback.py" restore \
  --postimages "$B/post-cutover-v2/postimages.json" --clients-closed --confirm
```

Restaura wrapper/runtime1.19.4, ownership, plugins/assets, auxiliares actuales y
backup histórico consumido, con hashes/modos. Rechaza drift desconocido ANTES de
escribir. No ejecuta installers, re-adopta Background ni restaura una DB V2 sobre
el original. El store V2 y sus nuevos mensajes quedan conservados; no se promete
que V1 pueda leerlos como si fueran sesiones V1. Verificar resolución/versión y
lectura normal del original al volver, sin publicar transcripts.

Restauración por archivo, no transacción global. Una interrupción deja journal y
pre/postimages. Con recursos cerrados y lease propio reconciliado explícitamente,
`restore ... --recover before --clients-closed --confirm` completa rollback;
`--recover after` repone el lado V2 sellado. Sólo acepta mezclas conocidas de ambos
lados; jamás adopta cambios ajenos ni retira locks por PID automáticamente.

## Límites nativos y de externos

Se conservan fuentes enteras y respaldos; no se reduce historia a resúmenes. El
export/import oficial no replica eventos/jobs/inbox, todos los estados de revert/
fork o recursos externos; normaliza metadata como slug/version/time.updated.
No se agrega una exigencia1:1 de representación interna al migrador aprobado.
Directorios y adjuntos externos siguen intactos en sus rutas originales: no se
borran, relocalizan ni se copian por arrastre. SQLite+inline verificados **no son
backup integral/restauración exhaustiva de aplicación** ni atomicidad con externos.
La validación real de acceso/auth/externos y sesión normal corresponde a la ventana
de corte, no se simula como aprobada por los fixtures.
