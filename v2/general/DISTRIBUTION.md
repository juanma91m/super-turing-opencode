# Revisiones de distribución V2 — configuración del candidato

## Estado y alcance exacto

Implementado y probado con OpenCode oficial **2.2.7** en temporales. La selección
real sólo recibió `release-plan`, `release-history` y `status`: not-distributed,
historial vacío y not-prepared, sin crear store/destino ni abrir un host o DB.
No se ejecutaron install/update/rollback/recover en el candidato real. V1, workshop
y los stores originales permanecen intactos.

`distribution.json` de esta carpeta declara el contrato **general-native/1** y los
siete aportes públicos por owner. No reemplaza ni interpreta
`distribution/addons.json`: ese manifiesto sigue siendo V1 e incluye Background.
Background/Stitch y capas privadas/organizacionales/proyecto no entran en este pack.
Los builders siguen en cada owner, no en un compositor privado de overlays.

**Es una revisión machine-bound de configuración y bundles**, no un instalador
global portable ni un backup de HOME/datos. No cambia PATH, binario, versión del
host o runtimes de addons; no clona repos, descarga dependencias, ejecuta installers
V1, crea backends, copia credenciales o migra historial. Usa los runtimes existentes
seleccionados por sus owners. El corte global y la salida de ownership V1/adopted
siguen en su fase autorizada posterior.

## Qué se conserva

Cada revisión guarda sólo assets del plan dentro de:

- `home/.config/opencode/`: roles, skills, comandos, scripts, configuración nativa,
  registries, plantillas y assets públicos declarados;
- `bundle/`: plugins y código público aportados explícitamente por los owners.

No se recorre ni copia data/state/cache/tmp, proyecto, fuentes editables del usuario,
sesiones, auth stores, browser profiles/cookies o runtimes externos. Se rechazan
paths privados/operativos, symlinks/hardlinks, topology collisions, límites de
tamaño/cantidad y credenciales literales en configuración/metadata. Refs de entorno
no se resuelven; el mock sólo admite su placeholder sintético conocido.

Esto no es un detector universal de secretos dentro de fuentes arbitrarias: los
inputs deben seguir siendo assets públicos canónicos revisados, no un packager de
archivos del usuario. Los bindings/rutas machine-local pueden estar en la revisión;
tratar el store como metadata local, no publicarlo ni indexarlo automáticamente.

## Store y propiedad

Para un destino `.../general-composed-candidate`, el store sibling es
`.../.general-composed-candidate-distribution/`, identificado por owner/contract/root.

```text
owner.json
state.json                    # current / previous
releases/<SHA256>/release.json # identidad, metadata y hashes de assets
releases/<SHA256>/files/...    # sólo configuración y bundles
transaction.json              # sólo mientras una operación está pendiente
scratch/                      # temporales propios, no config descubrible
```

El ID es checksum determinista del root, contrato, metadata y hashes. No es versión
semántica, firma upstream ni defensa contra el mismo UID. El mismo destino es
obligatorio; no se puede reubicar una revisión con paths/bindings absolutos ni
adoptar otro store. Archivos/config extra, archivos nuevos que colisionan con datos
no gestionados, payload corrupto o marker distinto se rechazan.

El store retiene revisiones sin poda automática. Un staging huérfano se informa,
no se adopta/borra. Si falta espacio o hay fallo I/O, detenerse y recuperar después
de reconciliar el problema; no borrar backups o snapshots por iniciativa.

## Comandos y confirmación

Diagnóstico sin crear releases ni destino:

```text
node migrations/v2/general-composed.mjs release-plan --project /directorio/revisado
node migrations/v2/general-composed.mjs release-history --project /directorio/revisado
node migrations/v2/general-composed.mjs status --project /directorio/revisado
```

`release-plan` muestra digest deseado y conteos added/changed/removed; no certifica
runtime, conexión o capas reales. `status` de un store valida revisión instalada y
su previous. Sin store conserva el diagnóstico de candidato anterior.

Contratos para una **futura ventana autorizada**, no pedidos para ejecutarlos ahora:

```text
node migrations/v2/general-composed.mjs install --project /directorio/revisado --candidate-only --client-closed
node migrations/v2/general-composed.mjs update --project /directorio/revisado --candidate-only --client-closed
node migrations/v2/general-composed.mjs rollback --project /directorio/revisado --revision SHA256 --candidate-only --client-closed --confirm
node migrations/v2/general-composed.mjs recover --project /directorio/revisado --to previous --candidate-only --client-closed --confirm
node migrations/v2/general-composed.mjs recover --project /directorio/revisado --to target --candidate-only --client-closed --confirm
```

Install es inicial o idempotente: una revisión distinta requiere update. Update
exige instalación existente. Un candidato legacy sólo se adopta si coincide
**exactamente** con el plan actual; no se infiere metadata vieja desde un marker ni
se archivan ediciones desconocidas. Una vez creado el store, `prepare` legacy queda
bloqueado para no eludir el historial. Root V1/workshop/activo permanece prohibido.

