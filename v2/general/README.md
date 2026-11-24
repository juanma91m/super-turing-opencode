# Perfil general gestionado

El perfil base se genera con `planGeneral` y se distribuye con un bundle de
configuración ligado a su revisión. `render.py` prepara las definiciones nativas
con los roles, modelos, variantes y prompts de Core. Ver [instalación desde
cero](../../INSTALLATION.md).

- `master-dev` es el agente por defecto. `planner` analiza y usa un broker de
  helpers acotados; no adquiere shell libre. Los roles de lectura no se vuelven
  escritores por cambios de permisos de una sesión.
- Los comandos de sesión usan la API pública. El mantenimiento de sesiones
  requiere alcance y confirmación explícitos; no elimina la sesión activa.
- `stack-layer-status` y `stack-layer-audit` informan fuentes, permisos y
  registro efectivo sin mostrar prompts ni credenciales. `stack-layer-scaffold`
  propone un delta para revisar, no escribe configuración de proyecto.
- Los deltas locales conservan el prompt base cuando sólo definen campos
  soportados. El auditor y las guardas consultan el rol efectivo. Ver el
  [contrato nativo](NATIVE-CONTRACTS.md) y el [playbook de overlays](../../PLAYBOOK-LOCAL-OVERLAYS.md).
- Los addons no se cargan implícitamente. Sus aportes se ensamblan con un
  [contrato explícito](COMPOSED.md), sin absorber sus datos o permisos en Core.

## Verificar

`opencode debug config` muestra las fuentes que carga el runtime. Para validar
la instalación base, usá la [prueba con HOME temporal](../../INSTALLATION.md#repetir-la-prueba-en-un-home-temporal).
