# Estado consolidado del corte a OpenCode V2

## Estado vigente posterior al corte — 2026-11-19

**El corte ya se ejecutó y 2.2.7 está activo**, confirmado por recibo
`installed-and-verified`, marker activo y arranque real del usuario. Auditoría:
13 ubicaciones listas, once despliegues sin escrituras/retiros pendientes, 22
prompts globales retenidos, 3451 pre/postimages íntegras y 285 pruebas pass.
Las declaraciones de «corte pendiente» más abajo son cronología previa, no una
orden de repetir el corte. El fallo inicial se corrigió y existe prueba del modo
del wrapper bajo umask privado en los tests de cutover.

Mantenimiento/otra máquina: `v2/install/README.md` y UPDATE del owner AUNE. No
ejecutar el plan fechado de esta computadora en otra. La auditoría detectó los
bindings de Semgrep/ast-grep, cuota Context7 y fuentes sin publicar; el estado de
remediación se documenta en `MANTENIMIENTO-POST-CORTE.md`. No hay garantía de
bootstrap universal de una notebook antigua ni de credenciales/cuota externas.

## Cronología anterior (conservar como evidencia)

Revisión: 2026-11-18. Este es el **punto de entrada vigente** para decidir qué falta.
Los documentos de pilotos/addons conservan la cronología y evidencias de cada
incremento; sus conteos antiguos o frases «pendiente» no reemplazan esta matriz.

**Directiva vigente:** migrar el harness V1 excepto **Background y Stitch**. No es un
MVP ni un rediseño: conservar capacidades, prompts, permisos y general → AUNE →
proyecto; adaptar sólo lo necesario por V2/API. Las propuestas/restricciones de
incrementos anteriores no son reglas aprobadas por estar implementadas o testeadas.
El usuario reiteró expresamente que Stitch no va en V2. Su reintroducción anterior
fue un error del agente, ya retirada de selección/plugins/MCP/grants/instrucciones/
skill y referencias de key. V1 intacto; no volver a proponerlo por lenguaje general.

## Conclusión

**Decisión operativa vigente:** el usuario delegó priorización para pasar el harness
a V2 funcionando lo más igual posible a V1, sin más elecciones técnicas. Se elige
`managed-harness-v1`: harness completo en el uso habitual ya comprobado, diferencias
de hosting explícitas y no equivalencia universal de CLI. No recorta agentes/MCP/
snapshots/atribución/benchmark/métricas ni cambia el pin oficial2.2.7. La limitación
de standalone/ACP y hosts ajenos sigue cierta; no se oculta ni se impone como gate
de este contrato práctico. Ver `CONTRATO-GESTIONADO.md`.

**Preparación completa, corte real pendiente de cierre:** `cutover-activate.py`
integra el procedimiento final, preflight live antes de retirar V1, lifecycle
Background, auxiliares actuales, preservación de npm histórico fuera de autoload,
entrada habitual, guardas de mutación/readers, commit activo y rollback. Fuente de
datos siempre en copias aisladas; original/piloto/trial no se reescriben. Si falla
instalación intenta devolver sólo preimages conocidas, no adopta drift. Rollback
explícito además preserva historia nueva V2 y revierte los11 receipts por su motor.

Validación vigente90 Node Core+78 Node AUNE+26 Python cutover+1 fixture nativo de
transferencia pass. CLI gestionada real leyó historial almacenado con fd3; modo
standalone sigue sin él. Check real13 ubicaciones, staged2.2.7, guard adquirido/
liberado y3451 preimages actuales verificadas. Plan real: ~99GB de reserva/~250GB
libres, original/piloto aún abiertos. No se crearon storage definitivo ni entrada
activa; sin retiro Background, cambio de PATH, datos reales adicionales o commits.
Todos los preparativos están listos para **un solo comando externo tras cerrar
V1 y el V2 de control**, no otro intercambio de prompts. Comando/rollback en
CONTRATO-GESTIONADO.md y CORTE-FINAL.md.

Los flujos principales de los addons ya funcionan en el workshop y el candidato
general ya recupera las superficies detectadas de V1, con implementación y pruebas
aisladas y **arranque real del candidato ya verificado**. Paso2 técnico cerrado en
ese alcance; paso3 privado también verificado en arranque real. **Todavía no
corresponde reemplazar V1 en caliente**: deploy/rollback/recovery y launcher de productos ya
están implementados/probados en fixtures. Higyrus ya aplicado/check/verify-live real
readyForChat, sin recorte de snapshots, y primer uso TUI básico confirmado por
operador. Los otros diez también aplicados/check/verify-live reales listos; falta
ejecutar la entrada/storage definitivos preparados, retiro de ownership V1 y validación/corte.
Respaldo/restore SQLite y ensayo de recuperación nativa sobre trial real ya
verificados en su alcance, no restauración integral de externos ni corte realizado.
El cierre concreto del paso2 se resume en
[../../v2/general/PASO2-CIERRE.md](../../v2/general/PASO2-CIERRE.md); no confundir
implementación validada con instalación real ni con aprobación de producción.
No hace falta crear más agentes ni repetir las pruebas ya aprobadas por ritual.

**Paso3 técnico cerrado en candidato privado:** ports implementados en sus owners,
empaquetados y verificados con arranque real fuera/dentro de AUNE; no producción.
Conserva evidencia previa con
host oficial/fixtures: contexto y references organizacionales nativos, GitHub
machine-local y Grafana con su scope físico vigente. Se verificó el canónico AUNE
activo (worktree con cambios locales0.15); el clon auxiliar publicado estaba atrás
y no debe sobrescribirlo. No se promovieron dominios/identidades a la base.
Candidato privado10 aportes/22 roles/34 comandos/8 registros/250 assets,
sin cambios a V1/global/overlays/aplicaciones o copia de autenticación.
Empaquetado privado consolidado con contrato/store aparte, base byte-exacta fijada
a994baceb... y pruebas de install/update/rollback/recovery/launcher. Perfil privado
instalado offline93931cd4... (250 assets), check oficial ready-assets sin drift
fuera y raíz AUNE. La preparación/check fueron offline; posteriormente se autorizó
y ejecutó verify-live con data/state nativos V2,0 inferencias/negocio. Fuera5 MCP
connected/Grafana ausente; dentro6 incluido Grafana readonly. Ambos ready/readyForChat
true,audit pass,findings:[],proveedor conectado por metadata. No secretos leídos/
copiados desde el agente o DB V1/historial convertido; SDK/auth/metadata normales.
Sesiones diagnósticas/recibos/hosts/leases propios retirados.
El candidato general del paso2 continúa en la misma revisión.37 Node/8 Python AUNE,
76 Node/3 Python Core,100 migración/41 composición y CodeGraph14 Node/57 Python
(56 OK/1 skip) OK. El pack portable no admite ni contiene datos/owners privados.

Rondas iniciales detectaron catálogo Rovo vacío pese a connected, también observado
en la base general y Context7 en una ronda. IDs originales regresaron sin modificar
permisos/config; causa no establecida. Diagnóstico de espera no usado en las verdes
y retirado, sin reintentos/sleeps permanentes para ocultarlo. Verificación FINAL
fuera/dentro repetida con código definitivo pass; si reaparece debe seguir fallando
cerrado. No afirmar corrección de servicio externo o pruebas de negocio realizadas.

Este relevamiento no habilita implementaciones, recortes funcionales o corte
productivo. Una propuesta de exclusión adicional requiere decisión explícita.

**Paso4 iniciado:** contraste de manifests de los once overlays realizado por el
owner AUNE, reutilizando sus contratos de suplementos/bloques y sin sync. Higyrus
presentó un AGENTS labura distinto del overlay; **el usuario autorizó reemplazarlo
por su overlay propio para instalar primero y reconciliar después, sin commits/push**.
Reemplazo de AGENTS aplicado y verificado byte a byte, sin borrar skills ni tocar
código funcional; los once estados OpenCode/compartidos gestionados ahora coinciden.
Se separaron diferencias de otros clientes y aliases no seguidos; extras nativos no
autorizan borrado general. Inventario7 tests Python pass. Primer port de config y
roles completos de los once owners pasa debug config/registro nativo oficial en
fixtures base→org→proyecto. Hook saldo portado con script/modelo/Git sintéticos.
Assets/skills/commands/helpers/instrucciones ya tienen port y registro, con imports
nativos explícitos y preservación de guías. Guardas corregidas en fuente Core para
usar agente nativo efectivo sin approvals de sesión: nueve report writers, ocho
inspectores Git y especialistas Python/TS probados, negativos conservados. No se
deshabilitaron. Ese incremento dejaba pendiente ticket_metrics, nueva fundación y
distribución/despliegue; los avances posteriores se registran abajo. Las releases
predecesoras archivadas no se modificaron para absorberlos.

**Sucesor preparado posteriormente, sin corte:** raíz nueva
`~/.local/share/opencode-v2-clean/rollout-successor/`, general
f1874f3a637cf3091cdb099be6b4e0039e5418faa69b4be8a2d94c2c66fb0630 y privada
b993b701531ab8afc8577754c0ca37956e1d07f4680531fc9489a28e944878d1 fijada al padre.
Incluye fix de guardas y ticket-metrics de Ticketing (capture API pública/report
CLI,16 tests owner). Check privado257 assets/0 drift/faltantes/extras, sin startup.
Los11 paquetes de transporte nativos quedaron archivados contra esa cadena,
160 archivos/8 aliases/0 dependencias globales pendientes. No son perfiles chat
recortados ni se aplicaron en productos. Su cliente de fundación sigue bloqueando
capas V1; aplicación/aceptación real siguen pendientes.
Detalle en el canónico AUNE `v2/projects/ROLLOUT.md` y sus manifiestos de staging.

**Deploy/rollback/recovery y launcher de producto implementados y validados en
fixtures:**11 owners con apply/schema/rollback oficial; cinco representativos con
startup privado+proyecto/catálogos sintéticos. Preservan defaults/disabled locales,
Python/TS completos, entradas nativas y regiones externas de guías; sin compositor
privado ni grants por approvals de sesión. Recibos/journal privados fuera de apps,
recovery explícita y update sólo de pin probado; recupera contra revisión exacta del
journal aunque el paquete haya avanzado. Core sólo agrega guard síncrono genérico
de fuentes y evidencia técnica de auditor; `generalOnly` no se relajó.
Regresión vigente79 Node+3 Python Core y74 Node+7 Python AUNE pass. No servicios,
modelos, hooks o negocio reales por esos fixtures. CLI live/chat de productos no
ejecutados. El warning experimental stripTypeScriptTypes sigue visible.

Los archivos de transporte se actualizaron en staging para incluir adapter/baseline
de las cuatro guías aditivas; los demás siete conservaron revisión y los pins de
fundación no cambiaron (launchers source-owned, no bundle runtime alterado). Check
padre257 assets/0 drift/lease ausente. Preflight real read-only:11/11 planes pasan
tras la reparación puntual autorizada del alias cierre-de-tarea de saldo-rt:
ahora apunta a ../../.agents/skills/cierre-de-tarea, con skill nativa intacta.
Es la única escritura nueva en productos de este ajuste; guías/hooks/trabajo previo
preservados. Confirmar ventana actual de cierre antes de aplicar overlays. Detalle
operativo en el canónico AUNE `v2/projects/DEPLOYMENT.md`. No overlays nuevos aplicados,
stores reales abiertos, Git writes, PATH cambiado o salida Background realizados.

