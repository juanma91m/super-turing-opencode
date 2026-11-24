# Instalar y mantener el stack gestionado

Para un HOME sin instalación, seguí la [instalación base](../../INSTALLATION.md).
`install` no adopta ni cambia una instalación detectada.

## Actualizar una instalación V2 existente

Desde un checkout limpio de la versión de Core que querés aplicar:

```sh
bash install.sh plan
# Cerrar normalmente los clientes que usan el perfil y, si corresponde, pausar
# sincronizaciones propias de Knowledge antes de tomar el backup.
bash install.sh update --clients-closed
```

El plan identifica los stores y procesos que los usan sin modificarlos. El
updater conserva el runtime 2.2.7 y vuelve a comprobar su pin. Respalda historia
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
