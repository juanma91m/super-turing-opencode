# Playwright en OpenCode V2 oficial

## Estado

Integración aplicada por el operador con **OpenCode oficial 2.2.7**. Captura y
plan posterior confirman Connected/applied y la composición de cinco MCP intacta.
La primera prueba pública del operador falló en example.com con DNS NXDOMAIN.
El reintento en example.org confirmó selección headless, navegación pública,
snapshot, evaluación DOM de sólo lectura y cierre. La evaluación devolvió título
Example Domain y H1 vacío; un GET HTTP independiente desde Debian confirmó el
mismo título y ausencia de H1 en el HTML servido. La aserción original de encabezado
no se cumplió: era una expectativa incorrecta sobre esa página externa, no evidencia
de fallo de extracción de Playwright. **Prueba operativa básica headless aprobada
en ese alcance**, sin afirmar cobertura de todas las tools o sitios.
El operador pidió luego visible y confirmó con captura la ventana real: modo
visible seleccionado, navegación pública y lectura de título correctas. El agente
dejó la ventana abierta esperando confirmación, como se pidió. **Modo visible real
aprobado**; cierre de esa ventana aún pendiente de confirmación en el chat del
workshop. No se probó login/takeover autenticado ni reutilización de credenciales.
V1 y su navegador no se modificaron. No se usaron cuentas, sitios internos ni
perfiles personales. Stitch sigue excluido de esta composición.

### Diagnóstico del fallo público

En el momento de la prueba, getent y curl también fallaron para example.com
fuera del navegador. Con entorno habitual y limpio se reprodujo la falta de
resolución; no había proxies de entorno configurados. En controles DNS resolvieron
example.org, opencode.ai y mcp.atlassian.com. example.org respondió HTTPS200 también
con entorno limpio. Esto sitúa el problema observado fuera de la integración,
sin probar por qué falla ese dominio (DNS/VPN/política/transitorio no diagnosticados).

No se cambió DNS/proxy/runtime ni se reinstaló/copió un perfil como remedio. El
reintento example.org del operador ya pasó navegación/evaluación/cierre sin reapply
o reinicio, con la salvedad del criterio H1 corregido arriba. No se identificó la
causa del DNS example.com ni se garantiza disponibilidad futura del sitio control.
El flujo headless loopback de los tests también sigue aprobado.

La navegación generó snapshots automáticamente según el backend. Son artefactos
de runtime con salida aislada, no escrituras solicitadas por el modelo ni memoria/
corpus. No prometer cero archivos físicos por pedir sólo lectura/sin outputs.

Se conserva la composición anterior: Knowledge, Ticketing con **scope discovery**,
CodeGraph query-only, Context7 y libnotify. Quedan 15 agentes, 20 skills y los
mismos 11 comandos de addons. Se reutiliza la skill stitch-playwright-ui-opencode,
sin habilitar el MCP Stitch ni duplicar su política en un agente nuevo.

## Candidato general posterior: runtime durable offline

El workshop aprobado descrito abajo no cambió. El candidato general ahora incluye
snapshot offline/versionado de MCP0.0.85/core1.66.0-alpha-2026-11-09 y Chromium1217
seleccionados, sin npx/download ni perfiles/cookies/auth. Su prepare exige runtime
durable íntegro; el selector/dispatcher sobreviven a la eliminación de cachés de
origen, comprobada sólo en fixtures. No se aplicó todavía el destino definitivo.

Lifecycle explícito: `migrations/v2/playwright-runtime.mjs plan|status`,
`prepare --client-closed` y `remove --client-closed --confirm`. No ejecutar writes
por diagnosticar. Hashes/modos/links/marker/locks/rename; drift falla sin adopción o
reparación automática, sin borrar fuente. Paridad local no es firma upstream ni
sandbox contra el mismo UID; actualizaciones requieren selección/revisión nueva.

Pasaron 7 unit managed, 7 legacy V2 y 7 calls reales headless/loopback por host oficial
usando copia temporal: modo/navegar/clic/snapshot/evaluate/screenshot/close, PNG e
integridad final. No se abrió otro visible ni se repitió aceptación humana.
Detalle/estado vigente en [../general/COMPOSED.md](../general/COMPOSED.md).

## Runtime y router del piloto aprobado

V1 usa un único MCP `playwright`, con `scripts/playwright_mode_router.py`, npx
`@playwright/mcp@latest` y un ejecutable Chromium user-space. Se confirmó que el
router instalado coincide con la baseline antes de editar la fuente.

El piloto selecciona el MCP **0.0.85** ya presente en caché y el Chromium configurado
actualmente. Su dependencia Playwright es **1.66.0-alpha-2026-11-09**; no se presenta
como una release estable distinta ni se cambia de versión por iniciativa del port.
No se descargó ni instaló otro runtime/browser. El selector exige wiring conocido,
pin, caché y ejecutable existentes, y rechaza overrides de perfil/CDP/proxy o de
permisos no reconciliados sin volcar valores.