**Primer apply real Higyrus autorizado y revertido (2026-11-18):** tras cerrar el
otro cliente V2, lease ausente y padre257 assets/0 drift. Apply de paquete8cb19c85...
validó schema/fuentes y publicó6 archivos/retiró5 supersedidos; receipt privado
04c53a42ab185ad09324b3a4d434a1f7d60597edb21705834f139ffb3e13d5b7.
Check posterior bloqueó por27 rutas con nombres potencialmente sensibles elegibles
para snapshots. Sólo metadata, no lectura de secretos ni prueba de que todas sean
secretas; no host/MCP o arranque de aplicación. Para evitar dejar V2 sin aceptación,
rollback restauró exclusivamente los cambios del intento. Higyrus `not-applied`,
plan vuelve a6 writes/5 removes sin drift, Git sólo conserva AGENTS previo elegido
por el usuario. Padre intacto/lease ausente; historial/runtime/PATH sin cambios.
Ese bloqueo se resolvió después sin recortar snapshots, como se detalla abajo.
Detalle en canónico AUNE `v2/projects/DEPLOYMENT.md`. El ensayo aprobado de historial
no se repite por este motivo.

**Higyrus aplicado y startup real listo, sin recortes (2026-11-18):** el usuario
pidió Higyrus completo, no desactivar snapshots. Política nativa local mediante
bloque aditivo en `.git/info/exclude`; fuente/contrato sólo en owner Higyrus
`v2/{snapshot-excludes.gitignore,SNAPSHOTS.md}`. Sin borrar archivos sensibles,
modificar índice/refs o `.gitignore` compartida por esa política. Core reconoce
exclusiones tracked con check-ignore --no-index, igual que el nativo; candidatos
nuevos expuestos siguen bloqueando y CLI apply los comprueba ANTES de publicar.
Fixture oficial demuestra undo normal y que payloads sensibles excluidos no se
materializan en objetos nuevos. No es purga: snapshots sembrados aún pueden
referenciar objetos históricos del Git fuente. No contenidos sensibles leídos.

Regresión vigente80 Node+3 Python Core y75 Node+7 Python AUNE pass. Reapply de
8cb19c85.../receipt04c53a42... pasó; check6 fuentes/257 assets/0 drift y snapshots
habilitados (27 candidatos/27 excluidos/0 expuestos). Verify-live real de Higyrus
con data/state del piloto V2:ready/readyForChat true, planner default, plan/build
disabled,62 skills/43 commands, seis MCP connected y metadata proveedor conectada.
0 inferencias/negocio; sin copia de auth o acceso a DB V1/trial del ensayo.
Scoped audit warning por overrides locales de comandos/skills,0 blockingFindings;
baseline global error por contraste sin deltas (plan/build disabled) se conserva,
no se transforma en pass ficticio. No certifica todos los workflows/negocio:
actualHierarchyAcceptance:false. Host/probe/leases propios retirados, padre íntegro.
Primer uso TUI básico confirmado por el operador con captura: planner, GPT-6.1
Sol/high, respuesta real del modelo y6 MCP connected. No certifica todos los
workflows/negocio; los0 requests del verificador no se extrapolan a ese uso humano.
Pendientes demás productos/corte; no repetir historial aprobado o smoke básico por
rutina. La TUI abierta mantiene su lease normal. Apertura/rollback en DEPLOYMENT.md.

**Historial: vía nativa, sin migrador propio.** Se confirmó el migrador V1→V2 de
la distribución oficial2.2.7. El usuario indicó llegar hasta lo que soporte y
retirar el desarrollo sobrante: se eliminaron los cuatro diagnósticos experimentales
de import/export y store sintético. No se exige igualdad1:1 de cada campo como
condición adicional ni se construye un conversor a medida por defecto. Se preservan
sesiones, respaldos y lectura nativa del runtime. Respaldo online/restore SQLite
ya comprobados; tras preservar el primer intento interrumpido, una continuación
nativa completó y verificó1402 sesiones/cinco conversaciones representativas. Ver
`HISTORIAL-INTEGRO.md` para procedimiento y alcance, no comandos retirados.

**Ensayo online autorizado:** el usuario conserva su sesión V1 abierta. Respaldar
con la Online Backup API SQLite y origen read-only/locking normal, no copiando
DB/WAL/SHM activos ni usando immutable. La presencia de un proceso V1 con esos
descriptores no bloquea por sí sola este ensayo. Un único ejecutor en la sesión
V2 separada realizará backup privado → restore comprobado → migración nativa de
otra copia nueva. Original/piloto/instalación preservados, sin aplicar overlays.
El backup no sincroniza mensajes posteriores ni certifica adjuntos externos; el
corte final y la copia offline sí requieren ventana actual sin escrituras. Los
gates de cierre de config/launchers compartidos no se relajan. No duplicar el
trabajo desde la sesión V1.

**Resultado real de historial aprobado en alcance de ensayo (2026-11-18):** raíz privada
`/mnt/hd_linux/opencode-history-20261118T163530Z-g8p7jw44/`; backup online
25911316480 bytes, integridad OK/0 FK y restore separado byte-idéntico aprobados.
Primer ensayo interrumpido por timeout HTTP120s del verificador; trial parcial
DB/sidecars/logs preservados antes de una única continuación normal2.2.7, sin reset,
edición SQL o APIs internas. Sandbox byte-idéntico, sin original/piloto/red externa.
Verificador ajustado: presupuesto absoluto3600s/120s umbral observable, una consulta
pendiente, observador independiente de vida/CPU/I/O/espacio y watchdog.6 tests
HTTP/host+3 preservación sintéticos pass; un gate fallido sin arranque conservado.

Tarea `sh_1efaebe22001DkFqxrLZkKybSI` completó con exit0,17:34:27Z. Continuación y
comprobaciones368,656s; estado nativo/persistido completed. API pública listó1402/1402
sesiones (463 raíces/939 hijas), sin diferencias de títulos/fechas/parentesco;
abrió cinco conversaciones y verificó1274 textos assistant,1716 inputs/1683 outputs
de tools y dos resúmenes de compaction por hash. Error de clasificación de summary
user en el verificador se corrigió explícitamente: complemento SQLite read-only,
sin otro host, confirmó178 textos user/cinco adjuntos inline. No diferencias
observadas; no se exige igualdad1:1 de la representación interna. Trial1402 sesiones
V2/91313 mensajes.74 muestras operativas,139 requests, máximo una pendiente; host
cerrado y ningún proceso del ensayo activo. Backup/restore conservados sin abrir.
868 partes inline en referencia, sólo cinco payloads comprobados; externos no
recuperados, mensajes posteriores V1 no sincronizados. Alcance no prueba todos los
campos/adjuntos, UI, auth o continuación con proveedor real. Ver HISTORIAL-INTEGRO.
Sin inferencias/negocio, overlays, instalación/PATH o corte. Quedan unos234GiB libres.

**Incidente de aislamiento documentado:** el primer generador de fixture invocó
el wrapper V1, que fija DB al original y anuló env temporal: session list consultó
ese store. Se detuvo, sin imprimir/persistir stdout, export/import/borrado o mutación
deliberada; no se certifica ausencia de housekeeping SQLite. No se abrió de nuevo
para comprobarlo. Los ensayos posteriores quedaron confinados y ahora se retiraron
como experimentos redundantes; nunca volver a usar ese wrapper para aislamiento.
No se migró el historial real ni se cambió PATH.
Detalle y herramienta pertenecen al canónico AUNE `v2/projects/README.md`, no a Core.

**Condición bloqueante enfatizada por el usuario:** preservar todo el esquema
lógico `stack general → stack AUNE → stack por proyecto`. No alcanza con instalar
las tres capas: hay que demostrar su composición efectiva, precedencia y límites.
Verificar base sola, base + capa organizacional, y base + organizacional + proyecto,
sin pérdida silenciosa de prompts, modos, modelos, skills, tools, targets o permisos
seguros. No asumir herencia completa automática por archivos del mismo nombre.
La capa organizacional y el dominio por proyecto permanecen en sus owners, no se
absorben en la base reusable. El workshop sintético no prueba esta condición.

## Qué se revisó y qué no — relevamiento inicial histórico

- Inventario de fuentes canónicas, configuración global V1 por metadata y assets
  físicos del workshop V2. No se resolvieron valores/interpolaciones ni se abrieron
  credential stores, `.env*`, DB, sesiones o documentos de negocio.
- Matriz fuente/instalado/composición y contratos de plugins, launchers, helpers,
  commands, lifecycle y recursos gestionados; evidencia anterior de tests y las
  confirmaciones del operador en esta sesión, sin volver a ejecutarlas.
- Inventario actual de once pares overlay canónico/target. **No** se ejecutó una
  auditoría semántica de los overrides, ni debug config desde cada repo, ni sync.
- No se iniciaron servicios, MCP, OAuth, navegador o inferencias. No se ejecutaron
  prepare/apply/chat/verify, installers, comandos de limpieza o mantenimiento.
- Únicas escrituras de este relevamiento: documentación canónica y actualización
  del inventario machine-local del staging; producción y workshop no cambiaron.

El reporte de metadata está en `$HOME/.local/share/opencode-v2-clean/inventory.json`.
Los nombres/rutas de los proyectos quedan allí, no en esta guía reusable. Se generó
mediante `inventory.mjs --overlay-root <root-local-de-overlays> --save`.

### Conteos observados (archivos, no certificación del catálogo efectivo)

| Superficie | V1 global instalado | Workshop V2 | Interpretación |
|---|---:|---:|---|
| Archivos de agentes | 22 | 22 | Presencia no equivale a modos/permisos/targets completos |
| Comandos de archivos | 34 | 18 | Faltan nueve base, cinco CodeGraph y dos Documents legacy |
| Skills propias | 35 | 33 | GitHub local y skill del addon Background no están en el workshop; Background está excluido |
| Archivos de registro de helpers | 8 | 3 | Faltan cuatro base y GitHub local; no contar archivos como cantidad de verbos |
| MCP configurados | 6 | 5 | Candidato general5 también: Stitch excluido explícitamente, no una brecha |

El workshop declara diez plugins server por configuración; sus paquetes viven
fuera de `plugins/` del perfil. Un conteo de cero archivos en ese directorio **no**
significa cero plugins cargados. Del mismo modo, las ocho coincidencias heurísticas
«background» del inventario V2 son textos como «may not delegate» de Documenter,
no prueba de ocho dependencias ejecutables del addon descartado.

## 1. HECHO — preservar, no volver a probar sin cambio material

