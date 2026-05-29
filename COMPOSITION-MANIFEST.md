# COMPOSITION-MANIFEST

## Objetivo

Este documento define el modelo actual de composición del ecosistema `super-turing-opencode`.

La instalación efectiva ya no debe leerse como salida de un único repo. Hoy el estado final se compone por capas:

1. stack base global,
2. addons globales opcionales,
3. runtime/background gestionado,
4. overlays locales por proyecto.

## Superficies de despliegue

- `~/.config/opencode/` — configuración global efectiva, agentes, commands, skills y plugins globales.
- `~/.opencode/` — runtime local gestionado de OpenCode cuando el addon background adopta la instalación.
- `<repo>/.opencode/` — overlay local por proyecto.

## Repos canónicos y ownership

| Componente | Repo canónico | Superficie principal | Regla de ownership |
|---|---|---|---|
| Stack base | `opencode-stack` | `~/.config/opencode/` | base reusable; no describe por sí solo la composición final cuando hay addons activos |
| Background | `super-turing-opencode-background` | `~/.opencode/` + plugins async globales | dueño canónico del modelo async/background, del lifecycle y de los patches host/core versionados; el stack base no distribuye esos assets |
| Knowledge | `super-turing-opencode-knowledge` | `~/.config/opencode/` + runtime Engram/Qdrant | dueño de assets de knowledge y de augment aditivo de autonomía |
| Ticketing | `super-turing-opencode-ticketing` | `~/.config/opencode/` | dueño de workflow de tickets, coupling y augment aditivo de autonomía |
| Notifier | `super-turing-opencode-notifier` | `~/.config/opencode/plugins/opencode-notify.ts` | dueño del plugin de notificaciones del SO |
| Overlay Higyrus | `super-turing-opencode-higyrus` | `higyrus/.opencode/`, `higyrus/AGENTS.md`, `higyrus/opencode.json` | dueño del overlay local del proyecto Higyrus |

## Orden recomendado de composición

Cuando haya que reconstruir o reconciliar una máquina, aplicar en este orden:

1. `opencode-stack`
2. `super-turing-opencode-knowledge`
3. `super-turing-opencode-ticketing`
4. `super-turing-opencode-notifier`
5. `super-turing-opencode-background`
6. overlays locales por proyecto, por ejemplo `super-turing-opencode-higyrus`

Racional:

- el stack base instala la capa reusable común,
- knowledge y ticketing enriquecen esa base,
- notifier suma capacidad aislada,
- background gobierna el runtime productivo y la UX async,
- los overlays locales aterrizan la especialización repo-específica encima de todo lo anterior.

## Reglas de composición

### 1. Aditivo cuando el archivo expresa comportamiento compuesto

Usar composición aditiva en archivos donde varios addons agregan contexto complementario.

Casos actuales:

- `agents/plan.md`
- `agents/build.md`
- augment opcional sobre:
  - `agents/planner.md`
  - `agents/master-dev.md`
  - `agents/agent-design.md`

Señales de composición aditiva:

- markers `KNOWLEDGE_AUTONOMY_START/END`
- markers `TICKETING_AUTONOMY_START/END`

En estos casos, el criterio correcto de status no es igualdad byte a byte contra un solo repo, sino presencia de los bloques esperados.

### 2. Dueño único cuando el asset es ejecutable o feature-complete

No intentar mergear semánticamente archivos que son herramientas completas por sí mismas.

Casos típicos:

- plugins enteros,
- commands con contrato propio,
- scripts operativos del addon,
- lifecycle/installers,
- patches host/core versionados.

En estos casos debe existir dueño único o, si se conserva una copia adicional, tratarla como mirror explícito y no como source of truth independiente.

### 3. Tooling interno del addon != asset productivo compartido

Scripts como:

- `scripts/status.sh`
- `scripts/uninstall.sh`
- `scripts/manage_agent_autonomy.py`
- `scripts/manage_install_marker.py`

pueden existir dentro del repo del addon para operar su lifecycle, sin que eso implique que deban competir por el mismo path en `~/.config/opencode/` como parte del estado final compuesto.

## Nota específica sobre background

El componente background se modela en dos planos:

1. **addon/lifecycle/plugin**
2. **patch host/core versionado + runtime gestionado**

La expectativa operativa es:

> instalar `super-turing-opencode-background` debe alcanzar para instalar todo lo necesario del sistema async/background: plugin, patch host/core requerido y runtime productivo gestionado.

El stack base no debería distribuir assets canónicos de background. La funcionalidad async/background completa debe instalarse desde `super-turing-opencode-background`.

## Cómo interpretar status en un entorno compuesto

### `opencode-stack`

- debe validar solo la base que realmente le pertenece,
- debe ignorar archivos actualmente gobernados por addons activos cuando eso sea intencional.

### Addons (`knowledge`, `ticketing`)

- deben validar assets propios por igualdad cuando tengan dueño único,
- y validar por markers/presencia cuando participen en archivos aditivos como `plan.md` y `build.md`.

### Overlays locales de proyecto

- deben auditarse contra la base global usando `/check-local-overlays`,
- y además pueden tener su propio ciclo repo-canónico -> target repo.

## Resultado esperado del modelo

- menos falso drift,
- ownership más claro,
- instalación final explicable como composición por capas,
- y menor dependencia de conocimiento tribal para saber qué repo manda sobre cada área.
