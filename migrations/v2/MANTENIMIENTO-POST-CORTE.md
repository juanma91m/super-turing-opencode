# Mantenimiento posterior al corte — 2026-11-19

Actualización 2026-11-24: ver [CIERRE-PENDIENTES-2026-11-24.md](CIERRE-PENDIENTES-2026-11-24.md).
Se corrigió la espera de readiness del catálogo MCP y la pasada live posterior
dio 13/13; los dos runners de Higyrus siguen pendientes por un padre abierto.
Este archivo conserva la evidencia y los pendientes observados el 19.

## Estado y alcance

La entrada habitual ya es OpenCode oficial **2.2.7**, contrato
`managed-harness-v1`. No se repitió el corte ni se reemplazaron stores activos.
La auditoría inicial está en `AUDITORIA-POST-CORTE-2026-11-19.md`.

Se publicaron fuentes canónicas de Core, seis addons, owner AUNE y once
overlays: 19 repos. Background y Stitch siguen fuera de V2. Los instaladores V1
no son la ruta para actualizar V2; `install.sh` rechaza su aplicación cuando
detecta una instalación V2 activa.

## Cambios verificados

- Higyrus: wrappers con bindings Git locales explícitos, Semgrep sin métricas ni
  version-check y ast-grep **0.51.3**, sin `npx latest` al ejecutar búsquedas.
  Se instaló el runtime fijado y se escribieron los dos bindings locales.
- Updater: fuentes nuevas por commits exactos, backups SQLite con integrity/FK,
  corpus con lock/hashes, `snapshot`/`repos` preservados, migración oficial sobre
  copia aislada, wrapper y marker de generación. La segunda actualización no
  vuelve a la historia V1. Rollback conserva las bases viejas y nuevas.
- AUNE: adapter opt-in con padre privado/cohorte/receipts; no se incorporó dominio
  organizacional a la lógica portable. Mantiene scope y proyectos reconocidos.
- Documents: dependencia SDK de **lectura de metadata pública** ahora tiene un
  paquete/lock versionados. Un clon limpio no depende de `.opencode/node_modules`
  no publicado; ese SDK no se carga como plugin V2 ni ejecuta herramientas legacy.
- Bootstrap AUNE descarga el commit Core fijado por su lock; GitHub privado admite
  cuenta local explícita sin `gh auth switch` ni archivos de tokens.

## Evidencia de esta pasada

- Core Python: **188 casos, 187 pass/1 skip** con temporal corto aprobado. La
  ruta larga del HOME aislado no sirve para tests AF_UNIX; no se relajaron guardas.
- Updater: **12 Python pass + 1 Node pass**. Incluye fallo al publicar marker tras
  escribir complete, snapshots, segunda actualización, rollback y prompts Git hostiles.
- Core nativo: **91 pass**, incluida migración oficial con familia, archivo,
  adjunto inline y auth sintética. AUNE: **79 pass**. Documents: **19 pass**.
- Los once payloads se reconstruyeron desde un árbol limpio del índice, sin
  dependencias sin publicar y con cero dependencias sin resolver.
- Builder completo ejecutado desde esas fuentes limpias en modo `prepareOnly`:
  general, privado, once paquetes y migración nativa de una DB sintética; terminó
  sin aplicar proyectos ni publicar entrada. Los runtimes preexistentes de esta
  máquina sí se reutilizaron. Esto **no** es un update real de la notebook ni una
  prueba de publicación/rollback de toda la cohorte de esa máquina.
- Después de publicar se descargaron por HTTPS los **19 commits exactos** del
  lock AUNE, incluidos los privados mediante cuenta local `juanma91m` y askpass
  sin token en archivos. Se repitió el builder con dos sesiones nativas sintéticas
  padre/hijo y un snapshot sintético: conservó los tres, preparó once proyectos
  y el entry generado devolvió `opencode v2.2.7`. Sin activar ni abrir stores reales.
- Screening acotado de blobs staged en los 19 repos: sin hallazgos. No constituye
  certificación universal de ausencia de secretos ni auditoría funcional de apps.

## Pendientes y límites que no deben ocultarse

