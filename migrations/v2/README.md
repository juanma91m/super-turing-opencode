# V2 limpio, sin Background ni core patches

> **Estado vigente y pendientes:** [ESTADO-CORTE.md](ESTADO-CORTE.md).
> Este README conserva la cronología de los incrementos: sus estados antiguos no
> son instrucciones para repetir apply, volver a un launcher anterior o retirar
> integraciones ya aprobadas. La matriz consolida evidencia, faltantes y decisiones;
> todavía no autoriza el corte productivo.

> **Paso 1 — reapertura completado:** fix probado, repair aplicado por el operador y
> apertura normal confirmada. Ver [B00-REAPERTURA.md](B00-REAPERTURA.md); preserva inputs
> existentes y controles de config/scripts. No repetir reparación o QA documental.

> **Paso 2 en curso:** [candidato base independiente](../../v2/general/README.md)
> y [composición nativa de addons](../../v2/general/COMPOSED.md) implementados y
> probados en fixtures, incluidos auditor/propuestas y snapshot durable offline.
> Restan activación durable/defaults/storage/distribución finales y la cadena
> AUNE/proyectos real. No es reemplazo del workshop ni distribución lista.
> [Defaults y storage opt-in](../../v2/general/ACTIVATION.md): modelos auxiliares y
> binding nativo probados en temporales; diagnósticos reales sólo metadata, sin
> activar stores ni credenciales. D05 ya aprobado e implementado: auto compaction,
> snapshots, imports explícitos de skills y manual updates del pin. Status/check
> offline listos; [launcher verify-live/chat](../../v2/general/LAUNCHER.md) ya probado
> con TUI oficial/stores temporales. [Revisiones de distribución](../../v2/general/DISTRIBUTION.md)
> install/update/rollback/recovery probadas, sólo config/bundles machine-bound;
> las siete definiciones dormidas ya portadas sin uso/discovery. Restan paridad
> legacy explícita en la matriz, ventana real autorizada y corte global posterior.
> CodeGraph ya recuperó init/status/sync/reindex por tool nativa en el candidato;
> benchmark todavía pendiente. No se operaron índices reales ni se amplió shell.

## Decisión y alcance

Por pedido del usuario (2026-11-12), se descarta la migración experimental
anterior. La nueva base usa exclusivamente la distribución oficial de OpenCode
V2. No se compila OpenCode ni se conserva el patch de variantes. El comportamiento
del host es el nativo; las diferencias relevantes se documentan y se validan,
no se resuelven con modificaciones del core.

Background queda **fuera** de esta entrega: plugins server/TUI, lifecycle,
patches, proyecciones, comandos, herramientas y referencias a esas herramientas
en agentes/skills. Su implementación futura o deprecación se analiza después del
corte a V2. El lifecycle V1 existente se conserva hasta ese corte para no romper
la instalación actual ni su rollback.

El stack base coordina la migración. Cada addon conserva sus propios assets,
adaptadores, tests e instalador; los overlays mantienen el dominio local.
`distribution/addons.json` todavía describe la distribución V1, no debe usarse
para bootstrappear esta composición V2.

## Baseline oficial

Versión inicial de evaluación: `@opencode/cli@2.2.7`, publicada como `latest` al
verificar el registro. La versión se fija durante las pruebas, no se crea un fork
ni una restricción de actualización de producción.

```bash
node migrations/v2/staging.mjs prepare
node migrations/v2/staging.mjs install
node migrations/v2/staging.mjs verify
node migrations/v2/inventory.mjs
node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-env-guard.mjs
node migrations/v2/smoke-pilot.mjs
```

`staging.mjs` es tooling de migración, **no** un runtime manager productivo.
Instala el paquete oficial con npm en `~/.local/share/opencode-v2-clean/npm/`.
No cambia PATH, shell profiles, configuración activa, DB, servicios ni el runtime
gestionado actual. El entorno se construye desde una allowlist; npm no recibe
credenciales ni configuración npm del usuario. npm verifica las integridades
publicadas de los paquetes; el registro local añade el SHA-256 del ejecutable.