**Tradeoff del piloto:** no seguir `latest` silenciosamente, pero depender del
runtime que hoy vive en caché npm. Si se limpia o cambia esa caché, falla con un
error: no descarga un reemplazo. Un runtime durable/pin completo para distribución
productiva requiere una decisión de instalación propia antes del corte global.

El router canónico agrega un único extension point opcional `PLAYWRIGHT_MCP_CLI`:
si se configura, ejecuta Node y el entrypoint absoluto existente; si falta o es
inválido no hace fallback por red. Sin esa variable, su argv V1 sigue siendo igual
al código comprometido en HEAD, comprobado por test. Este cambio fuente no se
sincronizó a producción V1. No se duplica la lógica de modo ni se agrega otro proxy.

El dispatcher V2 limpia credenciales/preloads/CDP/storage-state/proxies heredados,
usa `--isolated` y salidas del perfil V2, sin conectar al Chrome personal. Conserva
transporte de escritorio efímero para visible (incluido path XAUTHORITY, nunca su
contenido); no serializa esas variables ni copia cookies, perfiles o auth stores.

## Modos y continuidad

- Único MCP/browser activo por perfil. No superponer workflows foreground/background.
- Llamar `playwright_browser_set_mode` antes de cada workflow: headless por defecto;
  visible sólo por pedido explícito. Esto conserva el contrato de instrucciones V1,
  no es un detector automático de intención del usuario.
- Seleccionar el mismo modo no cierra la sesión. Cambiarlo reinicia el upstream y
  pierde la sesión aislada. Si se acuerda login/takeover manual visible, mantener
  ese modo y esperar confirmación; no volver a elegir modo/cerrar durante el takeover.
- Sin DISPLAY/WAYLAND, visible falla antes de cerrar el browser actual. Un fallo al
  iniciar visible restaura headless según el router canónico.
- Visible real fue pedido y confirmado por el operador con ventana observada,
  navegación y título correctos. Los cambios/fallback de modo también tienen
  tests simulados. No se abrió la ventana por iniciativa ni se probó un takeover
  autenticado; no confundir observación manual con validación de login.

## Permisos y guardas

Los cinco roles actuales de V1 se conservan: master-dev, planner,
frontend-web-developer, ui-web-designer y dev-test. Los otros diez no ven Playwright.
Los flags legacy `tools.playwright_*` de esos cinco se convierten a reglas nativas
con deny de prefijo y allows por nombre; no se importa un wildcard allow accidental.
Los permisos browser explícitos del caller no se pisan. Deny de sesión sigue mandando.

El catálogo actual tiene 25 tools upstream más browser_set_mode del router. El
piloto permite **25 tools efectivas** y deniega **browser_run_code_unsafe**: el
README del proveedor la declara equivalente a ejecución arbitraria en el proceso
servidor. **Es una restricción deliberada respecto de la superficie V1**, no una
promesa de paridad total. No exponer Node/RCE como vía alternativa a shell/Edit en
roles read-only. Cualquier necesidad de esa capacidad requiere diseño/autorización
separados, no ampliar permisos para pasar una prueba.

También se aplican las guardas específicas de este piloto:

- Tools nuevas/desconocidas quedan fuera, sin grants por wildcard.
- Navegación explícita sólo HTTP(S), sin credenciales embebidas en URL.
- Uploads/drop de archivos sólo del proyecto sintético, sin symlinks ni rutas
  sensibles. Esto no autoriza subirlos a un sitio: manda además el alcance del usuario.
- Artefactos automáticamente nombrados van al output propio. Si se especifica
  filename, debe ser **absoluto** bajo `<workshop-cache>/playwright-output`.
  Rechazar nombres relativos es importante: upstream los resuelve contra el
  workspace, no contra output-dir, y podrían sobrescribir archivos de aplicación.
- No navegar sitios internos/autenticados, inspeccionar credenciales de red ni
  ejecutar acciones de negocio sin un pedido/alcance autorizado.

Estas guardas no son sandbox OS/red ni convierten las acciones del navegador en
read-only universal: clics, JS en página y formularios pueden tener efectos. El
backend conserva sus semánticas. No interpretar una tool allow como autorización
para mutar un sistema remoto o persistir datos privados.

## Validación realizada

```bash
KNOWLEDGE_API_NATIVE=1 node --test migrations/v2/test/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 TMPDIR=/tmp/opencode python3 -m unittest discover -s tests -v
node migrations/v2/smoke-playwright.mjs
node migrations/v2/smoke-codegraph.mjs
node migrations/v2/smoke-ticketing.mjs
node migrations/v2/smoke-ticketing-oauth.mjs
node migrations/v2/playwright.mjs plan
```

