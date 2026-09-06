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
| Stack base | `opencode-stack` | `~/.config/opencode/` | base reusable y dueño del scaffolding/auditoría de overlays locales; no describe por sí solo la composición final cuando hay addons activos |
| Background | `super-turing-opencode-background` | `~/.opencode/` + plugins async globales | dueño canónico del modelo async/background, del lifecycle y de los patches host/core versionados; el stack base no distribuye esos assets |
| Knowledge | `super-turing-opencode-knowledge` | `~/.config/opencode/` + runtime Engram/Qdrant | dueño de assets de knowledge y de augment aditivo de autonomía |
| CodeGraph | `super-turing-opencode-codegraph` | `~/.config/opencode/` + runtime global + `<repo>/.codegraph/` | dueño del runtime/MCP/wrappers de inteligencia estructural; cada índice permanece machine-local en su repository root |
| Ticketing | `super-turing-opencode-ticketing` | `~/.config/opencode/` | dueño de Jira, Atlassian Rovo, comandos `/ticket-*`, workflow de tickets y augment aditivo de autonomía |
| Notifier | `super-turing-opencode-notifier` | `~/.config/opencode/plugins/opencode-notify.ts` | dueño del plugin de notificaciones del SO |
| Documents | `super-turing-opencode-documents` | `~/.config/opencode/` + runtime Quarto user-space | dueño de publicación PDF/DOCX/ODT, plantillas, QA visual y lifecycle del runtime documental |
| GitHub accounts local | `super-turing-opencode-github-accounts-local` | `~/.config/opencode/skills/github-cuentas-multiples/` | addon privado y machine-local; dueño del mapeo cuenta/owner/alias SSH de esta máquina, sin credenciales |
| Overlay Higyrus | `super-turing-opencode-higyrus` | `higyrus/.opencode/`, `higyrus/AGENTS.md`, `higyrus/opencode.json` | dueño del overlay local del proyecto Higyrus |

## Orden recomendado de composición

Cuando haya que reconstruir o reconciliar una máquina, aplicar en este orden:

1. `opencode-stack`
2. `super-turing-opencode-knowledge`
3. `super-turing-opencode-codegraph`
4. `super-turing-opencode-ticketing`
5. `super-turing-opencode-notifier`
6. `super-turing-opencode-documents`
7. `super-turing-opencode-background`
8. addons privados machine-local, cuando existan, como `super-turing-opencode-github-accounts-local`
9. overlays locales por proyecto, por ejemplo `super-turing-opencode-higyrus`

## Instalación orquestada

El repo base expone un único entrypoint para bootstrap:

```bash
bash install.sh --main
bash install.sh --complete
```

- `--main` instala únicamente la base reusable.
- `--complete` instala base, Knowledge, CodeGraph, Ticketing, Notifier,
  Documents y Background en el orden anterior.
- el orquestador lee `distribution/addons.json`, clona o actualiza cada repo y
  ejecuta su contrato estable `scripts/install.sh`;
- la lógica interna, dependencias y lifecycle siguen siendo propiedad de cada
  addon;
- `github-accounts-local` y los overlays específicos quedan fuera del pack.

Por diseño, el catálogo general solo debería cambiar cuando se agrega o quita
un componente, o cuando cambia el orden de composición. Los cambios internos de
un addon se resuelven dentro de su propio instalador.

Racional:

- el stack base instala la capa reusable común,
- knowledge, CodeGraph y ticketing enriquecen esa base con responsabilidades separadas,
- CodeGraph centraliza runtime y consulta estructural sin centralizar los índices de cada repo,
- notifier suma capacidad aislada,
- documents agrega publicación editorial reproducible sin cargar el lifecycle en la base,
- background gobierna el runtime productivo y la UX async,
- los addons machine-local agregan políticas específicas de la máquina sin contaminar la base portable,
- los overlays locales aterrizan la especialización repo-específica encima de todo lo anterior.

## Reglas de composición

### Regla de ubicación por responsabilidad

| Si una capacidad trata de... | Dueño esperado |
|---|---|
| roles generales, permisos base, seguridad, Context7, auditoría o scaffolding de overlays | `opencode-stack` |
| memoria durable, retrieval, Engram, Qdrant, backup o sync de conocimiento | `super-turing-opencode-knowledge` |
| delegación async, foreground/background, estado o UX de tareas en segundo plano | `super-turing-opencode-background` |
| Jira, Confluence vía Rovo, comandos `/ticket-*` o handoffs `tmp/<ticket>/` | `super-turing-opencode-ticketing` |
| generación PDF/PPTX/DOCX/ODT, diagramas, render, templates o QA visual | `super-turing-opencode-documents` |
| índices estructurales, MCP CodeGraph o wrappers de init/sync/reindex | `super-turing-opencode-codegraph` |
| notificaciones nativas del sistema operativo | `super-turing-opencode-notifier` |
| identidades, aliases o rutas propias de una máquina | addon privado machine-local |
| dominio, stack, comandos o restricciones de un producto concreto | overlay local del proyecto |

Una regla descubierta en un proyecto debe subir a global solo cuando:

1. no contiene nombres, paths, dominio ni contratos propios del repo,
2. aplica a más de un proyecto o agente,
3. tiene un dueño global inequívoco según la tabla,
4. y al promoverla se elimina o reduce la copia local equivalente.

Promover no significa duplicar: el proyecto conserva únicamente el lente de
dominio que especializa la regla global.

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

## Nota específica sobre políticas machine-local

Identidades, aliases SSH, rutas o mappings propios de una máquina no deben entrar
al stack base portable. Cuando necesiten versionado y lifecycle, deben vivir en
un addon privado separado que:

- no copie tokens, claves ni credential stores,
- administre solo sus assets declarados,
- y mantenga `install`, `status` y `uninstall` propios.

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