Config/data/state/cache/HOME/TMP son propios. El perfil inicial niega inferencia,
tools, MCP, skills y plugins externos, y desactiva updates/snapshots/warming.
Estos cierres son **del staging inicial**, no un recorte de los permisos que debe
preservar la composición final. No se copian OAuth, transcripts ni estado del
piloto descartado. No es aislamiento OS: los procesos conservan el UID del usuario.

## Cobertura obligatoria antes del despliegue

| Capa | Validación requerida |
|---|---|
| Base | Config nativa/compat soportada; guardas `.env`, shell y permisos; identidad/atribución; agentes y comandos; helpers y doctor |
| Knowledge | Engram/Qdrant, wrappers y autonomía; contrato del ID de sesión con el backend, sin asumir igualdad con OpenCode |
| Ticketing | Naming, Jira/Rovo, permisos por rol, comandos y handoff opt-in |
| CodeGraph | MCP/runtime/wrappers existentes; no inicializar ni reindexar proyectos automáticamente |
| Playwright | Navegador/MCP y permisos por rol; sin Stitch en esta composición |
| Alertas | Contrato del notifier actual vs alertas nativas; no perder silenciosamente foco, quiet hours o configuración |
| Documents | MCP/tools/helpers, skills con sus recursos, permisos y runtime documental |
| Privados | GitHub accounts local y AUNE siguen separados del bundle reusable; no copiar secretos |
| MCP global | Inventario efectivo, conexión, catálogo y permisos por rol; no inferir éxito por JSON válido |
| Overlays | Todos los proyectos del inventario machine-local, canon y target; preservar drift ajeno, permisos seguros y reglas de dominio |
| Sesiones | Backup consistente y restaurable; decidir continuidad V1 rica sin modificar la DB original ni prometer import compatible |

No basta con omitir el plugin Background: la composición V2 debe carecer de
permisos, prompts, comandos y helpers que dependan de `delegate`,
`delegation_apply`, etc. La delegación nativa requiere revisión de permisos;
su disponibilidad no autoriza escrituras paralelas implícitas.

## Selección de MCP para esta migración

Decisión explícita del operador (2026-11-12): **Stitch queda fuera de V2** por
falta de uso. Conservar el resto del inventario aplicable: Context7, Engram,
CodeGraph, Atlassian Rovo y Playwright, cada uno con validación y permisos propios.
Qdrant sigue dentro de Knowledge mediante su contrato de wrappers/servicio; no
inventar un MCP nuevo sólo para completar una lista.

Al componer V2 no registrar Stitch, copiar su clave ni conceder sus herramientas.
No eliminar por eso Playwright, los roles de UI o skills que aún aporten al resto
del flujo. Esta selección es de la migración del operador, no un recorte de la
base portable genérica. La instalación V1 no se desinstala ni se modifica como
efecto de esta decisión; el retiro efectivo corresponde al corte V2 autorizado.

Siguiente bloque: Knowledge con equivalencia funcional respecto del estado actual,
por aclaración explícita del usuario. Adaptar la integración a V2, no los backends:
preservar datos, persistencia, configuración operativa y permisos por rol. Las
pruebas de conexión/consulta/escritura/sesión son incrementales, no recortes del
funcionamiento final. No copiar bases, crear colecciones ni reindexar como setup.

Orden acordado: **Knowledge → Ticketing → CodeGraph → Playwright → resto**.
La auditoría inicial de Knowledge está documentada por su owner en
`super-turing-opencode-knowledge/v2/READ-ONLY-AUDIT.md`. Los efectos normales de
arranque de Engram/Qdrant no son un bloqueo ni un motivo para cambiar Knowledge.
Se descarta la propuesta de un candidato Engram con modo lector adicional.
El primer port nativo del addon (`v2/ENGRAM-ADAPTER.md` en Knowledge) ya probó
trece casos con el Engram actual sobre SQLite temporal: persistencia por rol,
summaries idempotentes/ID explícito, reader y sesión denegados, hints y catálogo.
`smoke-knowledge.mjs --engram-bin=/ruta/al/engram` ejecuta esa prueba sin datos o
proveedor reales; convive con un fixture Context7. El incremento siguiente ya
compone wrappers, autonomía y assets: 24 casos nativos con fixtures, 15 agentes,
18 skills y cinco comandos. Ver `v2/ASSETS-WORKSHOP.md` en el addon Knowledge.
`knowledge.mjs plan` verificó metadata del wiring actual sin cambiar el workshop.
La incorporación es opt-in: cerrar ese cliente y usar `knowledge.mjs apply
--client-closed`; luego `knowledge.mjs chat|verify`. La composición ya está aplicada
en el workshop del operador y su lectura Qdrant real fue confirmada. No es un instalador global:
producción V1 sigue intacta y el corte conserva sus puertas de backup/rollback.

