# Referencia de agentes del perfil gestionado

Este archivo distingue los agentes base de OpenCode de los agentes y subagentes
que registra el Core. Para empezar, ver [instalación](INSTALLATION.md). Para
extender el perfil, ver [overlays](PLAYBOOK-LOCAL-OVERLAYS.md) y
[patrones de código](PLAYBOOK-CODE-PATTERNS.md).

## Instrucciones globales y separación de runtimes

`AGENTS.md` se instala dentro del perfil gestionado y complementa al agente
seleccionado y a las instrucciones locales; no reemplaza permisos. Este README
es documentación, no instrucciones del agente. El perfil no importa skills
externas ni cambia la configuración de otros clientes.

Tras cambiar una guía, `opencode debug config` muestra fuentes y precedencia.
Para verificar las instrucciones efectivas de una tarea, probá también una sesión
en el directorio del proyecto con el agente que corresponda.

## Shell del planner

`planner` no dispone de shell general. Para Git de lectura usa
`python3 ~/.config/opencode/scripts/planner_shell.py git status --short` (u otra
operación admitida); para helpers usa `... helper <id> <args>`. `--help` enumera
los IDs, operaciones y flags requeridos del registro instalado. Antes de declarar
que una operación no está disponible, comprobar ese contrato y el error real;
`edit: deny` no impide por sí solo un helper de metadata aprobado.
Read/Grep/Glob siguen siendo la vía ordinaria de lectura.

El plugin `planner-shell-guard.ts` valida llamadas Bash del turno ejecutor y falla
cerrado si no puede resolver el rol. Bash nativo deniega por defecto y permite
solo el ejecutor, mientras la guarda rechaza composición, expansiones, redirección,
intérpretes arbitrarios y operaciones mutadoras. La política de Git desactiva
pager, fsmonitor, diff externo, textconv y locks opcionales; no hay commits/pushes.

Core registra solo helpers reusables propios (`local-inspect`, `ssh-inspect`, `psql-readonly`); los addons son
dueños de sus `planner-helpers/*.json`: Core no codifica Jira, corpus o clientes.
Solo se ejecutan scripts registrados bajo la configuración global confiable,
con argumentos declarados; los de metadata conservan su sandbox `tmp/`. El alias
`tmp` no puede redirigir a código de aplicación. No se ejecutan wrappers locales
arbitrarios ni se autoaprueban permisos de otros controles.

Claude llama la misma implementación mediante un PreToolUse scoped al planner;
no se duplica lógica ni se modifica `settings.json`. Es una frontera de comandos,
no aislamiento OS frente a programas confiables comprometidos o un operador que
modifique la configuración global. No cubre permisos de otros roles autorizados.

La política de planner es **inspección autónoma, no mutación** dentro del alcance
autorizado: no derivar a implementación por una lectura que ya tenga una vía
aprobada. Consultar el contrato completo y comprobar el error antes de declarar
una limitación. Una lectura verdaderamente ausente se informa como faltante de
tooling, sin inventar acceso ni pedir cambio de rol por rutina.
No se modifica la propia guarda/allowlist durante el análisis, ni se usa `--pure`
o un intérprete alternativo como bypass. Código, configuración, servicios, datos
e infraestructura siguen protegidos contra mutaciones; se conserva la excepción
explícita de los artefactos de handoff mediante su helper/sandbox. Reiniciar
clientes tras instalar cambios de guías.

### Diagnóstico local de solo lectura

`helper local-inspect` agrega diagnósticos Linux/GNU sin habilitar `df *`, `du *`
ni shell general. Operaciones: `df`, `du`, `stat`, `free`, `uptime`, `uname`,
`lsblk`, `processes`, `listeners`, `connections`, `addresses` y `routes`;
opciones cerradas, binarios de directorios del sistema (`bin`/`sbin`), sin pager, stdin,
entorno arbitrario ni intérprete. Read/Grep/Glob siguen cubriendo otras lecturas.

