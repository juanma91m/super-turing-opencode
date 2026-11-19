# Candidato general compuesto — addons nativos, sin frontera de workshop

## Estado del incremento

Implementado y validado con host oficial **2.2.7**, candidato preparado y verify-live
real pass tras autorización. V1/global/workshop sin cambios; sólo data/state del
piloto V2 reutilizados nativamente para auth/metadata, no DB V1 o lectura cruda de
credenciales.7 aportes/5 MCP, Stitch excluido expresamente. Revisión/detalle/límites
en PASO2-CIERRE.md; startup no es inferencia/publicación o migración de historial.

El paso 2 avanza, **no es todavía distribución lista para el corte**. Runtime
durable offline y auditor/propuestas nativos están implementados y probados en
temporales. Restan su activación definitiva y defaults/auth-storage/distribución
finales. Defaults D05 aprobados e implementados; ya hay mapping de mantenimiento y binding storage opt-in probado en
fixtures; ver [ACTIVATION.md](ACTIVATION.md). AUNE y los once overlays reales conservan sus pasos propios;
su cadena efectiva es condición bloqueante antes de desplegar global.

Distribución versionada de config/bundles, update/rollback/recovery y boot archivado
ya implementados/probados, sin instalación real ni backup de stores. Ver
[DISTRIBUTION.md](DISTRIBUTION.md): contrato machine-bound, no installer V1/global.
Las siete definiciones Ollama dormidas ya están portadas al plan y conservadas en
releases, con uso/discovery desactivados; ver DORMANT-PROVIDERS.md.

### Plan actual

| Superficie | Candidato compuesto |
|---|---:|
| Agentes propios | 22, incluidos plan/build hidden |
| Skills propias | 33 |
| Comandos de archivos | 34: base9 + Knowledge5 + Ticketing6 + Documents9 + CodeGraph5 |
| Registros de helpers | 7: base4 + Knowledge/Ticketing/Documents |
| MCP definidos | 5: Context7, Engram, Rovo, CodeGraph, Playwright |
| Componentes aportantes | 7, incluidos Notifier TUI y Documents tools |

No confundir definido/registrado con conexión o aceptación humana del candidato.
Los cuatro comandos lifecycle CodeGraph ya están portados por tool nativa explícita.
Benchmark CodeGraph nativo history/capture/report ya probado en fixtures.
Las dos entradas Documents antes ausentes conservan los comandos V1 del agente
actual y tres programas originales QMD/D2/Typst, sin subconjunto estático impuesto.
Las ocho tools locales conservan sus permisos/defaults; Confluence recupera dos
writes nativos sólo Doc con ask.227 assets en revisión instalada/verify-live real pass.
Es corrección de paridad, no publicación real certificada ni cierre del harness.
Notifier avanzado portado/probado en fixtures, aceptación desktop separada;
atribución almacenada D06 recuperada/probada, migración integral D01 pendiente.
GitHub/organización/
proyectos permanecen privados; Stitch retirado por decisión explícita junto con
Background, no volver a proponerlo por lenguaje general de paridad. Paso2 técnico
validado con cinco MCP reales conectados, auditoría pass/0 hallazgos; sin modelo o
negocio. Matriz/alcance de cierre: [PASO2-CIERRE.md](PASO2-CIERRE.md).

## Contrato de contribuciones

`planGeneral` admite contribuciones explícitas identificadas (`version:1`,
`kind:general`). El coordinador `addons.mjs` selecciona los builders; cada repo
mantiene su `v2/general.mjs`, assets, reglas y adaptación. No se invoca el instalador
V1 ni se simula un plugin llamado workshop-guard para engañar adaptadores antiguos.

El aporte consume agentes nativos, documento nativo, CLI y métodos de assets del
plan; no recibe código del proyecto ni config arbitraria como baseline confiable.

- Agentes anteriores: cuerpo retenido, modo/modelo conservados y reglas anteriores
  como prefijo. Autonomía se agrega desde la fuente del owner, sin sustituir globals.
