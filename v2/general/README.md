# Candidato general V2 — base independiente

## Estado

**Paso2 técnico completado: candidato preparado y verify-live real OK, no producción.** Hay una base
independiente del workshop con once roles canónicos, quince skills, nueve comandos
registrados y cuatro registros de helpers. Este documento describe su contrato
inicial. El siguiente incremento **ya integra los addons por un contrato nativo**:
22 roles/33 skills/34 comandos/7 registros/5 MCP; ver [COMPOSED.md](COMPOSED.md) para
evidencia, bindings y pendientes actuales. V1/config workshop intactos; data/state
del piloto V2 se reutilizaron nativamente con autorización para SDK/metadata.

El criterio vigente es **paridad del harness V1 excepto Background y Stitch**, no
rediseño ni subconjunto diario. La corrección más reciente restaura comandos y tres
programas legacy Documents, edit:allow/destinos V1, Confluence nativo Doc ask y
benchmark recapturable. Prototipos QMD estático/ODT derivado fuera del default;
restricciones/aprobaciones añadidas no son requisitos por estar testeadas.227 assets
en candidato instalado/verify-live pass; Stitch retirado por decisión explícita,
incluidas recomendaciones en roles/skill, sin tocar V1. Libpq existente restaurado
sólo al helper correspondiente. Ver [PASO2-CIERRE.md](PASO2-CIERRE.md): revisión
instalada/evidencia y límites. AUNE/proyectos/historial íntegro no cerrados aquí.
Notifier avanzado ya conserva backend/preferences V1 con18 tests owner y2 PTY
oficiales aislados; no certifica audio/foco reales ni modifica el workshop básico.
La atribución general ya enumera todo el historial almacenado de la sesión con API
pública, incluso antes de compaction, como V1; no sólo el contexto. D06 implementado
y probado, distinto del requisito D01 de migrar el historial íntegro. Sin nuevos
permisos; modo histórico del workshop conservado. Ver [ATTRIBUTION.md](ATTRIBUTION.md).

La fuente incluye una corrección posterior para los deltas nativos del paso4:
ver [NATIVE-CONTRACTS.md](NATIVE-CONTRACTS.md). No está aún en la revisión instalada
del cierre2: requiere nueva revisión candidata y rebase privado explícitos. Los
bytes archivados anteriores y su evidencia histórica no se reemplazaron por código
del working tree ni se extendió su aceptación a proyectos automáticamente.

El host de validación es el oficial **2.2.7**. No se recompila, parchea o recupera
Background. No hay nuevo agente coordinador ni compositor privado de herencia.
Plan/Build siguen hidden, no deshabilitados para rutas explícitas.

## Composición y ownership

- `render.py` traduce únicamente las fuentes canónicas V1 de la base a agentes
  nativos (`permissions`, `shell`, `subagent`, `model#variant`). Usa Python estándar
  y un subconjunto cerrado de mapas/escalares del frontmatter actual: duplicados,
  listas, tags/anchors, bloques o campos desconocidos fallan visiblemente, no se
  ignoran. **No es un parser YAML general ni un intérprete de overlays.** No agrega
  PyYAML ni instala dependencias. Los sources V1 se conservan intactos.
- `profile.mjs` produce un plan sin escribir y prepara sólo un destino candidato
  explícito/identificado. Copia los plugins públicos y sus dependencias relativas
  a un bundle propio; no depende de `workshop-guard`, de snapshots de ese perfil o
  de una allowlist `app/message.txt`. El destino no puede ser V1 o el workshop.
- El estado registra hashes de assets del candidato, no archivos de aplicación.
  Misma composición idempotente, drift desconocido/symlinks rechazados y sin poda
  implícita de assets retirados. No es transacción global ni backup/rollback final.
- La configuración general no contiene un proyecto fijo. El mismo plan sirve a
  proyectos distintos; la ubicación runtime y el descubrimiento de `.opencode/`
  son nativos. Se mantienen deshabilitadas las skills externas de otros clientes
  para no importar reglas por accidente; D05 ya aprobó imports explícitos por owner,
  con filtro nativo antes del prompt además de los flags de entorno.
- La organización aporta contexto aditivo por su plugin público y cada repo sus
  deltas nativos sin `system`/prompt completo, más sus lentes en AGENTS. Los owners
  organizacionales/proyecto conservan su dominio, referencias y reglas. No se
  copian perfiles privados a la base ni se reimplementa su política de activación.

La prueba genérica valida base sola, base + organización sintética y base +
organización + delta de proyecto. No constituye migración o aprobación de AUNE
real, de sus referencias/visibilidad ni de los once overlays: pasos 3/4 siguen abiertos.

## Permisos y flujo