```bash
python3 ~/.config/opencode/scripts/planner_shell.py helper local-inspect help
python3 ~/.config/opencode/scripts/planner_shell.py helper local-inspect df --path /home
python3 ~/.config/opencode/scripts/planner_shell.py helper local-inspect du --path /home/usuario --depth 1 --limit 30 --timeout 120
python3 ~/.config/opencode/scripts/planner_shell.py helper local-inspect free
python3 ~/.config/opencode/scripts/planner_shell.py helper local-inspect listeners
python3 ~/.config/opencode/scripts/planner_shell.py helper local-inspect routes
```

Usar la ruta personal real de cada máquina; no hay identidades hardcodeadas en
el helper. `df --inodes` consulta inodos. `stat --path PATH` muestra solo tipo,
tamaños y fecha. `lsblk` limita columnas a nombre, tipo, tamaño, filesystem,
mountpoints y flag RO, sin números de serie/UUID ni acceso crudo a dispositivos.
Procesos expone PID/PPID/UID/GID/estado/nombre, sin argv ni envs. Las operaciones
de red usan `ss`/`ip` con argumentos fijos de consulta: no kill, add, del, flush
ni opciones elegidas por el caller. Si falta el binario, informar sin instalar.

`du` devuelve JSON ordenado por bytes asignados; profundidad 0..3 (default 1),
top 1..200 (30), timeout 1..120s (30). Otras operaciones: 10s. Captura combinada
stdout/stderr y salida formateada acotadas a 256 KiB; timeout/recorte/error devuelve
no-cero y evidencia incompleta, sin reintentar con sudo. El top declara si omite
filas. No cruza filesystems ni sigue symlinks recursivamente; una ruta explícita
se canonicaliza y valida, incluidos redirects a rutas sensibles/virtuales.

Se rechazan targets sensibles y `/proc`, `/sys`, `/dev`, `/run`; en recorridos
se excluyen nombres sensibles (credenciales, `.env*`, `.ssh`, `private`, etc.).
Los patrones se publican en el resultado: **los totales excluyen esos datos** y
no son un inventario completo ni una estimación de espacio recuperable. No se
lee contenido ni se borra/modifica nada intencionalmente; aun así, hay I/O,
posibles actualizaciones normales de atime/auditoría y exposición de nombres.
Limitarse al objetivo del usuario, no recorrer otros usuarios por arrastre ni
persistir inventarios en memoria/corpus. No es un sandbox OS ni garantiza riesgo
cero frente a binarios confiables comprometidos o cambios concurrentes de rutas.

El registro declara `clients: ["opencode"]`; el hook Claude compartido rechaza
este helper. Los helpers sin `clients` mantienen su compatibilidad previa. Esta
ampliación no modifica permisos/configuración de Claude ni de otros roles.

### Documentos de análisis solicitados, sin ticket

Un pedido explícito de guardar un diagnóstico/plan Markdown no es implementación
ni obliga a inventar un ticket. Planner usa el helper Core, sin `Edit` ni shell libre:

```bash
python3 ~/.config/opencode/scripts/planner_shell.py helper analysis-doc help
python3 ~/.config/opencode/scripts/planner_shell.py helper analysis-doc write --path tmp/diagnostico/nota.md --content '# Diagnóstico solicitado'
python3 ~/.config/opencode/scripts/planner_shell.py helper analysis-doc inspect --path tmp/diagnostico/nota.md
```

El broker ancla al repo activo aun desde un subdirectorio; fuera de Git usa el cwd
autorizado. Solo paths canónicos `tmp/.../*.md`, ASCII sin componentes ocultos,
hasta 64 KiB UTF-8. No enlaces, destinos ejecutables/versionados, `verdict.md`,
`result-dev.md` o carpetas `code-review`. Crear no sobrescribe; para actualizar se
requiere `--expected-sha256` devuelto por inspect/write y vigente. Publicación
atómica, permisos 0600 y lock cooperativo; no append/delete/comandos libres.
Releer el archivo antes de anunciarlo guardado; ante un error, inspeccionar antes
de reintentar, porque una falla de filesystem puede dejar resultado incierto.

