# Adaptadores V2 del stack base

Implementaciones nuevas para la distribución oficial, sin imports internos,
patches del host ni dependencias de Background. El código V1 permanece separado
y activo hasta completar la migración descrita en `../migrations/v2/README.md`.

## Estado

- `general/`: candidato separado del workshop con base y aportes nativos de los
  addons, comandos/helpers, dispatch y mantenimiento de sesiones por API. Base con
  tres capas sintéticas y composición de 22 roles/5 MCP fixture; no AUNE/overlays
  reales ni despliegue actual. El paso 2 sigue abierto para runtime durable,
  auditor/defaults/activación. Ver [general/COMPOSED.md](general/COMPOSED.md).

- `playwright/`: composición aditiva del MCP/browser con router canónico,
  runtime ya disponible, headless por defecto y modo visible por pedido. 24 casos
  nativos y flujo real headless contra una página loopback propia validados. Ya
  aplicado y Connected según operador/plan; headless público en example.org pasó
  navegación/snapshot/DOM/cierre. HTML externo no tiene H1, confirmado vía HTTP:
  la aserción original de encabezado era incorrecta. DNS example.com se reprodujo
  fuera del browser; no se cambió red/runtime. Visible real pedido y confirmado
  por captura con navegación/título correctos; espera cierre en el chat operador.
  Takeover autenticado no probado. No copia perfiles/cookies,
  no instala browsers y deniega ejecución host `browser_run_code_unsafe` en el
  piloto. Ver [playwright/README.md](playwright/README.md) para tradeoffs y límites.

- `plugins/controlled-permissions`: transforma reglas shell y registra el hook
  público de evaluación; reutiliza `lib/permission-policy.ts`, sin duplicar listas
  de riesgo. Denies finales preservados, asks sensibles/wrappers conservados.
- `plugins/planner-shell`: valida con el broker Python canónico y el actor del
  turno ejecutor; no infiere el rol desde el último mensaje/steer.
- `plugins/agent-identity`: hint del actor real y `agent_attribution` con permiso
  previo. La salida sólo tiene metadata del contexto visible, no cuerpos ni una
  promesa de historial completo.

- `plugins/env-guard`: primer adaptador al hook público `execute.before`; tests
  unitarios del contrato y del registro con contexto simulado, carga comprobada
  en el catálogo del host oficial y rechazo nativo de un `read` a `.env*`
  sintético, sin abrir ningún `.env` real. Protege rutas
  `.env*` salvo el archivo exacto `.env.example`, incluyendo destinos de moves y
  edits anidados. Evita imprimir el path o comando sensible en errores.
- El control es léxico: no es un parser shell ni confinamiento de filesystem.
  No garantiza bloquear acceso indirecto desde un proceso arbitrario.
- **Pendiente**: composición completa, cobertura fuera del fixture y distribución
  productiva. Los adaptadores todavía no están instalados en producción ni
  habilitados en la baseline cerrada; se ejercitan en perfiles explícitos.

Los adaptadores de permisos/planner/identidad tienen cobertura nativa en
`smoke-workshop.mjs` sobre un proyecto sintético: escritura acotada, read-only,
shell permitido, escapes rechazados, deny de sesión, aprobación sensible
rechazada y atribución sin texto. No implica validar sus futuros addons/MCP o
uso irrestricto en repos reales. Ver `migrations/v2/SEGUNDA-PRUEBA.md`.

Smoke sin inferencia ni MCP reales:

```bash
node migrations/v2/smoke-env-guard.mjs
```

Carga únicamente este plugin mediante configuración inline explícita sobre el
runtime oficial ya instalado; espera su publicación asíncrona en el catálogo.
Cada proceso usa el entorno del staging. El servidor es privado/loopback, con
autenticación efímera no impresa y limpieza de su propio proceso al terminar.
La baseline cerrada en disco se verifica antes y después; no se cambia producción.

La prueba de ejecución nativa está en `node migrations/v2/smoke-pilot.mjs`, con
proveedor loopback y un perfil temporal independiente. En la API nativa 2.2.7,
`read` recibe `{path: ...}`, no el `{filePath: ...}` de V1. Para la primera prueba
humana, ver `migrations/v2/PRIMERA-PRUEBA.md`: no requiere habilitar shell/autopilot
ni terminar aún todos los ports.

No ejecutar el installer/sync V1 para desplegar estos directorios. No ampliar
permisos para conseguir que un smoke pase; preservar los denies y asks sensibles.