Rollback restaura también modelos/permisos/guardas de la revisión elegida, no sólo
scripts: revisar su alcance y confirmar explícitamente. No mezcla guardas actuales
con el release viejo ni dice que «anterior» equivalga a aprobación de seguridad hoy.
No restaura DB, versiones de runtimes externos, auth, índices, procesos o efectos de
negocio. El pin nativo sigue 2.2.7 y las dependencias deben seguir siendo compatibles.

## Protocolo de aplicación y recuperación

1. Validar consentimiento, root/lease/estado, bytes íntegros y todos los paths antes
   de modificar assets; callback nativo síncrono obligatorio, sin skip-check CLI.
2. Tomar la lease común y revalidar el estado bajo ella. Launcher/prepare rechazan
   una transacción pendiente; no reintentar silenciosamente otro baseline.
3. Publicar releases verificadas antes de editar el destino, con temporales propios,
   hashes, fsync y rename. Conservar la revisión anterior completa.
4. Escribir journal antes de aplicar. Reemplazos atómicos por archivo; retiradas sólo
   de paths gestionados íntegros. No hay atomicidad de todo el árbol.
5. Comparar bytes/marker finales y validar schema/fuentes con el binario fijado,
   cwd y DB/cache/state temporales. No server, MCP, modelo o DB de aplicación.
6. Recién después confirmar current/previous y retirar journal. Cualquier excepción
   posterior al journal exige recover explícito, no un rollback automático oculto.

Recovery sólo acepta estados parciales conocidos: bytes before/target o ausencia
permitida por una adición/retirada. Ediciones desconocidas, un asset presente en
ambas revisiones perdido o archive corrupto lo bloquean. `previous` restaura el estado previo;
`target` completa el objetivo exacto. En primera instalación no existe previous:
se exige completar target, no inventar una baseline vacía y borrar directorios.
La lease puede quedar tras SIGKILL/crash; su reconciliación sigue siendo explícita.
Es protocolo cooperativo/filesystem, no transacción de DB o garantía física frente
a hardware/FS que no respete durabilidad. Los fallos de los tests son simulados.

## Boot después de rollback

status/history/rollback/recover y el boot de releases instaladas no regeneran los
builders actuales ni leen V1 para reconstruir el release viejo. `installedPlan`
valida el archive y materializa su metadata/path mapping en el mismo destino,
sin mergear dominio local. Check/live usan esos assets aunque el plan nuevo difiera.

Playwright valida su binding durable con el programa owner archivado; no consulta
la caché/V1 para cambiarlo o descargar un reemplazo. Otros runtimes/entornos siguen
referenciados por bindings de sus owners y sus checks normales, no restaurados por
este mecanismo. El código de control base/contrato y las dependencias instaladas
siguen siendo requisitos; no es bundle relocatable o bootstrap de máquina vacía.

## Evidencia

- **66 Node +3 Python general**,29 base,41 composición OK.100 migración conserva
  evidencia del hito legacy anterior, no repetido sin cambios a esos adapters.
- Install/update/rollback/recovery/idempotencia, adición/retirada de assets, drift,
  credenciales, colisiones, lease, symlinks, root ajeno y archive corrupto cubiertos.
- Fallo de validación y estados parciales old/new/absent recuperados explícitamente;
  proyecto, data/state/cache sintéticos conservados, sin backup/restauración de ellos.
- Schema oficial tras update/rollback y boot metadata real con22 roles/5 MCP fixture;
  sin inferencia ni tool calls funcionales.
- CLI en HOME temporal sin configuración V1: status, rollback, recovery, check y
  verify-live funcionan con assets archivados. Copia del binario público oficial
  verificada por el mismo pin; no copia de stores.
- Preflight browser archivado funciona tras borrar sólo caches fuente del fixture
  y falla ante drift del snapshot sin repair/download.

Las siete definiciones dormidas ya se preservan también en update/rollback, sin
habilitar discovery o uso (DORMANT-PROVIDERS.md). Catálogo general7 aportes/5 MCP,
sin Background/Stitch. Reintroducción Stitch retirada por decisión del usuario,
sin excepción de key-ref en archivos de release. Candidato real instalado/actualizado
y verify-live pass; detalle en PASO2-CIERRE.md. Esto no es despliegue global. AUNE,
once proyectos, historial rico y backup/restore de datos conservan gates separados.

## Reuso del motor sin ampliar el pack portable

`createReleaseManager(catalog)` reutiliza las mismas transacciones/integridad/
validación para un owner con contrato y store distintos. El API por defecto sigue
`general-native/1` y su catálogo cerrado: rechaza planes privados. El catálogo del
owner y sus datos no se agregan a distribution.json portable. Parent root/id puede
conservarse en metadata de configuración para pin verificable, no herencia privada
de prompts o permisos. Rollback nunca significa restaurar DB/runtimes.

El inspector admite una extensión explícita de plugins/MCP esperados por el owner,
sin reemplazar servidores públicos ni volver opcional su auditoría. CLI portable
no expone flags para ampliar esa extensión. Las reglas físicas/credenciales/lifecycle
privadas siguen en el owner. Tests públicos y privados verifican aislamiento de
catálogos, stores y conservación del padre.
