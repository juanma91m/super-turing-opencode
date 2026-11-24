# OpenCode V2 gestionado

- [`../INSTALLATION.md`](../INSTALLATION.md): entrada única de instalación base.
- [`install/README.md`](install/README.md): updates de fuentes sin reemplazar el almacenamiento.
- [`CONTRATO-GESTIONADO.md`](CONTRATO-GESTIONADO.md): alcance del host y de la CLI.
- `general/`: composición, distribución, guardas, perfiles y launcher.
- `runtime/`: instalación y verificación del binario oficial fijado.
- `tools/`: utilidades explícitas de mantenimiento y diagnóstico.
- `testing/`: fixtures y regresiones, no son parte del runtime.

No hay instalación implícita de addons ni cambios a los defaults de un perfil
al instalar la base en otro entorno. Los tests nativos que requieren el binario
local deben correrse en directorios temporales con datos sintéticos.
