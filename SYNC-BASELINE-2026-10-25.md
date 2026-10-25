# Línea base OpenCode — 2026-10-25

Preparación para una nueva simplificación; no ejecuta ninguno de los puntos de
`PLAN-SEGUNDA-SIMPLIFICACION.md`. Este registro no se instala ni se carga como prompt.

## Alcance auditado

- Core `opencode-stack` y addons Knowledge, CodeGraph, Ticketing, Notifier,
  Documents, Background, GitHub Accounts Local y AUNE: nueve repos canónicos.
- Nueve overlays canónicos: Higyrus, Market Data, Virtual Broker, Keycloak,
  Higyrus Gateway, Aggregator, Perfil Inversor, Documento API y OMS API.
- Instalación global efectiva y superficies OpenCode de esos nueve productos.
- Remotos GitHub de los canónicos y mirror GitLab del Core.

## Reconciliación

- Se conserva y publica el cambio de modelo a `openai/gpt-6.1-sol`, las mejoras
  pendientes de code review, las métricas CodeGraph v2 y el soporte Background
  para OpenCode 1.19.4 ya instalado; no se reconstruyen runtimes.
- Core: sincronizados changelog y la recomposición aditiva de planner/master-dev;
  el drift de estos dos agentes era solo un salto de línea final.
- Virtual Broker: restaurado el `AGENTS.md` canónico faltante, sin tocar CLAUDE.md.
- Gateway: preservado en el canónico el contexto actual del perfil `external` y
  mappings por instancia desde clients-configs/demos-configs.
- Aggregator: reconciliadas instrucciones actuales de mise, documentación temporal,
  fechas, posición valuada duplicada, logger y commits, conservando los guardrails.

## Validación

- Nueve configuraciones locales y configuración global válidas con `opencode debug config`.
- Paridad OpenCode: 9/9; auditoría de overlays: cero errores, cero warnings,
  37 recortes explícitos aceptados. Sin assets obsoletos pendientes.
- Core: 12 tests; CodeGraph: 28; Knowledge: 12 Python + 4 de plugins;
  Ticketing: 10; Background: 6; lifecycle GitHub Accounts Local: aprobado.
- Patch Background 1.19.4: reverse-check sobre el checkout gestionado aprobado;
  runtime activo `1.19.4--202610232249`.
- Status de addons y paridad de helpers AUNE verificados; CodeGraph permanece 1.5.0.

## Diferencias preservadas, fuera del alcance OpenCode

El checker completo de manifests compartidos todavía informa tres diferencias
Claude. No se modifican manifests para esconderlas ni se fuerza paridad:

1. Virtual Broker: CLAUDE.md de producto difiere del snapshot del overlay.
2. Gateway: CLAUDE.md de producto contiene la actualización del perfil external.
3. Aggregator: `.claude/skills` apunta a `../.agents/skills`, no al árbol del overlay.

No ejecutar syncs amplios que sobrescriban esas superficies sin reconciliar su
ownership. El stack global Claude Code y sus instrucciones quedan fuera de este trabajo.

Los checkouts upstream/gestionados de Engram y OpenCode no son repos de publicación;
sus patches pertenecen a los addons. No se commitean productos ni worktrees, ni se
versionan credenciales, índices, datos de sesiones o corpus de conocimiento.
