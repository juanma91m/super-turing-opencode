# Corte final V2 — handoff operativo vigente

**Corte completado (2026-11-19).** Entrada habitual 2.2.7, recibo final y arranque
real confirmados; auditoría posterior de las trece ubicaciones pasó. Los comandos
de abajo conservan el handoff inicial y no deben ejecutarse otra vez por rutina
ni en una notebook distinta. Actualizaciones: `../../v2/install/README.md`, adapter
de organización y `MANTENIMIENTO-POST-CORTE.md`.

## Handoff inicial — historial

Revisión: 2026-11-18. El usuario autorizó completar la instalación habitual V2,
incluido el lote restante, sin otra aprobación por cada subpaso del alcance. No
interpretar esa autorización como cierre de procesos o como corte ya ejecutado.

## Siguiente acción vigente: un comando, no otro cambio de sesión

El usuario delegó la priorización para funcionar lo más igual posible a V1. Se
eligió `managed-harness-v1`, con harness completo y diferencias de hosting claras,
no equivalencia universal de CLI. Ver `CONTRATO-GESTIONADO.md`: el bloqueo universal
ya no es gate del contrato práctico. No cambiar el pin ni usar APIs privadas.

La preparación y pruebas terminaron:90 Node Core,78 Node AUNE,26 Python cutover y
1 fixture nativo de transferencia pass. Preflight real13 ubicaciones, staged2.2.7,
guard real adquirido/liberado y3451 preimages verificadas. No se efectuó el corte.