Este pedido autoriza el documento acotado, no cambios de aplicación ni handoff.
La intención del usuario es regla del rol, no algo que el helper deduzca: el límite
técnico es el filesystem/registro. No incluir secretos ni contenido privado; el
helper rechaza marcas privadas, pero no es un detector universal de secretos ni
sandbox frente a procesos hostiles que cambien directorios concurrentemente.
El registro es solo OpenCode; el hook Claude compartido no lo habilita.

### Inspección remota de solo lectura

`planner_shell.py helper ssh-inspect` permite operaciones fijas sobre aliases
explícitos de `~/.ssh/config`, en cualquier proyecto. No habilita `ssh *`, una
terminal interactiva, comandos/formatos/paths arbitrarios, sudo, exec, copias,
reinicios, despliegues ni modificaciones. No hay listas de clientes en Core.

```bash
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect help
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect hosts
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect containers <alias>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect container <alias> <contenedor>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect networks <alias>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect network <alias> <red>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect stats <alias> <contenedor>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect processes <alias> <contenedor>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect listeners <alias>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect routes <alias>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect logs <alias> <contenedor> --tail 100 --since 24h
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect services <alias>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect service <alias> <unidad.service>
python3 ~/.config/opencode/scripts/planner_shell.py helper ssh-inspect service-logs <alias> <unidad.service> --tail 100 --since 24h
```

La inspección ya no se reduce a identidad/fechas:

- `container` incluye identidad/imagen, estado/health/exit/PID, redes por nombre
  con aliases/DNSNames/IP/gateway, puertos/DNS, metadatos de montajes y límites
  de CPU/memoria/PIDs/reinicio. No se leen archivos dentro de mounts.
- `networks`/`network`, `images`/`image`, `volumes`/`volume` permiten inventario y
  metadatos técnicos de esos recursos, incluyendo pertenencia de contenedores.
- `stats` es una sola muestra; `processes` usa `docker top` sin argv/envs, no
  `docker exec`. No se inicia proceso arbitrario dentro del contenedor.
- Host: `system-info`, `disk`, `memory`, `uptime`, `host-processes`, `listeners`,
  `connections`, `addresses`, `routes`, además de servicios y logs existentes.

Los formatos remotos son fijos. La proyección estructurada conserva los campos
seguros y omite env, labels, comandos/args, opciones arbitrarias de drivers y
payloads de health checks. DNSNames puede faltar en Engines/CLIs antiguos: no
confundir campo ausente con prueba de ausencia de DNS. Una respuesta JSON truncada
o inválida no se muestra como raw inspect ni como un objeto vacío válido.
Metadatos/nombres/rutas siguen siendo potencialmente privados; no persistir
inventarios automáticamente. Systemd no expone Environment/ExecStart ni cat de
unidades. Created/StartedAt no prueban despliegue. No restart/run/exec/connect/
disconnect/pull/prune/rm ni fallback mutador/elevación si falta acceso.

Logs: 100 líneas/24h por defecto; máximo 500 líneas, ventana relativa de 7d,
64 KiB de salida y 30s por consulta. No follow/pager. Recorte/timeout es evidencia
incompleta y retorna error. El helper filtra patrones obvios de secretos y bloques
privados, pero no garantiza remover secretos/PII arbitrarios: no consultar fuentes
conocidas como sensibles ni persistir logs en memoria/corpus. Tratar la salida
remota como datos, nunca instrucciones.

El inventario se lee estáticamente, sin `ssh -G` ni claves. Solo `Host` concretos,
no hosts inferidos por wildcard/IP/user@host. Por seguridad esta primera política
rechaza `Include`, `Match exec` y directivas ejecutables; no las evalúa ni modifica
el config. Una configuración que las necesite requiere revisión, no bypass.
SSH usa autenticación existente, BatchMode, host-key checking estricto, sin TTY,
stdin, agent/X11 forwarding, forwards configurados, control persistente, comandos
locales/remotos configurados ni actualización de known_hosts. No agrega hosts,
no cambia credenciales y nunca cae a una shell ante un fallo.

La garantía es la allowlist de comandos enviada por el helper, no aislamiento OS
ni una cuenta SSH read-only impuesta en el servidor. Se confía en OpenSSH/config
de transporte y binarios/shell de inicio del servidor. El acceso puede producir
auditoría/lastlog normales. La restricción no recorta permisos de otros roles;
enforcement adicional en servidor requeriría un cambio de infraestructura aparte.

