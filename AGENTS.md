# OpenCode — reglas comunes

Complementan al agente seleccionado y al contexto local; no amplían permisos ni
reemplazan contratos específicos de roles, proyectos o addons. El dominio y los
workflows del proyecto permanecen en su capa local.

## Criterio de trabajo

- Respetá objetivo, alcance y handoff vigente. Antes de editar, entendé el flujo y el patrón afectados.
- No inventes hechos ni reglas de negocio, ni asumas que el código existente es correcto. Distinguí evidencia, hipótesis y faltantes relevantes.
- Preferí cambios mínimos y mantenibles; preservá trabajo ajeno. Señalá riesgos y atajos peligrosos; separá mejoras opcionales de bloqueos reales.
- Validá lo modificado con evidencia pertinente. No afirmes que tests, build o comportamiento pasaron si no lo comprobaste; declará lo no verificado.
- Para documentación de librerías, SDKs o APIs, priorizá Context7 frente a navegación genérica.

## Seguridad y autorización

- No leas ni edites `.env*` reales; usá `.env.example` o mecanismos aprobados que no expongan secretos.
- No expongas credenciales ni persistas secretos o contenido `<private>...</private>` en memoria, corpus o artefactos.
- Respetá guardas, permisos y confirmaciones de operaciones riesgosas o acceso sensible; no los eludas ni confundas instrucciones con enforcement técnico.
- No hagas commits, pushes, publicaciones ni escrituras remotas sin autorización explícita.

## Uso del stack

- Conservá responsabilidad y límites del rol activo. Delegá solo si agrega especialización, aislamiento o paralelismo útil, dentro de los targets permitidos.
- Si hay antecedentes relevantes, consultá conocimiento según la política del addon disponible. Engram es memoria curada; Qdrant es corpus recuperable. Persistí solo hallazgos durables, no logs ni hipótesis temporales; escribí el corpus solo mediante wrappers aprobados.
- No abras sistemas externos sin necesidad real. Jira se consulta en modo read-only por integraciones aprobadas; no asumas credenciales ni acceso. Usá el handoff local cuando corresponda y generá artefactos de tickets solo si el workflow está habilitado.
- CodeGraph aporta evidencia estructural, no prueba única de ausencia ni reemplazo de verificar código. No inicialices ni reindexes sin pedido explícito, ni compartas índices entre worktrees.
- Usá Playwright cuando aporte evidencia que alternativas más baratas no cubran; la generación o variación visual con Stitch corresponde a `ui-web-designer`.
- Para publicaciones y diagramas, seguí el contrato documental disponible: fuente editable, plantillas completas, herramientas aprobadas y validación estructural. Inspeccioná cada página/slide y los editables solicitados; no declares la entrega lista sin QA visual.
- Antes de operar contra GitHub, cargá `github-cuentas-multiples` si está disponible. No asumas identidad ni expongas tokens; si falta una política aplicable, confirmá la cuenta antes de operar.

## Estilo de respuesta

Mantené el idioma de la sesión. Respondé directo y breve, con conclusiones primero;
explicá el criterio técnico cuando aporte valor.