- Los permisos y targets salen del **agente nativo efectivo** (global + deltas
  locales), no de snapshots estáticos de la base. El paso4 detectó que esos snapshots
  bloqueaban reportes y especialistas locales legítimos. `native-contract.mjs`
  consulta `ctx.agent.get`, nunca los approvals de sesión, sin componer prompts.
- Los roles read-only mantienen edit default deny. Sólo excepciones nativas de path
  permiten edit/write/patch, dentro de la raíz física del proyecto, sin symlinks ni
  traversal. Un allow amplio o sólo de sesión no convierte el rol en writer libre.
  Shell conserva validación literal e integridad, pero usa las reglas nativas locales.
- Dispatch y actores de tools gestionadas verifican permiso del agente nativo;
  catálogo cerrado/policies/confirmaciones nativas siguen aplicando. Un target local
  declarado funciona; un override de sesión por sí solo no lo agrega. Config/plugins
  locales son código/configuración confiable del owner, no un sandbox contra ese
  owner. Continuación exige mismo padre/agente; sin delegación anidada por defecto.
- El hijo tiene sus propios permisos. No hay worktree, aislamiento OS o serialización
  de writers automáticos: no superponer escrituras sin alcance/partición explícitos.
- El guard de prompt exige que el global siga presente. Un proyecto que sustituya
  todo `system` falla antes de consultar el modelo, en vez de operar como stub
  permisivo. Es validación del contrato, **no** merge/reconstrucción privada de prompts.
- Integridad de scripts/registro **antes** de ejecutar incluso `planner_shell.py
  --check`; shell recibe sólo entorno básico, sin password del servidor/preloads/keys.
  Los programas locales aprobados son confiables, no un sandbox OS o de red.
- Las flags V1 `tools.<mcp>_*: true` no se convierten en grants wildcard de ejecución.
  Cada addon debe aportar catálogo exacto y permisos propios al integrarse. False
  sigue siendo deny. El candidato base no tiene MCP configurados.

## Comandos y helpers: alcance real del primer incremento

- Quedan registrados los nueve nombres base, incluidos review, patrones, scaffolding,
  diagnóstico y sesiones. Se conservan fuentes que no dependen del esquema de DB V1.
- `stack-doctor` y `check-local-overlays` ahora usan `stack-layer-audit`: fuentes
  nativas y registro efectivo del host ya vivo, inventario local, prompts/modos/
  modelos/visibilidad, testigos de permisos y catálogo/guards. `stack-layer-status`
  conserva el resumen barato. No imprimen prompts/config resuelta ni exigen
  Background/Stitch. No certificar aprobación semántica o toda herencia real por
  testigos. `debug config` usa storage temporal; no `debug agents`, que inicia MCP.
- `init-project-agent-layer` usa propuesta primero y `stack-layer-scaffold`, sin
  writes, índices, credenciales, `system` copiado ni aliases/sentinel V1. Plantilla,
  playbook y skill de overlays específicos del candidato; V1 intacto. Aplicación
  deliberada sólo con confirmación, validación y reinicio. Ver COMPOSED.md.
- `sessions-list/clean` usan tools/API nativas, no el helper SQL V1 ni `opencode` de
  PATH. Defaults: hijos del directorio actual; scope/edad/root/otros proyectos son
  explícitos. Cleanup selecciona IDs, protege sesión actual/ancestros, valida
  descendientes y timestamps, pide autorización nativa y revalida. Puede interrumpir
  y borrar recursivamente las seleccionadas: **no es idle-only** ni operación
  transaccional. Reporta errores parciales; persiste sólo lo que el host requiere.
  En tests se eliminaron únicamente sesiones sintéticas de una DB temporal propia.
- Registros `analysis-doc`, `local-inspect`, `ssh-inspect`, `psql-readonly` y sus
  implementaciones canónicas están copiados sin ampliar verbos. `analysis-doc`
  write/relectura por planner se validó de verdad bajo tmp de un Git sintético,
  mientras Edit y shell libre siguen denegados. Help enumera los cuatro helpers.
- No se probaron infraestructura, GitHub o PostgreSQL reales. Este HOME aislado no
  copia identidades/libpq/SSH/credenciales ni reproduce sus overrides machine-local.
  Resolver bindings explícitos sin secretos y preservar política de identidad es
  parte de B07 y las capas privadas, no autorización para operar esos sistemas ahora.

## Evidencia

Desde el repo base:

```bash
node --test v2/general/test/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s v2/general/test -p 'test_*.py' -v
node migrations/v2/smoke-general.mjs
KNOWLEDGE_API_NATIVE=1 node --test migrations/v2/test/*.test.mjs
```

- **78 tests Node** de la última corrida del paso4: render sin writes, alias/modelos/variantes, parser
  cerrado, ownership/drift, perfil multi-proyecto, entornos y limpieza/paginación/
  consentimiento/ancestros/descendientes/concurrencia y fallo parcial de sesiones.