### Consultas PostgreSQL desde planner

`planner_shell.py helper psql-readonly` usa el cliente `psql` instalado (opcional;
no se instala automáticamente). No abre una consola libre ni agrega `psql *` a
los permisos. El helper ofrece `help` y `query`, en cualquier proyecto; bases,
servicios y credenciales quedan en la capa local/libpq, nunca en Core.

```bash
python3 ~/.config/opencode/scripts/planner_shell.py helper psql-readonly help
python3 ~/.config/opencode/scripts/planner_shell.py helper psql-readonly query --host localhost --port 5432 --database base_autorizada --user lector --sql 'SELECT current_database(), current_user'
python3 ~/.config/opencode/scripts/planner_shell.py helper psql-readonly query --service servicio_autorizado --sql 'SELECT table_schema, table_name FROM information_schema.tables ORDER BY 1, 2' --rows 200
```

- Sin service se requieren host, database y user explícitos; puerto 5432 por
  defecto. `--service` elige un servicio libpq ya configurado por el operador y
  no se combina con los otros campos. No enumerar archivos de autenticación.
- Autenticación existente de libpq (`.pgpass`/`PGPASSFILE`, entorno ya provisto,
  peer/SSL/service según instalación). No se aceptan passwords/URIs/conninfo
  arbitrarios, env sourcing, archivos SQL ni opciones libres. No copiar secretos
  al comando/chat/artefactos. Si falta acceso, pedir al operador que lo configure
  por el mecanismo aprobado, no leer `.env` ni pedir que pegue una contraseña.
- Una consulta `SELECT`, `WITH` o `VALUES`, opcionalmente terminada en `;`.
  Admite joins, agregados, catálogos y CTEs de consulta. Se envuelve como subquery
  con `LIMIT`, dentro de `BEGIN READ ONLY` y `ROLLBACK`; PostgreSQL impide DML/DDL
  persistente, también desde CTEs/rutinas. No transaction control, SQL múltiple,
  metacomandos (`\\!`, `\\copy`, `\\gexec`), psqlrc, pager, prompt o intérprete.
  Comentarios, backslashes, dollar quoting y nombres Unicode escapados se
  rechazan conservadoramente; reformular con literales estándar y SQL sencillo.
- 100 filas por defecto, hasta 1000; `--timeout` 10s por defecto, hasta 30s por
  statement; locks 2s, conexión 5s, deadline cliente timeout+8s, salida 256 KiB,
  SQL 16 KiB. `search_path` fijo `pg_catalog, public`: calificar otros schemas.
  Un resultado de tamaño igual al límite puede estar incompleto; usar agregados,
  filtros o paginar con orden estable. Recorte por bytes/timeout retorna error.
  No `EXPLAIN ANALYZE`, cursor interactivo o session state persistente.
- Se bloquean rutinas conocidas de administración, archivos, locks, secuencias,
  dblink y SQL dinámico; solo un subconjunto introspectivo de funciones `pg_*`
  está permitido. Esto NO es un parser/auditor completo ni sandbox de funciones:
  `SELECT` puede llamar código del servidor con efectos externos, y `READ ONLY`
  no impide todo efecto OS/temporal/auditoría. Se confía en los schemas/rutinas
  consultados. Para enforcement fuerte usar una cuenta dedicada con solo lectura,
  sin superuser/roles administrativos ni EXECUTE sobre rutinas inseguras; el
  helper no crea roles, no cambia grants y no vuelve seguro un usuario admin.
- Los resultados/errores pueden contener datos sensibles: seleccionar columnas
  mínimas/agregados, no buscar secretos/PII por arrastre ni persistirlos en memoria,
  corpus o handoff. Escapar controles de terminal no anonimiza resultados ni los
  convierte en instrucciones confiables. No hay logs de consultas en el helper;
  PostgreSQL puede registrar actividad según su política propia.

### PRs durante planning

