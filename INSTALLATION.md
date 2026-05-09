# Instalación del stack OpenCode

Esta guía está pensada para un tercero que quiere instalar el **stack base** desde este repo, empezando por un `git clone` limpio.

## Qué instala

- agentes y subagentes globales,
- commands globales,
- skills globales,
- plugins globales del stack base,
- helpers Jira/session cleanup,
- configuración MCP para Context7, Playwright y Stitch,
- documentación operativa en `~/.config/opencode/`.

## Prerrequisitos mínimos

- `opencode` ya instalado
- `git`
- `node`, `npm`, `npx`
- `python3`

## Instalación paso a paso

### 1. Clonar el repo

```bash
git clone <URL-DEL-REPO> opencode-stack
cd opencode-stack
```

### 2. Ejecutar el installer

```bash
bash scripts/install-opencode-stack.sh
```

Ese comando:

- instala dependencias npm del stack,
- instala Playwright Chromium user-space si falta,
- copia assets a `~/.config/opencode/`,
- genera `~/.config/opencode/opencode.json` con Context7 global y el resto de MCPs base según disponibilidad local,
- valida con `opencode debug config`,
- e intenta correr `stack-doctor` al final para reportar warnings/errores del entorno.

El stack base no incluye addons externos opcionales.

## Instalación completa de distribución (base + addons)

Si además querés que el mismo flujo clone/actualice e instale los addons externos recomendados, usá:

```bash
bash scripts/install-opencode-distribution.sh
```

Por defecto ese wrapper instala:

- stack base,
- `super-turing-opencode-notifier`,
- `super-turing-opencode-knowledge`,
- `super-turing-opencode-ticketing`.

El addon `super-turing-opencode-background` queda fuera del default porque no tiene un install universal honesto: requiere un checkout fuente compatible de OpenCode para aplicar su patch de host. Si lo querés incluir, el wrapper soporta:

```bash
bash scripts/install-opencode-distribution.sh \
  --with-background \
  --background-opencode-root /ruta/al/opencode-checkout
```

Y si además querés takeover sobre `~/.opencode`:

```bash
bash scripts/install-opencode-distribution.sh \
  --with-background \
  --background-opencode-root /ruta/al/opencode-checkout \
  --background-adopt-local-install \
  --background-bun-path /ruta/a/bun
```

Importante:

- `install-opencode-stack.sh` sigue siendo **base-only**,
- `sync-opencode-stack.sh` sigue siendo **base-only**,
- `install-opencode-distribution.sh` es un wrapper de orquestación para bootstrap completo, no el nuevo owner de los addons.

### 3. Completar secretos opcionales

#### Stitch

Si querés usar Stitch, crear:

```bash
mkdir -p ~/.config/opencode
printf '%s' '<TU_API_KEY_DE_STITCH>' > ~/.config/opencode/stitch-api-key
chmod 600 ~/.config/opencode/stitch-api-key
```

#### Jira helpers (solo si un proyecto los usa)

Los helpers globales de Jira **no** necesitan configuración global fija, pero los proyectos que adopten workflow Jira deben tener un `.env` compatible con:

- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

#### Context7

El MCP global de Context7 queda configurado via `npx -y @upstash/context7-mcp@latest` y sirve para documentacion actualizada de librerias/APIs.

- no requiere secreto para uso basico,
- aprovecha los prerrequisitos globales `node`/`npx` ya pedidos por el stack,
- si mas adelante queres mejores rate limits o material privado, conviene evaluar una API key local y ajustar esa integracion aparte.

## Validación básica

Después de instalar:

```bash
opencode run --command stack-doctor --agent agent-design --dir "$(pwd)" --dangerously-skip-permissions
```

Opcionalmente, correr:

```bash
opencode debug config
```

La idea es:

- el installer ya intenta ejecutar `stack-doctor`,
- y si querés revisar de nuevo después de corregir algo del entorno, corrés ese mismo comando manualmente hasta que el diagnóstico quede sano.

Si un proyecto incorpora pattern checks con Semgrep/ast-grep, la guía global de uso e integración está en:

- `PLAYBOOK-CODE-PATTERNS.md`

## Instalación en modo diagnóstico (sin escribir)

Si querés ver qué haría el installer:

```bash
bash scripts/install-opencode-stack.sh --dry-run --skip-npm-install --skip-playwright-install --no-validate
```

## Mantenimiento normal después de instalar

Una vez bootstrappeada la máquina, **no** hace falta reinstalar todo para cambios comunes.

Usar:

```bash
bash scripts/sync-opencode-stack.sh --status
bash scripts/sync-opencode-stack.sh
```

## Qué NO migra automáticamente

- `~/.cache/ms-playwright/`
- secretos fuera del repo (`stitch-api-key`, `.env` de proyectos, etc.)


## Problemas frecuentes

### `opencode debug config` expone la Stitch key resuelta

Tratar su salida como sensible.

### El repo fuente está dirty pero el activo no tiene drift

Eso significa que tu `~/.config/opencode/` ya fue sincronizado con el working tree actual, pero todavía no committeaste esos cambios en el repo fuente.
