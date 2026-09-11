---
name: stitch-playwright-ui-opencode
description: Resume el uso operativo de Playwright y Stitch para trabajo de UI en OpenCode, incluida la selección dinámica entre navegador headless y visible.
compatibility: opencode
---
## Cuando usarme
- Antes de usar Playwright para inspección visual de UI desde agentes de diseño o frontend.
- Antes de usar Stitch para generar, editar o variar pantallas.
- Cuando hace falta decidir si una inspección/generación debe ser headless, foreground o retomada desde estado previo.

## Playwright
- Usarlo como segunda opción cuando fetch, docs o contexto textual no alcancen.
- Hay un único MCP `playwright_*`. Antes de iniciar cada workflow, llamar `playwright_browser_set_mode` con `headless` o `visible` según el pedido.
- Si el usuario pide explícitamente modo visible, headed o foreground, seleccionar `visible`; ese pedido ya cuenta como confirmación y no debe repreguntarse.
- Si pide headless, o no expresa preferencia, seleccionar `headless`.
- En trabajo async o delegado, mantener modo no interactivo/headless salvo que el usuario haya pedido explícitamente una ejecución visible en foreground.
- No depender de interacción manual del usuario para completar el flujo; el modo visible sirve para observación o takeover acordado.
- Cambiar de modo cierra el navegador actual y pierde su sesión aislada. Para login o takeover manual, mantener `visible`, esperar la confirmación del usuario y continuar sin volver a seleccionar modo ni cerrar el browser.
- El MCP mantiene un solo browser activo: no iniciar otro workflow Playwright concurrente ni cambiar el modo desde background mientras haya una prueba foreground en curso.
- Puede ser usado por coordinación, planning, frontend, diseño UI o testing cuando el navegador aporte evidencia real.

## Stitch
- Su único owner operativo es `ui-web-designer`; otros agentes deben derivar allí la generación, edición o variación de pantallas.
- Generar prompts concretos y reutilizables.
- Si una operación tarda o falla por timeout/conexión, no asumir fracaso inmediato.
- Verificar el estado del proyecto y de las screens antes de reintentar.
- Favorecer `edit_screens` para refinar una base existente y `generate_variants` para explorar alternativas.
- Evitar disparar múltiples generaciones duplicadas por ansiedad ante un timeout.

## Regla práctica
- Primero recuperar estado existente.
- Luego decidir entre inspección, edición o variantes.
- Recién al final regenerar desde cero si no hay base útil.