| ID | Capacidad | Evidencia y alcance | Límite que no invalida lo aprobado |
|---|---|---|---|
| H01 | Host oficial 2.2.7 aislado | Baseline/hash/debug config y perfiles separados ya validados; sin core patches | No es despliegue productivo ni sandbox OS |
| H02 | Base: guardas `.env`, permisos controlados, broker, identidad | Adaptadores públicos y tests; edición/checker master-dev y lectura/broker planner confirmados por operador | Proyecto sintético, no shell/build/test de una aplicación real; atribución sólo contexto visible |
| H03 | TUI: question, permisos, atajos, Plan/Build ocultos | Corrección question, pruebas PTY y confirmaciones del operador; hidden preservado por composición | No habilitar de nuevo Plan/Build en selector; rechazo humano final de permiso no confirmado, aunque sí PTY |
| H04 | Context7 | Integración real aprobada antes del agotamiento de cuota | Cuota del servicio no es bug de migración |
| H05 | Knowledge | Engram nativo y persistencia por autoridad probados en fixtures; reader real Engram/Qdrant, estado y cinco hits del corpus existente confirmados | Delegación de Knowledge y escritura durable genuina desde el candidato final aún no probadas; no crear memorias/índices de ensayo |
| H06 | Ticketing/Rovo | OAuth discovery operativo; recursos/Jira issue/búsqueda y contenido Confluence reales aprobados; comandos/handoff/naming cubiertos por fixtures | Handoff humano completo y naming fuera de frontera sintética aún no certificados; search Jira vacío no prueba recuperación por clave |
| H07 | CodeGraph query-only | Connected y consulta real ejecutada; roles/roots/denies y catálogo real probados | Respuesta real de relevancia parcial; no certificar cobertura/frescura ni reindexar para mejorarla |
| H08 | Playwright | Headless público y visible real confirmados; flujo loopback real y permisos por rol probados | No takeover autenticado, garantía universal de sitios o cero artefactos físicos |
| H09 | Notifier básico | Banner libnotify y avisos de pregunta/finalización/permiso confirmados, sin emisor nativo duplicado | Avanzado posteriormente portado/probado en fixtures; no aceptación desktop real de quiet hours/sonido/foco |
| H10 | Lectura documental | Helper, texto y ambas páginas renderizadas abiertos por planner real | No OCR/fidelidad universal o acceso arbitrario a documentos externos |
| H11 | Documenter multiformato | PDF/DOCX/PPTX, checks/previews, QA independiente 16 imágenes, dos ciclos spec-only y cierre real | Dos MINOR reportados; no certificación de edición nativa Office/accesibilidad |
| H12 | Delegación nativa documental | Dispatch, continuación del mismo hijo y Ctrl+B/background con entrega tras cierre provisional comprobados | Sólo seis especialistas de Documenter; no toda la delegación ni lifecycle del addon Background V1 |
| H13 | Diagramas y canvas | Dos diagramas con receipts 7/7 y 8/8/check SVG/QA PNG; canvas edit/export, captura tras conectar frontend, QA PNG y stop propio confirmados | PDF standalone no inspeccionados visualmente; `.excalidraw` exportado no verificado como editable |
| H14 | Paso 1: reapertura tras editar inputs | Repair aplicado por operador:0 inputs reemplazados, permisos/tools preservados y backup; chat verificó composición y abrió normalmente | No valida todavía composición general → AUNE → proyecto ni corte productivo |

## 2. FALTA — trabajo necesario para preparar el corte

«Necesario» significa preservar el uso vigente sin pérdida silenciosa; no que
debamos implementar toda feature opcional antes de decidir alcance.

| ID / prioridad | Brecha concreta | Dueño | Criterio para cerrarla |
|---|---|---|---|
| B00 / cerrado | Ownership corregido, repair y reapertura real confirmados por operador | Documents + coordinador base | Completado; ver H14 y B00-REAPERTURA.md. No repetir repair ni render/QA |
| B01 / cerrado candidato general |7 aportes/22 roles/33 skills/34 comandos/7 registros/5 MCP,227 assets | Base coordina; cada addon mantiene su port | Instalado/check/verify-live reales pass, proveedor/MCP conectados,0 modelo/negocio. Ver PASO2-CIERRE.md; no corte o capas privadas aprobados |
| B02 / parcial | Normal edición/build, guards y descubrimiento nativo; auditor/propuestas implementados con host oficial y addons compuestos | Base | Completar defaults/activación y validación real de capas; testigos no son aceptación semántica de toda herencia |
| B03 / validado en fixtures | Dispatch técnico, Knowledge y documental coexisten, con targets/denies y overrides acotados | Base + owners | No aprueba todavía permisos de AUNE/proyectos reales ni aislamiento automático de writers |
| B04 / parcial | Nueve base +25 addon y7 registros; CodeGraph4 lifecycle+benchmark recapturable; Documents tres programas legacy originales/comandos de agente actual y ocho tools locales; Confluence nativo sólo Doc con ask | Base + owners | Continuar comparación de capacidades/bindings/identidad y aceptación real. Prototipos QMD/ODT acotados fuera del harness default; tests no equivalen a paridad completa |
| B05 / alta | Privados y once overlays no compuestos/validados en V2 | Addons privados y canónicos locales | Conservar identidades/aliases/políticas y deltas locales, comprobar fuentes y reglas efectivas por repo en candidato aislado; preservar drift ajeno y no normalizarlo por sync |
| B06 / cerrado candidato general | Runtime durable preparado:546 entradas/404912446 bytes,Chromium1217,integridad verificada | Base, owner Playwright | Candidato usa copia durable y MCP conecta. Sin descargas/perfiles/cambios caches fuente; V1/workshop no reemplazados |
| B07 / parcial | Wrappers/bindings, HOME broker, D05, launcher, releases y siete definiciones Ollama dormidas probados en temporales | Cada addon + coordinador | Uso real autorizado y cierre de paridad pendientes; rollback sólo config, no host/stores o cutover |
| B08 / parcial; antes del corte | Backup online/restore de DB real comprobados y recuperación nativa ensayada; backup final de aplicación y salida managed-local-install pendientes | Base coordina + lifecycle Background vigente | Pruebas DB y recuperación D01 no son backup integral de externos/config/runtime. Para corte: ventana actual sin escrituras V1 y respaldo final actualizado; restaurar ownership antes de reemplazar binario, conservar config/runtime/storage compatibles para rollback |
| B09 / cierre | Validación efectiva de composición candidata y corte | Base + owners | debug config aislado, roles/policies/catálogos, overlays y un flujo acotado representativo; PATH/versión/auth/sesión nueva. Sólo luego proponer corte autorizado |

### B00: diagnóstico original y corrección posterior

El spec sintético del workshop recibió correcciones autorizadas de QA. La
composición anterior lo registraba como `desired` fijo dentro de `assets` y pins;
prepareWorkshop lo pasaba a upgradeOwned, que rechazaba cambios legítimos al
recomponer en chat/verify. Ese era el conflicto previo, no el diseño ya corregido.

El relevamiento detectó el conflicto por inspección de código, sin reabrir el
workshop. Después, autorizado el paso 1, ambos errores (reapertura y validación
shell de pins) se reprodujeron y corrigieron en fixtures temporales. Los inputs
ahora se siembran sólo si faltan, se preservan si existen y no son pins confiables.
La actualización legacy acepta sólo la baseline anterior conocida y quita los
tres pins, conservando todos los demás controles.

Pasaron 100 tests de migración, debug config oficial en fixture migrado y 11 casos
nativos de base. Después el operador ejecutó repair-inputs --client-closed y chat:
reportó 0 inputs reemplazados, permisos/tools sin cambios, backup y reapertura normal.
Chat verificó 22 agentes/33 skills, cinco MCP conectados, hidden y Documenter
preservados. **B00 cerrado con evidencia del operador**; no se repiten render/QA ni
se deshace el spec. Detalle en [B00-REAPERTURA.md](B00-REAPERTURA.md).

### B04: los faltantes no son sólo nombres

**Actualización paso 2:** los nombres y registros siguientes ya están presentes en
el candidato base de `v2/general/`, no en el workshop. Se probaron helpers de análisis
y mantenimiento de sesiones nativo. Auditoría/scaffolding y bindings todavía tienen
límites: no se declara paridad completa ni se alteró el perfil vigente. Ver
[../../v2/general/README.md](../../v2/general/README.md).

Comandos antes ausentes en el workshop y ahora registrados en el candidato base:

- `check-code-patterns`, `check-local-overlays`, `find-code-pattern`.
- `code-review`, `code-review-pr`.
- `init-project-agent-layer`, `stack-doctor`.
- `sessions-list`, `sessions-clean`.

Registros base antes ausentes en el workshop y ahora presentes en el candidato: `core-local.json` (`local-inspect`),
`core-ssh.json` (`ssh-inspect`), `core-psql.json` (`psql-readonly`) y
`core-analysis-doc.json` (`analysis-doc`). El workshop no se modificó por este
incremento; los registros/scripts están en el candidato base. El quinto registro
ausente, `github-pr.json`, pertenece al addon privado local, no a la base.

Ejemplos de adaptación requerida:

- El `stack-doctor` original V1 pide plugin async y Stitch: no se copia como
  diagnóstico equivalente. El candidato ahora combina fuentes nativas/registro
  efectivo y propuestas sin writes, con límites explícitos. Owners reales aún no
  validados, sin modificar el comando V1 instalado.
- `session_cleanup.py` fija la ruta DB V1, consulta su esquema y llama al
  `opencode` de PATH para borrar sesiones: **no ejecutarlo contra V2 ni copiarlo
  como compatible**. El candidato ya tiene listado y limpieza por API pública,
  probados sólo con sesiones temporales propias, consentimiento y protección de
  ancestros/descendientes. No declarar idéntico su scope/atomicidad o apuntarlo a V1.
- `analysis-doc` tiene escritura acotada de metadata bajo tmp y control de hash;
  no equivale a conceder Edit general al planner.
- Migrar helpers no autoriza a probar SSH/PostgreSQL/GitHub reales: su acceso y
  selección de identidad requieren el alcance/confirmación correspondientes.

### Cronología de incrementos — no reemplaza el criterio vigente

Las secciones históricas siguientes registran implementaciones y límites de ese
momento. Las restricciones estáticas, no-overwrite, writer nuevo y aprobaciones
extra descritas allí fueron revisadas en «Corrección de paridad V1» más abajo; no
seguirlas como requisitos actuales. Conservar la evidencia no las vuelve política.

### Incremento nativo: auditor/propuestas y runtime durable (2026-11-16)

- Auditor combina `debug config --standalone` con DB/data/state/cache temporales
  y APIs del registro ya vivo, sin `ctx.config` inexistente ni `debug agents`, que
  inicia MCP en este pin. No expone prompts/config resuelta/recursos shell. Catálogo,
  fuentes, deltas y guardas visibles; testigos de permisos, no prueba formal ni
  aceptación semántica de AUNE/once overlays. Scaffolding sólo propone: cero writes,
  sin system/tools V1, init CodeGraph, sync o autenticación implícitos.
- Prueba compuesta detectó divergencia entre deny shell inline de plan y ask de su
  archivo fallback posterior. El guard ya denegaba shell libre; las restricciones
  propias se materializan también al final del rol emitido para alinear registro
  y enforcement, sin cambiar V1 o ampliar permisos.
- Runtime público Playwright snapshot con hashes/modos/links internos y lifecycle
  explícito. Plan real: 546 entradas/404912446 bytes; copia y ejecución sólo temporales,
  7 calls reales headless loopback/PNG/integridad final OK. Sin descarga ni perfiles.
  Destino durable definitivo no preparado; candidata real no activada.
- Evidencia: 20 Node + 3 Python general, 100 regresiones migración, 29 casos base,
  41 de composición con 5 MCP fixture, 7 managed Python y 7 legacy Playwright V2 OK. Auditor
  no inicia MCP adicionales; actor no autorizado bloqueado incluso con allow sesión.
  Propuesta aceptada por debug config oficial. Sin negocio/modelos reales/DB original.
