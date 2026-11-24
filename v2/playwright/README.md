# Playwright en el perfil gestionado

Playwright es opt-in; la instalación base no descarga Chromium ni registra el
MCP. En un perfil compuesto se usa un binding explícito, con pin MCP `0.0.85` y
un navegador aprobado. `validateInstalledPlaywright` comprueba el snapshot
administrado sin descargar ni reparar runtimes durante el arranque.

Para mantener un binding existente, el owner puede usar
`node v2/tools/playwright-runtime.mjs plan` y `status`. `prepare --client-closed`
valida y empaqueta un runtime seleccionado; no instala Chromium desde cero.
La desactivación o el retiro requieren el lifecycle explícito del componente.

## Modos y guardas

- Headless por defecto, visible sólo por pedido explícito. Elegí el modo antes de
  abrir una página: cambiarlo no transfiere la sesión, pestañas ni cookies.
- Los roles permitidos son `master-dev`, `planner`, `dev-test`,
  `frontend-web-developer` y `ui-web-designer`. No se permite ejecutar código de
  navegador arbitrario ni acceder a perfiles personales.
- Los uploads se limitan a archivos autorizados y confinados al proyecto. Los
  artefactos nombrados se escriben por ruta absoluta dentro del output-dir del
  perfil. No usar symlinks, archivos sensibles o destinos externos.
- Clics, formularios y navegación pueden afectar sistemas remotos; que una tool
  figure en el catálogo no autoriza mutaciones. Los tests usan datos sintéticos
  o páginas loopback, sin credenciales ni sitios del operador.

Para diagnóstico, verificá primero el binding y el estado con `opencode mcp list`.
Un fallo de DNS fuera del navegador no se corrige reinstalando el perfil.
