# Historial — recuperación nativa, sin migrador propio

## Decisión vigente

Priorizar la recuperación que trae OpenCode y llegar con el historial hasta donde
soporte esa vía, documentando los límites. No construir ni mantener un conversor
propio para obtener fidelidad1:1 de cada campo interno. No borrar, sanitizar o
reducir las conversaciones a resúmenes como sustituto del store existente.

**Modalidad autorizada para el ensayo: respaldo online con V1 abierto.** El usuario
quiere conservar esta sesión V1 como respaldo operativo mientras prueba V2 aislado.
No exigir su cierre sólo porque tenga DB/WAL/SHM abiertos. La exigencia de cierre
anterior correspondía al procedimiento offline, no a una limitación de SQLite.
Esto no autoriza el corte, migrar el original o modificar una configuración activa.

Por pedido del usuario se retiraron los cuatro scripts experimentales de contrato,
import/export y seeding/restore de fixtures. No había un migrador de producción
instalado: esos ensayos no formaban parte del runtime ni de los paquetes preparados.
No se eliminaron bases, respaldos, sesiones, paquetes o marcadores de ownership.

## Qué hace el producto

La distribución oficial2.2.7 contiene migración nativa V1→V2. Reconoce sesiones
legacy, preserva su identidad/familia/fechas y adapta mensajes al formato nuevo.
Esto es distinto de exportar/importar transcripts manualmente: actualizar el
binario conservando el mismo store no significa empezar sin historial.

Fuente de la versión fijada (sólo evidencia, no invocación de APIs internas):
https://unpkg.com/@opencode/core@2.2.7/dist/database/v1-migration.bun.js

Ruta habitual Linux: ~/.local/share/opencode/opencode.db. HOME/XDG, canal o
OPENCODE_DB pueden cambiarla. El piloto y rollout se aislaron deliberadamente:
sus stores nuevos no ven por sí solos el original. Primero comprobar las rutas,
no inferir pérdida de sesiones porque una base aislada esté vacía.

Hay diferencias nativas conocidas de representación/metadata y resultados ya
compactados. No prometer igualdad absoluta, pero tampoco tratar esas diferencias
como pérdida total o como razón automática para bloquear la actualización.

## Procedimiento autorizado

1. Identificar rutas y procesos que usan origen/destino, sin imprimir contenido ni
   credenciales; comprobar espacio disponible. V1 puede seguir abierto. El destino
   de backup/restore/ensayo debe ser NUEVO, privado y sin otro cliente conectado.
   Coordinar un solo ejecutor: no lanzar otro respaldo en paralelo desde otra sesión.
2. Crear respaldo consistente de SQLite con su **Online Backup API**, por ejemplo
   `sqlite3.Connection.backup`, no con `cp` del DB/WAL/SHM activos. Abrir el origen
   mediante URI `mode=ro` con locking normal; no `immutable=1` sobre una base viva,
   DML, checkpoint forzado, cambios de journal o export/import de conversaciones.
   No pasar por el wrapper OpenCode V1. Locks/SHM se gestionan por SQLite: no
   prometer ausencia absoluta de efectos de coordinación o ralentización.
3. Verificar integridad y restore sobre copia separada del respaldo. Revisar datos/
   archivos externos necesarios (adjuntos, etc.): una instantánea SQLite consistente
   **no** garantiza atomicidad conjunta de todos los archivos de la aplicación.
   Documentar faltantes/límites; no leer/copiar auth o envs por arrastre ni afirmar
   respaldo completo de aplicación por comprobar sólo su DB.
4. Ensayar V2 oficial sobre una copia NUEVA derivada del respaldo comprobado,
   preservando original, respaldo y piloto por separado. No mezclar/reescribir sus
   DB a mano; nunca abrir el original con V2 mientras V1 lo utiliza.
5. Dejar actuar a la compatibilidad/migración nativa. Verificar listado, fechas,
   familias y varias conversaciones representativas, herramientas y adjuntos.
6. Documentar recuperado/limitaciones y resolver acceso/config/auth del candidato.
   Sólo después decidir el cambio de instalación, sin declarar aprobado lo no visto.

