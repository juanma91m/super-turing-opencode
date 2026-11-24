# Composición general con addons nativos

La instalación base no activa addons. Cada aporte tiene un owner que administra
sus capacidades, dependencias, permisos y configuración. Para mantener una
composición instalada, ver [mantenimiento](../install/README.md).

## Contrato de contribuciones

`planGeneral` admite contribuciones explícitas identificadas (`version:1`,
`kind:general`). El coordinador `addons.mjs` selecciona los builders; cada repo
mantiene su `v2/general.mjs`, assets, reglas y adaptación. No se invoca el instalador
ni se simula el registro de otros plugins.

El aporte consume agentes nativos, documento nativo, CLI y métodos de assets del
plan; no recibe código del proyecto ni config arbitraria como baseline confiable.

- Agentes anteriores: cuerpo retenido, modo/modelo conservados y reglas anteriores
  como prefijo. Autonomía se agrega desde la fuente del owner, sin sustituir globals.
- Permisos/policies/plugins globales anteriores conservados como prefijo; un aporte
  no puede quitar guardas/defaults ni reemplazar el MCP de otro owner.
- Assets en config/bundle confinados, no colisiones ni symlinks; no copiar `.env*`
  reales u overrides `.local.*`. Los archivos del proyecto no forman parte del lote.
- Cada owner declara catálogo cerrado de tools. Namespace desconocido/mutador y
  actor no autorizado fallan incluso si una sesión/delta intenta un allow más amplio.
  Restricciones nativas más estrechas siguen mandando; los guards no conceden acceso.
- Tras componer se serializan agentes nativos y se derivan targets, roles con Edit
  denegado, reglas shell y actores por tool. Un registro no amplía autoridad solo
  por aparecer. Source de datos, percepción visual y autorización siguen separados.

La herencia **organizacional/proyecto** sigue siendo nativa: contexto de su plugin
opt-in y deltas de proyecto sin borrar `system` global. Este contrato es para
componer addons generales, no un compositor privado de prompts locales ni una
excusa para mover dominio AUNE a la base.

## Owners y límites

| Integración | Contrato |
| --- | --- |
| Context7 | Sólo documentación pública; ver [conexión y cuota](../context7/OPERATIONS.md). |
| Knowledge | Datos y wrappers de su owner; no se indexa automáticamente ni se copian credenciales. |
| Ticketing | Lecturas por rol; OAuth no amplía permisos. El handoff es opt-in. |
| CodeGraph | Consulta estructural e índices separados por proyecto/worktree; lifecycle explícito. |
| Playwright | [Runtime verificado](../playwright/README.md) y límites de navegador por rol. |
| Documents | Herramientas y runtimes del owner; publicar requiere el permiso explícito que corresponda. |
| Notifier | El destino de alertas y el escritorio se administran en el addon. |

Los perfiles compuestos conservan las responsabilidades del Core. AUNE y los
proyectos tienen owners separados, con sus propios permisos explícitos.
