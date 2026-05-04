---
name: stitch-playwright-ui-opencode
description: Resume el uso operativo de Playwright y Stitch para trabajo de UI en OpenCode, con foco en headless, polling y evitar regeneraciones ciegas.
compatibility: opencode
---
## Cuando usarme
- Antes de usar Playwright para inspección visual de UI desde agentes de diseño o frontend.
- Antes de usar Stitch para generar, editar o variar pantallas.
- Cuando hace falta decidir si una inspección/generación debe ser headless, foreground o retomada desde estado previo.

## Playwright
- Usarlo como segunda opción cuando fetch, docs o contexto textual no alcancen.
- En trabajo async o delegado, asumir modo no interactivo/headless.
- No depender de un navegador visible ni de interacción manual del usuario.
- Si una inspección headed/manual realmente agrega valor, pedir confirmación explícita y hacerlo en foreground.

## Stitch
- Generar prompts concretos y reutilizables.
- Si una operación tarda o falla por timeout/conexión, no asumir fracaso inmediato.
- Verificar el estado del proyecto y de las screens antes de reintentar.
- Favorecer `edit_screens` para refinar una base existente y `generate_variants` para explorar alternativas.
- Evitar disparar múltiples generaciones duplicadas por ansiedad ante un timeout.

## Regla práctica
- Primero recuperar estado existente.
- Luego decidir entre inspección, edición o variantes.
- Recién al final regenerar desde cero si no hay base útil.