- **30 casos nativos con proveedor fixture**, más control de reemplazo de prompt
  rechazado antes de llamar al modelo. Base sola/org sintética/tres capas; delta
  reviewer de proyecto conserva global/mode/model/edit-deny y restringe git show
  sin perder git diff. Ni una prueba sintética aprueba toda herencia real.
- Edición y ejecución Node de aplicación fuera del fixture viejo; sin password
  del host en el proceso hijo. Planner help/write/relectura y escapes; readonly/
  sesión-override y `.env` sintético bloqueados. No se abrió `.env*` real.
- Inspector/implementador por subagent nativo, followup propio y rechazo de sesión
  ajena/nested. Un target explícito en delta nativo funciona también para planner;
  una ampliación sólo de sesión a otro target sigue rechazada. El test viejo que
  negaba el delta de proyecto reflejaba el snapshot incorrecto, no una regla aprobada.
- Diagnóstico por tool, listado de sesiones, permiso de cleanup rechazado, sesión
  propia protegida y eliminación nativa de una sesión sintética seleccionada.
- Broker alterado en fixture no se ejecutó ni siquiera para --check: marcador
  de ejecución ausente. Config y runtime de tests se eliminan al terminar.
- `debug config --standalone` y metadata HTTP efectivos sobre el host oficial.
- **100 tests de migración del hito anterior OK**, incluido B00/hidden/Knowledge y addons;
  no se repiten en el port dormido porque esos adapters/workshop no cambiaron.
  `private-server.mjs` admite entorno explícito para esta prueba; su default del
  workshop sigue intacto. No se repitieron render/canvas o consultas de negocio.

En 2.2.7, `ctx.agent.get` devuelve `{location,data}` y `ctx.session.get` devuelve el
Info directo; no asumir mismo decoder. El primer smoke localizó esa diferencia
antes de corregir el adaptador. La guía pública evoluciona: mandan las pruebas del pin.

## Preparación / no activar todavía como reemplazo

`general.mjs plan --project /root/autorizado` muestra sólo metadata del plan. Se
comprobó sobre `/tmp/opencode` sin crear el perfil real. `prepare --project ...
--client-closed` existe para un candidato identificado, no toca V1, no arranca
host/MCP/modelo, y no es installer productivo. **No se pidió al operador ejecutarlo
ni se ofrece aún chat de esta base incompleta.** Usar el workshop ya aprobado para
las pruebas actuales; no abrir por iniciativa repos reales/HOME con plugins V1.

El plan mantiene solicitudes auxiliares/compaction nativas sin hooks que las
bloqueen como en el laboratorio. D05 fue aprobado: compaction auto y snapshots
habilitados, imports explícitos de skills y actualización manual del pin. El guard
de skills usa transform nativo antes del prompt, no sólo flags; ver ACTIVATION.md.
Status/check offline no preparan ni activan. Launcher verify-live/chat y revisiones
de config/install/update/rollback/recovery ya probados en temporales (LAUNCHER.md y
DISTRIBUTION.md); proveedor dormido ya portado (DORMANT-PROVIDERS.md), uso real de
auth/storage todavía requiere B01/B07. Rollback no restaura datos/runtimes ni despliega globalmente.

## Estado posterior de los incrementos

1. Contrato nativo de aportes y builders por owner **implementados**, sin importar
   workshop-guard ni manipular headers V1 de los agentes ya nativos.
2. Knowledge/Ticketing/CodeGraph/Playwright/Documents/Notifier/Context7 **compuestos
   y probados en fixtures**; wrappers canónicos y selección opaca de entorno sin
   despacho autorreferente. Ver COMPOSED.md; no es conexión nueva real a negocio.
3. Auditor/propuestas nativos y runtime durable offline implementados/probados en
   temporales. Pendientes: activación durable definitiva, revisión de capas reales y
   defaults/activación/storage/distribución finales. El paso 2 sigue abierto.
4. AUNE/proyectos reales y backup/rollback/corte continúan después, bajo sus gates.

Incremento defaults/storage: [ACTIVATION.md](ACTIVATION.md). Mapping nativo de
title/summary/compaction preserva selecciones explícitas de V1; proveedor local
deshabilitado no se habilita ni se borra. Binding opt-in data/state V2 probado con
sesiones temporales, HOME/config/cache/tmp propios, sin copiar auth o abrir DB real.
La política D05 y el launcher ya están implementados/probados en fixtures; la
activación real sigue pendiente, nunca implícita por ejecutar diagnósticos offline.

Fuentes: schema https://opencode.ai/config.json y documentación oficial
https://opencode.ai/v2/docs/{agents,permissions,build/plugins/server}/. Context7
se intentó primero, pero su cuota mensual sigue agotada.