- Permisos/policies/plugins globales anteriores conservados como prefijo; un aporte
  no puede quitar guardas/defaults ni reemplazar el MCP de otro owner.
- Assets en config/bundle confinados, no colisiones ni symlinks; no copiar `.env*`
  reales u overrides `.local.*`. Los archivos del proyecto no forman parte del lote.
- Cada owner declara catálogo cerrado de tools. Namespace desconocido/mutador y
  actor no autorizado fallan incluso si una sesión/delta intenta un allow más amplio.
  Restricciones nativas más estrechas siguen mandando; los guards no conceden acceso.
- Tras componer se serializan agentes nativos y se derivan targets, roles con Edit
  denegado, reglas shell y actores por tool. Un registro no amplía autoridad solo
  por aparecer. Source de datos, percepción visual y autorización siguen separados.

La herencia **organizacional/proyecto** sigue siendo nativa: contexto de su plugin
opt-in y deltas de proyecto sin borrar `system` global. Este contrato es para
componer addons generales, no un compositor privado de prompts locales ni una
excusa para mover dominio AUNE a la base.

## Adaptación por owner

### Knowledge

- Mismo Engram seleccionado, filtro completo y efectos actuales; reader conserva
  sus cinco mutadores denegados. Plantillas fallback y autonomía del owner en
  plan/build/planner/master-dev/agent-design. No se inyecta otro proyecto por defecto.
- Wrappers canónicos copiados al perfil, no shims que despachen a helpers V1 que
  luego serían reemplazados por sí mismos. Status Engram usa implementación separada
  y `--config-dir` del perfil; aggregate status/seed mantienen sus siblings/root.
- Perfil aislado: su `knowledge_env.sh` referencia el **código de entorno existente**
  seleccionado, que a su vez carga su override en el contexto original. El modelo
  y el planner no leen/copían ese override; la preparación tampoco lo sourcea.
- Si el config final coincide con el runtime config, el plan instala el entorno
  canónico real, no un stub autorreferente. La validación legacy del dispatcher
  antiguo sigue rechazando igualdad: la excepción es sólo del plan de wrappers
  canónicos, nunca una flag que el modelo pueda activar en un binding JSON.
- Hook de entorno sólo reconoce llamadas literales aprobadas, restaura HOME/XDG/
  settings no secretos seleccionados y elimina password del host/preloads. No
  crea backends, colecciones, embeddings o semillas al componer.

### Ticketing / Context7 / CodeGraph / Playwright

- Rovo conserva discovery nativo compatible con V1/2.2.7, callback DCR revisado,
  ACL técnica de cuatro/tres lecturas y naming local; handoff por broker, opt-in.
  Confluence conserva el writer nativo V1 sólo Doc/ask cuando el owner Documents
  se compone; otros mutadores/tools desconocidos bloqueados por policy/catálogo,
  no por OAuth scopes.
- Excepción readonly coordinada Ticketing→Documents: Documenter recupera sitio/
  contenido y un executeRead **no genérico** (input/handler propios): guide-create,
  guide-update o espacio ID/key explícito, permiso document-confluence-reference-read
  allow como las lecturas V1. Sitio UUID/hostname/URL como API; no ask/ID-only nuevos.
  Sólo getContentFormatGuide(page create/update)/getConfluenceSpace; otros
  actores, operaciones y Jira/admin siguen bloqueados. Firma backend
  vigente incompatible/codec desconocido falla antes de llamar; no certificada en
  vivo aún. No alias que invoque otra tool denegada: es la misma nativa bajo Core.
- Context7 tiene módulo/policy público propio compartido con el workshop; no toma
  la última entrada de plugins como boundary. Conserva límites de query y protección
  private. La selección de esta máquina es el comando local stock V1; el candidato
  usa el remoto público ya aprobado en V2, sin npx/download ni copiar credenciales.
  Sólo se acepta esa forma stock o el remoto canónico; headers/argv no revisados
   se rechazan con metadata de nombres, nunca valores.
