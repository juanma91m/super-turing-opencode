# Perfil de permisos de confianza alta controlada

## Objetivo

Reducir prompts repetitivos de `allow/deny` sin convertir la instalación en un
`permission: allow` irrestricto.

## Mecanismo

`plugins/permission-autopilot.ts` aplica el perfil en dos capas:

- durante `config`, convierte los perfiles Bash con default `ask` en default
  `allow` y agrega reglas `ask` para comandos sensibles,
- conserva intactos los perfiles Bash cuyo default es `deny`,
- y mantiene `permission.ask` como segunda barrera para runtimes que ejecutan
  ese hook antes de mostrar el diálogo.

La capa de configuración es necesaria porque algunos builds de OpenCode
publican el evento de permiso sin ejecutar el hook `permission.ask`. Con este
fallback, las operaciones cotidianas se resuelven antes de crear el diálogo:

- se permiten operaciones cotidianas clasificadas como de bajo riesgo,
- se mantiene `ask` para operaciones sensibles,
- no modifica reglas que ya resolvieron en `deny`,
- y no autoaprueba permisos desconocidos.

Esto permite conservar los perfiles read-only y los overlays existentes sin
duplicar la misma lista en cada agente.

Las reglas Bash usan el orden de OpenCode: gana la última coincidencia. El
plugin coloca primero el `allow` general, después los comandos sensibles en
`ask` y al final cualquier `deny` explícito que ya existiera.

## Operaciones autoaprobadas

- Bash no clasificado como destructivo o sensible.
- Lectura, búsqueda, edición y aplicación de patches no sensibles.
- Acceso cross-repo mediante `external_directory` salvo rutas sensibles.
- LSP, skills, web fetch y gestión normal de tareas.
- Builds, tests, formatters, linters y Git cotidiano, incluido push normal cuando
  el usuario lo pidió y el rol lo permite.

La autoaprobación no reemplaza los límites del prompt: por ejemplo, un agente
que tiene prohibido hacer commit o push no recibe autorización conceptual para
hacerlo solo porque el permiso runtime sea silencioso.

## Operaciones que siguen preguntando

- `sudo`, `doas`, `pkexec`.
- `rm`, `rmdir`, `shred`.
- reset, clean, rebase, restore, branch delete, amend y force-push de Git.
- borrado, transferencia, rename/archive o mutaciones directas sensibles de
  GitHub.
- cambios de permisos/ownership del filesystem y señales a procesos.
- apagado/reinicio y cambios sensibles de servicios.
- operaciones de disco, Docker destructivo, Kubernetes delete, Helm uninstall,
  Terraform/OpenTofu apply/destroy.
- clientes de base de datos, migraciones y comandos de publicación/deploy.
- descarga remota conectada directamente a un shell.
- referencias a credenciales, SSH/GPG/AWS, config de `gh`, API keys o `.env*`.
- permisos desconocidos y `doom_loop`.

## Guardrail adicional de `.env`

`plugins/env-guard.ts` bloquea `.env*` —excepto `.env.example`— tanto en tools
de archivos como mediante Bash. Aunque el usuario aprobara manualmente un prompt,
el acceso crudo sigue bloqueado por el guard.

## Validación

Después de modificar la política:

1. ejecutar typecheck sobre ambos plugins,
2. validar casos seguros y riesgosos del clasificador,
3. sincronizar el stack,
4. ejecutar `opencode debug config` y comprobar el perfil Bash efectivo de un
   agente mutable y de uno read-only,
5. reiniciar OpenCode porque los plugins se cargan al iniciar la sesión.