- Detalle: [../../v2/general/COMPOSED.md](../../v2/general/COMPOSED.md). Próximo bloque:
  defaults/activación/storage/distribución final del paso2; luego AUNE/proyectos bajo
  gate obligatorio, historial/backup/restore y corte autorizado. No repetir taller.

### Incremento defaults y storage opt-in (2026-11-16)

- Relevamiento JSON V1 metadata-only: modelo y small_model gpt-6.1-sol; title low,
  summary/compaction medium. Traducidos a modelos nativos auxiliares sin copiar
  prompts/settings/proveedores. Peticiones title/compaction reales ante mock verifican
  variantes, summary por registro. Ollama existente está deshabilitado: no se habilita,
  sus siete definiciones dormidas aún deben portarse/preservarse antes del corte.
- Binding V2 existente implementado como API opt-in, no activado en stores reales.
  Revalida markers/paths/symlinks y conserva HOME/config/cache/tmp propios. Prueba
  nativa: primer host crea sesión/DB temporal; segundo host la relee con data/state
  compartidos, sin SQL/copias/credenciales. Consentimiento de reuse y cierre humano
  obligatorios; no es backup independiente o migración de historial V1.
- 27 Node + 3 Python general, 100 regresiones migración, 29 base y 41 composición
  OK. `general-defaults.mjs plan`, `general-storage.mjs plan` y composed plan reales
  sólo consultaron metadata pública; no host/MCP/modelos/DB contenidos o writes.
- D05 pendiente: política de compaction automática/snapshots/skills externas/updates;
  propuestas y contrato en [../../v2/general/ACTIVATION.md](../../v2/general/ACTIVATION.md).
  No hay launcher chat/activación final ni nuevo login solicitado.

### Defaults D05 aprobados e implementados; lifecycle offline (2026-11-16)

El usuario confirmó las cuatro recomendaciones: compaction automática nativa,
snapshots para undo/revert, skills externas sólo por imports explícitos y binario
fijado con actualización explícita. Implementados en el candidato, no instalados
globalmente. La autorización no incluye corte, prepare definitivo o reuse real.

- Config explícita: compaction.auto:true, snapshots:true, update:disable y pin2.2.7.
  Los addons no pueden sustituir estos defaults implícitamente. Warming sigue false.
- Host oficial en fixtures: undo/redo/commit restaura original y elimina creado,
  sin modificar índice/refs Git ni archivos ajenos/ignorados/fuera del directorio;
  compaction automática por uso alto simulado, resumen medium y continuación sin
  API manual. No prueba calidad de resumen con proveedor real.
- Pin2.2.7 aún descubre ~/.agents/skills pese al switch external. Las fuentes de
  archivos llegan después de transforms de setup: se filtran con API nativa antes
  del prompt, no con un loader privado. No se anuncian/cargan en el modelo, incluso
  con allow de sesión; skill de proyecto nativa conserva carga. Discovery interno
  puede leer metadata/cuerpo: no se afirma sandbox de filesystem.
- status distingue assets listos/ausentes/outdated/drift sin prepare. check valida
  bytes/pin, assets y fuentes con CLI/storage temporal, no server/MCP/auth/modelos.
  Preflight de snapshots detecta nombres sensibles tracked/untracked no ignorados,
  sin contenidos; no es detector universal de secretos. Los snapshots contienen
  datos locales sensibles y no son backup, GC privado o secure erase.
- 35 Node +3 Python general,100 migración,29 base y41 composición OK. Status real:
  not-prepared, sin crear destino; check sólo temporal. V1/workshop/stores intactos.
- Siguiente: launcher interactivo y distribución/rollback, definiciones dormidas
  de proveedor y activación durable autorizada. AUNE/once proyectos siguen bajo el
  gate real obligatorio. Detalle en ACTIVATION.md; no repetir pruebas del workshop.

### Launcher general implementado, sin activación real

- verify-live/chat separados de check offline. Requieren candidate-only y cierre
  humano; chat además reuse V2 explícito y TTY antes de selectores/stores. No URLs,
  credenciales, DB o servidor ajenos por flags, ni login automático.
- Preflight de integridad/pin/snapshots y rechazo por metadata de config/assets
  locales/ancestrales no revisados antes de invocar parser/host. Descubrimiento
  nativo no se deshabilita. Es general-only; no saltea el port AUNE/proyectos.
- Un único servidor propio por stdio/loopback, password efímero no serializado;
  cliente se adjunta a sesión nueva con agente/modelo/variant efectivos. Transporte
  desktop permitido tanto en servidor como TUI. Reuse sólo data/state del piloto,
  sin copia ni cambios de HOME/config/cache/tmp.
- OpenAPI2.2.7 no tiene tool.list HTTP. Comando nativo stack-runtime-probe permite
  auditoría metadata por API del plugin, sin inferencia ni dispatch arbitrario;
  sólo master-dev/agent-design y UUID, salida fija en cache. Sesión diagnóstica propia
  y recibo retirados. Es comando runtime, no aumenta el conteo de27 archivos.
- Lease bloquea candidato paralelo/prepare, no sustituye cerrar otros clientes
  del store. Cierre normal/error retira sólo inode propio y host propio; stale tras
  crash requiere reconciliación, no borrado/kill automático.
- 46 Node+3 Python,100 migración,29 base,41 composición OK. TUI oficial en PTY con
  mock/store temporal: sesión nueva, anterior intacta,0 inferencias y cleanup
  comprobado; caso OpenAI sin conexión detiene TUI sin login. Compuesto5 MCP fixture
  conectados sin tools de negocio; errores MCP/actor/nonce/lease/config rechazados.
- No prepare/verify-live/chat sobre el candidato real, runtime durable definitivo
  o stores originales; V1/workshop intactos. Restan distribución/update/rollback,
  definiciones dormidas y preparación/verificación reales autorizadas para paso2.
  Contrato: [../../v2/general/LAUNCHER.md](../../v2/general/LAUNCHER.md).

### Distribución de configuración y rollback implementados, sin despliegue real

- Manifiesto V2 separado general-native/1: siete owners, sin Background/Stitch o
  privados. No se ejecuta/reescribe distribution/addons.json ni el installer V1.
- Releases machine-bound sólo de home/.config/opencode y bundle, con hashes,
  metadata owner/root/pin y current/previous. No recorren/copían HOME, DB, auth,
  runtime browser, data/state/cache o proyecto. No son pack relocatable/bootstrap
  de máquina vacía ni backup consistente del historial.
- install/update explícitos, rollback por SHA y recover previous/target con confirm;
  lease compartida, validación nativa síncrona antes de commit, journal que bloquea
  launch/prepare/check si queda pendiente. Drift/extra config, credenciales literales,
  colisiones, symlinks/hardlinks y root ajeno no se adoptan. Sin poda automática.
- Boot archivado no regenera builders actuales ni requiere V1 para reconstruirlo.
  Se mantiene en el mismo destino; dependencias externas no se restauran. Browser
  valida su snapshot por adapter owner archivado, sin caché/V1/descargas.
- 59 Node +3 Python general,100 migración,29 base y41 composición OK. CLI en HOME
  temporal sin V1: status/rollback/recovery/check/live verificados; rollback compuesto
  conserva22 roles/5 MCP fixture sin inferencia/tools de negocio. Parciales simulados
  recuperados; datos/caché/proyecto sintéticos conservados, no respaldados.
- Real: release-plan not-distributed207 archivos, release-history vacío, status
  not-prepared; sólo metadata,0 writes/host. No install/update/rollback real ni
  stores originales abiertos. Falta port/preservación de siete definiciones dormidas
  y preparación/verificación reales autorizadas para cerrar paso2. Corte global y
  backup/restore de datos siguen después de los gates AUNE/proyectos.
- Contrato: [../../v2/general/DISTRIBUTION.md](../../v2/general/DISTRIBUTION.md).

### Siete definiciones dormidas preservadas, sin habilitar Ollama

- Relevamiento V1 por metadata: siete modelos con name, sin otras opciones. El
  mapper conserva IDs/tags/nombres/endpoint en providers nativo, remapea sólo el
  paquete compatible revisado y no inventa limits/capabilities/cost/variants.
  Credenciales/campos no mapeados/proveedores activos/endpoints no revisados fallan.
- Hallazgo pin2.2.7: provider.use deny bloquea catálogo/inferencia pero el builtin
  Ollama aún consulta discovery. Control negativo sólo contra loopback propio.
  Candidato OpenAI-only desactiva -opencode.provider.ollama y plugin.use; la policy
  explícita de uso dormido permanece. No afecta el servicio ni helpers embeddings.
- Prueba nativa: siete definiciones conservadas, modelos no utilizables, builtin
  ausente, selección rechazada y cero requests/fallback con protección, incluso
  ante allow local. Launcher revisa catálogo/plugin; releases conservan el estado
  en update/rollback. Sin inferencia real, pulls, auth, reindex o efectos de negocio.
- 66 Node +3 Python general,29 base y41 composición OK actuales. Las100 regresiones
  legacy son del hito anterior; esos adapters/workshop no cambiaron aquí.
- Plan real conserva22 roles/33 skills/27 archivos commands/7 registries/5 MCP y
  siete declaraciones dormidas. release-plan not-distributed207, historial vacío,
  status not-prepared,0 writes/host. V1/workshop/stores originales intactos.
- Contrato: [../../v2/general/DORMANT-PROVIDERS.md](../../v2/general/DORMANT-PROVIDERS.md).

**No confundir este cierre con paridad completa del paso2.** Además de la ventana
autorizada de preparación/verificación real, siguen explícitas D02/D03/D04/D06:
CodeGraph mantenimiento/benchmark, Documents legacy/remoto, Notifier avanzado y
atribución de historial. No se consideran excluidos por no haber entrado al piloto.
Resolver/portar el alcance correspondiente antes de dar el stack general por cerrado;
no pedir un corte ni nuevas pruebas humanas del workshop para compensarlo.

### CodeGraph: cuatro comandos lifecycle nativos (hito anterior a benchmark)

- Owner portó init/status/sync/reindex a tool codegraph-project separada del MCP
  explore. No se ejecutan al instalar/conectar/query; no nuevos mutadores MCP,
  shell/Edit al inspector o CLI libre. Sync/init/reindex van al coordinador con
  permiso nativo; reindex exige explicación/confirmReindex. Status ruta inspector
  comprobada por command API2.2.7; session allow no habilita writes del read-only.
- Root Git/worktree absoluto exacto, no symlinks/subdirs/home; estado/registry
  seleccionados por binding owner, tuning/runtime1.5 conservados. Adopción compatible
  no reindexa; falta DB/mismatch/reindex recomendado detiene init/sync sin fallback.
  Índices incompletos no se reparan silenciosamente. No unlock/uninit/install/upgrade.
- Registry per-root y exclude Git local después de aprobación, sin tracked .gitignore
  o codegraph.json. Locks de metadata propios no reemplazan upstream; sin captura
  raw de stdout/stderr/código, sólo proyección de estado/conteos. Normal SQLite,
  daemon/watchers/locks/migraciones no se desactivan o prometen cero writes físicos.