Actualización: el operador ya ejecutó apply. Sus assets/marker quedaron aplicados,
pero el chequeo posterior falló al asumir `.data` en `/api/config`, que devuelve un
array directo. Corregido mediante `api-list.mjs`; `knowledge-inspect.mjs` se usa
tanto en el launcher como en el smoke para cubrir el mismo flujo completo. La
regresión reprodujo el TypeError antes del fix y pasó después. `knowledge.mjs
verify` ya pasó sobre el perfil real con MCP conectados y login V2 presente, sin
repetir apply. Después, las capturas del operador confirmaron status Qdrant OK y
cinco hits del corpus global existente, usando Ollama/snowflake-arctic-embed2 de
1024 dimensiones, además de doctor/search Engram. No hizo falta reindexar ni
reinstalar. Se valida el flujo de lectura probado, no todas las colecciones ni el
corte global. Delegación nativa y otras puertas de equivalencia siguen pendientes;
el siguiente addon del orden acordado es Ticketing.

Ticketing ya tiene adaptación fuente y composición aditiva sobre Knowledge,
documentadas en `super-turing-opencode-ticketing/v2/README.md`. Pasaron 21 casos
nativos con fixtures: allowlists 4/3, mutadores denegados, naming y handoff local
por broker sin credenciales. El preflight del config actual coincide con el
endpoint/request OAuth y la exposición canónicos. `ticketing.mjs plan` no aplica
ni abre Jira; la incorporación requiere cerrar el workshop y ejecutar
`ticketing.mjs apply --client-closed`, luego `ticketing.mjs chat|verify`. OAuth
real se hace explícitamente en el panel MCP nativo, sin copiar tokens V1.
El operador ya aplicó Ticketing; su intento OAuth nativo fue rechazado con
invalid_request. La captura identifica CIMD, aunque Atlassian anuncia ambos
modos (CIMD/DCR); no se concluye una causa interna definitiva del proveedor.
Se preparó `ticketing.mjs oauth-compat --client-closed`: agrega sólo redirect_uri
loopback explícito para seleccionar DCR en 2.2.7, con backup/marker y permisos,
scopes, endpoint v2 y tokens intactos. La alternativa pasó un flujo OAuth nativo
completo de PKCE/callback/token ficticio en loopback. El operador ya aplicó el modo
y confirmó client_id registrado/callback fijo, pero el login real falló igual.
No se apilan más cambios: la siguiente hipótesis fue identidad OAuth ausente,
respaldada por reportes públicos. El operador autorizó solicitar read:account/email
y se implementó `ticketing.mjs oauth-identity --client-closed`, con backup propio,
marker opt-in y callback/permisos/endpoint iguales. El operador ya lo aplicó:
captura y plan confirman read:account/email, pero volvió a fallar en Chrome y en
el navegador integrado de la app con el mismo invalid_request. Las pruebas nativas
son sintéticas, no prueba del proveedor. Se detienen reintentos y cambios por
ensayo; la doble apertura de enlaces se trata como síntoma separado y no como
causa probada. No se modifica el cliente abierto ni se cancela el intento. Ver
`super-turing-opencode-ticketing/v2/OAUTH-COMPATIBILITY.md`.
El operador precisó terminal independiente Debian y fallo después de Aceptar el
consentimiento, no al abrir el enlace. Se preparó resumen sanitizado para soporte;
políticas de dominios se revisan sólo en lectura, sin cambios admin por ensayo.