Referencia de la API de backup (no es un migrador propio):
https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup

El backup online representa un estado consistente, **no una réplica continua**:
lo escrito después en V1 no se incorpora automáticamente a la copia ni al ensayo.
Para el **corte definitivo** sigue siendo necesaria una ventana actual sin escrituras
de V1 y respaldo final actualizado. La alternativa de copia offline también exige
cierre actual; un apagado anterior no lo demuestra. No restaurar encima de stores
activos ni omitir los gates de cierre del launcher al reutilizar el piloto V2.

## Resultado real — 2026-11-18

**Estado vigente: respaldo/restore SQLite y recuperación nativa aprobados en el
alcance comprobado sobre el trial.** La única continuación autorizada completó
la migración y la lectura pública de1402 sesiones/cinco conversaciones de muestra.
No equivale a restauración integral de archivos externos, réplica de V1, aceptación
de producción, merge del piloto o corte. Resultado detallado al final de esta sección.

**Antecedente preservado:** el primer ensayo se interrumpió por timeout del
verificador, no por un error interno confirmado del migrador. Su estado parcial
se preservó antes de continuar; no se borró/recreó el trial ni se editaron cursores.

Raíz privada autorizada:
`/mnt/hd_linux/opencode-history-20261118T163530Z-g8p7jw44/`.
Directorios0700/archivos0600; backup, restore, trial y temporales separados en ese
disco. No se copiaron auth/envs o archivos externos por arrastre.

- **Backup online:** `backup/opencode.db`,25911316480 bytes, terminado
  2026-11-18T16:39:38Z, mediante `sqlite3.Connection.backup`, origen `mode=ro`,
  locking normal y V1 abierto. No cp de DB/WAL/SHM activos, immutable, checkpoint
  forzado, limpieza o compactación del original. `integrity_check:ok`,0 violaciones
  de claves foráneas. Ventana de captura16:36:41–16:39:38Z; no réplica continua.
- **Restore:** `restore/opencode.db`, integridad y conteos comprobados, idéntico
  byte a byte al backup. La semilla `trial/opencode.db` tenía el mismo SHA256:
  `d10f32c07cf94a96f42c29d1515483c7904a68ba1e71376d3420c8f20ea6c252`.
  Las tres etapas previas quedaron completas a16:55:30Z. Backup y restore no se
  abrieron durante el ensayo; inode/tamaño/mtime/ctime/modo siguen iguales al gate.
- **Aislamiento:** binario oficial2.2.7 con SHA verificado, `serve --stdio` normal
  dentro del sandbox que pasó preflight. Sin acceso al original/piloto/backup/
  restore, red aislada, HOME/XDG/cache/tmp propios sobre el disco autorizado.
  Sin inferencias, tools de negocio, overlays o cambio de instalación/PATH.
- **Referencia previa tomada sólo del trial:**1402 sesiones (463 raíz/939 hijas),
  90401 mensajes legacy y868 partes `file`, todas `data:` dentro de SQLite.
  Se prepararon cinco muestras (antigua/reciente, padres/hijos, tools y compaction)
  mediante metadata/hashes, sin volcar conversaciones. No equivale a recuperación.
- **Fallo concreto del ensayo:**17:01:16–17:03:21Z. El primer
  `GET /api/experimental/migration/v1` excedió el timeout HTTP de120s del
  verificador (`TimeoutError`); su cleanup cerró el host propio. El log registra499
  al cancelar esa consulta,21 migraciones de esquema completadas y ningún error
  interno observado. La causa de que no respondiera a tiempo (lentitud/bloqueo)
  **no quedó determinada**; no atribuirlo como bug probado de2.2.7.
- **Estado al cerrar el primer ensayo (hoy preservado aparte):**`migration.v1-v2.phase=sessions`, sin cursor;
  `session:1402`, `session_v2:0`, `session_message:0`, `event:0`. La fase nativa
  inicial retiró los1623707 eventos legacy sólo en el trial. No se editaron tablas
  a mano. La migración de conversaciones no terminó: **listado, apertura, fechas,
  parentescos, mensajes, tools y adjuntos por API V2 no se verificaron en ese intento**.