- Addon55 Python:54 OK/1 skip opt-in,7 lifecycle nuevos y referencia de state añadida.
  Runtime real1.5 copiado sólo como paquetes públicos a HOME temporal: status ausente,
  init/adopt/sync/reindex/status con grafo real mínimo. Sin índices/state reales,
  downloads, código funcional del operador o commits. Worktrees unborn separados
  probados con CLI sintético. Un test nativo2.2.7 verifica tool/command/ask/refusal,
  roles/pins/roots, sin modelo real; general66 Node+3 Python regresionados.
- Plan real:31 comandos de archivo y214 assets,22 roles/33 skills/7 registries/5 MCP,
  not-prepared,0 writes/host. V1/workshop sin cambios funcionales; extensión legacy
  query-only no habilita maintenance por omisión. No reapply/QA humana repetida.
- D02 parcial: benchmark history/capture/report depende de tablas session/message/
  part V1. No copiar nombre/script o export/SQL de PATH como supuesto port. Requiere
  adapter/cobertura/privacidad V2; no excluido ni corridas A/B lanzadas aquí.
- Contrato owner: v2/NATIVE-LIFECYCLE.md. D03/D04/D06 y gates reales siguen abiertos.

### Benchmark CodeGraph nativo implementado/probado, sin corrida real

- El usuario delegó aplicar la mejora que conserve utilidad. Owner recuperó
  history/capture/report con proyección de cuerpos sólo en RAM del servidor y total
  derivado versionado de componentes normalizados exclusivos. `reported_total:null`,
  no billing/total V1, sin mezclar pares de backend/bytes/measurement distintos.
- Hallazgo adicional pin2.2.7: mensajes almacenados existen en HTTP público, no en
  `ctx.session.message` del plugin. Launcher entrega su propia conexión por pipe
  fd3 sólo RAM; sin auth file, secreto nuevo heredable en env, daemon ajeno, core
  import, SQL o export. API raw no se devuelve al modelo ni se persiste; DTO mínimo
  al cálculo puro extraído por owner con allowlists/SHA, sin CLI/SQLite V1.
- Tool distinta del MCP/lifecycle. Master-dev/agent-design/code-inspector/build;
  permisos read/capture ask y directorios externos autorizados. No shell/Edit general
  al inspector. Capturas sólo store fijo schema3 separado,0700/0600, owner/measurement,
  no links/drift/import legacy; publicación atómica inmutable/no-clobber.
- Familia parentID, rangos exactos/clip hijos, operador fuera y recheck de metadata/
  uso/modelos/descendencia tras leer y tras autorización. Fork/revert activo rechazado;
  compaction completada y asistentes previos contados una vez. No acredita trabajo
  borrado/externo/no enlazado, ni cambia el guard general completeHistory:false (D06).
- Owner14 Node OK,57 Python:56 OK/1 skip. Host oficial con mock:354 con/236 sin,
  reporte negativo verdadero; compaction almacenada479, fork sin doble cuenta,
  revert/deny rechazados, hijo/rango118 y history observacional. Capturas previas
  congeladas tras cambios.33 requests mock explícitos,0 inferencias ocultas/reales.
  Store/paginación/permisos/transporte sin cuerpos/secretos y extracción pura probados.
- General66 Node+3 Python y smokes29 base/41 composición OK; debug config oficial
  aislado sin MCP y auditor del host. Plan actual32 comandos/219 assets,22 roles/
  33 skills/7 registries/5 MCP, not-prepared/not-distributed,0 writes/host reales.
  V1/workshop/stores/índices originales intactos, sin retest humano ni aplicación.
- D02 recuperado en candidato, **no aceptación real ni paso2 cerrado**. Siguen
  Documents D03, Notifier D04, atribución D06 y ventana autorizada de preparación/
  instalación/verificación. Luego AUNE/once overlays/historial/backup/corte.
  Contrato owner: v2/TELEMETRY-DESIGN.md; no pedir autorización otra vez para la
  decisión de proyección/métrica ya delegada, ni lanzar A/B reales por reflejo.

### Documents: entradas nativas y ODT derivado; D03 sigue parcial

- Diagnóstico: V1 publicar-documento/crear-diagrama usan QMD/Quarto y wrappers D2/
  Typst, pero el owner exige DocumentSpec y Documenter sin shell. Copiar esos
  ejecutores como tools eludiría la frontera; no se hizo ni se aprobó retirar el
  workflow. Entradas ahora enrutan a Documenter por API nativa, contratos completos
  de spec/formatos/QA y límites explícitos, sin reinterpretar fuentes legacy exactas.
- Nueva tool document-editable sólo documenter/artifact-renderer, escritura ask.
  Desde DOCX de finales y spec validado, LibreOffice local produce ODT compañero,
  PDF de QA y todas sus PNG; no sustituye PDF canónico o fuente. Checks de hashes,
  rutas, Office ZIP, macros/embeddings/recursos externos/campos activos; perfil
  temporal seguro, entorno sin secretos heredados, runtime/helper por SHA, sin
  instalación/descarga. No sandbox OS/red o correspondencia semántica DOCX/spec.
- Salidas fijas en artifact-studio/artifacts/output y previews,0700/0600, nombre
  nuevo, locks propios/no reemplazo/adopción. Recheck tras autorización; fallos
  normales limpian staging propio. Crash puede dejar lock/conjunto incompleto;
  requiere reconciliación, no transacción global/auto-cleanup. Reporte siempre QA
  independiente pendiente. Shell/edición general/remoto no se amplían.
- Owner8 Node y37 Python OK; oficial2.2.7 con conversión Office real pública,
  rutas slash, rechazo interactivo/deny/actor/overwrite, fuentes inmutables.12
  requests mock explícitos,0 proveedor/servicio remoto real. Cuatro PNG finales
  inspeccionadas directamente; salto redundante corregido en spec. No QA
  independiente o entrega de usuario aprobada, ni retest humano del workshop.
- General66 Node+3 Python,41 casos compuestos y catálogo legacy Documenter OK.
  Debug config oficial aislado, cinco MCP fixture,22 roles/33 skills/34 comandos/
  7 registros. Plan/release/status actuales223 assets,not-prepared/not-distributed,
  0 writes/host reales. Perfil instalado/workshop/V1 y runtimes no cambiados.
- **No cerrar D03 por recuperar nombres y ODT.** Faltan QMD/Quarto/style.typ/
  reference.odt y fuentes/perfiles D2/Typst legacy exactos, Confluence escritor y
  Gamma; no excluidos ni habilitados. Siguiente: resolver esas rutas sin shell
  oculto y coordinación Documents↔Ticketing con grants mínimos/lecturas frescas/
  confirmación; no pruebas de publicación real por reflejo. Contrato owner
  v2/compatibility/README.md. D04/D06 y gates AUNE/proyectos/datos/corte siguen aparte.

### Frontera legacy QMD verificada (diagnóstico previo a la decisión posterior)

- Lectura del wrapper V1 confirma quarto render en cwd del fuente, intermedios
  in-place y opciones del documento/proyecto; no copiarlo como tool confinada.
  AGENTS Documents exige DocumentSpec y no ejecutar comandos del contenido.
- Control negativo nuevo contra Quarto1.10.18: --no-execute no bloquea un filtro
  Lua seleccionado explícitamente. Texto sintético, filtro de prueba sólo aborta,
  sin comandos en el QMD, PDF/Office/modelo/MCP/publicación remota o datos reales.
  Una prueba OK; no se repitieron aprobaciones humanas ni renders del workshop.
- Recomendación pendiente: workflow local **separado del coordinador master-dev**
  para QMD estático confiable, tool/permiso acotados y excepción específica al
  contrato DocumentSpec sólo para esa ruta. Documenter mantiene todas sus guardas;
  no se autorizan celdas/hooks/filtros del contenido, shell general, imports libres,
  plantilla activa arbitraria, descargas o servicios. Soporte QMD activo requeriría
  otra decisión/frontera. No es exclusión aprobada ni una nueva tool ya habilitada.
- Antes de implementar ese cambio de contrato se pide confirmación puntual. Diseño
  owner v2/compatibility/LEGACY-CONTRACT.md. Candidato34 comandos/223 assets y
  permisos sin cambios por este análisis; D03/D04/D06 y pasos reales siguen abiertos.

### Excepción QMD aprobada/corregida e implementada para Documenter

- El usuario señaló que la tool sólo de master-dev no sería utilizable por
  Documenter. Se corrigió y aprobó **document-qmd sólo Documenter**, no coordinador
  técnico ni especialista por herencia. DocumentSpec sigue default; excepción local
  AGENTS Documents para preservar QMD estático canónico, sin código del contenido,
  shell general, nueva delegación o publicación remota. No volver a pedir esa decisión.
- Dos perfiles completos trabajo-practico/informe-profesional, header cerrado con
  labels editables, style/filtro/reference/runtime pinneados. Fuentes/assets se
  conservan byte a byte, hashes antes/después de aprobación y archive, no se
  convierten a DocumentSpec. Assets locales explícitos/AST permitido; desconocidos
  fallan, no se descartan para pasar. El ODT directo QMD no es el derivado de DOCX.
- Bubblewrap existente **obligatorio**, namespaces FS/PID/IPC/red/user y capacidades
  retiradas. HOME/XDG/tmp/staging propios, sin proyecto/metadata/hooks/home originales
  ni red del host; sólo /usr/runtime/fontconfig públicos read-only y scratch propio.
  /etc mínimo sintético, link which público y registry Office empaquetado verificado,
  no override machine-local. Sin instalación/descarga o fallback V1/no aislado.
  No es VM, firma de todas las dependencias OS, defensa universal de DoS o procesos
  confiables del mismo UID que alteren archivos del host.
- Permiso document-qmd-publish ask, actor fijo incluso con session allow; lock por
  nombre/inode, destinos nuevos, Linux renameat2 NOREPLACE evita reemplazar hasta un
  destino vacío aparecido durante la espera. No transacción de conjunto: crash
  puede dejar staging/lock/incompleto y requiere reconciliación, no auto-cleanup.
- Owner10 Node/45 Python OK,8 Python QMD nuevos. Host2.2.7 actor/deny/reject/recheck/
  filtros no aprobados/overwrite y fuente inmutable;14 requests mock explícitos,
  0 modelo real/inferencia oculta. Quarto1.10.18/Pandoc3.10 reales: dos PDF canónicos,
  DOCX/ODT de trabajo-practico y previews completos (2 páginas por formato).8 PNG
  inspeccionadas directamente; no QA independiente o documento de usuario aprobado.
  Índice DOCX puede necesitar refresco de campos; ODT requiere fecha explícita si
  no se quiere literal today, se corrigió en la fixture fuente, no en el editable.
- FS/red probados con marcador fuera de scratch y listener loopback propios, sin
  tocar servicios. General66 Node+3 Python/41 composición y catálogo legacy OK;
  debug config oficial aislado,22 roles/33 skills/34 comandos/7 registros/5 MCP.
  Plan/release/status actual225 assets,not-prepared/not-distributed,0 writes/host.
  No cambios al runtime instalado, perfiles/workshop/stores, retest humano o corte.
- D03 sigue parcial: QMD activo/arbitrario, templates/perfiles D2/Typst libres y
  Confluence/Gamma pendientes, no excluidos ni habilitados. Siguiente contrato
  Documents↔Ticketing remoto, luego D04/D06 y gates reales. Detalle owner
  v2/compatibility/LEGACY-CONTRACT.md, ahora contrato implementado, no propuesta vieja.

