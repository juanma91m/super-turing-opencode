# Guardas y contrato nativo por proyecto

Los conjuntos `delegationTargets`, `readOnlyShellRules` y `toolActors` producidos
en el plan global son baselines útiles, pero no incluyen deltas nativos de proyecto.
Para la autorización efectiva el guard consulta
**ctx.agent.get({agentID}).data.permissions**, que no incluye
approvals/overrides de una sesión. No usa ctx.config, APIs privadas ni un compositor
de prompts o archivos de aprobación paralelo.

- Target/managed tool: permiso allow o ask en ese agente; un deny nativo prevalece
  aunque la sesión autorice. El motor V2 sigue aplicando sus propios denies/asks,
  catálogo/policies y el contrato adicional del addon. El guard no concede permisos.
- Shell read-only: misma integridad y parser literal, reglas del agente efectivo.
  No acepta pipes/expansiones o shell libre por una excepción local de Git/helper.
- Edit read-only: el default debe seguir deny; todas las rutas de write/edit/patch
  deben estar permitidas por excepciones nativas y dentro del proyecto físico.
  Se normaliza traversal, se rechazan symlinks y se verifican todas las rutas/moves
  de un patch. Un formato sin rutas identificables no pasa. Allow amplio no elimina
  la responsabilidad read-only; approvals de sesión nunca producen estas excepciones.
- Continuaciones: mismo padre y agente, igual que antes. Prompt global retenido,
  entorno seguro, guard .env, broker y closed catalogs siguen activos.
- El auditor reporta targets/actores efectivos, no presenta el snapshot global
  anterior como guard aplicado a un proyecto. Warnings de semántica/cambios locales
  no se transforman por esto en aprobación de la jerarquía completa.

La configuración y los plugins locales son código de confianza.
No es sandbox frente a un owner que modifica su config/carga código, ni una prueba
formal de inclusión de globs o ausencia de TOCTOU con procesos locales maliciosos.
No se infiere la autorización de negocio de un target por clasificarlo como writer:
valen sus permisos propios, alcance del pedido y reglas del rol/caller.

Evidencia: dos unitarios Core + host oficial con nueve report writers locales,
ocho Git read-only, especialistas Python/TS y negativos de session-only edit/target/
MCP. Smoke general30 casos, incluidos rechazo de prompt perdido, env, shell libre,
anidación y sesión ajena. Sin herramientas o servicios de negocio reales.

Las revisiones activas no absorben cambios del checkout. Para aplicar una revisión
nueva, seguí el [mantenimiento del perfil](../install/README.md) y los checks del
owner de cada overlay.