- **Adjuntos/externos:**868 partes inline presentes en la referencia SQLite, pero
  todavía sin validación de lectura en V2. No se restauraron snapshot/storage/
  tool-output/delegations ni archivos de proyecto. Inventario externo sólo por
  tamaños; adjuntos de resultados de tools/referencias externas no relevados
  exhaustivamente. No afirmar respaldo completo de aplicación o atomicidad conjunta.
- **Cierre:**ningún proceso de este ensayo sigue activo. Copia parcial y diagnóstico
  preservados, sin reintento automático. Quedan unos258GiB libres en el destino.

Evidencia privada en `evidence/`: `backup-restore.json`, `runtime-pin.json`,
`preflight.json`, `rehearsal-gate.json`, `baseline.json`, `native-attempt.json`,
`native-rehearsal.json`, `diagnosis.json` y `external-inventory.json`; log nativo en
`runtime/data/opencode/log/opencode.log`. Reportes sin cuerpos de conversaciones ni
credenciales. Los scripts de `operations/` son sólo el backup/verificador local de
esta ejecución, no un conversor ni una nueva capacidad del harness instalado.

**Continuación autorizada por el usuario:** ajustar y probar el timeout/observabilidad
del verificador y luego un único intento de continuación nativa sobre el trial, con
su estado parcial previamente preservado. El único ejecutor sigue en la sesión V2
separada; no lanzar otro ensayo desde V1. No repetir backup/restore aprobados,
reiniciar para ocultar el fallo o regenerar stores automáticamente. Sin conversor,
mutaciones SQL manuales ni aceptación de pérdidas silenciosas. El corte final aún
exige cierre de escrituras V1, respaldo actualizado y los gates de composición/
despliegue pendientes. Continuación ejecutada; evidencia y límites más abajo.

### Revisión previa del verificador — sin nuevo arranque en esa revisión

Se inspeccionaron únicamente scripts/diagnóstico allowlisted, no DB, conversaciones
o logs nativos crudos. `operations/native_rehearsal.py` fija un deadline global de
3600s, pero `operations/native_host.py:get` fija120s para cada conexión HTTP. Un
timeout sale por excepción y el `finally` del ensayo llama `host.close()`. Por tanto,
el límite efectivo de la primera consulta fue120s, no la hora prevista. No se cambió
el verificador ni se ejecutó un segundo intento en esta revisión.

La fuente oficial2.2.7 citada arriba aporta dos límites de observabilidad:

- `status()` consulta DB (`hasLegacySessions` y `readState`) antes de devolver el
  estado runtime: no es un heartbeat independiente del almacenamiento.
- La conversión se hace por sesión dentro de una transacción; cursor, sesión y
  mensajes se confirman juntos, y el contador runtime avanza después. Cero filas
  V2 confirmadas/sin cursor no distingue primera transacción lenta de bloqueo.
  La fuente lee el estado/cursor persistido al arrancar; hay mecanismo de continuación
  nativa, no necesidad demostrada de borrar/recrear el trial o editar su KV.

**Hipótesis pendiente:** la primera transacción pudo exceder120s, pero no está
confirmado que hubiera progreso útil; tampoco se probó un bloqueo del migrador.
No declarar corrupción o pérdida por el0 parcial ni arreglarlo aumentando un número
a ciegas.

**Plan de continuación autorizado (avance más abajo):** ajustar sólo el
verificador para separar el timeout de consulta del presupuesto global ya previsto,
con observación de vida/CPU/I/O/espacio desde fuera del request bloqueado y errores
sanitizados. Probar ese comportamiento con un servidor sintético lento, sin stores
reales. Evitar consultas solapadas/reintentos que acumulen requests; un timeout de
estado aislado no debe cerrar prematuramente el host ni ocultarse como éxito.
Después, con estado parcial preservado, un único arranque de continuación nativa
sobre el trial, en el mismo sandbox y con el presupuesto global existente de3600s.
Si vence ese presupuesto o aparece error nativo/espacio insuficiente, cerrar sólo
el host propio, conservar evidencia y reportar sin otro arranque automático. Sin repetir
backup/restore aprobados, mutaciones SQL manuales, APIs internas o ampliar permisos.

