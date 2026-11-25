# Instalar y mantener el stack gestionado

Para un HOME sin instalación, seguí la [instalación base](../../INSTALLATION.md).
`install` no adopta ni cambia una instalación detectada.

## Cambiar sólo el texto de una skill existente

El mantenedor puede preparar una revisión local con `publishSkills` de
`v2/general/skill-release.mjs`, partiendo del plan instalado que devuelve el
owner. El arranque normal la selecciona por el hash de su base exacta, tras
validar ésta y sus fuentes. Las sesiones abiertas conservan la revisión con la
que arrancaron; para tomar la nueva basta abrir un cliente nuevo. No hay pull ni
recarga en caliente.

Sólo cambian cuerpos de `skills/**/SKILL.md` existentes con frontmatter idéntico.
No se admiten altas/bajas, agentes, comandos, helpers, plugins ni permisos. Se
archiva una copia de la configuración nativa; sólo se reubica la ruta de
configuración del auditor, sin cambiar `HOME`, rutas de ejecución, addons,
overlays ni almacenes. El parser nativo debe encontrar las mismas fuentes y
configuración, salvo esa ruta, con almacenamiento temporal. No se salta el
preflight del owner ni se altera el orden de las skills locales.

`rollbackSkills(plan, revision)` cambia el puntero para el próximo arranque,
sin restaurar datos. No se borran revisiones usadas por clientes. Si cambia el
perfil base, las revisiones locales no se trasladan automáticamente: integrar
su contenido en la fuente canónica para incluirlo en una actualización general.

## Actualizar el binario oficial

En un perfil generado con este lanzador, `/update` (TUI) y `opencode upgrade`
usan el actualizador nativo en el prefijo npm privado de la instalación. El
perfil notifica, no instala automáticamente. No recompone plugins, agentes ni
overlays y no hace backup de historial. Cerrá y reabrí por la entrada habitual
para usar el binario nuevo. Las guardas validan el arranque por fuentes y
capacidades, no por versión. Un cambio de API aún puede requerir ajustar el addon.

### Context7 con cuenta propia (opcional)

Al componer el perfil, el archivo privado
`~/.config/opencode-private/context7/api-key` opta por el transporte stdio.
El directorio debe tener modo `0700` y la clave, `0600`. El operador provisiona
también `@upstash/context7-mcp@4.8.0` en el prefijo npm privado
`~/.local/share/opencode-stack/runtime/context7-mcp-4.8.0` (`0700`), sin
instalaciones automáticas al abrir el cliente. Sólo ese proceso recibe la
clave; no se copia al perfil. Sin archivo privado se usa el remoto público.
Si el binding privado está incompleto, el fallo se ve en `/mcps`, sin impedir
el arranque ni intentar otro transporte.

## Actualizar la capa gestionada de una instalación V2 existente

Desde un checkout limpio de la versión de Core que querés aplicar:

```sh
bash install.sh plan
# Cerrar normalmente los clientes que usan el perfil y, si corresponde, pausar
# sincronizaciones propias de Knowledge antes de tomar el backup.
bash install.sh update --clients-closed
```

El plan identifica los stores y procesos que los usan sin modificarlos. El
updater usa el runtime npm instalado y no lo actualiza. Respalda historia
y snapshots; si el perfil usa Knowledge, también Engram y el corpus. Recompone
la configuración a partir de revisiones exactas en una generación nueva. El
almacén publicado, los datos de addons y la autenticación nativa se conservan
in situ; no se exportan ni se copian credenciales. No se actualizan checkouts
canónicos ni se cambian configuraciones globales por debajo del perfil.

La base se actualiza sólo con Core. Los perfiles compuestos requieren los
bindings/runtimes calificados de sus addons. Si ya usás AUNE, seguí la guía
`v2/UPDATE.md` de su owner y pasá su `--source-lock`; no cambies el owner o la
cohorte mediante el updater general. Para repos privados puede usarse la
identidad Git existente o `--github-account CUENTA` con `gh` autenticado.

## Verificar y recuperar

```sh
bash install.sh verify-backup --destination /ruta/a/la/generacion-de-update
bash install.sh rollback --destination /ruta/a/la/generacion-de-update --clients-closed
```

El rollback restaura la entrada anterior y revierte sólo cambios conocidos del
owner. Nunca vuelve a poner la DB del backup encima de la activa. Si hay drift
o procesos con el store abierto, se detiene sin matar clientes ni quitar locks.
Conservá todas las generaciones y sus recibos: el runtime o el almacén pueden
seguir referenciados por la entrada actual incluso después de actualizar.

Si falla un intento, consultá `failure.json`, `started.json` y los recibos que
alcanzó a escribir bajo la ruta informada. No borres datos ni reintentes sobre
la misma generación. Las causas de infraestructura o autenticación se revisan
por separado con la CLI nativa. Los journals quedan en la máquina; no hace falta
transportar el historial ni los backups para continuar en otra sesión local.