### Confluence: sonda de contrato preparada; escritores siguen bloqueados

- V1 declara dos lecturas y create/update Confluence para Documenter. La documentación
  oficial confirma contenido de muchos tipos y replacement/edits, pero no da en esa
  guía los parámetros ni contrato de versión/cuerpo completo. Assets locales sólo
  contienen nombres/prompts. No inventar un esquema de input/output y certificarlo
  con su propio mock; el adaptador writer sigue pendiente, no habilitado.
- Helper operador Documents v2/confluence/catalog.mjs plan/capture y selector
  metadata-only Ticketing selected-server.mjs implementados. No nuevo comando/tool
  del candidato, cambio de scopes/ACL/rol, Docs writer, endpoint REST o bypass SDK.
  Capture requiere candidate-only/client-closed/reuse-v2-storage exactos y ventana
  V2 del operador; esa ejecución real **todavía no se hizo**.
- Perfil/host/config/HOME/cache/tmp propios; sólo comparte data/state del piloto
  nativo2.2.7 opt-in, sin auth copiada/DB V1. Preflight offline de capas antes de
  store; sólo MCP Rovo seleccionado, todas sus tools/call y provider inference deny.
  Comando nativo agent-design+nonce lee ctx.tool.list, exporta cuatro input/output
  schemas estructurales, sin ejecutar ni getAccessible/getContent o leer páginas.
- Omite descripciones/defaults/ejemplos/valores no revisados; outputSchema ausente,
  codec/desconocido/omisiones se marcan incompletos. writerCompatibilityProven:false
  siempre, no inferir concurrencia/semántica por metadata. JSON0600 bajo /tmp/opencode;
  source native startup puede hacer locks/refresh/metadata/sesión propia, no es
  read-only físico/backup ni detector de cierre de otros clientes. Limpia sólo su
  sesión/host/lease/perfil; crash/cleanup fallido requiere reconciliar, no reintento
  automático o borrar sesiones ajenas. No nuevo login o consentimiento por fallback.
- 4 tests nuevos Documents OK con MCP/schema/storage V2 sintéticos y oficial2.2.7:
  datos previos preservados, sólo sesión original queda,0 tools/call/modelo, contrato
  nativo leído y archivo0600; flags previas a selectores y omisiones verificadas.
  Connected puede adelantarse al registro: espera de5s de catálogo en RAM cubre
  carrera observada con reuse. Ticketing10 Node+4 Python específicos OK (2 nuevos
  Node selector). Hito QMD anterior10 Node/45 Python y general66+3/41 no repetidos.
- Plan real de la sonda OK,0 writes/host. General34 comandos/225 assets sin preparar/
  distribuir; los helpers nuevos no se instalaron ni arrancaron backend real.
  Paso siguiente: captura de metadata real por operador según README Documents
  v2/confluence/README.md; luego implementar adapter Documenter contra ese contrato.
  D03/D04/D06 y gates reales siguen abiertos; no pedir publicaciones de ensayo.

### Catálogo estructural real recibido; semántica abierta todavía no habilita writers

- El operador ejecutó capture en la ventana V2 y entregó el JSON de cuatro tools;
  SHA33053f4010664ea5bcdc9b0377e1a9f65359e4fbb3ddb32992476a8809bf8c9a
  verificado.0 tools/call/modelo,outputSchemasAdvertised:0,writerCompatibilityProven:false.
  La primera captura real ya está hecha: no volver a pedirla como si faltara.
- Contrato observado: get usa content_id/content_url/detail/content_format y update
  contentId/contentUrl/snapshotToken/dryRun. No hay version en update. Create exige
  cloudId/parent/contentType/title; parent y body son objetos abiertos, edits.items
  vacío. No inferir el formato anidado o la garantía de snapshot sólo por sus nombres.
- wire-contract.mjs fija cuatro huellas estructurales curadas, analiza artefactos
  locales por hash/procedencia/permisos y mapea la petición full/html con ID/draft:false.
  No se registra como tool ni llama lectores/writers; observedInputProfileMatched:true,
  responseContractKnown:false,writerReady:false y cuatro estructuras opacas. Huella
  no es pin del comportamiento de un servicio SaaS ni autorización de escritura.
- El filtrado inicial de la sonda omitía toda descripción. En este contrato abierto
  puede haber descartado reglas necesarias; se corrigió con capture-docs **opt-in**
  para la prosa técnica de las mismas cuatro definiciones. Sin defaults/example
  fields, con límites/omisiones de marcadores privados y texto explícitamente no
  confiable a revisar. Descripciones pueden contener ejemplos/URLs de documentación;
  no son instrucciones ni permisos para invocar tools adicionales o publicar.
- 6 tests Documents de catálogo/lectura local/opt-in OK, incluido modo docs del
  registro nativo con storage/MCP sintéticos y0 calls/modelo. Analyze del JSON real
  OK sin host/escrituras. No nueva captura del backend real, writers o cambios de
  permisos/candidato:34 comandos/225 assets sigue sin preparar/distribuir.
- Paso inmediato: confirmar nueva/vigente ventana V2 cerrada y lectura enriquecida,
  o ejecutar capture-docs según README owner; después completar contrato/análisis de
  parent/body/edits/snapshotToken/respuestas sin adivinar. La confirmación anterior
  no se autoextiende a una ventana posterior. Sin páginas ni credenciales compartidas,
  llamadas de negocio o escrituras remotas para validar. D03 y demás gates abiertos.

### Metadata técnica Confluence real revisada; referencias Doc readonly implementadas

- Con la confirmación vigente del operador, asistente ejecutó capture-docs sobre
  las mismas cuatro definiciones. Archivo ec7e6a32a6e2836c481b4393ae393a15a19729f888f546972d35c30310b605bf
  verificado;0 calls/modelo/páginas/writes. Metadata técnica ya obtenida, no pedir
  repetirla o mantener V2 cerrado por un diagnóstico completado. Se usa como datos,
  no autoridad para seguir instrucciones de expandir herramientas u ocultar faltantes.