### Verificador ajustado/probado; continuación finalizada

Sólo cambió el verificador local de esta ejecución. Scripts anteriores preservados
en `verifier-v1-preserved/`; `sandbox.py` sigue byte-idéntico al preflight aprobado.
No se cambió runtime, configuración de candidato, instalación o tablas/cursor.

- Presupuesto **absoluto3600s**, iniciado antes de crear el host, compartido por
  readiness, migración y verificación. No se renueva por consulta. Connect máximo
  30s/restante; espera HTTP usa el presupuesto restante. Los120s ahora son umbral
  de telemetría, no cancelación/retry de una consulta viva. Sólo una consulta
  pendiente; solapamientos rechazados. Transporte/HTTP/JSON/error nativo no se ocultan.
- Observador independiente del request y de SQLite cada5s: vida/estado del hijo,
  CPU, I/O y espacio, sólo metadata numérica en
  `evidence/continuation-observation.jsonl`. Actividad no prueba progreso lógico.
  Watchdog al vencer3600s o bajar de20GiB libres; cierre sólo del host propio, con
  limpieza adicional acotada. No se usan prompts, args, auth o env como telemetría.
- **6 tests sintéticos HTTP/host pass:** respuesta lenta sobre umbral sin retry,
  deadline global, cuerpo por goteo, rechazo de consulta solapada,503 visible y
  limpieza propia sin matar otro proceso. CPU/I/O/espacio durante la espera probados.
  **3 tests de preservación pass:** WAL vacío/SHM aceptados sin editar, WAL no vacío
  rechazado y entradas inesperadas/symlinks rechazados. Sin OpenCode/stores reales
  en esos tests. Recibos `verifier-tests.json` y `preservation-gate-tests.json`.
- La primera tarea `sh_1efac37a8001RN0ol74lz1Bpab` terminó en el gate con
  **0 arranques nativos**: el verificador exigía sólo DB, pero el trial conserva
  WAL vacío/SHM32768 bytes. Se corrigió esa restricción del propio verificador;
  no se borraron sidecars ni se trataron como fallo del migrador. Recibo y script
  fallidos preservados (`continuation-task.json`, `continuation_task.gate1.py`).
- **Tarea completada:** `sh_1efaebe22001DkFqxrLZkKybSI`, PID158878; notificación
  recibida, exit0. Estado metadata en `evidence/continuation-task-02.json`. Primero
  verificó que no se observaban usuarios del trial y conservó DB/sidecars cerrados
  en `partial-attempt1-preserved/` con hashes, sin repetir backup/restore aprobados.
  Sólo después hizo el único arranque de continuación autorizado sobre el mismo
  trial. Sin borrado/recreación/SQL mutador o checkpoint forzado.
- Gates exclusivos y recibos separados (`continuation-task-02-once.json`,
  `partial-preservation.json`, `continuation-attempt.json`, `continuation.json`)
  conservan los resultados anteriores e impiden otro arranque automático.

### Resultado comprobado de la continuación — recuperación nativa aprobada

- **Preservación previa:** copia offline del trial parcial cerrado, no del original,
  en `partial-attempt1-preserved/`:25911443456 bytes, SHA256
  `b1db50c37884f47a1689636d72ca87dc2aaf13fc1527aaf14a10de3e0e3abd35`.
  WAL vacío y SHM32768 bytes también preservados/verificados; sin limpieza, checkpoint
  o restauración sobre el trial. Backup/restore aprobados no se abrieron ni repitieron.
- **Ejecución nativa:**17:28:18–17:34:27Z,368,656s incluyendo comprobaciones/cierre,
  dentro del presupuesto3600s. `migration_status:completed`; fase persistida
  `migration.v1-v2:completed`. Mismo oficial2.2.7 y sandbox byte-idéntico, sin APIs
  internas, conversor o mutaciones SQL manuales. Un único arranque de continuación.