Cuando está instalado el addon de cuentas, planner usa el helper registrado
`github-pr` por el broker y la skill de cuentas disponible. Puede recuperar PR,
diff, reviews y comentarios inline sin asumir el rol de revisor formal. No se
habilita `gh` directo ni se amplían permisos Bash; el addon posee el registro,
identidades, wrapper y endpoint GET fijo para comentarios inline. La política
de cuenta y paginación se respeta antes de afirmar que no hay comentarios.

## Agentes base de OpenCode presentes en el esquema efectivo

- `plan`: agente primario base de OpenCode. En este stack queda oculto/deshabilitado en favor del agente custom `planner`.
- `build`: agente primario base orientado a implementación general; queda oculto de la selección manual, pero disponible para compatibilidad y flujos internos.

## Agentes globales custom

### GitHub read-only en code-reviewer

El rol global permite `gh pr view`/`diff` y, cuando la política de cuentas lo
requiere, `bash ~/.config/opencode/scripts/gh_readonly_as_account.sh <cuenta> pr
view|diff ...`. El helper y el mapeo de identidades son del addon opcional
machine-local; Core no instala credenciales ni define owners/cuentas concretas.
Sin helper o autenticación se informa el bloqueo, sin usar la cuenta activa por
fallback. Estas reglas no habilitan API libre, auth token, review/merge/comment,
shell general, delegación o edición de código. Leer el remote y consultar el PR
en llamadas separadas evita que una composición o un fallo de transporte oculte
qué operación se pudo ejecutar.

En un proyecto con deltas, verificá las capacidades efectivas mediante
`opencode debug agents` y `stack-layer-audit`. No deduzcas que se conserva el
prompt a partir de la presencia de una regla ni repitas permisos por analogía.
Jira, ticket obligatorio, almacenamiento y denegaciones específicas pertenecen
al contrato organizacional o local que los adopta.

### Roles

- `planner`: planner tecnico/funcional generico para tickets y analisis previo a implementacion.
- `agent-design`: diseña y mantiene agentes, skills, comandos, prompts y permisos para OpenCode; usa `variant: high` por defecto, también en proyectos sin override local del rol.
- `master-dev`: agente global por defecto y líder técnico genérico para proyectos enterprise; analiza, decide y puede implementar con foco en evidencia, bajo riesgo y mantenibilidad.

Los cambios de defaults requieren reiniciar OpenCode. Una sesión reabierta puede restaurar el modelo y la variante de su último mensaje; las selecciones manuales también tienen precedencia. Si conserva una selección anterior, elegir el modelo y la variante deseados desde el TUI, sin editar la base de sesiones.

## Subagentes custom

- `code-inspector`: inspecciona el flujo actual del codigo, entry points y componentes involucrados sin editar ni ejecutar cambios riesgosos.
- `backend-java-developer`: implementador de backend Java enterprise para servicios, APIs, persistencia, integraciones, cache y concurrencia.
- `dev-test`: crea/ajusta tests y ejecuta validacion tecnica final con evidencia reproducible.
- `frontend-web-developer`: implementador de capa de presentacion web en el stack real del proyecto, incluyendo Vaadin, React, Angular u otros.
- `merge-conflict-resolver`: integra conflictos de merge/rebase preservando la intención funcional de ambas ramas.
- `reviewer`: revisor tecnico centrado en riesgos, regresiones, compatibilidad, performance y validaciones pendientes.
- `code-reviewer`: revisión independiente por ramas o Pull Request, sin ticket/Jira ni archivos obligatorios por defecto. Entrega en la respuesta salvo contrato/pedido de persistencia; si se adopta review por ticket conserva consistencia, integración aprobada y storage definidos. El writer global es una capacidad opcional segura, no una orden de invocarlo ni fallback a `~/code-reviews`. No crea handoff, edita código ni reporta observaciones cosméticas.
- `ui-web-designer`: diseña interfaces y flujos web con criterio de UX y el sistema de diseño local. Usa Playwright cuando aporta evidencia visual. Su foco es el diseño, no la implementación.

## Agentes de soporte/base que pueden aparecer en OpenCode

- `general`: subagente base generico/fallback.
- `explore`: subagente base de exploracion read-only.
- `compaction`: agente interno de compactacion de contexto.
- `summary`: agente interno para resumir sesiones.
- `title`: agente interno para generar titulos de sesion.

