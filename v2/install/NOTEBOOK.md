# Notebook antigua: continuar desde remotos, sin depender de otra PC

Todo el código necesario ya está publicado. No copiar HOME, credenciales, DBs,
perfiles archivados o rutas de la computadora original a la notebook. No hace
falta resolver la cuota Context7 para descargar las fuentes. Tampoco usar el
instalador V1 `--complete` para «poner al día» una instalación desconocida.

## 1. Diagnóstico corto, sin instalar

En una terminal normal de la notebook (no un HOME aislado de un agente):

```sh
mkdir -p "$HOME/.local/share/opencode-stack/bootstrap"
CHECK="$(mktemp -d "$HOME/.local/share/opencode-stack/bootstrap/notebook-XXXXXXXX")"
git clone --depth 1 https://github.com/juanma91m/super-turing-opencode.git "$CHECK/core"
python3 -I -B "$CHECK/core/v2/install/notebook-preflight.py" --home "$HOME" --save-report
```

El clone crea un directorio NUEVO; no modifica repos existentes. El diagnóstico
no arranca OpenCode, abre bases, imprime configuración/auth ni ejecuta instaladores.
Informa versiones y presencia/tamaño de rutas conocidas. **No hace falta pegar
ninguna salida en otra conversación.** Con `--save-report` deja en la notebook:

```text
~/.local/state/opencode-stack/install/diagnostics/attempt-*/
  diagnostic.json   # metadata del estado detectado
  NEXT-STEPS.md     # decisiones y acciones locales según los resultados
```

La ruta concreta aparece en la terminal. Archivos privados, sin sobrescribir
informes anteriores. El inventario no cambia la instalación; las únicas escrituras
de ese paso son los dos artefactos de diagnóstico solicitados.
El helper admite Python 3.8+; el updater requiere Python 3.9+.

`installationApproved:false` es intencional: este inventario NO certifica el
wiring completo. Un `earlyBlockers:[]` tampoco autoriza instalar a ciegas.

**Cada intento `update` actual ejecuta y guarda este diagnóstico automáticamente**,
antes de backups, clones de la cohorte o cambios de instalación. Si hay bloqueos
tempranos, se detiene y señala `NEXT-STEPS.md`. También deja `attempt.json` con
estado/generación si el intento falla después. `plan`, verify-backup y rollback
conservan su comportamiento previo: no se bloquea un rollback por dependencias
del instalador y `plan` no crea este informe por rutina.

## 2. Elegir la ruta correcta

| Resultado local | Qué hacer en la notebook |
|---|---|
| Node/Python/herramientas faltantes | Seguir la indicación por dependencia de `NEXT-STEPS.md`, seleccionar runtimes compatibles y repetir diagnóstico. No reinstalar el stack V1. |
| Background `managed-local-install` | Mantener el stack anterior; preparar el corte/rollback propio de esa notebook con su owner. No borrar el marker para eludir el bloqueo. |
| Sólo historial JSON | Preparar conversión oficial sobre una copia y verificar la historia antes de actualizar. No crear SQLite vacío. |
| SQLite y JSON simultáneos | Determinar localmente cuál contiene la historia completa; no fusionar ni descartar automáticamente. |
| Sin bloqueos tempranos | Ejecutar el plan del owner; comprobar wiring/runtimes/stores y cerrar clientes antes de update. |
| Update detenido más adelante | Leer `attempt.json`, `NEXT-STEPS.md` y los journals de la generación; conservar todo y resolver localmente el owner afectado. |

- **Background `managed-local-install`, historial sólo JSON o layout desconocido:**
  detenerse, conservar todo y preparar la migración oficial/rollback de ESA
  notebook. No crear SQLite vacío ni forzar la entrada nueva para aparentar éxito.
- **Datos/runtimes reconocibles:** ejecutar `plan` del owner. `plan` verifica
  selección de stores/cierre observable, no certifica toda la construcción ni
  sustituye backups. Los preflights completos del builder siguen siendo obligatorios.
- **AUNE/productos:** usar el owner privado AUNE, no el updater portable que omite
  esa capa. No asumir workspace, aliases SSH o credenciales de otra máquina.

Desde un checkout ACTUAL del owner AUNE descargado con la identidad local correcta:

```sh
bash v2/update.sh plan --home "$HOME"
```

Si el preflight/alcance fue revisado, están las dependencias y todos los clientes
OpenCode/Engram/sync están cerrados:

```sh
bash v2/update.sh update --home "$HOME" --clients-closed --github-account juanma91m
```

La cuenta debe existir/autenticarse en la notebook. No copiar tokens ni hacer
`gh auth switch` por automatismo. Para una máquina sin AUNE, la ruta portable está
en [README.md](README.md). El updater aún no es un bootstrap de máquina vacía.

## 3. Después se puede mantener desde la notebook

Con instalación exitosa, las correcciones se obtienen de los remotos con nuevos
locks/generaciones y rollback; no hace falta volver a la PC original. Conservar
todos los backups y el receipt. Si un update se detiene, conservar `failure.json`
y la generación: no borrar locks, bases o checkouts ni repetir a ciegas.

Comprobar después versión, selección de historial, login nativo, capas y catálogos.
Fuentes descargadas no equivalen a instalación lista. Context7 sin cuota y Rovo
intermitente siguen siendo incidencias; no desactivar guardas para abrir chat.

## 4. Si continuás con un agente en la notebook

Indicarle que lea esta guía y el directorio de diagnóstico local señalado por el
instalador. `NEXT-STEPS.md` contiene el handoff: resultado, acciones por bloqueo,
reglas de preservación y archivos que inspeccionar. Puede recuperar la evidencia
en esa misma máquina sin pedirte copiar outputs, secretos o bases a esta sesión.

Esto hace autónoma la continuación, **no convierte los layouts antiguos desconocidos
en migraciones ya implementadas**. En esos casos el comportamiento correcto sigue
siendo conservar la instalación anterior y preparar un cambio local seguro.
