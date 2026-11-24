# Distribución del stack

El [instalador base](INSTALLATION.md) copia sólo archivos versionados y valida
un perfil nativo sin addons. La entrada gestiona su propio runtime fijado y no
edita `~/.config/opencode` ni una aplicación.

| Capa | Owner | Alcance |
| --- | --- | --- |
| Base gestionada | Core | Runtime oficial, roles reusables, skills, comandos, guardas y lifecycle. |
| Integraciones opt-in | Owners de addons | Dependencias, configuración, permisos y datos propios. |
| Organización | AUNE | Integraciones y reglas privadas; composición encima de general. |
| Producto | Overlay canónico | Deltas nativos y assets locales del producto, sin duplicar prompts globales. |

Para un equipo nuevo, instalá primero la base. Los addons y las capas de
organización/producto son opcionales: se preparan con el owner que administra
sus dependencias y accesos. No hay un instalador único para todas las capas.

- [Manifest de composición](COMPOSITION-MANIFEST.md)
- [Política de dependencias](DEPENDENCY-POLICY.md)
- [Playbook de overlays](PLAYBOOK-LOCAL-OVERLAYS.md)
