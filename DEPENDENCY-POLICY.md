# Política de dependencias externas

## Objetivo

Toda capability del ecosistema debe declarar y operar sus dependencias sin
depender de conocimiento tribal ni ejecutar cambios privilegiados sorpresivos.

## Ownership

- el stack base instala únicamente sus dependencias;
- cada addon es dueño de detectar, instalar, validar y documentar las propias;
- `distribution/addons.json` define membresía y orden, no duplica lógica de
  package managers ni versiones internas de addons.

## Categorías

### Runtime user-space administrable

Ejemplos: Quarto, Bun, Go, paquetes npm, Chromium de Playwright.

El installer debe, cuando sea razonable:

- fijar versión y origen;
- verificar checksum o usar lockfile;
- instalar sin `sudo` en un directorio addon-owned;
- no reemplazar instalaciones globales ajenas;
- exponer estado y desinstalación segura;
- aceptar un path explícito cuando el usuario ya administra el runtime.

### Aplicación o integración del sistema

Ejemplos: Docker, LibreOffice, Poppler, `wmctrl`, `xdotool`, servicios systemd.

- detectar antes de escribir;
- explicar qué capability se degrada si falta;
- no ejecutar `sudo` silenciosamente;
- instalar solo con consentimiento o flag explícito;
- permitir degradación segura cuando sea realmente opcional.

### Servicio, secreto o credencial

Ejemplos: tokens Cloud, API keys, Jira, credenciales GitHub.

- nunca inventar ni descargar credenciales;
- no imprimir secretos;
- usar prompts seguros o archivos machine-local con permisos restrictivos;
- mantener estos datos fuera de repos y bundles portables.

## Contrato de preflight

Cuando un addon expone `scripts/preflight.sh`, el orquestador lo ejecuta antes
de instalar la base. Ese preflight:

- no debe modificar el sistema;
- valida requisitos que no puede bootstrappear;
- puede aceptar una dependencia faltante si el installer demuestra que puede
  instalarla después en user-space;
- devuelve error antes de cualquier escritura si el estado no es recuperable.

## Estado actual

- Base: npm y Chromium user-space; Git/Python/Node siguen siendo bootstrap del sistema.
- Knowledge: Go y Qdrant administrados; local-only es el default portable; Docker/Cloud son opt-in.
- CodeGraph: paquete npm fijado en runtime propio.
- Ticketing: Python estándar, sin runtime adicional.
- Notifier: helpers de foco del escritorio opcionales y no privilegiados por defecto.
- Documents: Quarto/Pandoc/Typst fijado y verificado en user-space.
- Background: Bun fijado y verificado en user-space para el runtime administrado.

## Regla de cierre

Agregar una dependencia nueva exige actualizar installer, preflight, status,
documentación y pruebas del componente dueño. Declararla solo en un README no
alcanza cuando puede instalarse de forma segura y reproducible.
