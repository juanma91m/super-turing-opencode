# Actualización V2 conservadora desde repos remotos

Para una notebook antigua, empezar por [NOTEBOOK.md](NOTEBOOK.md): diagnóstico
acotado sin instalar y selección de la ruta del owner antes de modificar datos.

## Alcance real

Linux con Python 3, Git, Node compatible (22.22.2+, 24.15+ o 26+), npm/corepack,
Bubblewrap y **los runtimes completos de addons ya instalados y seleccionables**.
Pin oficial OpenCode 2.2.7. No es un bootstrap de máquina vacía ni un conversor
universal para cualquier versión histórica. El instalador V1 `--complete` no es
un atajo para completar dependencias sobre una instalación V2.

El updater está diseñado para actualizar un stack conocido sin reemplazar sus
datos. Si la notebook es más antigua que los contratos reconocidos, se detiene:
**no crear una DB vacía, no resetear ni copiar la DB de otra computadora**.
No se ha probado sobre la notebook real. Los tests de preservación son fixtures;
no convertir esa evidencia en una garantía de compatibilidad universal.

## Un comando de actualización; sin preguntas interactivas

Desde un checkout actual de Core, primero cerrar OpenCode V1/V2, Engram y procesos
de sincronización/uso de corpus de esa máquina. No basta cerrar una conversación.

```sh
bash scripts/update-from-remote.sh update --clients-closed
```

Descarga código actual de Core a un checkout nuevo; luego clona las revisiones
exactas del `source-lock.json`. No hace pull/reset/clean sobre repos de trabajo.
No cambiar remotes/identidades ni usar force para resolver un checkout sucio.
Para la capa organizacional usar el updater de su owner, no el portable de Core.
Para repos privados puede seleccionarse `--github-account <cuenta-local-gh>`:
el token pasa sólo por pipes de `gh` a Git, sin archivo ni cambio de cuenta global.
Sin esa opción se usa el mecanismo Git ya configurado de la máquina; no se copia
autenticación desde otra computadora ni se inventa un alias SSH portable.

Para una revisión sin tocar la instalación:

```sh
bash install.sh --v2 plan
```

Con layout no estándar: `--home /home/usuario --history-db /ruta/opencode.db
--engram-db /ruta/engram.db --qdrant-dir /ruta/qdrant`. Las rutas son selecciones
explícitas, no se buscan secretos ni se sourcean overrides desde el modelo.
Con V2 activo no se acepta seleccionar historia vieja mediante override.

## Preservación

1. Exige confirmación de cierre y comprueba descriptores observables; no mata
   procesos, elimina locks ni enrola Cloud. Lock exclusivo del instalador.
2. Reserva espacio antes de empezar. Destino por defecto:
   `~/.local/share/opencode-stack/updates/<generación>`. Puede elegirse
   `--destination /volumen-durable/nueva-generacion`; no usar tmpfs.
3. Backup API de SQLite para OpenCode y Engram, integrity/FK checks, hashes,
   copia verificada del corpus bajo lock y preservación de directorios nativos
   `snapshot`/`repos` si existen. Backups privados; sin exportar transcripts.
4. Fuentes por commits exactos en directorios nuevos, no desde working trees
   sucios. Dependencias Artifact Studio por lockfile en esas fuentes nuevas.
5. Compone roles/plugins/assets por sus owners y valida schema/fuentes. La
   migración oficial de historial corre en una copia aislada con Bubblewrap.
6. Cambia únicamente el wrapper final una vez terminada la preparación; preserva
   configuración/auth originales, DB Engram, corpus, índices y proyectos ajenos.
   Un owner opt-in puede actualizar sus archivos con su lifecycle/receipts.
7. Commit de generación local. La próxima actualización descubre **el nuevo store
   activo**, nunca vuelve a la DB V1 y pierde las conversaciones posteriores.

La nueva entrada no atiende chat hasta que concuerdan el marker de generación y
el recibo completo. Configuración/historia listas no prueban OAuth/servicios/modelo.
Puede ser necesario autenticar por la interfaz nativa; no se copian tokens por
archivos. `needsLogin` conservador no certifica invalidez ni valida credenciales.
Se conservan paths originales de recursos externos: no se promete rescate de todos
los adjuntos externos sólo por respaldar SQLite.

## Bloqueos explícitos

- Historia file-per-session/JSON sin SQLite reconocido: requiere conversión
  oficial previa, no un migrador privado.
- Runtime todavía bajo ownership managed-local-install de Background: requiere
  su corte/rollback sellado. El updater no lo toma por la fuerza.
- Dependencias/versiones/wiring desconocidos, defaults/overrides no revisados o
  drift local: se detiene, conserva backups/generación e informa el fallo.
- Context7 puede conectar y seguir sin cuota. No comprar, cambiar cuenta ni
  fingir consultas; usar documentación oficial como fallback explícito.
- No inicializa/reindexa CodeGraph, no refresca Qdrant, no enrola Engram Cloud ni
  aplica reparaciones de journal histórico por actualizar el stack.

Estas limitaciones son deliberadas: **una actualización de cualquier notebook
«super vieja» sin conocer su layout aún no está certificada**.

## Recovery y rollback

No repetir una generación fallida a ciegas. Conservar `failure.json`, backups y
fuentes; no borrar locks huérfanos sin reconciliación explícita.

```sh
bash install.sh --v2 verify-backup --destination /ruta/generacion
bash install.sh --v2 rollback --destination /ruta/generacion --clients-closed
```

Rollback verifica hashes/drift y devuelve el comando anterior. Nunca restaura
una DB vieja sobre la nueva: ambas quedan intactas, incluidas conversaciones
creadas después del update. La reversión de archivos del owner usa su adapter y
se niega si un proyecto avanzó. No es transacción global contra hardware/crashes
o writers no cooperativos. No hay poda automática de generaciones/backups.

## Pruebas

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s v2/install -p 'test_*.py' -v
node --test v2/install/loader.test.mjs
```

Cubren backups/corpus, update/segunda actualización, datos V2 nuevos tras rollback,
fallos/locks/dirty entry y layout desconocido. Las suites nativas de Core/AUNE y
`migrations/v2/test/final-storage-native.test.mjs` prueban por separado composición,
permisos y migración oficial aislada. No sustituyen una prueba integrada en notebook.