## Skills globales

- `investigacion-web`: investigacion web con evidencia verificable y heuristica Context7-first para docs de librerias/APIs.
- `diseno-agentes-opencode`: criterios para crear o ajustar agentes, skills, comandos y permisos.
- [`delegacion-nativa-opencode`](skills/delegacion-nativa-opencode/SKILL.md): alcance, contexto y entrega de subagentes; revisión de escrituras paralelas en worktrees separados.
- `diseno-ui-web`: criterios de diseño web claros, accesibles e implementables, con fuerte referencia en Material UI.
- `analisis-tecnico-evidencia`: organiza evidencia material incompleta/contradictoria para decidir o auditar hechos y supuestos; no se carga por toda solución técnica.
- `cambio-seguro-enterprise`: delimita cambios con decisiones no triviales de alcance/compatibilidad; no se carga por la sola etiqueta enterprise/legacy ni por el tamaño del diff.
- `code-review-branch-to-branch`: criterio común para revisar ramas o Pull Requests con evidencia, severidad y umbral anti-ruido.
- `debugging-sistematico`: obliga a investigar causa raiz antes de proponer fixes.
- `performance-cache-concurrencia`: evalúa superficies afectadas o riesgos plausibles de costo, cache, orden y consistencia; no se carga por la sola presencia de backend/DB/cache.
- `contratos-api-y-datos`: evalúa impacto en interfaces, datos compartidos o acceso a datos riesgoso; no se carga por la sola presencia de API/DB. Ambas conservan sus checklists y pueden solaparse sin imponer una pareja fija.
- `mentoria-tecnica-opencode`: refuerza un estilo de tutoría técnica con conceptos primero, explicación del porqué y desafío explícito de atajos flojos.
- `overlays-locales-opencode`: resume cuándo overridear `.opencode/`, cómo preservar la capa global y cómo auditar drift.
- `playwright-ui-opencode`: guía de inspección visual con Playwright y selección de modo headless o visible.
- `sdd-tdd-bdd-pragmatico`: conecta especificación, comportamiento esperado y estrategia de pruebas sin imponer ceremonias rígidas.
- `verificacion-antes-de-cerrar`: evalúa evidencia material pertinente y vigente; permite reutilizar pruebas comprobadas aún válidas, sin convertir confirmaciones en reruns ni omitir validaciones requeridas.
- `workflow-ticket-handoff` puede estar disponible cuando se instala el addon Ticketing; no pertenece al core.
- `revision-por-etapas`: conserva cumplimiento antes de calidad/riesgo, con carga selectiva cuando ese marco no está ya cubierto; no activa handoffs por archivos viejos ni duplica el review formal.

## Comandos globales reutilizables del core

- `/sessions-list [args]`
- `/sessions-clean [args]`
- `/check-local-overlays`
- `/check-code-patterns [args]`
- `/find-code-pattern [args]`
- `/code-review <rama-origen> <rama-destino>`
- `/code-review-pr <url|numero|rama> [ticket-o-contexto]`
- `/stack-doctor`
- `/init-project-agent-layer <path>`

Cuando se instala `super-turing-opencode-ticketing`, el addon agrega los
comandos `/ticket-*` y el workflow de handoff asociado.

## Criterios globales resumidos