**No enviar más prompts al otro agente.** El ejecutor final es el comando autónomo,
con ambos clientes V1/V2 cerrados y desde una terminal independiente:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /home/jmagnaterra/.local/src/opencode-stack/migrations/v2/cutover-activate.py activate --plan /mnt/hd_linux/opencode-cutover-install-20261118-prepared/activation-plan.json --clients-closed --confirm
```

No abrir clientes hasta terminar. Comprobar `managed-v2-activation-completed` /
`installed-and-verified`; entonces usar `opencode`. Si falla, no repetir a ciegas:
leer stage/journal. Runtime/ownership V1 se devuelven automáticamente sólo ante
imágenes conocidas, sin tocar DB o overlays previos. Rollback completo y diferencias
de modos en CONTRATO-GESTIONADO.md. La entrada V2 de control descrita abajo queda
como alternativa de diagnóstico, no como otro paso obligatorio del corte.

## Estado comprobado

- **Once overlays aplicados**, con receipts propios y check oficial ready-assets.
  Higyrus además tiene primer uso TUI básico confirmado por el operador.
- Los otros diez pasaron verify-live real con data/state del piloto V2: todos
  ready/readyForChat:true,6 MCP connected, metadata proveedor conectada,0 blocking
  findings y0 inferencias/negocio del verificador. Python/TS completos preservados;
  saldo carga su port de hooks, no el JS SDK V1. No se normalizaron disabled/defaults.
- Snapshots:true en todos. Exclusiones nativas locales en Higyrus,VB,Keycloak,
  Aggregator,BYMA;0 expuestos. No se borraron/leyeron claves ni se desactivó undo.
  No purga historia Git: hay límites de objetos referenciados; ver owner Higyrus
  `v2/SNAPSHOTS.md` y AUNE `v2/projects/DEPLOYMENT.md`.
- Padre general f1874f3a.../privado b993b701...,257 assets intactos. El lote actual
  no cambió esos pins. Archivos de aplicación y commits/stage/push fuera del alcance.
- Backup/restore y recuperación nativa de trial ya aprobados en su alcance; ver
  HISTORIAL-INTEGRO.md. No repetir el ensayo por rutina. El trial no es el store del
  launcher y los mensajes posteriores de V1/piloto aún no están reunidos.
- `opencode` habitual todavía resuelve a `~/.opencode/bin/opencode`, wrapper V1
  que fija DB original. No hubo cambio de entrada/PATH, restore Background o corte.

## Cambiar la sesión de control antes del corte

**Aclaración vigente del usuario: V1 puede seguir abierto DURANTE LOS PREPARATIVOS.**
La sesión V2 de control independiente ya fue abierta. Que el original siga en uso
no bloquea lectura de contratos, diseño/implementación del entrypoint y binding
de producción, tests sintéticos, validación offline, preparación de rollback o
respaldo online SQLite autorizado. No quedarse esperando cierre al principio de
esas tareas ni pedir que se confirme falsamente que V1 está cerrado.

**El cierre es gate del CAMBIO EFECTIVO**, no del desarrollo/preparación: no retirar
runtime/plugins V1, reemplazar su instalación activa, restaurar stores encima del
original o efectuar su migración/corte definitivo mientras siga usándolo el cliente.
Preparar primero la solución y comprobarla; pedir cierre una sola vez al llegar a
ese gate. Un backup online anterior no se convierte en «final actualizado» si V1
escribió después. Tampoco abrir V2 sobre la DB original viva ni relajar sus locks.

Si la UI quedó esperando la respuesta a «cerrá V1», el operador puede indicar que
V1 sigue abierto deliberadamente y que se continúe sólo con preparativos y pruebas;
no interpretar eso como autorización de cambiar producción en caliente. El ejecutor
único sigue siendo la sesión V2, no iniciar otro instalador desde esta sesión V1.

El cliente V1 que sostiene esta conversación (PID observado4925) sigue usando el
store original. No ejecutar retiro del runtime/plugins ni restauración de stores
mientras esté activo. No matarlo ni retirar locks automáticamente.

Cerrar ordenadamente esta TUI V1 y cualquier V2 de productos. Desde una terminal
independiente, abrir el candidato general ANTERIOR como control de instalación:

```sh
node /home/jmagnaterra/.local/src/opencode-stack/migrations/v2/general-composed.mjs chat --project /tmp/opencode --candidate-only --client-closed --reuse-v2-storage
```

Seleccionar `agent-design` y continuar este handoff. Este candidato usa otro perfil
(`general-composed-candidate`), no el padre privado del rollout que se va a activar.
Por eso no toma su lease. Sí usa el piloto: no modificar/restaurar ese store bajo
la sesión de control ni afirmar que está cerrado. Cualquier backup suyo debe usar
el mecanismo online autorizado o coordinar otro cierre específico si fuera necesario.

**Entrada de control verificada antes del handoff:** check227 assets/0 drift/lease
ausente; verify-live real ready/readyForChat:true,audit pass/findings:[],22 roles,
34 commands,36 skills,149 tools,5 MCP connected/proveedor conectado;0 inferencias/
negocio. Se retiraron host/probe/lease propios. No prometer que una conexión nunca
expire; si falta auth después, informar sin copiar tokens o login por reflejo.

## Trabajo que todavía falta — no confundir con otro piloto

**Preparativos posteriores desde V2:** ver `PREPARACION-ENTRADA.md`. Hay código de
binding/entrada y readers, rollback de instalación real preservado en el disco
privado y pruebas dirigidas verdes. Continuación: fuentes anidadas y procedimiento
storage/rollback implementados/probados. Queda incompatibilidad CLI/transportes
confirmada del pin (`CLI-2.2.7-INCOMPATIBILIDAD.md`) y datos de ventana; no se activó.
V1 sigue abierto a propósito;
no pedir cierre para resolver esos pendientes ni confundir wrapper staged con corte.

1. Preparar con V1 abierto; verificar ausencia de descriptores sobre DB/WAL/SHM
   original sólo al llegar al cambio efectivo. Preservar la instalación V1
   administrada actual y rollback de los archivos modificados antes
   de invocar restore Background: su backup original es1.14.39, no el1.19.4 actual.
   Revisar también auxiliares actualizados (Engram/semgrep), no degradarlos por
   restaurar ciegamente versiones anteriores. Estado Background indica que el
   backup histórico de storage fue omitido; no usarlo como respaldo final.
2. Preparar backup final consistente en el disco privado autorizado `/mnt/hd_linux`,
   preservando original/piloto/trial y datos externos necesarios. No imprimir
   conversaciones ni copiar auth/envs por arrastre. Usar SQLite Backup API; nada de
   cp de DB/WAL/SHM vivos, SQL de merge o conversor propio. Native2.2.7 ya demostró
   recuperación; falta el estado definitivo actualizado, no otro experimento.
3. Resolver explícitamente el store final con el historial V1 actualizado y las
   conversaciones nuevas del piloto preservadas. Usar sólo mecanismos nativos
   soportados para export/import si corresponde; no borrar ni sustituir historial
   por un backup o resúmenes. Directorios/adjuntos externos tienen límites separados.
4. Terminar/adaptar la entrada habitual y su binding de storage de producción con
   permisos mínimos, sin recortar capacidades ni clonar prompts. Hoy los clientes
   existentes son candidatos y `storage.mjs` sólo admite el piloto identificado:
   **no inventar que ya hay un activador global completo**. Usar contratos explícitos
   de producción y tests pertinentes, no `OPENCODE_DB` arbitrario para eludirlos.
5. Con respaldo/rollback y validación correspondientes, salir del ownership
   managed-local-install por el lifecycle Background; después reemplazar la entrada
   habitual por V2 oficial fijado. No reinstalar Background/Stitch, borrar backups
   o cambiar otros binarios por arrastre. Evitar editar PATH si basta conservar el
   entrypoint que ya resuelve la shell.
6. Validar `opencode --version`, resolución real del comando, selección de las tres
   capas, historial/acceso/auth y una sesión normal. No declarar corte hasta hacerlo.

## Invariantes del launcher final

- Runtime oficial2.2.7, modelos/defaults acordados, Ollama dormido, guardas y
  general→AUNE→proyecto. Dominios y reglas locales permanecen en sus owners.
- **No apuntar simplemente a un binario desnudo perdiendo el transporte del harness.**
  `v2/native-history.mjs` usa conexión opaca del host propio por fd3. Atribución,
  CodeGraph benchmark y Ticketing metrics dependen de esa lectura HTTP pública;
  Plugin.Context2.2.7 no expone session.message. Preservar/integrar ese transporte
  mediante APIs públicas, sin prototipos privados, auth files o fallback V1.
- Preservar el comportamiento de CLI necesario, sesiones y selección por proyecto.
  No publicar como producción un alias de chat que descarte flags o una cuota de
  clientes heredada accidentalmente del launcher de candidatos. Explicitar cualquier
  incompatibilidad material, no aceptarla como subset para terminar más rápido.
- No forzar cierres, adoptar estado desconocido, retirar leases ajenas o repetir
  capturas/fixtures ya aprobados sin cambio material. La sesión de control es V2
  separada; no bloquear el trabajo sólo por estar abierta si no usa el recurso afectado.

## Referencias

- `ESTADO-CORTE.md` y `HISTORIAL-INTEGRO.md` — estado de alcance y datos.
- AUNE canónico `v2/projects/{DEPLOYMENT,ROLLOUT}.md` — receipts y launchers actuales.
- AUNE `v2/projects/{client,deploy,deployment}.mjs`, `v2/{core,launch}.mjs`.
- Core `v2/general/{launch,owned-server,storage,releases}.mjs`, `v2/native-history.mjs`.
- Background `installation.md`, `scripts/restore-local-install.mjs`,
  `lib/local-install.mjs`; no ejecutar antes de preservar el1.19.4 actual.
