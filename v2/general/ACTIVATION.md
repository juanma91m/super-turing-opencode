# Defaults y preparación de activación del candidato V2

**Actualización vigente:** runtime durable y candidato general ya preparados,
revisión versionada instalada, check/verify-live reales pass con reutilización
nativa autorizada del piloto V2. Sin Stitch/Background,0 modelo/negocio o DB V1.
Ver PASO2-CIERRE.md para cierre técnico del paso2 y límites. El resto conserva la
historia/evidencia de implementación de defaults/storage, no un bloqueo aún vigente.

## Estado: implementación probada, no activación real

Se implementaron selección conservadora de modelos auxiliares, defaults D05 aprobados,
binding opt-in de storage nativo V2 y lifecycle offline. Se validaron con OpenCode oficial **2.2.7** en temporales. No se
preparó/activó el candidato real ni su runtime durable definitivo; no se abrió la
DB V1 o la DB V2 del operador con un host de ensayo. V1/workshop no cambiaron.

Los CLI siguientes son sólo diagnóstico, sin host/MCP/modelos o escrituras:

```bash
node migrations/v2/general-defaults.mjs plan
node migrations/v2/general-storage.mjs plan
node migrations/v2/general-composed.mjs plan --project /tmp/opencode
node migrations/v2/general-composed.mjs status --project /tmp/opencode
```

El launcher ahora implementa verify-live/chat con flags explícitas de candidato,
cierre y reuse; sólo se ejecutó contra stores temporales. Ver [LAUNCHER.md](LAUNCHER.md)
para efectos, precondiciones y límites. Un plan/status nunca equivale a esos consentimientos.

`general-composed.mjs check --project <directorio>` existe para un candidato **ya
preparado explícitamente**: jamás llama prepare ni actualiza assets. Comprueba
hash/owner/extra-config, bytes del binario oficial contra el pin conocido y schema/
fuentes mediante CLI con storage temporal. Incluye preflight de snapshots por
nombres Git, sin contenidos. No inicia server/MCP/modelos ni abre DB de aplicación;
no sustituye el auditor del registro vivo o la aceptación real de las capas.

`status` distingue not-prepared, ready-assets, needs-prepare y drift, sin corregirlos.
Se ejecutó sobre la selección real: **not-prepared**, sin crear el destino. `check`
se ejecutó sólo en temporales; no correr prepare real como remedio automático.

## Defaults observados y preservación

`defaults.mjs` lee sólo JSON V1 sin interpolar variables o abrir referencias. El
reporte devuelve IDs de modelos y flags/metadata allowlisted, no valores de opciones
de proveedor, URLs, headers, prompts, tokens o contenido de archivos referenciados.
Valores variables/formatos desconocidos quedan `configured-unreviewed`.

Selección observada en este incremento:

| Superficie | V1 explícito | Candidato nativo |
|---|---|---|
| Modelo/default agent | openai/gpt-6.1-sol; master-dev | Conservados |
| small_model | Igual al principal | No se copia alias V1; overrides auxiliares explícitos abajo |
| title | gpt-6.1-sol, low | agents.title.model con #low |
| summary | gpt-6.1-sol, medium | agents.summary.model con #medium |
| compaction | gpt-6.1-sol, medium | agents.compaction.model con #medium |
| Ollama | Proveedor loopback configurado, 7 modelos, deshabilitado | Siete definiciones preservadas; uso y discovery bloqueados. Ver DORMANT-PROVIDERS.md |
| snapshots/autoupdate/compaction root | No declarados en JSON V1 | No inferir equivalencia de defaults V1/V2 |

`maintenanceDefaults` falla si cambia la selección principal, hay small_model
distinto sin mapping, mutaciones de prompt/request auxiliares, OpenAI deshabilitado,
o algún proveedor custom activo que se perdería. No omite estos cambios como si
fueran equivalentes. `planGeneral` sólo acepta esos tres modelos auxiliares, con
proveedor ya permitido y sin cuerpo/request/policies nuevos. Los roles propios no
cambian y el auditor compara también cada override auxiliar explícito.