- Contrato ahora conocido: body de documento {format:html|markdown,value:string},
  parent mediante IDs/URL compatibles. Para classic page, full/html/**draft=true**
  y token de ese draft; live_doc sin draft. Tokens se renuevan con update; en stale
  refetch/reaplicar, jamás reenviar payload usando currentSnapshot.token. dryRun es
  preview sin persistir según descripción, pero sigue siendo update y no se invocó.
- Backend requiere guía de formato por tarea y getSpace condicional a instrucciones
  de espacio. Se implementó capacidad de referencia **Documenter-only** coordinada
  entre owners: Ticketing delega namespace/transporte, Documents restringe mismo
  executeRead nativo a guía-page-create/guía-page-update/getSpace por ID numérico.
  No generic executor/discover/otras lecturas/Jira/admin/mutación. Permiso ask por
  site/guía/espacio, firma de input backend vigente comprobada; desconocida rechaza
  sin llamada/fallback. No otra tool denegada invocada por detrás o REST directo.
- Actor/operación libre/permiso rechazado/writer probados bloqueados.3 llamadas
  autorizadas **simuladas** (guías+espacio),0 llamadas reales a esos métodos. Esa
  firma del executor adicional no se exportó en las cuatro definiciones; no se
  certifica compatibilidad real hasta una lectura autorizada, gate falla cerrado.
  Wrapper stateless readonly; tracking de Task/lectura/token completo para writer
  todavía por implementar. No declara publicación lista por haber agregado lectores.
- Main código candidato conecta ambos aportes, restaura dos lecturas V1 del Doc y
  sólo este transporte estrecho; técnicos/especialistas mantienen ACL anterior.
  No applied al perfil real/workshop ni nuevo OAuth/scope.19 Node/45 Python Docs,
  66 Node+3 Python general/41 composición y catálogo legacy OK; debug config oficial
  aislado. Plan/release226 assets,34 comandos/22 roles/33 skills/7 registros/5 MCP,
  not-prepared/not-distributed0 writes/host del plan. No cierre D03 ni corte.
- Siguiente: writer con padre explícito, testigos guía/space/base completa, token
  draft correcto, preparación/confirmación/recheck y respuesta segura, sólo frente
  a firmas soportadas; probar en mocks sin publicar páginas reales. Respuestas
  backend aún no tipadas y firma real de referencias no ensayada; mantener sus
  límites explícitos y fallar ante desconocidos. D03/D04/D06/datos/capas reales abiertos.

### Corrección de paridad V1 — estado actual (2026-11-17)

Comparación con scripts/comandos/roles originales, no nuevo diseño:

- Benchmark: V1 atomic_write_json reemplaza la misma identidad. Capture V2 ahora
  también lo hace atómicamente; permite corregir outcome/utilidad/correcciones sin
  duplicar corrida. Report no recaptura ni cambia un registro por sí solo. Retirado
  el no-clobber añadido, preservada medición V2 explícita y privacidad.
- Documenter: restaurado edit:allow de V1 y retirado el guard exclusivo de
  artifact-studio/. Shell deny y límites especialistas/memoria siguen. Las tools
  generales recuperan destinos del proyecto/defaults artifacts/output y previews;
  límites históricos del workshop sólo en ese modo, no en la base general.
- publicar-documento/crear-diagrama: comandos originales **sin agent forzado** y
  scripts publish_document.py/render_diagram.py/render_infographic.py copiados
  byte a byte. Sólo referencias config/HOME/flags de runtime adaptadas al perfil
  aislado. Prueba real local de QMD/estilo propios A5, PDF/DOCX/ODT y previews,
  actualización de misma entrega, perfil D2 y Typst propio. No prueba de fidelidad
  Office ni QA independiente del resultado. No nuevas restricciones de plantilla,
  header estático, nombre nuevo o Bubblewrap como requisitos del harness original.
- document-qmd/document-editable quedan sólo opt-in para tests históricos, fuera
  de la composición general; sus pruebas no son capacidades activadas del harness.
- Confluence: restauradas las dos tools nativas createConfluenceContent y
  updateConfluenceContent sólo Doc con **ask** como V1. Los técnicos permanecen
  readonly. Sin nuevo writer, protocolo prepare/commit o parser de output inventado.
  Guardrails originales de página/padre explícito/base fresca/contenido ajeno/
  confirmación conservados como instrucciones y permisos, no fingir enforcement
  estructural de tipos por el cliente. La API exige guía/espacio/draft/snapshotToken;
  el executor auxiliar sigue restringido a esas lecturas, con read:allow V1, sitio
  UUID/hostname/URL y espacio ID/key (se retiraron ask/ID-only añadidos).
- Dos capturas Confluence reales ya hechas; no repetir ni pedir mantener V2 cerrado.
  Native writer ask/allow/reject/otro actor y payload intacto probados en mock.
  Ninguna guía/espacio/página/publicación real adicional ni OAuth/scope cambiado;
  firma real executor aún no ensayada, no certificar publicación por ese fixture.
- Verificación actual:66 Node+3 Python general,21 Node+45 Python Documents,
  14 Node+57 Python CodeGraph(56 OK/1 skip),10 Node+4 Python específicos Ticketing;
  41 casos de composición y catálogo legacy Documenter OK. Incluye debug config
  oficial en perfiles temporales, sin datos originales. Prototipos dentro del total
  Documents son regresiones históricas, no justificación de su uso por defecto.
- release-plan/status:225 assets,34 comandos,22 roles/33 skills/7 registros/5 MCP;
  **not-prepared/not-distributed**. El check del destino real se negó por falta de
  prepare, como corresponde; no es un check exitoso de candidato instalado. No se
  preparó/instaló para pasar el check. V1/workshop/config global/stores intactos.

Este incremento no cierra paso2 ni D03/D04/D06/capas/historial. Siguiente: continuar
comparación V1 y portar faltantes reales, no diseñar aprobaciones/hardening nuevo,
ni reducir el harness a lo diario. Contratos vigentes en COMPOSED.md y READMEs owners.

### Notifier avanzado — paridad de fuente recuperada (2026-11-17)

- Faltantes V1 confirmados en fuente: notify.json/defaults/horarios silenciosos,
  hints de sonido/urgencias, título y foco GNOME/D-Bus/X11/AT-SPI; pregunta textual
  final y atención de permisos de hijas al root. El piloto básico los había omitido.
- Owner Notifier adapta su sección OS original en build-time, quita tipos y wiring
  SDK/eventos V1, emite módulo JS dentro del bundle. No segunda implementación de
  quiet hours/focus, nuevas preferencias/ceremonias/permisos de modelo o helpers OS.
  Build usa stripTypeScriptTypes del Node22.23.2 existente (aviso experimental),
  runtime JS sin checkout/SDK antiguo/transpiler adicional. Fuente V1 sin cambios.
- Selector pasa ruta de notify.json existente, se relee por evento; no se copia ni
  congela como asset. Ausente/malformado → defaults V1. Título de sesión al escritorio
  como V1 (ya no fijo del piloto); no cuerpo de mensaje/pregunta/error. Linux normal/
  critical y sound-name originales, no suppress-sound forzado. Emisor/sound V2 nativo
  siguen apagados para evitar duplicados. Workshop mantiene su modo básico aprobado.
- Click best-effort original con ID/token/acción correspondientes, wmctrl→xdotool
  en X11 y tab AT-SPI; helpers ausentes → notificación simple, sin instalar. Metadata
  GNOME/terminal del launcher preservada; procesos desktop sin credenciales/preloads,
  timeout45s/cleanup sólo de procesos/timers propios. No cierre de terminales ajenas,
  No molestar, permisos de modelo o ajustes OS nuevos. Backends macOS/Windows se
  preservan/probaron con mocks, no certificación de distribución en esos OS.
- Controlador TUI público2.2.7 conserva formularios/permisos y recupera heurística
  de último assistant type/content/text con ?/¿, dedupe y atención de hijas al root
  dentro de la frontera de launch. No fin independiente de hijas/otros directorios.
-18 tests owner OK;66 Node+3 Python general/41 composición OK, debug config oficial
  temporal incluido.2 PTY oficiales con bundle generado/config real sintética y
  transporte final simulado: pregunta respondida, permiso rechazado sin revelar
  contenido;0 OS/audio/OSC nativos/modelos o servicios reales. Unit mocks verifican
  config reload/overnight/end exclusivo/sonido/título/token propio-ajeno/buffering/
  una activación/wmctrl/xdotool/AT-SPI/fallback/cleanup. No aceptación humana avanzada.
- Plan/release/status actual **226 assets**,34 comandos/22 roles/33 skills/7
  registros/5 MCP,not-prepared/not-distributed0 writes/host. El asset adicional es
  sólo backend JS del owner. No instalación/global/workshop/stores/notify.json,
  avisos de escritorio/audio reales, commit/push/corte o cambio a aplicación.

Continúa paso2: atribución D06 y comparación de bindings/capacidades restantes;
después AUNE/proyectos, historia rica/backup/restore/corte autorizado. No reducir
alcance ni pedir repetir la entrega básica de notificaciones por este incremento.

### D06 — atribución almacenada recuperada, distinta de migrar historial (2026-11-17)

- Comparación: V1 agent-identity consulta client.session.messages; V2 sólo
  session.context, lo que pierde atribución pre-compaction. General ahora selecciona
  history:stored en la misma tool/input vacío/permiso, sin nuevo actor/ask. Workshop
  sin opción conserva modo histórico visible/completeHistory:false.
- API pública paginada de la sesión actual, orden ascendente hasta agotar páginas;
  metadata de cada mensaje, no agente/modelo actual. Proyección inmediata en RAM
  a índice/tipo/agente/modelo/variante; sin cuerpos/razonamiento/tools/títulos/
  adjuntos/resumen al modelo/archivos. Unknowns como V1, no atribuciones inferidas.
- completeHistory:true sólo para filas almacenadas enumeradas de esa sesión; no
  transacción atómica, familia/externo/borrado, respaldo íntegro o migración V1. Error,
  cancelación/duplicado/cursor repetido no devuelven parcial como total ni contexto
  como fallback. D01 intacto al desplegar sigue obligatorio y **no certificado**.
- Transporte HTTP existente de benchmark pasa a base v2/native-history.mjs, owner
  CodeGraph conserva shim; base no depende del addon. El cargador pin duplica estado
  importado por plugin: primer ensayo falló al releer fd3 cerrado. Corregido con una
  función HTTP GET acotada compartida en RAM, auth privada en closure, no descriptor
  secreto global/RPC/tool nuevo. Same owned PID/loopback/pipe/timeout/errores opacos;
  no nuevo secreto en archivo/argv/env ni daemon/DB ajenos. No sandbox contra plugins
  confiables del proceso/UID. Requiere launcher existente, sin login/fallback nuevo.
-6 pruebas nuevas (4 unit/2 oficiales) OK: paginación2 filas, cambio master-dev→planner,
  compaction elimina mensaje del contexto pero no atribución almacenada, fork con
  atribución copiada, permiso deny, sin cuerpos, benchmark en ambos órdenes.10 calls
  mock explícitas por caso,0 modelo/datos originales. Test transporte fuerza además
  clon de módulo y verifica API opaca, no credenciales expuestas o redirects.
-72 Node+3 Python general,14 Node+57 Python CodeGraph(56 OK/1 skip),100 regresiones
  migración/41 composición/11 workshop OK. Debug config oficial aislado cubierto;
  plan/release/status actual227 assets,34 comandos/22 roles/33 skills/7 registros/
  5 MCP,not-prepared/not-distributed0 writes/host. No instalación/global/workshop/
  DB real/import de historial, índices reales, commit/push/corte. Contrato en
  [../../v2/general/ATTRIBUTION.md](../../v2/general/ATTRIBUTION.md).

Sigue la comparación restante/bindings y capas reales, y preparar/validar la
migración rica D01 sobre fixtures y copia autorizada; no sustituirla por texto o
backup ni abrir la DB original con V2. Estos tests no cierran el paso2/corte.

### Incremento histórico retirado — reintroducción Stitch no aprobada

**No vigente:** el usuario corrigió esta interpretación. Stitch fue retirado; no
seguir la propuesta de8 aportes/6 MCP ni pedir de nuevo la ventana ya autorizada
y ejecutada. Cierre vigente en la sección siguiente/PASO2-CIERRE.md.

- Contraste con fuentes V1 consolidado en PASO2-CIERRE.md. Ocho aportes, seis MCP
  (Stitch antes omitido), mismos22 roles/33 skills/34 comandos/7 registros;229 assets.
  Privados/AUNE/proyectos permanecen en sus owners/pasos3/4, no exclusiones finales.
- Stitch conserva estado/namespace/timeout5min y key file-ref nativo V1, sólo UI
  designer; sin lista estática/ask nuevos ni clave leída/copiada por plan. Modelo/
  release no reciben valores; sólo MCP loopback con key sintética en tests. Install/
  update/rollback con8 aportes/6 MCP y schema oficial probados en temporales. Startup
  respeta plazos startup/catalog explícitos, no corta a45s una conexión dentro del
  contrato. Google/generación reales no usados.
- Libpq: retirado rechazo PGPASSWORD añadido por V2, restaurados PGSSL*/Kerberos del
  helper V1. Credenciales existentes sólo en servidor propio y helper literal
  psql-readonly, no config/argv/TUI/shell genérica/modelo. psql falso confirma SQL
  READ ONLY y auth sintética, permisos wrapper originales aprobados sólo en fixture;
  cero DB reales. Sin leer/sourcear envs o cuentas reales.
- Confluence desconocido ya fallaba al ejecutar; ahora el transporte incompatible
  se retira del catálogo y el auditor existente reporta managed-tool-missing. No
  readiness falsa, nuevo protocolo o política; writes V1 conservados. Firma real
  de referencias pendiente de metadata nativa, no publicación de ensayo.
-78 Node+3 Python general,100 regresiones migración,29 base/41 composición;
  Documents21 Node/45 Python (10 Confluence reejecutados tras cambio),CodeGraph14
  Node/57 Python(56 OK/1 skip),Ticketing10 Node/4 Python,Notifier18 Node,Knowledge7
  Node/8 Python OK.7 Python Playwright y7 calls headless reales en copia temporal
  pública/integridad OK. Sin descargas/perfiles/caches originales/modelos reales.
- Status real: candidato not-prepared/not-distributed, runtime durable not-prepared.
  Corregido el status ausente que informaba unowned/incomplete de forma ambigua;
  sigue rechazando árboles existentes sin owner/drift, sin adoptarlos o crearlos.
  No install/prepare real, V1/global/workshop/datos/credenciales intactos.

**Bloqueo operativo del paso2:** confirmar cierre vigente de clientes V2 y autorizar
preparación del runtime público/candidato y verify-live neutral con reuse opcional
explícito de data/state del piloto para auth existente. Sólo startup/catálogos/
registro/metadata, sin modelo, tools de negocio, publicaciones o migración de sesiones.
SDK puede locks/refresh/sesión diagnóstica propios; no es cero escrituras ni backup.
No presumir cierre por pedido genérico ni matar clientes. Resolver incompatibilidad
real que aparezca antes de declarar el paso cerrado. D01 íntegro sigue obligatorio
antes de producción, no certificado por estos tests y separado del port general.
No repetir pilotos aprobados por ritual.

### Cierre técnico paso2 autorizado — sin Stitch y verificación real OK

- Usuario reiteró exclusión Stitch y autorizó el resto de la ventana.7 aportes,
  5 MCP/22 roles/33 skills propias/34 comandos/7 registros/227 assets. Sin selector,
  módulo/plugin/MCP/key/allow Stitch; recomendaciones retiradas y skill adaptada a
  playwright-ui-opencode sólo en V2. Background y Stitch excluidos, V1 intacto.
- Runtime durable preparado offline,546 entradas/404912446 bytes/Chromium1217,
  sin descargas/perfiles/cambios caches originales. Instalación y actualización
  versionadas sólo del candidato, no global/workshop/binario V1.
- Primer verify-live:5 MCP connected pero warning managed-tool-missing executeRead.
  No se declaró listo. Metadata adicional sólo definiciones,0 tools/modelo/páginas,
  SHA e4c18fb688831bcaea6e69a8170757ab8692315bb9ea3234df769ba4317aeacf.
  Firma real agrega responseFields/view opcionales y min/max de name: matcher
  adaptado, sin exponer selectores nuevos ni cambiar los3 métodos/permisos acotados.