- Stitch queda fuera de V2 por decisión explícita, sin MCP/plugin/key/allow o
  recomendaciones; Playwright conserva su skill adaptada. Referencias Confluence
  incompatibles se retiran del catálogo para que el auditor
  existente vea managed-tool-missing; no declarar un adapter ejecutable si su
  backend no tiene firma soportada. No cambios a writes nativos V1.
- CodeGraph: runtime existente, explore exacto, cwd neutral de caché sin ancestro
  con `codegraph.db`, no confundir carpeta de estado con índice. Query exige root
  Git/worktree e índice existente; tuning/watchers/locks normales preservados.
  Cuatro comandos lifecycle ya agregados por su owner, con tool distinta del MCP,
   índices sólo bajo pedido/permiso, sin shell ampliado al inspector. Benchmark V2
   nativo history/capture/report por API pública, read/capture ask y metadata-only
   schema3 recapturable con reemplazo atómico de misma identidad como V1; total
   derivado exclusivo versionado, no total reportado V1.
   La conexión HTTP-only del host llega por pipe sólo RAM, no auth file/env nuevo
   con secreto. Sin benchmark/modelos/índices reales al instalar o diagnosticar.
   Transporte ahora compartido con atribución por base v2/native-history.mjs, no
   doble lectura fd3 por módulo compilado. Ver owner v2/TELEMETRY-DESIGN.md y
   ATTRIBUTION.md; historia borrada/externa y migración D01 no certificados.
- Playwright: mismo runtime/pin seleccionado, actor5/tools25, unsafe denegado. Scope
  de upload sale de `ctx.location.directory`, no de un proyecto grabado en el perfil;
   salida explícita absoluta dentro del output-dir. El candidato exige un snapshot
   durable verificado antes de prepare; el workshop conserva su runtime aprobado.

### Documents / Notifier

- Lector por broker sin fixtures copiadas a repos. Documenter y seis especialistas,
  ocho tools base/schemas/resources con contratos de QA; no repetir render/QA humana por
  mover el contrato de composición. Tools se ejecutan por el runtime existente.
- Modo de delegación `composed`: el plugin documental no elimina `subagent` del
  coordinador técnico. Sus seis targets y no-nested permanecen acotados por owner y
  contrato general; el default legacy sigue documenter-only para el workshop.
- Documenter conserva **edit:allow V1**; retirado el guard añadido de artifact-studio/.
  Shell documental bloqueado aun con override. Especialistas conservan sus límites
  y denies de memoria. Destinos del proyecto/defaults artifacts/output/previews
  originales, restricciones históricas del workshop sólo en su modo.
- publicar-documento/crear-diagrama son comandos V1 sin agent forzado; scripts
  publish_document.py/render_diagram.py/render_infographic.py copiados idénticos,
  plantillas completas. Sólo paths config/HOME/flags existentes de runtime adaptados
  al perfil aislado. No convertir QMD a spec ni imponer static/header/directorio/
  no-overwrite nuevo. Test local de estilo/QMD propios, actualización de entrega,
  PDF/DOCX/ODT y previews, D2/Typst propios. No certifica fidelidad o QA independiente.
  Prototipos document-qmd/document-editable fuera del harness default, opt-in sólo
  para regresiones históricas. Contrato vigente en owner v2/documenter/README.md.
- Confluence recupera create/update nativos originales sólo Doc con ask y guardrails
  V1. Backend exige guía/espacio/draft/snapshotToken, no protocolo writer/prepare/commit
  propio. Permisos/transporte intacto/actor y rechazo probados en MCP simulado; no
  nuevas páginas/guías/espacios reales ni certificación de publicación. No Gamma
  nuevo, Jira/delete/admin o ejecutores ocultos; contratos owner v2/confluence/README.md.
