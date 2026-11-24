# OpenCode Stack

Harness gestionado para OpenCode V2 oficial **2.2.7**. El perfil base instala
roles nativos, comandos, skills, guardas y helpers a partir de las fuentes
versionadas.

**Para empezar:** [instalación desde cero](INSTALLATION.md), desde el clon hasta
la primera sesión. Si querés comprobarla antes de instalar en tu usuario, la
misma guía incluye una prueba que usa un HOME temporal.

- [Mantenimiento](v2/install/README.md): plan, actualización, backups y rollback.
- [Contrato de hosting](v2/CONTRATO-GESTIONADO.md): qué admite la entrada gestionada.
- [Delegación nativa](skills/delegacion-nativa-opencode/SKILL.md): encargos a subagentes y revisión de cambios en worktrees.
- [Distribución por owners](README-DISTRIBUTION.md): base, addons y overlays.
- [Criterios para overlays locales](PLAYBOOK-LOCAL-OVERLAYS.md),
  [permisos](PLAYBOOK-PERMISSIONS.md) y [roles](README-AGENTS.md).

La instalación base funciona sin otros repos, runtimes de addons ni datos
previos. Los addons y AUNE tienen configuración y dependencias propias; no se
instalan ni habilitan implícitamente. Para una instalación V2 existente se usa
`bash install.sh plan` y `bash install.sh update --clients-closed`, no `install`.
