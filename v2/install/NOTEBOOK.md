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
python3 -I -B "$CHECK/core/v2/install/notebook-preflight.py" --home "$HOME"
```

El clone crea un directorio NUEVO; no modifica repos existentes. El diagnóstico
no arranca OpenCode, abre bases, imprime configuración/auth ni ejecuta instaladores.
Informa versiones y presencia/tamaño de rutas conocidas. Puede compartirse su
JSON para decidir el siguiente paso, sin pegar `.env`, tokens ni conversaciones.
El helper admite Python 3.8+; el updater requiere Python 3.9+.

`installationApproved:false` es intencional: este inventario NO certifica el
wiring completo. Un `earlyBlockers:[]` tampoco autoriza instalar a ciegas.

## 2. Elegir la ruta correcta

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