Hallazgo posterior al contraste de archivos: el SDK 1.29.0 declarado por V1 toma
scopes PRM antes que clientMetadata.scope; V2 fuerza el scope de config en auth().
El desafío real devuelve resource_metadata sin scope. La selección SDK V1 fue
reproducida sin red/credenciales en fixture. Se preparó `ticketing.mjs oauth-discovery
--client-closed`: quita sólo el override, conserva callback/ACL y deja consentimiento
al descubrimiento del proveedor (potencialmente más amplio). Pasaron 66 tests de
migración y cinco modos OAuth nativos loopback, además de los 21 casos Ticketing.
El operador ya aplicó el cambio y confirmó que el MCP funcionó. El plan posterior
confirma modo resource-metadata, sin consultar conexión ni tools: el éxito real
es evidencia del operador. Su captura posterior confirma Connected y una llamada
real getAccessibleAtlassianResources OK con un recurso. Una segunda captura
confirma search sin error (cero resultados) y getJiraIssue exitoso con ticket
autorizado. Otra captura confirma búsqueda con resultado y lectura Markdown
Confluence: prueba básica real Jira/Confluence aprobada. Primer search Confluence
falló (tabla informa DNS), el siguiente funcionó. Search Jira no probó recuperación
por clave; imágenes/adjuntos no validados. No se
rediseñaron permisos por agente (postergados por pedido), ni se tocaron V1/tokens.
El hallazgo corrige la afirmación anterior de paridad de solicitudes basada sólo
en config, pero no identifica el scope exacto exigido por Atlassian.

## Puertas de corte y rollback

Documents ya tiene aplicado su primer incremento **reader-only**: helper canónico
document-review, registro broker y skill,
reutilizando LibreOffice/Poppler existentes.15 agentes/21 skills/11 comandos, los
cinco MCP anteriores sin cambios y ningún MCP Documents nuevo. No se activan
Documenter/Artifact Studio, publicación, diagramas/canvas o Rovo escritor.
Pasaron79 tests migración,18 tests reader del addon y19 casos nativos con conversores
reales: texto, ODT dos páginas, rango PDF e imagen; texto y ambas páginas renderizadas
fueron abiertas por Read y entregadas a la entrada multimodal del modelo simulado,
y se inspeccionaron visualmente ambas previews públicas. Originales/app intactos,
escapes/denies y regresiones de los addons anteriores comprobados.
Aplicar con `documents-read.mjs apply --client-closed`, luego usar `documents-read.mjs
chat|verify`, sin volver al launcher Playwright aislado. El operador ya confirmó
desde planner helper --render, texto y ambas imágenes abiertas/revisadas con
marcadores correctos y citas de página. Lectura básica aprobada; generación/QA
siguen pendientes. Ver el README v2/reader del
addon Documents; no confundir convertir con revisar o con terminar toda la migración.

Plan/Build reaparecieron por fallback Knowledge habilitado sin conservar hidden.
Se preparó preferencia local de visibilidad, aplicada después de addons y preservada
en upgrades: sólo dos flags hidden, sin deshabilitar agentes, permisos o rutas.
84 tests migración y API nativa validan ocultamiento, permisos compilados idénticos,
`/memory-init → plan` y build explícito disponibles. Pendiente aplicar con
`documents-read.mjs hide-builtins --client-closed` y reiniciar; ver AGENT-VISIBILITY.md.