- Canvas con caché por hash de proyecto y ownership de proceso/puerto; status no
  inicia un servicio. No attach/stop ajeno ni compartir escenas entre proyectos.
- Notifier general recupera backend OS V1 generado desde fuente del owner, config
  notify.json existente leída por evento sin copiar, quiet hours/defaults/sonidos/
  urgencia/título y click-to-focus GNOME/X11/AT-SPI best-effort. Native emitter/sound
  apagados evitan duplicar, no suprimen sonido del addon. Título de sesión sale al
  escritorio como V1; no cuerpo de pregunta/error/transcript. Workshop básico con
  títulos fijos/sin sonido preservado. Scope `launch` resuelve cwd del cliente al iniciar,
  sin fijar el workshop en config. No sigue automáticamente session_move a otro
  directorio en el mismo cliente: allí conserva la frontera de lanzamiento. No
  afirmar aceptación real de quiet hours/sonido/foco por pruebas simuladas (D04).
  APIs TUI públicas recuperan preguntas textuales y atención de hijas al root.
  Entorno desktop conserva metadata GNOME/terminal sin credenciales; cleanup sólo
  de procesos/timers propios, sin instalar helpers o alterar No molestar.

## Atribución almacenada (D06)

Tool/permiso/input originales agent_attribution, sólo sesión actual, sin ask nuevo.
General selecciona history:stored; API HTTP pública paginada proyectada en RAM a
tipo/agente/modelo/variante históricos, incluso pre-compaction. No bodies/tools/
títulos/adjuntos al modelo/archivos. completeHistory:true sólo significa agotamiento
de filas almacenadas observadas de esa sesión, no snapshot atómico/trabajo borrado/
externo/familia o migración V1 íntegra. Workshop sin opción conserva contexto/false.

Transporte pertenece a base; CodeGraph reexporta el helper. Pin compila dependencias
por plugin: compartir path no comparte caché. Se verificó/corrigió doble consumo de
fd3 con una sola función HTTP acotada en RAM, auth dentro del closure, no descriptor
secreto global/RPC nuevo. Usa launcher existente, no fallback a daemon/DB/auth ajenos.
Dos fixtures oficiales compaction/cambio de agente/fork/deny y benchmark en ambos
órdenes OK; límites/contrato/pruebas en [ATTRIBUTION.md](ATTRIBUTION.md). D01 sigue aparte.

## Base y bindings de helpers

Las reglas shell de los roles sin Edit se verifican además contra su contrato
compuesto y parser literal antes de ejecutar el broker/validator. Un allow de
sesión no habilita store del reader o Node arbitrario de plan. Sumar un helper/
target autorizado de una capa real requiere su port explícito, no romper estas
guardas para hacer pasar un fixture.

`runtimeHome` es opt-in explícito. Para llamadas literales al broker se restaura
HOME/XDG de la identidad seleccionada, sin copiar SSH/libpq ni lectura de secretos
desde el modelo. Sólo paths/flags de transporte aprobados pueden ir efímeramente
al host/helper. El rechazo añadido de PGPASSWORD se retiró: V1 ya lo admite.
Sólo el servidor propio conserva esos mecanismos libpq existentes, y sólo la
invocación literal psql-readonly los recibe; no config/argv/TUI/shell genérica o
modelo. PGSSL*/Kerberos preservados como el helper V1. psql falso y permisos wrapper
originales probados, sin conexión a infraestructura real.

Por defecto HOME/data/state del candidato siguen aislados y vacíos de credenciales.
Hay ahora una API de binding opt-in sólo de data/state al piloto V2 identificado,
probada con una sesión nativa temporal, no con auth/DB reales. Config/cache/tmp
siguen propios. El CLI ofrece plan/prepare, status/check offline y verify-live/chat
opt-in; launcher probado sólo en temporales, no activación real o copia de stores.
Ver ACTIVATION.md para consentimientos, límites y modelos auxiliares. No hacer un
segundo login por iniciativa ni inferir backup/migración V1 por compartir storage.