Las definiciones dormidas siguen en V1 intactas y ya se preservan en el plan nativo,
sin habilitarlas. Source fields no mapeados fallan; no se omiten ni copian secretos.
La policy de uso sola no evita discovery en2.2.7: se desactiva también el builtin.

## Storage V2 existente: referencias, no copia de autenticación

`storage.mjs` selecciona únicamente el piloto dentro del staging V2 identificado:
markers públicos exactos owner/kind/version y stat de data/state/DB esperados, sin
abrir sus contenidos ni resolver credenciales. Symlinks, DB ausente, otro owner,
otro descriptor o una ruta de almacenamiento V1 fallan sin init/fallback/adopción.
El diagnóstico real confirmó esos paths/markers, **no el estado del login**.

`bindV2Storage(profile, selected, {clientClosed:true,reuseV2Storage:true})` produce un
descriptor runtime sin writes: sólo data/state pasan a los paths nativos existentes.
HOME/config/cache/tmp siguen exactamente bajo el candidato; ni copia ni enlaces
de auth/DB. `generalEnvironment` revalida el binding y no acepta OPENCODE_DB, keys o
loaders heredados que lo desvíen. Verificar el ejecutable oficial fijado pertenece
además al launcher; los markers no son una prueba criptográfica del runtime.

La confirmación de cierre es humana, no detección de procesos ni serialización OS.
Al usarlo realmente, cerrar los clientes V2 que comparten ese store (incluido el
workshop); no matar procesos ajenos. El host nativo puede escribir migraciones,
locks, sesiones y refresh OAuth normales. No prometer cero escrituras físicas,
backup independiente o rollback transaccional. La autenticación válida sigue siendo
responsabilidad del runtime; si no está disponible, detenerse antes de iniciar otro
login por iniciativa. Esto **no migra historial V1**, no lo abre y no lo convierte.

## Evidencia de este incremento

- **66 Node + 3 Python general**, **29 casos base**
  y **41 compuestos** pasaron;100 regresiones legacy pertenecen al hito anterior,
  sin cambios a esos adapters aquí. El compuesto audita los tres modelos auxiliares sin
  drift y mantiene todos los guards/targets/catálogos anteriores.
- Host oficial con proveedor loopback ficticio: overrides title/summary/compaction
  visibles por API; hooks de peticiones reales observaron title low y compaction
  medium, hubo solicitudes efectivas al mock sin bloquear auxiliares como workshop.
  Summary tiene evidencia de registro/modelo, no otro flujo de resumen certificado.
- Un primer host creó una DB nativa temporal y una sesión por API. Tras cerrarlo,
  otro candidato con HOME/config propios y binding explícito volvió a consultar la
  misma sesión nativa. Sin SQL/copia de DB/credenciales/conexiones reales y sin DB
  alternativa bajo HOME candidato. No prueba por sí solo refresh OAuth de cuentas.
- Tests negativos: falta de ambos consentimientos, owner inválido, symlink, DB
  ausente, descriptor cambiado, entorno DB ajeno y config/HOME fuera de frontera.
- Los tres `plan` reales pasaron sólo selección/metadata. No se lanzaron modelos,
  MCP, servicios o un host sobre stores reales por este diagnóstico.

## D05: política aprobada e implementada en el candidato

El usuario confirmó explícitamente las cuatro recomendaciones. Esto autoriza su
implementación y pruebas, **no el corte, prepare definitivo o reuse real del store**.

1. **Compaction automática nativa**: `compaction.auto:true`, conservando modelo/
   variant auxiliares y sin cambiar keep/buffer nativos o habilitar compaction remota.
   El fixture simula uso alto de la ventana y verifica resumen automático medium y
   continuación, sin llamar la API manual. No prueba calidad semántica con OpenAI real.
