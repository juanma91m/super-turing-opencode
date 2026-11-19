# B00 — fuentes de trabajo editables y reapertura del workshop

## Estado

**Paso 1 cerrado: corregido, probado y aplicado por el operador, con reapertura
real confirmada.** La salida de repair informó changed:true, inputs existentes
reemplazados:0, permisos/tools sin cambios y backup separado. Después, documents.mjs
chat verificó la composición y el operador confirmó que abrió normalmente para
promptear. V1 y su storage no se modificaron por esta reparación.

No cambia la condición de corte general: la composición completa
`general → AUNE → proyecto` sigue siendo una puerta obligatoria independiente.

## Causa y reproducción

La composición de Documenter incluía tres fixtures de proyecto en el mismo lote
que agentes/scripts/configuración y también las fijaba por hash como ejecutables
confiables. Documenter tenía permiso para editarlas, pero después de una edición:

- Reapertura: `Managed asset changed; refusing upgrade`.
- Comando permitido: `Workshop: trusted asset changed`, aunque el script confiable
  y el comando no hubieran cambiado.

Ambos fallos se reprodujeron con tests rojos sobre un perfil temporal antes del
fix. No se usó el workshop real para reproducirlos. El control negativo legacy
permanece en la suite, sin restaurar código defectuoso ni editar fuentes V1.

## Diseño del cambio

- Documents declara tres `workingInputs` con **bytes iniciales** de fixtures
  públicas. Ya no son assets gestionados ni pins de integridad.
- La base planifica seeds únicamente para archivos ausentes, dentro del proyecto,
  sin symlinks/directorios/rutas sensibles o conflictos con ownership protegido.
  No lee ni reemplaza inputs existentes: conserva incluso JSON incompleto de una
  edición en curso. Validar el documento sigue siendo responsabilidad de las tools.
- Los seeds ausentes forman parte del lote validado antes de escribir. Si hay
  drift de configuración/scripts, tampoco se crean esos seeds. Si el operador
  borra una fixture, una preparación posterior puede sembrar de nuevo ese archivo
  ausente; esto no sobrescribe un archivo regular existente.
- Permisos, roles, targets, tools, instrucciones, cinco MCP y demás pins no cambian.
  No se altera el motor `upgradeOwned` ni se aceptan fuentes editadas como nueva
  baseline confiable. La separación es de ownership, no una excepción genérica de
  la raíz `artifact-studio/` a controles de seguridad.

Para migrar un perfil antiguo se reconstruye la configuración legacy **desde las
fuentes conocidas**, no desde el contenido de los documentos o una configuración
editada. La diferencia admitida son sólo los tres pins iniciales. Si el caller
quitó otro pin, agregó uno, cambió permisos, instrucciones o un script, falla
antes de actualizar el config/crear el backup. Los inputs tienen que ser archivos
regulares; un symlink provoca rechazo, no su adopción o eliminación.

La opción de composición `inputOwnership: managed` existe únicamente para
reconstrucción/control negativo de la baseline anterior; el default es editable.
El coordinador expone la migración mediante una acción explícita y client-closed,
no por actualización silenciosa al abrir chat/verify. Un perfil legacy recibe
una indicación de reparación antes de recomponer o iniciar servicios.

## Aplicación por el operador — realizada; conservar como referencia

1. Cerrar **sólo el cliente workshop V2**. No cerrar V1 para este arreglo y no
   detener procesos ajenos. Canvas ya fue reportado detenido por el operador.
2. Ejecutar:

```bash
node "$HOME/.local/src/opencode-stack/migrations/v2/documents.mjs" repair-inputs --client-closed
```

3. Si termina bien, abrir normalmente:

```bash
node "$HOME/.local/src/opencode-stack/migrations/v2/documents.mjs" chat
```

No continuar con chat si repair falla. Compartir sólo el error; no resetear el
spec, ejecutar apply/instaladores antiguos, borrar pins a mano o copiar auth.