Playwright ya está aplicado al workshop por el operador, que confirmó Connected;
plan posterior informa applied. Reutiliza Chromium y MCP0.0.85, mantiene modo dinámico
headless/visible y convierte los cinco roles browser actuales a permisos nativos
por nombre. Se conserva la composición previa (15 agentes/20 skills/11 comandos),
sin Stitch. Excepción deliberada: browser_run_code_unsafe (RCE host según proveedor)
queda denegado; archivos de browser se acotan a áreas autorizadas del piloto.
Pasaron 75 tests migración, Python base180OK+1skip,24 casos nativos Playwright y
flujo real headless loopback (navegación/clic/DOM/PNG/cierre), además de regresiones
CodeGraph/Ticketing/OAuth. La navegación pública inicial del operador falló por
DNS en example.com, también reproducido mediante getent/curl en Debian con entornos
habitual/limpio, sin proxy. El reintento del operador en example.org pasó headless,
navegación pública, snapshot, evaluación DOM y cierre. DOM y GET HTTP independiente
coinciden en título Example Domain y ausencia de H1: el criterio original de
encabezado no se cumplió y era incorrecto para el HTML servido, no un fallo MCP
demostrado. Prueba operativa básica headless aprobada en ese alcance, sin cambios
de DNS/runtime. Snapshots automáticos son artefactos de runtime, no memoria/corpus.
El operador también pidió visible y confirmó ventana real/navegación/título; el
agente conserva la ventana abierta hasta confirmación de cierre en ese chat.
Uso básico headless/visible aprobado; no takeover autenticado ni sitios internos
del usuario. Usar `playwright.mjs chat|verify`.
El runtime cacheado es un tradeoff del piloto, no un installer
productivo durable nuevo. Ver `v2/playwright/README.md` en el stack base.

CodeGraph tiene preparado un incremento **query-only** sobre la composición ya
validada: reutiliza 1.5.0, sólo explore para los cinco roles canónicos, skill y
playbook (15 agentes/20 skills/11 comandos de addons). Se verificaron 71 tests
migración, 23 casos nativos CodeGraph y handshake/catalog del runtime real sin
consultar índices ni indexar. Rovo discovery/Knowledge/Context7/libnotify se
preservan. El operador ya aplicó y confirma CodeGraph Connected; el plan posterior
informa applied y conserva Rovo discovery. Usar `codegraph.mjs chat|verify`, no
recomponer con Ticketing aislado. Una captura posterior confirma skill y consulta
real con root explícito autorizado desde master-dev: ejecución OK, relevancia
parcial (script de carga en vez de entrypoint principal y relación sin corroborar
por el cuerpo devuelto). No certificar utilidad general/cobertura/frescura ni
reindexar por ese resultado; una evaluación de calidad requiere símbolo concreto.
No se habilitan
lifecycle/benchmark V2: las métricas legacy leen esquema V1 y requieren adaptación,
sin consultar la DB V1 por accidente. No es equivalencia completa ni corte global.
Ver `super-turing-opencode-codegraph/v2/README.md`.

1. Inventario completo y matriz de equivalencias/exclusiones; ninguna dependencia
   de Background, imports internos del host, core patches o builds propios.
2. Tests de plugins/helpers y `opencode debug config` de la composición global
   y de cada overlay, ejecutados con V2 aislado. Verificar reglas efectivas, no
   solamente nombres de tools o coincidencia de archivos.
3. Piloto con proveedor real y verificaciones read-only de integraciones dentro
   del alcance autorizado. Pedir intervención para autenticación o datos reales.
4. Con V1 cerrado ordenadamente: respaldo consistente de configuración,
   instalación y storage (incluyendo WAL/SHM cuando corresponda), prueba de
   restauración y plan explícito de historial. No sustituir esto por copiar una DB
   activa ni asumir que existe un backup de la adopción anterior.
5. Salir ordenadamente del `managed-local-install` de Background. Revisar su
   restore/lifecycle antes de reemplazar el ejecutable. No ejecutar el installer
   oficial sobre ese ownership todavía vigente.
6. Desplegar el paquete oficial y la composición probada; validar PATH/versión,
   configuración, credenciales, MCP y una sesión nueva. Mantener rollback
   separado de cambios de esquema de DB; no abrir storage convertido con V1.
7. Producción usa actualizaciones oficiales (`opencode upgrade` o el package
   manager elegido), no este helper. Configurar `update: notify`; validar nuevas
   versiones antes de adoptarlas. Sin core patch desaparece el rebuild propio,
   **no** la posibilidad de cambios incompatibles en APIs de plugins/MCP.