## Auditor y propuestas locales nativas

- `stack-layer-audit` (master-dev/agent-design) combina `debug config --standalone`
  **del binario oficial que ejecuta el host** con el registro público ya vivo de
  agentes/comandos/skills/plugins/tools. Verifica el pin; no usa `ctx.config`, que
  no existe en 2.2.7, ni inicia otro `debug agents` (ese comando sí inicia MCP).
- El subproceso conserva sólo identidad/rutas de configuración y usa DB/data/state/
  cache temporales; elimina inline config y entorno secreto. No imprime valores
  resueltos, cuerpos globales, recursos shell ni logs raw. Identifica overrides de
  entorno omitidos con warning. No abre la DB de sesiones de aplicación para auditar.
- Reporta fuentes en orden observado, campos declarados, inventario local sin
  seguir symlinks, retención de prompts propios, modo/modelo/visibilidad, testigos
  acotados de permisos, catálogo registrado y contratos de guards/targets/actores.
  Builtins sólo tienen baseline de sus overrides explícitos, no de todo su prompt.
- Un modelo heredado sin selección explícita no es un cambio respecto de una
  asignación de sesión. Se normalizan `~/` como hace el host. Al componer la base,
  las restricciones inline de un builtin también se materializan al final de su
  archivo emitido: se detectó que el fallback de plan podía dejar `shell:ask` en
  el registro después del deny inline. El guard ya lo bloqueaba; ahora registro
  nativo y guard coinciden, sin cambiar V1 ni reducir funcionalidad aprobada.
- Límites explícitos: testigos no son inclusión formal de wildcards, prueba de
  aprobaciones guardadas ni todas las policies/visibilidades por modelo/sesión;
  retención textual no es revisión semántica. Los archivos redescubiertos pueden
  haber cambiado desde el arranque. No aprueba AUNE ni los once overlays reales.
- `stack-layer-scaffold` es sólo de agent-design, incluso frente a un allow de
  sesión de otro actor. Devuelve **propuesta sin writes** para roles existentes:
  modelo/modo/permisos nativos, nunca copia `system`/tools ni genera un compositor.
  Todo cambio pide revisión explícita, incluidos recortes; aplicación deliberada
  y reinicio posteriores, no autosync/index/autenticación.
- doctor/check-local e init-project del candidato usan estas tools; plantilla,
  playbook y skill de overlays son específicos V2. Las fuentes V1 no se cambian:
  no instruir `__replace__`, reinyectar tools legacy o ejecutar init CodeGraph V1.

## Runtime Playwright durable offline

`v2/playwright/managed_runtime.py` copia únicamente la distribución pública ya
seleccionada: MCP **0.0.85**, core **1.66.0-alpha-2026-11-09** y el Chromium
**chromium-1217** actualmente aprobado. Sin descargas, actualización de versiones,
perfil personal, cookies, auth ni modificación/eliminación de las cachés originales.

Destino propuesto: `~/.local/share/opencode-stack/runtime/playwright-mcp-0.0.85`.
`migrations/v2/playwright-runtime.mjs` ofrece `plan`, `status`,
`prepare --client-closed`, `remove --client-closed --confirm`. **No se ejecutó prepare
en ese destino definitivo.** Plan real: 546 entradas/404912446 bytes; copia y uso
reales sólo en /tmp, con limpieza final.

Snapshot con marker/manifest, hashes y modos, links internos rebased, límites de
tamaño/cantidad, lock y publicación por rename. Drift desconocido/symlinks externos/
material privado fallan; no auto-adopt/repair/download. Idempotencia exige selección
de origen compatible; selector/dispatcher funcionan aun si desaparecen las cachés
originales. Overrides heredados de perfil/CDP/proxy se rechazan, no se ignoran por
limpiar el entorno. `status` vuelve a verificar el árbol completo; `remove` sólo
borra el owned íntegro con confirmación, nunca la fuente.