2. **Snapshots nativos**: `snapshots:true`. Fixture Git en subdirectorio: dos writes,
   stage undo, cancel redo y commit rollback; archivo original restaurado y creado
   eliminado; índice/refs Git y archivos manuales/ignorados/fuera de scope intactos.
   Los tests limpian sólo sus temporales. No se implementa GC privado o borrado de
   objetos de snapshots al limpiar sesiones; historial durable puede conservarlos.
3. **Sin autoimportar skills de otros clientes**. Importar lo útil explícitamente
   por owner; conservar GitHub/organización/proyectos en sus capas. No declarar que
   esa decisión ya aprobó todas las skills externas inventariadas.
4. **Binario fijado y actualización explícita**: `update:"disable"`, entorno limpio
   y verificación SHA256 2.2.7; sin fallback a PATH, adopción, instalación o repair.
   Notificación de disponibilidad es una decisión de UX separada.

Addons no pueden reemplazar implícitamente snapshots/compaction/update/warming.
Esto todavía no es configuración productiva aplicada. Después:
uso autorizado del launcher y distribución de configuración ya probados
([DISTRIBUTION.md](DISTRIBUTION.md)), activación durable autorizada,
pasos AUNE y once proyectos con el gate real general → AUNE → proyecto, historial
rico/backup/restore/salida Background adopted y recién el corte autorizado.

### Skills: límite real del pin, no confiar sólo en flags

En 2.2.7 el switch Claude fue efectivo, pero el fixture demuestra que
`OPENCODE_DISABLE_EXTERNAL_SKILLS=1` no evita descubrir `~/.agents/skills`. Además,
un skill.transform durante setup ve sólo builtins: las fuentes de archivos se
registran después. No se conserva un filtro inefectivo ni se parchea el loader.

`skills.mjs` registra un transform **nativo** al procesar el primer prompt, antes
de resolver sus skills/adjuntos y ensamblar el contexto. Filtra definiciones cuyo
path seleccionado venga de `.agents/skills` o `.claude/skills`, refresca en prompts
posteriores y conserva las fuentes propias de config y `.opencode/skills`. Un hook
de permisos adicional impide recuperación por saved/session allows.

La prueba observa catálogo raw externo antes del prompt (discovery no es una
barrera de lectura OS); después no llegan sus descripciones/cuerpos al modelo,
su carga explícita falla incluso con allow de sesión y una skill nativa de proyecto
sí carga. Imports owner deben usar assets/rutas nativas revisadas. No es un loader
privado, copia/reconstrucción de prompts ni certificación de todos los overrides.

### Snapshots y datos sensibles

Snapshots pueden guardar contenido completo de archivos elegibles en data nativo.
El guard de read no es filtro de captura. `check` inventaría paths tracked y
untracked no ignorados del directorio activo, detectando candidatos `.env*` salvo
`.env.example`, claves/certificados y stores conocidos por nombre antes del CLI.
Contrasta exclusiones con `git check-ignore --no-index`, igual que el nativo2.2.7:
reporta inventario/excluidos/expuestos y bloquea si queda alguno expuesto. No lee
esos contenidos, modifica el índice o inventa un filtro privado de captura. La
política que sólo sirve a un repo se mantiene local; no se instala globalmente.

La exclusión protege updates de working tree, **no borra historia**: índices de
snapshots sembrados pueden referenciar objetos ya presentes en el Git fuente.
Prueba sintética oficial con tracked/untracked excluidos confirma undo normal,
preservación del índice y que los blobs sensibles no se copian/materializan en el
store nuevo. No es detector de secretos con otro nombre ni sandbox de Git/historia.
Fuera de Git sólo rollback conversacional; snapshot es best-effort, no backup/
transacción/secure erase ni reversión de red/procesos/DB. No prometer que commit
rollback elimina objetos.