Estado: baseline oficial instalado y validado con `debug config`; **no apto aún
para producción**. Primer adaptador: `../../v2/plugins/env-guard`, con tests de
contrato, carga y bloqueo nativo de `read` comprobados. El resto de ports e
integraciones sigue pendiente.

Por pedido de avanzar incrementalmente, hay una [primera prueba mínima](./PRIMERA-PRUEBA.md)
antes de completar el resto del stack. Usa un agente y un fixture de lectura,
sin MCP, shell, ediciones, Background ni repos reales. La baseline cerrada no se
modifica; el piloto tiene config/DB/estado separados y comparte únicamente el
binario oficial. El operador confirmó login, inferencia real y lectura del
fixture el 2026-11-12 mediante captura y salida de `verify`; el primer piloto
mínimo está validado. Esto no habilita todavía el despliegue completo ni otros
agentes, repos o integraciones.

La [segunda prueba](./SEGUNDA-PRUEBA.md) incorpora los once agentes y quince
skills base, permisos controlados, broker del planner e identidad en un proyecto
sintético. Conserva config/cache/HOME propios y reutiliza únicamente data/state
del piloto V2 autenticado, sin copiar secretos. El operador confirmó con capturas
el uso real master/planner: escritura y checker válidos, y lectura/status/diff vía
broker sin escrituras del planner. No habilita MCP, delegación ni repos reales.
Los defaults nativos de teclado cambiaron en V2; el workshop ahora configura
Tab/Shift+Tab para avanzar/retroceder agentes y Ctrl+Space para completar.
El comportamiento está probado en PTY aislado y el operador confirmó Tab/Shift+Tab
en su terminal. No se modifica el host para implementar esta preferencia.

El siguiente incremento es [Context7](./CONTEXT7-PRUEBA.md): único MCP remoto oficial, dos herramientas
documentales explícitas y sin Code Mode. Conexión y consultas reales pasaron
mediante modelo simulado y luego el operador confirmó el flujo real con planner,
incluyendo resolución, consulta y fuente oficial. Se
conservan login, archivo editable, atajos y las restricciones anteriores.

Context7 quedó confirmado por el operador. El siguiente incremento son las
[alertas nativas](./ALERTAS-PRUEBA.md): notificaciones sin sonido en CLI config,
sin cargar el plugin V1. Reglas/controlador de la fuente 2.2.7 auditados con spies;
entrega real a GNOME y click-to-focus aún requieren confirmación humana. Los gaps
de notify.json/quiet hours/backend se mantienen explícitos en el addon Notifier.

La prueba humana encontró un formulario invisible por una transformación
redundante de `question` en el adaptador del workshop. Corregido sin cambiar el
host: conserva el handler nativo ya directo. El smoke completo ahora prueba
pregunta → TUI → respuesta y permiso → TUI → rechazo, con control negativo del
comportamiento anterior. Repetir question en una conversación nueva; la entrega
desktop sigue pendiente y no se infiere de esos tests.

El aviso directo de notify-send fue confirmado por el operador, pero no el
transporte nativo/OSC777. El workshop ahora carga un único adaptador cliente
libnotify propiedad del addon Notifier, y deshabilita el emisor nativo. No agrega
permisos del modelo ni cambia el core. Comando local `/alerts-test` sin inferencia;
el operador confirmó entrega de pregunta/finalización/permiso mediante capturas.
Click-to-focus, quiet hours y sonidos siguen pendientes. Ver ALERTAS-PRUEBA.md.

`inventory.mjs --overlay-root /ruta/al/workspace` incorpora los overlays de esa
máquina sin codificar sus rutas o dominio en la base portable. Registra únicamente
nombres/rutas, conteos y líneas con referencias que revisar; no imprime prompts,
credenciales, endpoints, argumentos MCP ni valores de configuración. No sigue
symlinks ni inspecciona `.env*`, auth stores o DB. Un symlink requiere revisión
posterior de ownership/recursos; su presencia no prueba que su contenido migre.
Con `--save`, guarda el reporte de metadata con modo 0600 únicamente dentro del
staging ya identificado por su marker; las rutas de la máquina no entran al repo.

