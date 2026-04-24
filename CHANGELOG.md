# Changelog

Todos los cambios relevantes del stack global de OpenCode deberían registrarse acá.

## [0.3.0] - 2026-04-24

### Added

- `scripts/sync-opencode-stack.sh` para sincronización incremental repo -> `~/.config/opencode/`
- backups dedicados `.stack-sync-backups/` para archivos reemplazados por sync

### Changed

- `install-opencode-stack.sh` ahora lee `managedFiles` desde `STACK-MANIFEST.json` para evitar drift
- la guía operativa ahora separa claramente bootstrap completo vs sync diario
- la versión del stack sube a `0.3.0`

### Notes

- el flujo recomendado de mantenimiento pasa a ser: editar repo -> `sync-opencode-stack.sh --status` -> `sync-opencode-stack.sh`

## [0.2.0] - 2026-04-24

### Added

- repo versionable `opencode-stack` como source of truth del entorno custom
- `README.md` de repo con layout y quickstart
- `scripts/install-engram.sh` para clonar Engram desde upstream, aplicar patch local y compilar binario reproducible
- patch versionado `patches/engram-source-agent.patch`
- metadata de componentes en `STACK-MANIFEST.json` con pin de Engram, bootstrap de Go y política Playwright

### Changed

- `scripts/install-opencode-stack.sh` ahora puede bootstrapear Engram además de npm/Playwright/config
- la versión del stack sube a `0.2.0`

### Notes

- el bootstrap automático de Go está pensado inicialmente para Linux x86_64
- la memoria persistida de Engram sigue siendo una migración separada

## [0.1.0] - 2026-04-24

### Added

- documentación del esquema efectivo de agentes con distinción entre agentes base de OpenCode y agentes custom globales
- guía de distribución portable e instalación del stack
- manifest inicial de versionado del stack
- installer inicial para copiar assets portables y renderizar `opencode.json` por máquina destino

### Notes

- esta versión inicial no empaqueta secretos ni estado persistido de Engram
- Playwright sigue configurado en modo headless/no interactivo por defecto