- **API pública:**1402/1402 sesiones listadas;0 ausentes y0 diferencias de títulos
  (comparados por hash), fechas creación/actualización o relaciones padre/hijo.
  Referencia463 raíces/939 hijas. Cinco conversaciones abiertas completas por
  paginación (antigua/reciente, raíz/hijo, tools, compaction y adjuntos inline).
  1274 textos assistant,1716 inputs y1683 outputs de tools comparados por hash sin
  diferencias; dos resúmenes de compaction iguales. Sin volcar conversaciones.
- **Corrección de medición explícita:** el check original trataba176 campos
  `summary` objeto de mensajes user como si fueran `assistant.summary===true` y
  emitía `summary_without_completed_native_compaction`. Era clasificación del
  verificador, no pérdida nativa. Se preservó `continuation.json` sin reescribirlo;
  complemento **SQLite read-only sobre trial ya cerrado**, sin otro host, verificó
  178 textos user, dos compactions y cinco payloads inline de las muestras, todos
  iguales por hash. Predicado corregido a role assistant/boolean True, con cuatro
  regresiones sintéticas. No afirmar que esos checks complementarios fueron HTTP.
- **Conteos/representación:** trial conserva1402 filas legacy y tiene1402 sesiones
  V2/91313 mensajes V2. No exigir igualdad con90401 filas message V1: el producto
  agrega avisos/synthetic y representa compaction de otro modo. No se midió fidelidad
  de cada campo/cuerpo de todo el store ni se validó toda continuación conversacional.
- **Observación:**74 muestras de vida/CPU/I/O/espacio, intervalo máximo5,008s;
  139 requests/139 respuestas, máximo **una** consulta pendiente,0 cancelaciones,
 0 umbrales120s excedidos en esta continuación. Sin errores/warnings de migración
  observados en el log nativo. La causa precisa del timeout del primer intento no
  queda probada por este éxito. Unos234GiB libres al terminar.
- **Límites externos:**868 partes file inline identificadas en la referencia; sólo
  cinco payloads verificados byte a byte como muestra, no QA visual de imágenes ni
  certificación exhaustiva de los868. No se restauraron archivos externos de
  aplicación/proyectos/snapshots/tool-output ni se resolvieron todos los adjuntos
  de tools. El backup no incluye mensajes V1 posteriores a la captura online.
- **Cierre:** host propio cerrado, ningún proceso del ensayo activo. Original,
  piloto, backup y restore protegidos; metadatos de las dos copias aprobadas
  conservados.0 inferencias/tools de negocio, sin overlays, cambios de instalación/
  PATH o corte. Directorios0700/archivos0600 comprobados.

Evidencia final: `evidence/partial-preservation.json`, `continuation-task-02.json`,
`continuation.json`, `continuation-observation.jsonl`, `postflight-readonly.json` y
`final-verification.json`. Los recibos del primer fallo y del gate fallido se conservan.
No hay nueva tarea corriendo ni arranque adicional autorizado por este cierre.
Restan archivos externos/acceso-config-auth/composición y gates de despliegue/corte;
para producción, ventana actual sin escrituras V1 y respaldo final actualizado.

## Guardas que se conservan

- `v2/native-history.mjs` es lectura pública de sesiones para atribución,
  CodeGraph y métricas, NO un migrador; se conserva con sus permisos/transportes.
- Los markers y herramientas de preparación de configuración V2 no migran
  historial: no borrar migrations/ o staging/ por el nombre de sus directorios.
- El launcher V1 ~/.opencode/bin/opencode fija OPENCODE_DB al original y anula el
  override del caller. No usarlo para ensayos supuestamente aislados por env.

Antecedente de seguridad: el primer generador experimental lo invocó y session
list consultó metadata del store real. Se detuvo sin imprimir/persistir stdout ni
pedir export/import/borrado deliberado; no se certifica ausencia de housekeeping
SQLite. Se informó al usuario. No reabrir el original para comprobarlo ni repetir
esa vía; borrar los experimentos no elimina este aprendizaje o incidente.