El staging desactiva descubrimiento de configuración de proyecto: HOME/XDG
propios no bastan porque la búsqueda ascendente puede encontrar el `.opencode`
del home real. `verify` comprueba las fuentes devueltas por `debug config` y
rechaza cualquier fuente externa al staging. Para probar overlays se deberá
habilitar descubrimiento en un fixture controlado, verificando esas fuentes de
nuevo antes de cargar plugins o servicios.

Usar `--standalone` también para las consultas de configuración V2. En 2.2.7,
`debug config` sin ese flag no refleja igual las opciones de configuración del
servidor privado y puede listar el `.opencode` del home real. `verify` consulta
explícitamente ese servidor privado; no usar la variante directa como prueba de
aislamiento ni de configuración efectiva del proceso que se va a usar.

`plugin list` puede responder vacío mientras el plugin todavía se carga. El
smoke conserva un mismo servidor privado y espera de forma acotada el ID público;
reiniciar el servidor en cada reintento repite la carrera y no valida la carga.

## Documenter local — prueba funcional real completada

El adaptador del addon Documents incorpora siete agentes, ocho tools públicas,
PDF/PPTX/DOCX, diagramas y canvas owned-only; total 22 agentes/33 skills/18 comandos
de addons. Plan/Build ocultos y cinco MCP anteriores preservados. **El operador ya
lo probó en el workshop**. No hay publicación remota o shell legacy QMD/ODT dentro
del Documenter. El lector conserva su aprobación anterior.

```bash
node migrations/v2/documents.mjs plan
node migrations/v2/smoke-documenter.mjs --keep-artifacts
# Sólo después de cerrar el cliente workshop:
node migrations/v2/documents.mjs apply --client-closed
node migrations/v2/documents.mjs chat
```

48 casos nativos aislados pasaron con renderers/canvas/browser reales y modelo/MCP
de negocio simulados. Seis contratos runtime y 86 tests de migración OK; regresiones
reader/Playwright/CodeGraph/Ticketing/OAuth OK. El smoke distingue errores de tools
de resultados exitosos, verifica continuation del mismo child desde su padre y
rechazo de sesión ajena; ni una respuesta mock ni un receipt es QA perceptual.
Inspección de todas las 16 previews finales y tres imágenes de diagramas/canvas:
overflow inicial resuelto en el spec sintético; diferencias editoriales restantes
documentadas, sin tocar renderers. Después el operador aportó capturas del flujo
real: tres formatos/checks/previews, QA independiente de las 16 imágenes, dos ciclos
de corrección del spec y continuación del subagente. Probó Ctrl+B para pasar la
última revisión a background; `Visual-Qa finished` llegó tras el cierre provisional
del padre, que emitió entonces una respuesta actualizada. Resultado reportado:
sin MAJOR/CRITICAL, con dos MINOR de atribución/pie PPTX y blancos PDF/DOCX. No es
equivalencia completa del addon Background V1; sí evidencia real de async nativo
con entrega al padre, sin plugin/patch. Después el operador confirmó ambos diagramas
standalone SVG/PNG/PDF, receipts con specs/hashes (7/7 y 8/8), checks SVG y QA de PNG
sin hallazgos; PDF standalone no inspeccionados visualmente. Canvas completó start,
creación/edición/export editable y, tras abrir el frontend loopback manualmente,
captura sobre la escena existente, QA del PNG y stop propio (`stopped: true`);
editable no verificado ni reexportado. **Prueba funcional local acordada completada**,
sin convertirla en QA universal de formatos ni paridad V1. La evidencia real es la
aportada por capturas del operador, no otra inspección directa de archivos/servicios.
No repetir apply por esta actualización documental. Ver
`super-turing-opencode-documents/v2/documenter/README.md` para alcance y procedimiento;
`VISUAL-FINDINGS.json` describe la fixture anterior, no el spec corregido del operador.

## Fuentes

- https://opencode.ai/v2/docs/migrate-v1
- https://opencode.ai/v2/docs/build/plugins/migrate-v1
- https://opencode.ai/v2/docs/cli/config
- https://registry.npmjs.org/@opencode%2fcli/latest