1. Los runners corregidos de Higyrus necesitan despliegue por lifecycle; los
   bindings solos no cambian los archivos ya desplegados. Paquete sucesor durable:
   `~/.local/share/opencode-stack/pending/higyrus-tools-20261119`, revisión
   `34b13ac4c332d0dbde40f40d1035f7920b666ffa684ae5dd6049f65c5d0dea2e`.
   Preflight con reconciliación explícita: exactamente dos writes, cero removes.
   La reconciliación sólo adopta bytes iguales al paquete anterior archivado;
   testea drift/rollback, no toma como baseline el archivo actual arbitrario.
   El padre tiene readers abiertos: **no aplicado**, sin quitar leases.
   Tras cerrar esos clientes, desde el owner AUNE actualizado:

   ```sh
   node v2/projects/deploy.mjs apply \
     --package /home/jmagnaterra/.local/share/opencode-stack/pending/higyrus-tools-20261119 \
     --project /home/jmagnaterra/TRABAJO/AUNE/higyrus-workspace/higyrus \
     --client-closed --confirm --upgrade-sources
   ```

   Es un comando machine-local de esta instalación, no para la notebook.
   Los runners canónicos sí pasaron smoke con Semgrep real y ast-grep real sobre
   Java sintético (un match cada uno), PATH restringido y red deshabilitada con
   Bubblewrap. HOME/XDG de prueba aislados, Python userbase público seleccionado;
   no se escaneó código de negocio ni se afirma smoke de los runners desplegados.
2. Context7 conecta pero la consulta real devolvió **Monthly quota exceeded**.
   Ver `../../v2/context7/OPERATIONS.md`; no se compró cuota ni cambió cuenta.
3. Una notebook con versiones/layout desconocidos aún no está certificada. El
   updater requiere runtimes existentes y wiring reconocible; rechaza historia
   JSON sin SQLite y runtime legacy bajo ownership `managed-local-install` de
   Background. Detenerse antes que crear una historia vacía o sobrescribir datos.
4. CLI externa/standalone/serve/service/ACP/pair y mutadores incompatibles siguen
   fuera del contrato gestionado. Se mantiene el pin; no se anuncia compatibilidad
   universal por la existencia de flags del runtime.
5. No se hicieron pruebas funcionales de aplicaciones, nuevos índices, seed de
   corpus, Cloud enroll, login ni publicaciones Jira/Confluence para validar.
6. Verificación final: offline **13/13 pass**. Una pasada live llegó lista a diez
   ubicaciones y se detuvo en OMS por siete `managed-tool-missing` de Rovo, aunque
   MCP decía Connected. OMS pasó después; BYMA mostró el mismo fallo en otro
   arranque y saldo pasó. Otro host BYMA registró los siete nombres. Es disponibilidad
   intermitente del catálogo observada, **causa no confirmada ni resuelta**; no
   ocultarla con un «13/13 live final» ni relajar las guardas de readiness. Los
   13 live de la auditoría anterior siguen siendo evidencia histórica, no garantía.

## Publicación y autenticidad de fuentes

Los 19 owners tuvieron commits y pushes normales a `main`; se comprobó HEAD
remoto antes y después, sin force, reset ni cambios de remotes. Cuenta GitHub
`juanma91m`, alias SSH `github-juanma91m-v2`. Core usa remoto `github` (no su
`origin` GitLab); los otros owners usan `origin`. Se preservaron extras locales
no relacionados y los repos de aplicaciones no recibieron commits.

Core publica `v2/install/source-lock.json`: sólo seis fuentes portables, con
`self` resuelto al HEAD limpio del Core descargado. AUNE publica `v2/source-lock.json`
con los 19 hashes y su adapter; la fila AUNE fija un commit anterior que ya contiene
el código, evitando autorreferencia circular. No equivale a actualizar el despliegue.

Actualización y recovery: `../../v2/install/README.md` y `v2/UPDATE.md` de AUNE.
Locks publicados de cada owner son la referencia exacta de fuentes; los recibos
locales de instalación siguen siendo la referencia del despliegue activo.