- **75 tests de migración**, todos OK, incluyendo API nativa, assets, backups,
  reapertura, CLI/app preservados, protección de rutas y ack de cliente cerrado.
- **181 tests Python base: 180 OK y un skip opt-in** de validación de rol instalado
  ajeno a este smoke. Incluyen 13 tests Playwright de selección, entorno, router,
  continuidad de modo/fallback y paridad legacy sin CLI explícita.
- **24 casos nativos**: catálogo por los cinco actores permitidos/diez denegados,
  unsafe/unknown, file URL, uploads sensibles/externos, output escape/relativo y
  deny de sesión. Dar allow unsafe sólo en sesión tampoco lo habilitó.
- Con backend MCP y Chromium **reales**, en perfil temporal distinto, el host con
  proveedor ficticio ejecutó desde dev-test seis calls reales: modo headless,
  navegar a página loopback propia, clic, snapshot, screenshot y close. Se comprobó
  el cambio DOM tras el clic y PNG con firma/dimensiones válidas. No es QA visual
  de una aplicación real ni prueba de todas las 25 herramientas.
- Cinco catálogos MCP convivieron y pasaron inspectores Knowledge/Ticketing/CodeGraph.
  No se consultaron índices, tickets/Confluence, cuentas o sitios del usuario.
- Se repitieron 23 casos CodeGraph, catálogo real1.5.0, 21 casos Ticketing y cinco
  modos OAuth de fixtures. Se conserva Rovo resource-metadata y guards anteriores.
- Pasó `debug config --standalone` del runtime oficial. No hay patches de core,
  Background, instalaciones de browsers ni uso de credenciales reales en los smokes.

## Aplicación al workshop (ya realizada por el operador)

Cerrar el cliente **workshop V2**, no producción V1. No se mata ningún proceso
ajeno. `--client-closed` es confirmación humana, no detección automática.

```bash
node "$HOME/.local/src/opencode-stack/migrations/v2/playwright.mjs" apply --client-closed
node "$HOME/.local/src/opencode-stack/migrations/v2/playwright.mjs" chat
```

Si apply falla, detenerse y compartir sólo el error. No correr instaladores V1 ni
repetir OAuth/reindex como remedio. El lote se compara antes de reemplazar, usa
backups `.pre-playwright.bak` y marker `.playwright-v2-enabled.json`; es atómico
por archivo, no transacción FS global. La selección CodeGraph previa se comparte
en codegraph-profile.mjs sin desplegarla ni reabrir índices por defecto.

Desde este incremento usar **playwright.mjs chat|verify**, no CodeGraph aislado:
el launcher anterior rechaza recomponer después del marker, para no borrar Playwright.
Apply/verify comprueban catálogos/roles, no abren páginas ni ejecutan tools de browser.

## Prueba del operador: headless y visible básicos completados

Playwright Connected y el flujo headless público ya están confirmados. Para una
comprobación equivalente futura (sin asumir un H1 que el sitio no garantiza),
usar planner o master-dev y solicitar headless explícitamente:

```text
Probá Playwright en headless, sin usar cuentas ni sitios internos.
Cargá stitch-playwright-ui-opencode. Seleccioná headless con
playwright_browser_set_mode y abrí https://example.org mediante browser_navigate.
Obtené un snapshot. Usá browser_evaluate en contexto de página para leer
document.title y los H1 existentes, sin cookies/storage ni mutaciones. Informá
el resultado real; no exijas un H1 si la página externa no lo tiene.
Luego cerrá sólo ese navegador aislado de prueba. No cambies modo si hay un
workflow/takeover activo: en ese caso detenete e informalo.
No ejecutar browser_run_code_unsafe, instalar browsers, subir archivos, guardar
cookies/perfiles, generar handoff ni persistir los resultados en memoria/corpus.
Informá operación, resultado y limitaciones; no declares pasos no ejecutados.
```

La prueba visible ya fue solicitada y confirmada. Para cerrar sólo la ventana de
prueba, el operador debe responder en ese mismo chat: «Sí, veo la ventana. Podés
cerrar sólo el navegador aislado de esta prueba con playwright_browser_close».
No cerrar desde otro workflow ni volver a headless durante un takeover. El cierre
headless ya fue probado; no declarar cerrado el browser visible sin su resultado.

No usar login de negocio sólo para probar una ventana. Pendientes: confirmar ese
cierre, takeover/login autenticado si una tarea lo requiere y decisiones de
runtime/permisos para corte global. No repetir la prueba pública por ritual;
para aserciones repetibles usar la página loopback propia, no markup externo.
