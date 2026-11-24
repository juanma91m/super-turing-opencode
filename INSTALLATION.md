# Instalar OpenCode Stack desde cero

## Requisitos

Linux x86-64, Git, Bash, Python 3.11 actualizado con SQLite, Node.js 22.22.2 o
posterior de la rama 22 y npm. Necesitás acceso al repositorio y al registro npm
oficial. No uses `sudo`. Para conversar, también necesitás una cuenta de OpenAI
con acceso al modelo configurado por el perfil.

## Instalar el perfil base

En una terminal normal:

```sh
git clone https://github.com/juanma91m/super-turing-opencode.git
cd super-turing-opencode
bash install.sh plan-install
bash install.sh install
export PATH="$HOME/.opencode/bin:$PATH"
opencode --version
```

El plan no escribe. El instalador no edita el shell ni toma control de una
instalación existente. Deja la generación privada y su `complete.json` bajo
`~/.local/share/opencode-stack/installs/`, y publica `~/.opencode/bin/opencode`
sólo después de validar el perfil y comprobar que el almacén nativo nace vacío.
Podés agregar esa ruta al `PATH` en tu shell si querés que el comando quede
visible en terminales nuevas.

## Abrir tu primera sesión

Para la primera prueba, usá un directorio propio sin configuración de OpenCode
del proyecto. No hagas esta prueba desde el checkout del stack.

```sh
mkdir -p "$HOME/prueba-opencode"
cd "$HOME/prueba-opencode"
opencode debug paths
opencode session list --format json
opencode auth login openai
opencode
```

Antes de iniciar sesión, `opencode --version` debe mostrar `opencode v2.2.7` y
el listado debe estar vacío. Completá el login desde la terminal, sin pegar
credenciales en archivos del repo. Ya en la TUI, podés probar: «Explicame en una
frase qué agente está activo. No uses herramientas ni escribas archivos».
`opencode debug config` muestra las fuentes de configuración si necesitás
diagnosticar el arranque.

El perfil **base** no necesita ni instala Engram, Qdrant, Playwright, Context7,
Documenter, Rovo, CodeGraph, Notifier, ni AUNE y sus overlays. Ver
[owners y alcance](README-DISTRIBUTION.md) para saber quién los administra.

## Repetir la prueba en un HOME temporal

Desde un checkout limpio, `python3 -B v2/testing/fresh-install-smoke.py`
descarga el pin oficial y ejecuta la misma instalación sobre un HOME temporal.
Comprueba la entrada por `PATH`, las fuentes, el almacén nativo vacío y el
registro efectivo de agentes, comandos, skills, tools y guardas. No usa login
real ni realiza inferencias y elimina sólo el entorno temporal que creó.

## Si algo no arranca

- Si `opencode --version` muestra otra versión, comprobá `command -v opencode`:
  la entrada esperada está en `~/.opencode/bin`.
- Si el plan detecta una instalación existente, no borres archivos. Para una
  instalación de este stack, seguí la [guía de mantenimiento](v2/install/README.md).
- Si falla la preparación, el intento se conserva con `failure.json` en la ruta
  informada; no se reemplaza otra entrada.