Es paridad origen/copia/manifest, **no firma upstream, sandbox frente al mismo UID
ni actualización automática**. Nueva versión requiere selección/revisión explícita;
el perfil falla cerrado si cambia la copia. Activación/rollback final siguen abiertos.

## Validación realizada

```bash
node --test v2/general/test/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s v2/general/test -p 'test_*.py' -v
node migrations/v2/smoke-general.mjs
node migrations/v2/smoke-general-addons.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_playwright_managed_runtime.py' -v
node migrations/v2/smoke-managed-playwright.mjs
KNOWLEDGE_API_NATIVE=1 node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-documenter.mjs --catalog-only
node migrations/v2/smoke-question.mjs --regression-control
node migrations/v2/smoke-question.mjs --desktop
node migrations/v2/general-composed.mjs plan --project /tmp/opencode
```

- **75 tests Node + 3 Python base** actuales,41 composición y100 regresiones legacy
  reejecutadas OK;11 casos workshop verifican modo histórico de atribución/denies.
  Los29 casos general-only pertenecen al incremento previo, no retest humano nuevo.
- **29 casos base nativos** y control pre-modelo de prompt sustituido; **41 casos
  de composición**, cinco MCP fixture conectados. Protocolos/API efectivos, no sólo
  presencia de archivos. Técnicos/Knowledge/Documenter pueden delegar sin que uno
  desactive al otro; reader/QA/store/unsafe/mutadores y overrides maliciosos rechazados.
- Wrappers Knowledge reales ante intérprete/backend falsos: env local seleccionado,
  HOME/modelo preservados y sin password del host. No existen helpers antiguos en
  runtimeConfig de ese fixture: la nueva ruta funciona sin despacho a ellos.
- Handoff local escrito/releído, TXT por lector real, spec validado por CLI real;
  no render/pdf/canvas-start o QA perceptual nuevos. Child QA declara routing only.
- **3 tests Knowledge general**, **8 Python + 7 Node legacy V2 Knowledge**, **9
  Notifier**, **7 contratos Documents** OK. Scope de navegador dinámico y explícito
  viejo cubiertos. Catálogo/roles del workshop y question/desktop PTY regresionados
  sin avisos OS reales ni tocar forms/sesiones del operador.
- Plan actual:7 aportes/22 roles/33 skills/34 comandos/7 registros/5 MCP, sin Stitch.
  Runtime durable y candidato preparados; check/verify-live reales pass con reuse
  nativo V2 autorizado y0 inferencias/tools de negocio. No chat o DB V1 abiertos.
- Benchmark owner:14 Node OK y57 Python (56 OK/1 opt-in skip); host2.2.7 con
  compaction almacenada, forks/reverts activos rechazados, hijos/rangos, permisos,
  comparación negativa honesta y transporte sin cuerpos/secretos. Capturas no se
  refrescan con report, pero recaptura explícita actualiza evaluación de la misma
  identidad, sin duplicado, como V1. No inmutabilidad añadida.
- Documents actual:22 Node/45 Python; scripts legacy copiados idénticos y ejecutados
  con estilo/QMD propios, PDF/DOCX/ODT y previews, reemplazo de entrega, D2/Typst
  propios. No QA independiente/fidelidad universal por ese test. document-qmd/
  document-editable se prueban como prototipos opt-in históricos, no capacidades
  activadas del harness. Catálogo workshop sin render regresionado.
- Capturas estructural/técnica Confluence reales ya completadas,0 calls/modelo/
  páginas. Backend classic-page draft/full/html+snapshotToken, body format/value y
  guías/space por tarea. Dos writes nativos Doc ask restaurados, permisos/rechazo/
  actor y payload intacto comprobados en MCP simulado; no protocolo writer nuevo.
  Referencias allow y sitio/espacio API sin restricciones ID-only propias. Firma
  real executor confirmada por metadata y adaptada (opciones omitidas responseFields/
  view y límites name); guías/espacios/publicación reales no invocados. No repetir
  capturas por ritual: nuevo diagnóstico acotado resolvió el bloqueo de registro.