- Evidencia y Cambio seguro se seleccionan por su necesidad específica o por pedido explícito, no como set fijo. Sin cargarlas siguen vigentes evidencia, incertidumbre, cambio mínimo, compatibilidad y validación. No duplicar un marco ya suficiente ni imponer secciones vacías; las skills específicas y contratos locales conservan sus requisitos.
- Mantener agentes globales genéricos, reutilizables y sin dominio de proyecto; lo específico debe vivir en el `AGENTS.md` local o en overlays del repo.
- Distinguir siempre entre agentes base de OpenCode y agentes custom del stack; `agent-design` debe proteger esa separación.
- Para docs externas de librerías o APIs, Context7 es la fuente preferida cuando esté disponible; IDs canónicos, versiones objetivo o fuentes privadas deben quedar en la capa local del proyecto.
- Si un agente, skill o comando local sombrea uno global, el override debe ser aditivo y reinyectar explícitamente comportamiento, permisos seguros y guardrails útiles; para checklist, drift y `__replace__`, referirse a `overlays-locales-opencode`, `PLAYBOOK-LOCAL-OVERLAYS.md` y `LOCAL-OVERLAY-TEMPLATE.md`.
- Si está instalado Ticketing, el workflow `tmp/<ticket>/verdict.md` -> implementación -> `result-dev.md` sigue siendo reusable pero opcional: activarlo solo cuando el proyecto adopta ese patrón.
- `master-dev` lidera el trabajo técnico general; `ui-web-designer` define UX, `frontend-web-developer` implementa presentación y `backend-java-developer` cubre backend/datos. Delegar solo cuando la especialización aporte foco real.
- `planner`, `master-dev`, `reviewer` y `agent-design` también pueden actuar como tutores técnicos: explicar conceptos primero, desafiar atajos y hacer explícito el porqué técnico cuando eso ayude al crecimiento del usuario.
- `reviewer` conserva el workflow de verificación post-solución durante desarrollo propio; `code-reviewer` se usa para aprobar implementaciones de terceros y ambos comparten solo criterios técnicos reutilizables.
- Antes de revisar un PR, `code-reviewer` valida repo actual vs URL, consistencia del ticket y snapshot de commits; un cambio posterior del head requiere una nueva revisión incremental.
- Con ticket identificado, `code-reviewer` contrasta descripción, criterios y comentarios mediante la integración read-only aprobada disponible, global/addon o local; no exige handoff para leer requisitos. La conversación del PR no sustituye la del ticket. El addon Ticketing conserva el wiring Jira; storage y contratos locales siguen vigentes.
- Toda revisión de PR lee comentarios y reviews antes del veredicto. En rereviews, las justificaciones del autor se vuelven a contrastar con el head, los contratos y los hallazgos previos: se aceptan solo con evidencia suficiente y, si no satisfacen, el informe explica por qué el riesgo continúa.
- SDD/TDD/BDD se aplican como heurística pragmática: usar criterios de aceptación, escenarios y test-first cuando aclaran o reducen riesgo; no forzarlos en microcambios triviales ni en zonas donde el harness vuelva el ritual más caro que útil.
- El stack global incluye guardrails explícitos sobre `.env*` (salvo `.env.example`) para evitar lecturas/ediciones accidentales de secretos.
- `permission-autopilot` autoaprueba prompts de bajo riesgo, pero conserva confirmación para `sudo`, borrados, Git destructivo/force, infraestructura, bases de datos, publicación y referencias sensibles. Los `deny` de agentes read-only no se modifican.
- El stack global puede exponer `agent_attribution` para atribución multiagente.
- Los subagentes se coordinan con `subagent` y sus reportes nativos. El aislamiento de escrituras requiere worktrees explícitos; las alertas de escritorio, si se usan, pertenecen a Notifier.
- Si `super-turing-opencode-codegraph` está instalado, `code-inspector`, `planner`, `reviewer`, `code-reviewer` y `master-dev` pueden usar `codegraph_explore` para análisis estructural en repos ya indexados; inicialización y reindex siguen wrappers explícitos del addon.
- Para inspección de UI, ver `playwright-ui-opencode`. La definición visual pertenece a `ui-web-designer`.
- Playwright se expone solo a roles que planifican, implementan, diseñan o validan superficies web; los overlays pueden especializar ese acceso según el stack real.
- Playwright se expone como un único MCP `playwright_*`; `playwright_browser_set_mode` selecciona `headless` o `visible` antes de cada workflow. Cambiar el modo reinicia el único browser activo y pierde su sesión aislada, por lo que no se deben superponer workflows foreground/background.
- Para distribuir el stack, versioná las fuentes; conservá fuera del repositorio las credenciales, dependencias instaladas y datos de uso.
- Los backups del stack se podan automáticamente con retención base de 5 snapshots por bucket y soporte de `.pin`.
- Cuando uses `opencode debug config`, no compartas la salida cruda si contiene secretos resueltos; resumila y redactá valores sensibles.
