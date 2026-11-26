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

## Comparación de cambios del stack (piloto)

`stack-ab.mjs` pertenece a Core. Prueba dos revisiones sintéticas del prompt
de `code-inspector` con la misma tarea, rúbrica y versión de OpenCode. No
requiere addons ni forma parte de la instalación o el arranque del perfil.

```bash
node v2/tools/stack-ab.mjs prepare
node v2/tools/stack-ab.mjs execute --runtime /ruta/al/runtime-npm-gestionado \
  --tmp-root /ruta/a/un/directorio-temporal-neutro-existente
```

`prepare` muestra el plan y sus hashes sin abrir un host. `execute` usa
un proveedor simulado en loopback, no ejecuta herramientas y crea un HOME,
perfiles y stores privados descartables. El directorio temporal no puede
estar en un repo ni bajo configuración de proyecto heredable. El runner
comprueba las fuentes con `opencode debug config --standalone` y no
adopta el perfil activo, guarda transcripts ni indexa repos.

El resultado JSON verifica que el host aplicó cada revisión, que la
respuesta esperada quedó en la sesión correspondiente y que pasa una
rúbrica mínima. **No compara calidad de modelos, costos ni ahorro de
tokens**: las dos respuestas son simuladas. `Ctrl+C` cancela el piloto y
cierra sólo sus procesos. Las revisiones arbitrarias, tareas reales y
proveedores reales quedan fuera de este primer incremento.