- Estado actual:227 assets,34 comandos,instalado/check ready-assets/verify-live
  ready:true,readyForChat:true,audit pass,0 hallazgos y cinco MCP connected. Cierre
  técnico del paso2 sólo en alcance candidato general, no datos/capas/producción.
- Auditor por tool real en base y compuesto22: baseline sin drift, delta de proyecto
  con ampliación detectada, prompt retenido, propuesta aceptada por `debug config`,
  cero writes de scaffolding y rechazo de actores fuera de contrato aun con override.
  Contador de startup MCP fixture no cambia durante la auditoría; config no inicia
  MCP, agents sí, comportamiento del pin cubierto explícitamente en fixture.
- Notifier:18 tests owner y2 recorridos PTY oficiales con bundle de paridad (form
  respondido, permiso rechazado;0 OSC nativos/OS/audio/modelo real). Backend V1
  generado sin SDK/dependencia del checkout, config reload/horarios/sonido/urgencia/
  título/token propio vs ajeno/wmctrl/xdotool/AT-SPI/fallback/cleanup verificados
  con dependencias simuladas. General66+3/41 composición y release/status OK.
  Aceptación avanzada desktop pendiente, básico previo no se repite por ritual.
- Atribución D06:6 pruebas nuevas (2 nativas oficiales); API almacena/pre-compaction
  frente a contexto reducido, cambia agente sin reinterpretar mensajes previos,
  fork/deny/paginación/cancelación/fallos y privacidad. Atribución→benchmark y orden
  inverso comparten servicio en RAM pese a bundler;14 Node/57 Python CodeGraph siguen
  pasando. No migración de sesiones reales ni cierre D01 por este incremento.
- **7 tests Python managed + 7 legacy Playwright V2** OK. Cachés eliminadas sólo en
  fixture: selector/dispatcher usan owned copy, entorno sin secretos, drift bloqueado.
- **7 calls Playwright reales** headless en copia temporal: modo, navegar loopback,
  clic, snapshot, evaluate, screenshot PNG y close; integridad post-ejecución OK.
  No visible nuevo, cuentas, descargas o QA perceptual de aplicación.

## Próximo trabajo / no ejecutar un corte

La lista histórica siguiente se actualiza en PASO2-CIERRE.md: runtime/candidato
preparados y arranque real validado con autorización. Paso2 técnico cerrado en ese
alcance; sigue paso3 AUNE/privados y luego proyectos. D01 íntegro permanece antes
del corte, separado del port de base. No repetir ventanas/QA ya cumplidas por ritual.

1. Activación final del runtime durable y validación del auditor/propuestas sobre
   los owners reales en sus pasos: no presentar fixtures como aceptación de overlays.
2. Cerrar defaults/activación (proveedores/small model/compaction/snapshots/storage),
   permisos/bindings y las diferencias opcionales registradas. No aceptar recortes
   funcionales por no haber entrado en el piloto.
   Mapping title/summary/compaction y binding V2 opt-in ya probados; faltan su uso
   real autorizado. Las definiciones dormidas ya se preservaron. Distribución/rollback de
   configuración ya probados, no restauración de datos o despliegue global.
   D05 ya aprobado: auto compaction, snapshots, skills por imports explícitos y
   pin/manual updates. Launcher y status/check implementados; ver ACTIVATION.md y
   LAUNCHER.md. General-only no admite capas ejecutables locales sin su port posterior.
3. Port AUNE en su repo, luego proyectos canónicos, con validación efectiva de la
   cadena real. Los fixtures sintéticos no satisfacen ese gate.
4. Historial rico/backup/restore/salida Background adopted y despliegue autorizado.

El operador no necesita ejecutar prompts ni repetir las pruebas anteriores para
este incremento. Los CLI de revisión versionada son del candidato: no sustituyen
el corte global autorizado o backup/restore consistente del historial.