La reparación conserva el marker Documenter y crea
`opencode.json.pre-documenter-inputs.bak` separado de los backups anteriores.
Reemplazo atómico por archivo, no transacción global del filesystem. Los archivos
existentes de trabajo no se reemplazan ni se «reparan» automáticamente. La acción
no inicia el host/MCP, no ejecuta renderers y no cambia auth/storage; compone y
valida el lote conocido. El nuevo config se validó además con el host oficial
aislado en tests. Al abrir chat sí se comprueba la composición y se inician los
servicios normales del perfil; el cliente debe estar reiniciado.

`plan` sólo informa metadata y la necesidad de reparación. Una reparación repetida
del mismo perfil válido es idempotente; no elimina backups ni concede permisos.
No hace falta volver a generar documentos o repetir su QA. Basta confirmar que el
workshop vuelve a abrir y que el spec corregido sigue conservado.

## Verificación realizada

```bash
KNOWLEDGE_API_NATIVE=1 node --test migrations/v2/test/*.test.mjs
node migrations/v2/smoke-workshop.mjs
node migrations/v2/documents.mjs plan
```

- **100 tests de migración OK**, incluidos 16 específicos de inputs/reapertura y
  composición Documenter. Los dos tests de la regresión fallaron primero y pasaron
  tras el fix; el control legacy sigue reproduciendo ambos errores.
- Upgrade conocido: comparación profunda del config confirma cambio exclusivo de
  tres pins, conserva bytes editados de los tres specs (uno deliberadamente
  incompleto), output, CLI, hidden, backups e idempotencia/reapertura.
- Rechazo de permisos/config desconocidos, instrucciones, scripts, pin adicional,
  pin protegido eliminado y symlink de input. Sin cambio de config/inputs/backup
  en esos controles negativos. Los scripts siguen bloqueando shell/reapertura si
  cambian, aunque los documentos editables también hayan cambiado.
- Seeds: planificación sin escrituras, confinamiento/ownership y lote completo
  validado antes de crear archivos. No se abre contenido existente para establecer
  confianza ni se parsea como config.
- **`debug config --standalone` oficial 2.2.7** pasó en el perfil temporal migrado;
  no hubo calls a tools de los backends ficticios.
- **11 casos nativos de base OK**, proveedor ficticio, roles read-only/writer,
  shell/broker, escapes, deny, ask y atribución. No inferencia o negocio real.
- Antes de la aplicación, el plan real informó pins legacy y reparación pendiente,
  sin modificar el perfil. El agente no ejecutó repair/apply/chat/verify reales;
  el operador hizo después la aplicación y reapertura indicadas a continuación.

No se repitieron renderers, browser/canvas o QA ya aprobados: no se modificaron.

### Confirmación real del operador

El operador compartió salida de `repair-inputs --client-closed`: ownership editable,
changed:true, existingInputsReplaced:0, permissionsAndToolsChanged:false, backup
`opencode.json.pre-documenter-inputs.bak`, mcpStarted:false y restartRequired:true.
Luego ejecutó `documents.mjs chat`: host 2.2.7, 22 agentes, 33 skills, cinco MCP
conectados, libnotify, Plan/Build hidden efectivos y Documenter con 7 roles/8 tools/7
comandos registrados. El usuario confirmó apertura normal para promptear.

**Reparación y reapertura real aprobadas en este alcance.** Es evidencia aportada
por el operador, no otra inspección de bytes o ejecución de servicios aquí. No
repetir reparación, render/QA o pruebas de Qdrant por ritual. Las frases genéricas
del inspector sobre «manual test» y «real semantic review» no anulan las pruebas
anteriores; delegación técnica sigue cerrada y Documenter conserva sus seis targets.

## Ownership y archivos

- Base: `working-inputs.mjs`, `workshop-profile.mjs` y
  `test/working-inputs.test.mjs`: mecanismo genérico de seed no gestionado.
- Documents: `v2/documenter/working-inputs.mjs` y `composition.mjs`: declaración
  de datos y reconstrucción de la baseline legacy del propio addon.
- Base: `documents.mjs` y `test/documenter-assets.test.mjs`: coordinación de
  actualización explícita y evidencia de integración.