- Revisión994baceb28080a8e11e02db5231022b908e65cc388eb4edd0c882a02b46fb683
  instalada; anterior50656cd883efcc226c0c89cd487de736354cbbc6c93fa5e677af974b990a1205.
  Check ready-assets sin drift; release-plan delta0. Verify-live segundo ready:true,
  readyForChat:true,auditStatus:pass,findings:[]; Rovo/CodeGraph/Context7/Engram/
  Playwright connected,proveedor conectado por metadata.36 skills totales/149 tools
  registradas, no permiso universal o validación semántica de cada método.
- Sólo data/state nativos del piloto V2 reutilizados con autorización y efectos
  normales SDK; sesión diagnóstica/recibo/host/lease propios limpiados.0 inferencias/
  tools de negocio/generaciones/publicaciones/SQL/SSH. No DB V1, auth copiada o
  migración de sesiones. No repetir esta ventana por ritual.
-75 Node+3 Python general,100 migración/41 composición,22 Node+45 Python Documents,
  14 Node+57 Python CodeGraph(56 OK/1 skip) OK; validación nativa oficial incluida.
  Audio/foco Notifier y guías/espacios/publicación Confluence reales no invocados:
  aceptación previa/fixtures/compatibilidad de metadata no son esas pruebas.

Siguiente paso3 AUNE/owners privados, luego11 overlays con cadena efectiva, D01
historial íntegro/backup/restore, salida ownership Background y corte autorizado.
Paso2 técnico verificado no es producción ni prueba de migración de datos.

## 3. PENDIENTES — no confundir «no portado» con exclusión autorizada

| ID | Asunto | Estado vigente / siguiente evidencia necesaria |
|---|---|---|
| D01 / backup-restore y recuperación nativa aprobados en ensayo | Historial en actualización estándar | Backup online/integridad/restore aprobados. Primer fallo por timeout del verificador conservado; una continuación oficial2.2.7 sobre el mismo trial aislado completó.1402 sesiones listadas/fechas/títulos/parentesco iguales; cinco conversaciones/tools/compaction comprobados por API y complemento SQLite read-only para178 textos user/cinco inline. Sin otro host, conversor o igualdad1:1 añadida. Externos no recuperados; no validación exhaustiva de cada campo/adjunto, UI/auth/inferencia o corte. Ver HISTORIAL-INTEGRO.md. Copias separadas/protegidas; V1 posterior no sincronizado, corte sólo con cierre de escrituras/respaldo final y gates pendientes |
| D02 / implementado en candidato | CodeGraph benchmark | Lifecycle4+history/capture/report nativos probados. Proyección en RAM y total derivado exclusivo versionado, reported_total n/a; API HTTP pública, metadata schema3. Recaptura reemplaza misma identidad como V1; transporte compartido con D06 base. No benchmark real; sus tests no son la evidencia separada de D01 |
| D03 / implementación y metadata real verificadas | Documents legacy y publicación remota | Tres scripts/comandos V1 y destinos/edit originales probados; dos writes nativos Doc ask. Firma real executeRead capturada/adaptada y registrada, sin ampliar operaciones/permisos; mock payload probado. Guías/espacios/publicación reales no invocados, no certificarlos por metadata |
| D04 / port implementado y probado, aceptación avanzada separada | Notifier avanzado | Backend V1/preferences/quiet hours/sonido/título/click-to-focus/root routing recuperados;18 owner+66/3 general+41 composición y2 PTY oficiales simulados OK. Sin nuevo esquema/política o cambios workshop; audio/foco desktop reales no certificados por mocks ni por aprobación básica previa |
| D05 / política aprobada | Defaults y proveedores | Defaults, auxiliares, launcher, rollback y declaraciones dormidas implementados/probados. Falta uso real autorizado; no habilitar Ollama por portarlo ni confundir rollback config con datos/host |
| D06 / cobertura V1 recuperada en candidato | Atribución de historial | agent_attribution usa API pública paginada almacenada de sesión actual; metadata histórica pre-compaction/cambio de agente/fork/deny y convivencia benchmark verificadas. Mismo permiso, sin cuerpos o contexto fallback. completeHistory:true sólo filas almacenadas enumeradas, no borrado/externo/familia/snapshot atómico o migración V1. Workshop histórico visible/false preservado. No uso real instalado; recuperación D01 comprobada aparte |

Continuar el port completo sin pedir decisiones que V1 ya resolvió. Sólo una
incompatibilidad real o cambio de alcance requiere opciones y decisión del usuario;
la falta de implementación no autoriza borrar capacidades ni ampliar permisos.

## 4. EXCLUIDO / NO BLOQUEA esta revisión

- **Excluido por el usuario:** addon Background V1 y sus core patches/builds en la
  distribución V2, y Stitch por decisión explícita reiterada. Su reintroducción
  errónea se retiró. No restablecerlo ni leer/copiar su key en futuras composiciones.
  El lifecycle V1 se lee sólo para preparar salida/rollback.
  La delegación nativa del host no es reintroducir ese addon.
- No exige nuevo retest: lectura Knowledge/Ticketing, browser básico, multiformato,
  QA documental, diagramas y canvas ya confirmados, salvo cambios materiales.
- No bloquean el corte por sí solos: pulido MINOR de la muestra, inspección extra
  de cada editable/standalone PDF de ensayo, DNS de example.com, diagnóstico de
  doble apertura OAuth ya superada, o garantizar calidad universal de CodeGraph.
  Esos límites siguen explícitos; no convertirlos en aprobaciones que no existen.
- No cambiar backends Knowledge, copiar storage ni reindexar para «cerrar inventario».
- No aplicar/fusionar automáticamente overlays ni publicar mappings/config privados.

## 5. Orden recomendado de trabajo

**Autorización operativa vigente:** completar instalación predeterminada V2 sin
pedir aprobación por cada subpaso. Tras cierre confirmado de V2, los otros diez se
aplicaron y pasaron check/verify-live reales:ready/readyForChat true,6 MCP connected,
proveedor conectado por metadata,0 blocking findings/0 inferencias/negocio. Once
receipts applied, preview0 cambios/whitespace OK; padre257 assets íntegros, leases
retiradas. Snapshots habilitados y especialistas Python/TS completos. Tabla en AUNE
`v2/projects/ROLLOUT-APPLIED.md`, sin repetir fixtures/historial aprobados.

**Siguiente trabajo: terminar preparativos desde V2; cierre de V1 sólo para el corte.**
El usuario mantiene V1 abierto intencionalmente. No bloquear implementación/tests/
preparación de rollback por ese hecho ni pedir cierre al principio. La sesión V2
de control es el único ejecutor; V1 no hará otra instalación en paralelo. Pedir
cierre al llegar al cambio efectivo de runtime/plugins/storage original, con la
solución ya preparada/probada. No migrar original vivo ni afirmar que está cerrado.
Se comprobó una entrada V2 de control con perfil ANTERIOR separado del padre del
rollout: general-composed-candidate227 assets/check y verify-live real ready/audit
pass,5 MCP/proveedor conectado,22 roles/34 commands/36 skills/149 tools. No dejó
host/probe/lease activo. Ver `CORTE-FINAL.md` para comando/handoff e invariantes.
El `opencode` habitual aún es wrapper V1 en ~/.opencode/bin y esta conversación
usa su runtime; no retirarlo en caliente ni confundir autorización con corte hecho.
Storage definitivo y entrada habitual de producción necesitan su integración
explícita: no un alias que descarte flags/capacidades o pierda el transporte fd3.

1. **B00 completado:** corrección, regresiones, aplicación y reapertura real
   confirmadas. No repetir reparación o pruebas documentales.
2. **Fundación sucesora preparada:** general/privada fijadas y11 payloads archivados,
   no aplicados a productos. Verificar su integridad offline al reanudar; no volver
   a portar lo ya probado ni regenerar un padre archivado desde la fuente.
3. **Despliegue implementado/probado en fixtures:** apply/rollback/recovery y launcher
   con preflight de fuentes/drift, entradas nativas y expectativas locales. Once
   proyectos aplicados/check/verify-live readyForChat. Primer uso TUI básico Higyrus
   confirmado por operador. No quitar guardas o usar
   generalOnly:false como atajo.
4. **Historial nativo comprobado en trial:** backup/restore y única continuación
   autorizada completos; listado1402 sesiones/cinco conversaciones verificados.
   Primer fallo/parcial preservados, sin conversor/reset/otro arranque automático.
   No repetir por rutina. Ver HISTORIAL-INTEGRO.md para alcance y límites de externos,
   adjuntos y medición complementaria. Original/piloto separados; mensajes posteriores
   no sincronizados. Para corte: ventana sin escrituras/respaldo final actualizado.
5. **Validación/corte:** aplicar overlays en ventana acordada, verificar tres capas
   y arranque, luego salida ordenada de ownership V1/cambio de instalación con
   rollback preparado. No cambiar PATH ni retirar V1 antes de esa aceptación.

**Paso2 técnico cerrado en alcance candidato general preparado/arranque real**;
ver [../../v2/general/PASO2-CIERRE.md](../../v2/general/PASO2-CIERRE.md). No repetir
ventana ya ejecutada/pilotos aprobados. Fundación AUNE/privada sucesora preparada;
siguen aplicación real de proyectos y gate general→AUNE→proyecto, archivos externos/
respaldo final y corte autorizado. Recuperación nativa sobre trial ya comprobada
en su alcance; no producción. B00 cerrado.
No confundir con producción ni con validar todas las operaciones reales/semántica.

## Evidencia navegable

- `inventory.mjs` y reporte machine-local: inventario redacted, no config resuelta.
- `workshop-profile.mjs`, `workshop-guard/guard.mjs`, `staging.mjs`: restricciones
  sintéticas, writes/roles/routing y descubrimiento de proyecto/skills deshabilitado.
- `owned-upgrade.mjs`, `documents.mjs`, addon Documents `v2/documenter/composition.mjs`:
  evidencia B00 y diferencia entre composición/instalación/reapertura.
- `STACK-MANIFEST.json`, `commands/`, `planner-helpers/`,
  `scripts/session_cleanup.py`: alcance base y dependencias que no pueden copiarse a ciegas.
- `distribution/addons.json`, `COMPOSITION-MANIFEST.md`: contratos actuales **V1**,
  todavía incluyen Background; no son la distribución V2 lista para instalar.
- `SEGUNDA-PRUEBA.md`, `ALERTAS-PRUEBA.md`, `AGENT-VISIBILITY.md`: evidencia de base/TUI.
- Owners: Knowledge `v2/ASSETS-WORKSHOP.md`, Ticketing `v2/README.md`, CodeGraph
  `v2/README.md`, Notifier `v2/DESKTOP-ADAPTER.md`, Documents `v2/documenter/README.md`,
  Playwright `v2/playwright/README.md` en la base.

No se corrió `opencode debug config` contra perfiles reales durante el relevamiento.
La corrección posterior B00, los candidatos y los payloads sí se validaron con el
host oficial en sus alcances registrados. Esos tests no aplican overlays ni son la
evidencia de recuperación real: D01 tiene su ensayo separado ya comprobado. Continuar
por los pendientes concretos, sin repetir pilotos/ensayo por rutina ni reutilizar
una ventana vieja de cierre para el corte.
